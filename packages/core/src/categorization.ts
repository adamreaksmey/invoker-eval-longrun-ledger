/** Categories available to the personal ledger MVP. */
export const TRANSACTION_CATEGORIES = [
  "Food & Dining",
  "Groceries",
  "Transportation",
  "Shopping",
  "Housing",
  "Utilities",
  "Healthcare",
  "Entertainment",
  "Income",
  "Other",
] as const;

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

export interface CategorizableTransaction {
  description?: string | null;
  merchant?: string | null;
  amount?: number;
}

const RULES: ReadonlyArray<readonly [TransactionCategory, RegExp]> = [
  ["Income", /\b(payroll|salary|direct deposit|wages|refund|interest earned)\b/i],
  ["Groceries", /\b(grocery|groceries|supermarket|whole foods|trader joe|safeway|aldi|costco)\b/i],
  ["Food & Dining", /\b(restaurant|cafe|coffee|coffee shop|doordash|ubereats|grubhub|takeout|food)\b/i],
  ["Transportation", /\b(uber|lyft|taxi|gas|fuel|parking|transit|train|bus|metro)\b/i],
  ["Housing", /\b(rent|mortgage|property management)\b/i],
  ["Utilities", /\b(electric|electricity|water bill|utility|utilities|internet|phone bill)\b/i],
  ["Healthcare", /\b(pharmacy|medical|doctor|hospital|dentist|healthcare|clinic)\b/i],
  ["Entertainment", /\b(movie|cinema|theater|concert|netflix|spotify|hulu|game)\b/i],
  ["Shopping", /\b(amazon|walmart|target|store|clothing|retail|purchase)\b/i],
];

/** Assigns a category using only the transaction's text and amount. */
export function categorizeTransaction(
  transaction: CategorizableTransaction | string | null | undefined,
): TransactionCategory {
  const details = typeof transaction === "string"
    ? transaction
    : [transaction?.merchant, transaction?.description].filter(Boolean).join(" ");
  const text = details.trim();

  // Positive amounts are commonly income in ledger imports, unless the text
  // identifies a more specific merchant category.
  for (const [category, pattern] of RULES) {
    if (pattern.test(text)) return category;
  }
  if (typeof transaction === "object" && transaction !== null && transaction.amount !== undefined && transaction.amount > 0) {
    return "Income";
  }
  return "Other";
}
