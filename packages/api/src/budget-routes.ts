import { randomUUID } from "node:crypto";
import { Router, type Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import { createBudget, type Budget } from "../../core/src/budgets";
import type { AuthenticatedRequest } from "./auth-routes";

type BudgetRow = { id: string; user_id: string; category_id: string; month: string; limit_cents: number };

/** SQLite-backed, user-scoped budget endpoints. Mount behind requireAuth. */
export function createBudgetRouter(db: DatabaseSync) {
  const router = Router();
  router.get("/", (req, res) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const month = optionalMonth(req.query.month);
    const sql = month
      ? "SELECT id, user_id, category_id, month, limit_cents FROM budgets WHERE user_id = ? AND month = ? ORDER BY category_id"
      : "SELECT id, user_id, category_id, month, limit_cents FROM budgets WHERE user_id = ? ORDER BY month, category_id";
    const rows = (month ? db.prepare(sql).all(userId, month) : db.prepare(sql).all(userId)) as unknown as BudgetRow[];
    return res.json(rows.map(toBudget));
  });

  router.post("/", (req, res) => {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;
      if (!isRecord(req.body)) throw new TypeError("Budget body must be an object");
      const budget = createBudget({ id: randomUUID(), userId, categoryId: req.body.categoryId as string, month: req.body.month as string, limitCents: req.body.limitCents as number });
      db.prepare("INSERT INTO budgets (id, user_id, category_id, month, limit_cents, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(budget.id, budget.userId, budget.categoryId, budget.month, budget.limitCents, Date.now());
      return res.status(201).json(budget);
    } catch (error) { return budgetError(res, error); }
  });

  router.get("/summary", (req, res) => {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;
      const month = requestedMonth(req.query.month);
      const rows = db.prepare("SELECT id, user_id, category_id, month, limit_cents FROM budgets WHERE user_id = ? AND month = ? ORDER BY category_id")
        .all(userId, month) as unknown as BudgetRow[];
      const budgets = rows.map(toBudget);
      const limitCents = budgets.reduce((sum, budget) => sum + budget.limitCents, 0);
      return res.json({ month, budgetCount: budgets.length, limitCents, spentCents: 0, remainingCents: limitCents, budgets: budgets.map((budget) => status(budget, 0)) });
    } catch (error) { return budgetError(res, error); }
  });

  router.get("/:id/status", (req, res) => {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;
      const row = db.prepare("SELECT id, user_id, category_id, month, limit_cents FROM budgets WHERE id = ? AND user_id = ?")
        .get(req.params.id, userId) as BudgetRow | undefined;
      if (!row) return res.status(404).json({ error: "budget not found" });
      return res.json(status(toBudget(row), 0));
    } catch (error) { return budgetError(res, error); }
  });

  router.get("/:id", (req, res) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const row = db.prepare("SELECT id, user_id, category_id, month, limit_cents FROM budgets WHERE id = ? AND user_id = ?")
      .get(req.params.id, userId) as BudgetRow | undefined;
    return row ? res.json(toBudget(row)) : res.status(404).json({ error: "budget not found" });
  });

  router.patch("/:id", (req, res) => {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;
      const existing = db.prepare("SELECT id, user_id, category_id, month, limit_cents FROM budgets WHERE id = ? AND user_id = ?")
        .get(req.params.id, userId) as BudgetRow | undefined;
      if (!existing) return res.status(404).json({ error: "budget not found" });
      if (!isRecord(req.body)) throw new TypeError("Budget body must be an object");
      const budget = createBudget({ ...toBudget(existing), ...req.body, id: existing.id, userId });
      db.prepare("UPDATE budgets SET category_id = ?, month = ?, limit_cents = ? WHERE id = ? AND user_id = ?")
        .run(budget.categoryId, budget.month, budget.limitCents, budget.id, userId);
      return res.json(budget);
    } catch (error) { return budgetError(res, error); }
  });

  router.delete("/:id", (req, res) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const result = db.prepare("DELETE FROM budgets WHERE id = ? AND user_id = ?").run(req.params.id, userId);
    return result.changes ? res.status(204).end() : res.status(404).json({ error: "budget not found" });
  });
  return router;
}

function toBudget(row: BudgetRow): Budget {
  return createBudget({ id: row.id, userId: row.user_id, categoryId: row.category_id, month: row.month, limitCents: Number(row.limit_cents) });
}

function status(budget: Budget, spentCents: number) {
  return { ...budget, spentCents, remainingCents: Math.max(0, budget.limitCents - spentCents), percentUsed: budget.limitCents === 0 ? 0 : Math.round(spentCents * 100 / budget.limitCents) };
}

function optionalMonth(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return requestedMonth(value);
}

function requestedMonth(value: unknown): string {
  if (typeof value !== "string") throw new TypeError("month query parameter must use YYYY-MM format");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new TypeError("Month must use YYYY-MM format");
  return value;
}

function budgetError(res: Response, error: unknown) {
  if (error instanceof TypeError || error instanceof RangeError) return res.status(400).json({ error: error.message });
  if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) return res.status(409).json({ error: "a budget already exists for this category and month" });
  return res.status(500).json({ error: "internal server error" });
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
