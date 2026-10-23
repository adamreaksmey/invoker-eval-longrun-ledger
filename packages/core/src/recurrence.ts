/** A recurrence is evaluated against UTC calendar dates (`YYYY-MM-DD`). */
export type RecurrenceSchedule =
  | { frequency: "weekly"; interval?: number; weekdays: readonly number[] }
  | { frequency: "monthly"; interval?: number; dayOfMonth: number }
  | { frequency: "custom"; interval: number; unit: "days" | "weeks" | "months" };

export interface RecurringTransaction {
  id: string;
  accountId: string;
  amountCents: number;
  description?: string;
  startDate: string;
  schedule: RecurrenceSchedule;
}

export interface TransactionPreview {
  id: string;
  accountId: string;
  amountCents: number;
  date: string;
  description?: string;
}

/** Return the first scheduled UTC date strictly after `afterDate`. */
export function getNextRunDate(rule: RecurringTransaction, afterDate: string): string {
  validateRule(rule);
  const after = parseDate(afterDate, "After date");
  const start = parseDate(rule.startDate, "Start date");
  const from = Math.max(start.getTime(), after.getTime() + DAY_MS);
  const candidate = new Date(from);

  if (rule.schedule.frequency === "weekly") {
    const interval = rule.schedule.interval ?? 1;
    const weekdays = rule.schedule.weekdays;
    for (let i = 0; i < MAX_SEARCH_DAYS; i += 1) {
      const date = addDays(candidate, i);
      const daysFromStart = Math.floor((date.getTime() - start.getTime()) / DAY_MS);
      if (weekdays.includes(date.getUTCDay()) && Math.floor(daysFromStart / 7) % interval === 0) return formatDate(date);
    }
  } else if (rule.schedule.frequency === "monthly") {
    const interval = rule.schedule.interval ?? 1;
    for (let i = 0; i < MAX_SEARCH_MONTHS; i += 1) {
      const monthIndex = start.getUTCFullYear() * 12 + start.getUTCMonth() + i;
      if (i % interval !== 0) continue;
      const year = Math.floor(monthIndex / 12);
      const month = monthIndex % 12;
      const day = Math.min(rule.schedule.dayOfMonth, daysInMonth(year, month));
      const date = new Date(Date.UTC(year, month, day));
      if (date.getTime() >= from) return formatDate(date);
    }
  } else {
    const { interval, unit } = rule.schedule;
    for (let i = 0; i < MAX_SEARCH_DAYS; i += 1) {
      const date = unit === "days" ? addDays(start, i * interval)
        : unit === "weeks" ? addDays(start, i * interval * 7)
          : addMonths(start, i * interval);
      if (date.getTime() >= from) return formatDate(date);
    }
  }
  throw new RangeError("Could not find a recurrence date within the supported search window");
}

/** Materialize the next `count` scheduled occurrences as transaction previews. */
export function previewRecurringTransactions(rule: RecurringTransaction, count: number, afterDate = previousDate(rule?.startDate)): TransactionPreview[] {
  validateRule(rule);
  if (!Number.isSafeInteger(count) || count < 0 || count > 10_000) throw new RangeError("Preview count must be an integer from 0 to 10000");
  let cursor = parseDate(afterDate, "After date");
  const previews: TransactionPreview[] = [];
  for (let index = 0; index < count; index += 1) {
    const date = getNextRunDate(rule, formatDate(cursor));
    previews.push({
      id: `${rule.id}:${date}`,
      accountId: rule.accountId,
      amountCents: rule.amountCents,
      date,
      ...(rule.description?.trim() ? { description: rule.description.trim() } : {}),
    });
    cursor = parseDate(date, "Generated date");
  }
  return previews;
}

const DAY_MS = 86_400_000;
const MAX_SEARCH_DAYS = 366_000;
const MAX_SEARCH_MONTHS = 120_000;

function validateRule(rule: RecurringTransaction): void {
  requireText(rule?.id, "Rule id");
  requireText(rule?.accountId, "Account id");
  if (!Number.isSafeInteger(rule?.amountCents) || rule.amountCents === 0) throw new TypeError("Amount must be non-zero safe integer cents");
  parseDate(rule.startDate, "Start date");
  const schedule = rule.schedule;
  if (!schedule || !["weekly", "monthly", "custom"].includes(schedule.frequency)) throw new TypeError("Invalid recurrence frequency");
  if (schedule.frequency === "weekly") {
    validateInterval(schedule.interval ?? 1);
    if (!Array.isArray(schedule.weekdays) || schedule.weekdays.length === 0 || schedule.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      throw new TypeError("Weekly weekdays must contain UTC day numbers from 0 to 6");
    }
  } else if (schedule.frequency === "monthly") {
    validateInterval(schedule.interval ?? 1);
    if (!Number.isInteger(schedule.dayOfMonth) || schedule.dayOfMonth < 1 || schedule.dayOfMonth > 31) throw new RangeError("Monthly day must be from 1 to 31");
  } else {
    validateInterval(schedule.interval);
    if (!["days", "weeks", "months"].includes(schedule.unit)) throw new TypeError("Custom unit must be days, weeks, or months");
  }
}

function validateInterval(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError("Recurrence interval must be a positive integer");
}

function parseDate(value: string, label: string): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError(`${label} must use YYYY-MM-DD UTC format`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || formatDate(date) !== value) throw new TypeError(`${label} must be a valid UTC calendar date`);
  return date;
}

function formatDate(date: Date): string { return date.toISOString().slice(0, 10); }
function addDays(date: Date, days: number): Date { return new Date(date.getTime() + days * DAY_MS); }
function previousDate(date: string | undefined): string {
  const parsed = parseDate(date as string, "Start date");
  return formatDate(addDays(parsed, -1));
}
function addMonths(date: Date, months: number): Date {
  const target = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const year = Math.floor(target / 12);
  const month = target % 12;
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), daysInMonth(year, month))));
}
function daysInMonth(year: number, month: number): number { return new Date(Date.UTC(year, month + 1, 0)).getUTCDate(); }
function requireText(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${label} must be a non-empty string`);
  return value.trim();
}
