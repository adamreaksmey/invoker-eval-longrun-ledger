import { createLedger, type Account, type Transaction } from "../../core/src";
import { DatabaseSync } from "node:sqlite";

/** Small persistence boundary used by the API. Core remains the source of validation rules. */
export class LedgerDatabase {
  private readonly sqlite = new DatabaseSync(":memory:");
  private ledger = createLedger();
  private accounts: Account[] = [];
  private transactions: Transaction[] = [];

  constructor() {
    this.sqlite.exec("PRAGMA foreign_keys = ON");
    this.sqlite.exec("CREATE TABLE accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL)");
    this.sqlite.exec("CREATE TABLE transactions (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), amount_cents INTEGER NOT NULL, description TEXT)");
  }

  listAccounts(): Account[] {
    return this.sqlite.prepare("SELECT id, name FROM accounts ORDER BY rowid").all() as Account[];
  }

  getAccount(id: string): Account | undefined {
    return this.sqlite.prepare("SELECT id, name FROM accounts WHERE id = ?").get(id) as Account | undefined;
  }

  createAccount(account: Account): Account {
    const saved = this.ledger.addAccount(account);
    this.accounts.push(saved);
    this.sqlite.prepare("INSERT INTO accounts (id, name) VALUES (?, ?)").run(saved.id, saved.name);
    return saved;
  }

  updateAccount(id: string, name: string): Account | undefined {
    if (!this.ledger.getAccount(id)) return undefined;
    const next = this.accounts.map((account) => account.id === id ? { id, name } : account);
    this.rebuild(next, this.transactions);
    this.persist();
    return this.getAccount(id);
  }

  deleteAccount(id: string): boolean {
    if (!this.ledger.getAccount(id)) return false;
    if (this.transactions.some((transaction) => transaction.accountId === id)) {
      throw new Error("Cannot delete an account with transactions");
    }
    this.rebuild(this.accounts.filter((account) => account.id !== id), this.transactions);
    this.persist();
    return true;
  }

  listTransactions(accountId?: string): Transaction[] {
    const rows = accountId === undefined
      ? this.sqlite.prepare("SELECT id, account_id AS accountId, amount_cents AS amountCents, description FROM transactions ORDER BY rowid").all()
      : this.sqlite.prepare("SELECT id, account_id AS accountId, amount_cents AS amountCents, description FROM transactions WHERE account_id = ? ORDER BY rowid").all(accountId);
    return rows.map((row: any) => ({ ...row, ...(row.description == null ? { description: undefined } : {}) })) as Transaction[];
  }

  getTransaction(id: string): Transaction | undefined {
    const row = this.sqlite.prepare("SELECT id, account_id AS accountId, amount_cents AS amountCents, description FROM transactions WHERE id = ?").get(id) as any;
    return row ? { ...row, ...(row.description == null ? { description: undefined } : {}) } as Transaction : undefined;
  }

  createTransaction(transaction: Transaction): Transaction {
    const saved = this.ledger.addTransaction(transaction);
    this.transactions.push(saved);
    this.sqlite.prepare("INSERT INTO transactions (id, account_id, amount_cents, description) VALUES (?, ?, ?, ?)").run(saved.id, saved.accountId, saved.amountCents, saved.description ?? null);
    return saved;
  }

  updateTransaction(id: string, transaction: Omit<Transaction, "id">): Transaction | undefined {
    if (!this.getTransaction(id)) return undefined;
    const next = this.transactions.map((saved) => saved.id === id ? { ...transaction, id } : saved);
    this.rebuild(this.accounts, next);
    this.persist();
    return this.getTransaction(id);
  }

  deleteTransaction(id: string): boolean {
    if (!this.getTransaction(id)) return false;
    this.rebuild(this.accounts, this.transactions.filter((transaction) => transaction.id !== id));
    this.persist();
    return true;
  }

  getBalance(accountId: string): number {
    return this.ledger.getBalance(accountId);
  }

  private rebuild(accounts: Account[], transactions: Transaction[]): void {
    const nextLedger = createLedger();
    for (const account of accounts) nextLedger.addAccount(account);
    for (const transaction of transactions) nextLedger.addTransaction(transaction);
    this.accounts = accounts.map((account) => ({ ...account }));
    this.transactions = transactions.map((transaction) => ({ ...transaction }));
    this.ledger = nextLedger;
  }

  private persist(): void {
    this.sqlite.exec("BEGIN");
    try {
      this.sqlite.exec("DELETE FROM transactions");
      this.sqlite.exec("DELETE FROM accounts");
      const addAccount = this.sqlite.prepare("INSERT INTO accounts (id, name) VALUES (?, ?)");
      const addTransaction = this.sqlite.prepare("INSERT INTO transactions (id, account_id, amount_cents, description) VALUES (?, ?, ?, ?)");
      for (const account of this.accounts) addAccount.run(account.id, account.name);
      for (const transaction of this.transactions) addTransaction.run(transaction.id, transaction.accountId, transaction.amountCents, transaction.description ?? null);
      this.sqlite.exec("COMMIT");
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

export function createDatabase(): LedgerDatabase {
  return new LedgerDatabase();
}
