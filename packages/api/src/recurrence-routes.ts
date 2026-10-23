import { randomUUID } from "node:crypto";
import { Router, type Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import { getNextRunDate, type RecurrenceSchedule, type RecurringTransaction } from "../../core/src/recurrence";
import type { Ledger } from "../../core/src/ledger";
import type { AuthenticatedRequest } from "./auth-routes";

type RuleRow = { id: string; user_id: string; account_id: string; amount_cents: number; description: string | null; start_date: string; schedule_json: string };
type AppliedRow = { occurrence_date: string; transaction_id: string };

/** SQLite-backed, user-scoped recurrence endpoints. Mount behind requireAuth. */
export function createRecurrenceRouter(db: DatabaseSync, ledgerFor: (req: AuthenticatedRequest) => Ledger) {
  const router = Router();

  router.get("/", (req, res) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const rows = db.prepare("SELECT id, user_id, account_id, amount_cents, description, start_date, schedule_json FROM recurrence_rules WHERE user_id = ? ORDER BY created_at, id")
      .all(userId) as unknown as RuleRow[];
    return res.json(rows.map(toRule));
  });

  router.post("/", (req, res) => {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;
      const input = record(req.body, "Recurrence body must be an object");
      const rule = parseRule({ ...input, id: randomUUID(), userId });
      db.prepare("INSERT INTO recurrence_rules (id, user_id, account_id, amount_cents, description, start_date, schedule_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(rule.id, userId, rule.accountId, rule.amountCents, rule.description ?? null, rule.startDate, JSON.stringify(rule.schedule), Date.now());
      return res.status(201).json(rule);
    } catch (error) { return recurrenceError(res, error); }
  });

  router.post("/apply-due", (req, res) => {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;
      const body = req.body === undefined ? {} : record(req.body, "Apply-due body must be an object");
      const asOf = body.asOf === undefined ? new Date().toISOString().slice(0, 10) : body.asOf as string;
      validateDate(asOf);
      const rules = db.prepare("SELECT id, user_id, account_id, amount_cents, description, start_date, schedule_json FROM recurrence_rules WHERE user_id = ? ORDER BY id")
        .all(userId) as unknown as RuleRow[];
      const applied: Array<{ ruleId: string; transactionId: string; date: string }> = [];
      const ledger = ledgerFor(req as AuthenticatedRequest);
      for (const row of rules) {
        const rule = toRule(row);
        const last = db.prepare("SELECT occurrence_date, transaction_id FROM recurrence_applications WHERE user_id = ? AND rule_id = ? ORDER BY occurrence_date DESC LIMIT 1")
          .get(userId, rule.id) as AppliedRow | undefined;
        let cursor = last?.occurrence_date ?? previousDate(rule.startDate);
        for (let count = 0; count < 1000; count += 1) {
          const date = getNextRunDate(rule, cursor);
          if (date > asOf) break;
          const transactionId = `${rule.id}:${date}`;
          // The primary key and deterministic transaction id make repeated calls safe.
          const inserted = db.prepare("INSERT OR IGNORE INTO recurrence_applications (user_id, rule_id, occurrence_date, transaction_id) VALUES (?, ?, ?, ?)")
            .run(userId, rule.id, date, transactionId);
          if (Number(inserted.changes) > 0) {
            try {
              ledger.addTransaction({ id: transactionId, accountId: rule.accountId, amountCents: rule.amountCents, description: rule.description });
            } catch (error) {
              db.prepare("DELETE FROM recurrence_applications WHERE user_id = ? AND rule_id = ? AND occurrence_date = ?").run(userId, rule.id, date);
              throw error;
            }
            applied.push({ ruleId: rule.id, transactionId, date });
          }
          cursor = date;
          if (count === 999) throw new RangeError("Apply-due is limited to 1000 occurrences per rule per request");
        }
      }
      return res.json({ asOf, applied });
    } catch (error) { return recurrenceError(res, error); }
  });

  router.get("/:id", (req, res) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const row = findRule(db, req.params.id, userId);
    return row ? res.json(toRule(row)) : res.status(404).json({ error: "recurrence rule not found" });
  });

  router.patch("/:id", (req, res) => {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;
      const existing = findRule(db, req.params.id, userId);
      if (!existing) return res.status(404).json({ error: "recurrence rule not found" });
      const input = record(req.body, "Recurrence body must be an object");
      const rule = parseRule({ ...toRule(existing), ...input, id: existing.id, userId });
      db.prepare("UPDATE recurrence_rules SET account_id = ?, amount_cents = ?, description = ?, start_date = ?, schedule_json = ? WHERE id = ? AND user_id = ?")
        .run(rule.accountId, rule.amountCents, rule.description ?? null, rule.startDate, JSON.stringify(rule.schedule), rule.id, userId);
      return res.json(rule);
    } catch (error) { return recurrenceError(res, error); }
  });

  router.delete("/:id", (req, res) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const result = db.prepare("DELETE FROM recurrence_rules WHERE id = ? AND user_id = ?").run(req.params.id, userId);
    return result.changes ? res.status(204).end() : res.status(404).json({ error: "recurrence rule not found" });
  });
  return router;
}

function findRule(db: DatabaseSync, id: string, userId: string): RuleRow | undefined {
  return db.prepare("SELECT id, user_id, account_id, amount_cents, description, start_date, schedule_json FROM recurrence_rules WHERE id = ? AND user_id = ?")
    .get(id, userId) as RuleRow | undefined;
}
function toRule(row: RuleRow): RecurringTransaction { return { id: row.id, accountId: row.account_id, amountCents: Number(row.amount_cents), ...(row.description ? { description: row.description } : {}), startDate: row.start_date, schedule: JSON.parse(row.schedule_json) as RecurrenceSchedule }; }
function parseRule(input: Record<string, unknown>): RecurringTransaction {
  const rule = { id: input.id as string, accountId: input.accountId as string, amountCents: input.amountCents as number, ...(input.description === undefined ? {} : { description: input.description as string }), startDate: input.startDate as string, schedule: input.schedule as RecurrenceSchedule };
  // Domain validation is performed by asking for the first occurrence.
  getNextRunDate(rule, previousDate(rule.startDate));
  if (input.description !== undefined && typeof input.description !== "string") throw new TypeError("Description must be a string");
  return rule;
}
function previousDate(date: string): string { validateDate(date); const d = new Date(`${date}T00:00:00.000Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); }
function validateDate(date: unknown): asserts date is string { if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) throw new TypeError("Date must be a valid YYYY-MM-DD UTC date"); }
function record(value: unknown, message: string): Record<string, unknown> { if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError(message); return value as Record<string, unknown>; }
function recurrenceError(res: Response, error: unknown) {
  if (error instanceof TypeError || error instanceof RangeError) return res.status(400).json({ error: error.message });
  if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) return res.status(409).json({ error: "recurrence occurrence already exists" });
  if (error instanceof Error && /Unknown account/.test(error.message)) return res.status(404).json({ error: error.message });
  return res.status(500).json({ error: "internal server error" });
}
