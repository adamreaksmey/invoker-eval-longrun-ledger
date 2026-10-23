/** A monthly spending limit for one category, owned by one user. */
export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  month: string;
  limitCents: number;
}

/** Transactions use signed integer cents; negative amounts are expenses. */
export interface BudgetTransaction {
  id: string;
  userId: string;
  categoryId: string;
  date: string;
  amountCents: number;
}

export interface BudgetAlert {
  thresholdPercent: number;
  spentCents: number;
  limitCents: number;
  triggered: boolean;
}

export function createBudget(input: Budget): Budget {
  const id = requireText(input?.id, "Budget id");
  const userId = requireText(input?.userId, "User id");
  const categoryId = requireText(input?.categoryId, "Category id");
  const month = requireMonth(input?.month);
  validateCents(input?.limitCents, "Budget limit");
  if (input.limitCents <= 0) throw new RangeError("Budget limit must be positive");
  return { id, userId, categoryId, month, limitCents: input.limitCents };
}

/** Sum expenses for the requested user's category and UTC calendar month. */
export function calculateBudgetSpent(
  userId: string,
  categoryId: string,
  month: string,
  transactions: readonly BudgetTransaction[],
): number {
  requireText(userId, "User id");
  requireText(categoryId, "Category id");
  requireMonth(month);
  let total = 0;
  for (const transaction of transactions) {
    validateTransaction(transaction);
    if (transaction.userId !== userId || transaction.categoryId !== categoryId) continue;
    const date = new Date(transaction.date);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 7) !== month) continue;
    if (transaction.amountCents >= 0) continue;
    total -= transaction.amountCents;
    if (!Number.isSafeInteger(total)) throw new RangeError("Budget spending exceeds safe integer cents");
  }
  return total;
}

/** Whether spending has reached or exceeded a percentage of the limit. */
export function isBudgetThresholdReached(spentCents: number, limitCents: number, thresholdPercent: number): boolean {
  validateCents(spentCents, "Spent amount");
  validateCents(limitCents, "Budget limit");
  if (spentCents < 0) throw new RangeError("Spent amount cannot be negative");
  if (limitCents <= 0) throw new RangeError("Budget limit must be positive");
  if (!Number.isFinite(thresholdPercent) || thresholdPercent <= 0 || thresholdPercent > 100) {
    throw new RangeError("Threshold must be greater than 0 and at most 100 percent");
  }
  return spentCents * 100 >= limitCents * thresholdPercent;
}

/** Build an alert result for a configured percentage threshold. */
export function getBudgetAlert(
  spentCents: number,
  limitCents: number,
  thresholdPercent: number,
): BudgetAlert {
  return {
    thresholdPercent,
    spentCents,
    limitCents,
    triggered: isBudgetThresholdReached(spentCents, limitCents, thresholdPercent),
  };
}

function validateTransaction(transaction: BudgetTransaction): void {
  requireText(transaction?.id, "Transaction id");
  requireText(transaction?.userId, "User id");
  requireText(transaction?.categoryId, "Category id");
  validateCents(transaction?.amountCents, "Transaction amount");
}

function validateCents(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) throw new TypeError(`${label} must be safe integer cents`);
}

function requireMonth(value: string): string {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new TypeError("Month must use YYYY-MM format");
  }
  return value;
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${label} must be a non-empty string`);
  return value.trim();
}
