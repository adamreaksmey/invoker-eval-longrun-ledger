import { describe, expect, it } from 'vitest';
import { Ledger } from './ledger';

describe('Ledger', () => {
  it('creates accounts with zero balances and returns copies', () => {
    const ledger = new Ledger();
    const account = ledger.createAccount({ id: 'checking', name: 'Checking' });
    account.balanceCents = 100;
    expect(ledger.getBalance('checking')).toBe(0);
  });

  it('records deposits, withdrawals, and resulting balances in cents', () => {
    const ledger = new Ledger();
    ledger.createAccount({ id: 'a', name: 'A' });
    const deposit = ledger.deposit('a', 1250);
    const withdrawal = ledger.withdraw('a', 250);

    expect(ledger.getBalance('a')).toBe(1000);
    expect(deposit.amountCents).toBe(1250);
    expect(withdrawal.type).toBe('withdrawal');
    expect(ledger.getTransactions('a')).toHaveLength(2);
  });

  it('transfers atomically between accounts and records the movement once', () => {
    const ledger = new Ledger();
    ledger.createAccount({ id: 'a', name: 'A' });
    ledger.createAccount({ id: 'b', name: 'B' });
    ledger.deposit('a', 500);

    const transfer = ledger.transfer('a', 'b', 125);
    expect(ledger.getBalance('a')).toBe(375);
    expect(ledger.getBalance('b')).toBe(125);
    expect(transfer.type).toBe('transfer');
    expect(ledger.getTransactions()).toHaveLength(2);
  });

  it('rejects invalid amounts, overdrafts, duplicate accounts, and missing accounts without mutation', () => {
    const ledger = new Ledger();
    ledger.createAccount({ id: 'a', name: 'A' });
    ledger.createAccount({ id: 'b', name: 'B' });

    for (const amount of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => ledger.deposit('a', amount)).toThrow();
    }
    expect(() => ledger.createAccount({ id: 'a', name: 'Again' })).toThrow();
    expect(() => ledger.withdraw('a', 1)).toThrow(/Insufficient funds/);
    expect(() => ledger.transfer('a', 'missing', 1)).toThrow(/Account not found/);
    expect(() => ledger.transfer('a', 'a', 1)).toThrow(/same account/);
    expect(ledger.getBalance('a')).toBe(0);
    expect(ledger.getTransactions()).toHaveLength(0);
  });

  it('rejects a balance overflow before changing either transfer balance', () => {
    const ledger = new Ledger();
    ledger.createAccount({ id: 'a', name: 'A' });
    ledger.createAccount({ id: 'b', name: 'B' });
    ledger.deposit('a', Number.MAX_SAFE_INTEGER);
    ledger.deposit('b', Number.MAX_SAFE_INTEGER - 1);

    expect(() => ledger.transfer('a', 'b', 2)).toThrow(/safe integer range/);
    expect(ledger.getBalance('a')).toBe(Number.MAX_SAFE_INTEGER);
    expect(ledger.getBalance('b')).toBe(Number.MAX_SAFE_INTEGER - 1);
  });
});
