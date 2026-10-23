import type { Transaction } from "../../core/src";

const HEADERS = ["id", "accountId", "amountCents", "description"] as const;

/** Serialize ledger transactions as CSV suitable for download or spreadsheet import. */
export function transactionsToCsv(transactions: readonly Transaction[]): string {
  const rows = [HEADERS.join(",")];
  for (const transaction of transactions) {
    rows.push([
      csvCell(transaction.id),
      csvCell(transaction.accountId),
      csvCell(String(transaction.amountCents), false),
      csvCell(transaction.description ?? ""),
    ].join(","));
  }
  return `${rows.join("\r\n")}\r\n`;
}

function csvCell(value: string, protectFormula = true): string {
  // Prevent spreadsheet applications from interpreting user controlled text as a formula.
  const safe = protectFormula && /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
