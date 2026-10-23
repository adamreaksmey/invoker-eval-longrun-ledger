import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Account = { id: string; name: string };
type Transaction = { id: string; accountId: string; amountCents: number; description?: string };
const API = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? `Request failed (${response.status})`);
  }
  return response.status === 204 ? undefined as T : response.json();
}

function money(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState("");
  const [accountName, setAccountName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const loaded = await request<Account[]>("/accounts");
    setAccounts(loaded);
    setSelected((current) => loaded.some((account) => account.id === current) ? current : loaded[0]?.id ?? "");
    const [rows, totals] = await Promise.all([
      request<Transaction[]>("/transactions"),
      Promise.all(loaded.map(async (account) => {
        const result = await request<{ balanceCents: number }>(`/accounts/${encodeURIComponent(account.id)}/balance`);
        return [account.id, result.balanceCents] as const;
      })),
    ]);
    setTransactions(rows);
    setBalances(Object.fromEntries(totals));
  }, []);

  useEffect(() => { refresh().catch((reason: Error) => setError(reason.message)); }, [refresh]);
  const visibleTransactions = useMemo(() => transactions
    .filter((transaction) => transaction.accountId === selected)
    .slice().reverse(), [transactions, selected]);

  async function submit(event: FormEvent, action: () => Promise<unknown>) {
    event.preventDefault();
    setError(""); setBusy(true);
    try { await action(); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Something went wrong"); }
    finally { setBusy(false); }
  }

  const selectedAccount = accounts.find((account) => account.id === selected);
  return <main className="shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark">L</span> Ledger</a><span className="status"><i /> Personal workspace</span></header>
    <section className="intro"><div><p className="eyebrow">YOUR MONEY, IN FOCUS</p><h1>A clearer view<br />of your finances.</h1><p className="subhead">Keep the everyday details in one calm place.</p></div><div className="intro-art" aria-hidden="true"><span>✳</span><b>+</b><i>•</i></div></section>
    {error && <div className="notice" role="alert">{error}</div>}
    <section className="overview">
      <div className="section-heading"><div><p className="eyebrow">OVERVIEW</p><h2>Your accounts</h2></div><span className="count">{accounts.length} {accounts.length === 1 ? "account" : "accounts"}</span></div>
      {accounts.length > 0 ? <div className="account-grid">{accounts.map((account) => <button className={`account-card ${selected === account.id ? "active" : ""}`} key={account.id} onClick={() => setSelected(account.id)}>
        <span className="card-icon">↗</span><span className="account-name">{account.name}</span><strong>{money(balances[account.id] ?? 0)}</strong><span className="card-foot">Current balance <span>→</span></span>
      </button>)}</div> : <div className="empty">Start with an account to begin tracking your ledger.</div>}
    </section>
    <section className="workspace">
      <div className="activity">
        <div className="section-heading"><div><p className="eyebrow">LEDGER</p><h2>{selectedAccount ? selectedAccount.name : "Recent activity"}</h2></div>{selected && <span className="count">{visibleTransactions.length} entries</span>}</div>
        {visibleTransactions.length ? <div className="transactions">{visibleTransactions.map((transaction) => <div className="transaction" key={transaction.id}><span className={`transaction-icon ${transaction.amountCents > 0 ? "credit" : "debit"}`}>{transaction.amountCents > 0 ? "↓" : "↑"}</span><span className="transaction-copy"><strong>{transaction.description || "Entry"}</strong><small>{new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</small></span><strong className={transaction.amountCents > 0 ? "positive" : ""}>{money(transaction.amountCents)}</strong></div>)}</div> : <div className="empty activity-empty">{selected ? "No entries yet. Add your first transaction." : "Create an account to see your activity."}</div>}
      </div>
      <aside className="forms">
        <form className="form-card" onSubmit={(event) => submit(event, async () => {
          const name = accountName.trim(); if (!name) throw new Error("Enter an account name.");
          await request("/accounts", { method: "POST", body: JSON.stringify({ id: crypto.randomUUID(), name }) }); setAccountName("");
        })}>
          <div className="form-title"><span className="form-icon">＋</span><div><h3>New account</h3><p>Add a place to keep track of.</p></div></div>
          <label htmlFor="account-name">Account name</label><input id="account-name" value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="e.g. Everyday checking" maxLength={80} required />
          <button className="button secondary" disabled={busy}>Create account <span>↗</span></button>
        </form>
        <form className="form-card transaction-form" onSubmit={(event) => submit(event, async () => {
          if (!selected) throw new Error("Create an account before adding a transaction.");
          const parsed = Number(amount); if (!Number.isFinite(parsed) || parsed === 0) throw new Error("Enter a non-zero amount.");
          const cents = Math.round(parsed * 100); if (!Number.isSafeInteger(cents) || cents === 0) throw new Error("Enter an amount with up to two decimal places.");
          await request("/transactions", { method: "POST", body: JSON.stringify({ id: crypto.randomUUID(), accountId: selected, amountCents: cents, description: description.trim() }) });
          setAmount(""); setDescription("");
        })}>
          <div className="form-title"><span className="form-icon lavender">↕</span><div><h3>Add transaction</h3><p>Income is positive, spending is negative.</p></div></div>
          <label htmlFor="entry-description">Description</label><input id="entry-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="e.g. Weekly groceries" maxLength={160} />
          <label htmlFor="entry-amount">Amount <span className="hint">USD</span></label><div className="amount-input"><span>$</span><input id="entry-amount" type="number" inputMode="decimal" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required /></div>
          <button className="button primary" disabled={busy || !selected}>Save transaction <span>↗</span></button>
        </form>
      </aside>
    </section>
    <footer>Made for the everyday math of life <span>✳</span></footer>
  </main>;
}
