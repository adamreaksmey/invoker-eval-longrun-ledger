import { describe, expect, it } from "vitest";
import { calculateBudgetSpent, createBudget, getBudgetAlert, isBudgetThresholdReached } from "./budgets";

describe("budgets", () => {
  it("creates validated monthly category limits in integer cents", () => {
    expect(createBudget({ id: "food-jan", userId: "alice", categoryId: "food", month: "2026-01", limitCents: 45_000 }))
      .toEqual({ id: "food-jan", userId: "alice", categoryId: "food", month: "2026-01", limitCents: 45_000 });
    expect(() => createBudget({ id: "x", userId: "alice", categoryId: "food", month: "2026-13", limitCents: 100 })).toThrow(/YYYY-MM/);
    expect(() => createBudget({ id: "x", userId: "alice", categoryId: "food", month: "2026-01", limitCents: 1.2 })).toThrow(/integer cents/);
    expect(() => createBudget({ id: "x", userId: "alice", categoryId: "food", month: "2026-01", limitCents: 0 })).toThrow(/positive/);
  });

  it("calculates expenses for only the requested user, category, and UTC month", () => {
    const transactions = [
      { id: "a", userId: "alice", categoryId: "food", date: "2026-01-02T12:00:00Z", amountCents: -1_250 },
      { id: "b", userId: "alice", categoryId: "food", date: "2026-01-31T23:30:00-02:00", amountCents: -2_000 },
      { id: "income", userId: "alice", categoryId: "food", date: "2026-01-10", amountCents: 5_000 },
      { id: "other-user", userId: "bob", categoryId: "food", date: "2026-01-10", amountCents: -9_000 },
      { id: "other-category", userId: "alice", categoryId: "rent", date: "2026-01-10", amountCents: -8_000 },
      { id: "next-month", userId: "alice", categoryId: "food", date: "2026-02-01", amountCents: -7_000 },
    ];
    // The offset timestamp lands in February in UTC, so only the first expense counts.
    expect(calculateBudgetSpent("alice", "food", "2026-01", transactions)).toBe(1_250);
  });

  it("reports threshold crossings at and above the configured percentage", () => {
    expect(isBudgetThresholdReached(7_499, 10_000, 75)).toBe(false);
    expect(isBudgetThresholdReached(7_500, 10_000, 75)).toBe(true);
    expect(isBudgetThresholdReached(10_100, 10_000, 100)).toBe(true);
    expect(getBudgetAlert(8_000, 10_000, 80)).toEqual({ thresholdPercent: 80, spentCents: 8_000, limitCents: 10_000, triggered: true });
    expect(() => isBudgetThresholdReached(10, 100, 0)).toThrow(/Threshold/);
  });
});
