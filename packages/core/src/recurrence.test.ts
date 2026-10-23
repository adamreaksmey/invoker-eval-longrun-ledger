import { describe, expect, it } from "vitest";
import { getNextRunDate, previewRecurringTransactions, type RecurringTransaction } from "./recurrence";

// All dates below are UTC calendar dates; recurrence boundaries never use the machine's local timezone.
describe("recurrence", () => {
  const base: RecurringTransaction = {
    id: "rent", accountId: "checking", amountCents: -125_000,
    description: "  Monthly rent  ", startDate: "2026-01-01",
    schedule: { frequency: "weekly", weekdays: [1, 3] },
  };

  it("finds weekly dates after the cursor and applies interval weeks", () => {
    expect(getNextRunDate(base, "2026-01-04")).toBe("2026-01-05");
    expect(getNextRunDate({ ...base, schedule: { frequency: "weekly", interval: 2, weekdays: [1] } }, "2026-01-05"))
      .toBe("2026-01-19");
  });

  it("clamps monthly dates to the final UTC day of short months", () => {
    const monthly = { ...base, startDate: "2026-01-31", schedule: { frequency: "monthly" as const, dayOfMonth: 31 } };
    expect(getNextRunDate(monthly, "2026-01-31")).toBe("2026-02-28");
    expect(getNextRunDate(monthly, "2026-02-28")).toBe("2026-03-31");
  });

  it("supports custom day, week, and month intervals", () => {
    expect(getNextRunDate({ ...base, schedule: { frequency: "custom", interval: 3, unit: "days" } }, "2026-01-01"))
      .toBe("2026-01-04");
    expect(getNextRunDate({ ...base, schedule: { frequency: "custom", interval: 2, unit: "weeks" } }, "2026-01-01"))
      .toBe("2026-01-15");
    expect(getNextRunDate({ ...base, startDate: "2026-01-31", schedule: { frequency: "custom", interval: 1, unit: "months" } }, "2026-01-31"))
      .toBe("2026-02-28");
    expect(getNextRunDate({ ...base, startDate: "2026-01-31", schedule: { frequency: "custom", interval: 1, unit: "months" } }, "2026-02-28"))
      .toBe("2026-03-31");
  });

  it("materializes deterministic transaction previews without mutating the rule", () => {
    const previews = previewRecurringTransactions(base, 3, "2026-01-04");
    expect(previews).toEqual([
      { id: "rent:2026-01-05", accountId: "checking", amountCents: -125_000, date: "2026-01-05", description: "Monthly rent" },
      { id: "rent:2026-01-07", accountId: "checking", amountCents: -125_000, date: "2026-01-07", description: "Monthly rent" },
      { id: "rent:2026-01-12", accountId: "checking", amountCents: -125_000, date: "2026-01-12", description: "Monthly rent" },
    ]);
    expect(base.startDate).toBe("2026-01-01");
  });

  it("validates dates and recurrence settings", () => {
    expect(() => getNextRunDate(base, "2026-02-30")).toThrow(/valid UTC calendar date/);
    expect(() => getNextRunDate({ ...base, schedule: { frequency: "monthly", dayOfMonth: 0 } }, "2026-01-01")).toThrow(/day/);
    expect(() => previewRecurringTransactions(base, -1)).toThrow(/Preview count/);
  });
});
