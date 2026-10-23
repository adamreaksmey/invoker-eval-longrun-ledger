/** A ledger row as consumed by the pure reporting helpers.
 * Amounts use the ledger's signed convention: credits are positive and debits
 * are negative. Dates may be ISO strings or Date instances.
 */
export interface ReportEntry {
  amount: number;
  date: string | Date;
  category?: string | null;
}

export interface ReportTotals {
  income: number;
  expenses: number;
  net: number;
}

export interface CategoryReport extends ReportTotals {
  category: string;
  count: number;
}

export interface MonthlyReport extends ReportTotals {
  month: string;
  count: number;
}

export interface LedgerReport extends ReportTotals {
  count: number;
  byCategory: CategoryReport[];
  byMonth: MonthlyReport[];
}

function monthKey(date: string | Date): string {
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) throw new RangeError(`Invalid report date: ${String(date)}`);
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addAmount(totals: ReportTotals, amount: number): void {
  if (!Number.isFinite(amount)) throw new RangeError("Report amounts must be finite numbers");
  if (amount >= 0) totals.income += amount;
  else totals.expenses += Math.abs(amount);
  totals.net += amount;
}

/** Builds a deterministic summary of signed ledger entries. */
export function buildLedgerReport(entries: readonly ReportEntry[]): LedgerReport {
  const report: LedgerReport = { income: 0, expenses: 0, net: 0, count: entries.length, byCategory: [], byMonth: [] };
  const categories = new Map<string, CategoryReport>();
  const months = new Map<string, MonthlyReport>();

  for (const entry of entries) {
    // Validate dates and amounts even when a row has no category.
    const month = monthKey(entry.date);
    if (!Number.isFinite(entry.amount)) throw new RangeError("Report amounts must be finite numbers");
    addAmount(report, entry.amount);

    const category = entry.category?.trim() || "Uncategorized";
    let categoryReport = categories.get(category);
    if (!categoryReport) {
      categoryReport = { category, income: 0, expenses: 0, net: 0, count: 0 };
      categories.set(category, categoryReport);
    }
    categoryReport.count += 1;
    addAmount(categoryReport, entry.amount);

    let monthlyReport = months.get(month);
    if (!monthlyReport) {
      monthlyReport = { month, income: 0, expenses: 0, net: 0, count: 0 };
      months.set(month, monthlyReport);
    }
    monthlyReport.count += 1;
    addAmount(monthlyReport, entry.amount);
  }

  report.byCategory = [...categories.values()].sort((a, b) => a.category.localeCompare(b.category));
  report.byMonth = [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
  return report;
}

export function summarizeLedger(entries: readonly ReportEntry[]): ReportTotals {
  const { income, expenses, net } = buildLedgerReport(entries);
  return { income, expenses, net };
}

export function reportByCategory(entries: readonly ReportEntry[]): CategoryReport[] {
  return buildLedgerReport(entries).byCategory;
}

export function reportByMonth(entries: readonly ReportEntry[]): MonthlyReport[] {
  return buildLedgerReport(entries).byMonth;
}
