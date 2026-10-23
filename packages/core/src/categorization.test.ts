import { describe, expect, it } from "vitest";
import { categorizeTransaction, TRANSACTION_CATEGORIES } from "./categorization";

describe("categorizeTransaction", () => {
  it("categorizes common merchant and description text without regard to case", () => {
    expect(categorizeTransaction({ merchant: "Whole Foods Market" })).toBe("Groceries");
    expect(categorizeTransaction("MONTHLY NETFLIX SUBSCRIPTION")).toBe("Entertainment");
    expect(categorizeTransaction({ description: "Rent payment" })).toBe("Housing");
  });

  it("uses amount as an income fallback and unknown text as Other", () => {
    expect(categorizeTransaction({ description: "Transfer", amount: 125 })).toBe("Income");
    expect(categorizeTransaction({ description: "Transfer", amount: -125 })).toBe("Other");
    expect(categorizeTransaction(undefined)).toBe("Other");
  });

  it("exports the supported category set", () => {
    expect(TRANSACTION_CATEGORIES).toContain("Other");
  });
});
