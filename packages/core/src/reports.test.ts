import { describe, expect, it } from "vitest";
import { buildLedgerReport, reportByCategory, reportByMonth, summarizeLedger } from "./reports";

describe("ledger reports", () => {
  const entries = [
    { date: "2025-02-02", amount: 1200, category: "Salary" },
    { date: "2025-02-03", amount: -45, category: "Food" },
    { date: "2025-01-04", amount: -25, category: "Food" },
    { date: new Date("2025-02-12T00:00:00Z"), amount: -10 },
  ];

  it("summarizes signed amounts and counts", () => {
    expect(buildLedgerReport(entries)).toEqual({
      income: 1200,
      expenses: 80,
      net: 1120,
      count: 4,
      byCategory: [
        { category: "Food", income: 0, expenses: 70, net: -70, count: 2 },
        { category: "Salary", income: 1200, expenses: 0, net: 1200, count: 1 },
        { category: "Uncategorized", income: 0, expenses: 10, net: -10, count: 1 },
      ],
      byMonth: [
        { month: "2025-01", income: 0, expenses: 25, net: -25, count: 1 },
        { month: "2025-02", income: 1200, expenses: 55, net: 1145, count: 3 },
      ],
    });
  });

  it("exposes focused summaries and handles empty input", () => {
    expect(summarizeLedger(entries)).toEqual({ income: 1200, expenses: 80, net: 1120 });
    expect(reportByCategory(entries)).toHaveLength(3);
    expect(reportByMonth(entries)).toHaveLength(2);
    expect(buildLedgerReport([])).toEqual({ income: 0, expenses: 0, net: 0, count: 0, byCategory: [], byMonth: [] });
  });

  it("rejects invalid amounts and dates", () => {
    expect(() => buildLedgerReport([{ date: "2025-01-01", amount: Infinity }])).toThrow(RangeError);
    expect(() => buildLedgerReport([{ date: "bad-date", amount: 1 }])).toThrow(RangeError);
  });
});
