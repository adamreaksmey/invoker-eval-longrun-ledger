export type Account = {
  id: string;
  name: string;
  balanceCents: number;
};

export type Transaction = {
  id: string;
  type: 'deposit' | 'withdrawal' | 'transfer';
  amountCents: number;
  fromAccountId?: string;
  toAccountId?: string;
  createdAt: Date;
};

export type CreateAccountInput = { id: string; name: string };

/** A simple in-memory ledger. All monetary values are integer cents. */
export class Ledger {
  private readonly accounts = new Map<string, Account>();
  private readonly entries: Transaction[] = [];
  private nextTransactionId = 1;

  createAccount({ id, name }: CreateAccountInput): Account {
    if (!id.trim()) throw new Error('Account id is required');
    if (!name.trim()) throw new Error('Account name is required');
    if (this.accounts.has(id)) throw new Error(`Account already exists: ${id}`);

    const account = { id, name, balanceCents: 0 };
    this.accounts.set(id, account);
    return { ...account };
  }

  getAccount(accountId: string): Account {
    const account = this.accounts.get(accountId);
    if (!account) throw new Error(`Account not found: ${accountId}`);
    return { ...account };
  }

  getBalance(accountId: string): number {
    return this.getAccount(accountId).balanceCents;
  }

  getTransactions(accountId?: string): Transaction[] {
    const items = accountId === undefined
      ? this.entries
      : this.entries.filter((entry) => entry.fromAccountId === accountId || entry.toAccountId === accountId);
    return items.map((entry) => ({ ...entry, createdAt: new Date(entry.createdAt) }));
  }

  deposit(accountId: string, amountCents: number): Transaction {
    this.validateAmount(amountCents);
    const account = this.requireAccount(accountId);
    this.ensureSafeBalance(account.balanceCents + amountCents);
    account.balanceCents += amountCents;
    return this.record({ type: 'deposit', amountCents, toAccountId: accountId });
  }

  withdraw(accountId: string, amountCents: number): Transaction {
    this.validateAmount(amountCents);
    const account = this.requireAccount(accountId);
    if (account.balanceCents < amountCents) throw new Error('Insufficient funds');
    account.balanceCents -= amountCents;
    return this.record({ type: 'withdrawal', amountCents, fromAccountId: accountId });
  }

  transfer(fromAccountId: string, toAccountId: string, amountCents: number): Transaction {
    this.validateAmount(amountCents);
    if (fromAccountId === toAccountId) throw new Error('Cannot transfer to the same account');
    const from = this.requireAccount(fromAccountId);
    const to = this.requireAccount(toAccountId);
    if (from.balanceCents < amountCents) throw new Error('Insufficient funds');
    this.ensureSafeBalance(to.balanceCents + amountCents);

    from.balanceCents -= amountCents;
    to.balanceCents += amountCents;
    return this.record({ type: 'transfer', amountCents, fromAccountId, toAccountId });
  }

  private requireAccount(accountId: string): Account {
    const account = this.accounts.get(accountId);
    if (!account) throw new Error(`Account not found: ${accountId}`);
    return account;
  }

  private validateAmount(amountCents: number): void {
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      throw new Error('Amount must be a positive safe integer number of cents');
    }
  }

  private ensureSafeBalance(balanceCents: number): void {
    if (!Number.isSafeInteger(balanceCents)) throw new Error('Balance exceeds safe integer range');
  }

  private record(input: Omit<Transaction, 'id' | 'createdAt'>): Transaction {
    const transaction: Transaction = {
      ...input,
      id: `txn_${this.nextTransactionId++}`,
      createdAt: new Date(),
    };
    this.entries.push(transaction);
    return { ...transaction, createdAt: new Date(transaction.createdAt) };
  }
}
