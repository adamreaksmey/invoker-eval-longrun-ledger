import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSession } from "./auth";

interface Budget {
  id: string;
  categoryId: string;
  month: string;
  limitCents: number;
  spentCents: number;
  remainingCents: number;
  percentUsed: number;
}

interface BudgetInput { categoryId: string; month: string; limitCents: number }
interface BudgetSummary { budgets: Budget[] }

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/budgets${path}`, {
    method,
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? `Request failed (${response.status})`);
  }
  return response.status === 204 ? undefined as T : response.json();
}

const money = (cents: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

export default function BudgetsPage({ onBack }: { onBack: () => void }) {
  const { user, logout } = useSession();
  const [month, setMonth] = useState(currentMonth);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const summary = await request<BudgetSummary>(`/summary?month=${encodeURIComponent(month)}`);
      setBudgets(summary.budgets);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load budgets");
    }
  }, [month]);
  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const input: BudgetInput = {
      categoryId: String(data.get("categoryId")).trim(),
      month: String(data.get("month")),
      limitCents: Math.round(Number(data.get("limit")) * 100),
    };
    setBusy(true);
    try {
      if (editing) await request(`/${encodeURIComponent(editing.id)}`, "PATCH", input);
      else await request("", "POST", input);
      setEditing(null);
      form.reset();
      setMonth(input.month);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save budget");
    } finally { setBusy(false); }
  }

  async function remove(budget: Budget) {
    setBusy(true);
    try { await request(`/${encodeURIComponent(budget.id)}`, "DELETE"); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete budget"); }
    finally { setBusy(false); }
  }

  return <div className="app-shell">
    <header className="topbar"><a className="wordmark" href="#" onClick={event => { event.preventDefault(); onBack(); }}><span className="brand-mark small">PL</span> Ledger</a><div className="user-actions"><span className="user-name">{user?.username}</span><button className="quiet-button" onClick={() => void logout()}>Sign out</button></div></header>
    <main className="dashboard budgets-page">
      <div className="welcome-row"><div><p className="eyebrow">PLAN WITH INTENTION</p><h1>Your budgets</h1><p className="muted">Give every category a clear monthly limit.</p></div><label className="month-picker">MONTH<input type="month" value={month} onChange={event => setMonth(event.target.value)} /></label></div>
      {error && <div className="notice" role="alert">{error} <button onClick={() => void load()}>Try again</button></div>}
      <section className="budget-layout">
        <article className="panel budget-list-panel"><div className="panel-heading"><div><p className="eyebrow">MONTHLY OVERVIEW</p><h2>Category budgets</h2></div><span className="activity-count">{budgets.length} {budgets.length === 1 ? "budget" : "budgets"}</span></div>
          {budgets.length === 0 ? <div className="empty-state"><div className="empty-icon">⌁</div><h3>No budgets for this month yet.</h3><p>Create one to keep an eye on your spending.</p></div> : <div className="budget-list">{budgets.map(budget => {
            const over = budget.spentCents > budget.limitCents;
            const percent = Math.max(0, budget.percentUsed);
            return <section className="budget-item" key={budget.id}>
              <div className="budget-title"><div><h3>{budget.categoryId}</h3><span>{money(budget.spentCents)} of {money(budget.limitCents)} spent</span></div><div className="budget-actions"><button className="text-button" onClick={() => setEditing(budget)}>Edit</button><button className="text-button danger-text" disabled={busy} onClick={() => void remove(budget)}>Delete</button></div></div>
              <div className="budget-track" role="progressbar" aria-label={`${budget.categoryId} budget used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(percent, 100)}><span className={over ? "over" : ""} style={{ width: `${Math.min(percent, 100)}%` }} /></div>
              {over ? <p className="budget-warning" role="status">Over budget by {money(budget.spentCents - budget.limitCents)}</p> : <p className="budget-remaining">{money(budget.remainingCents)} remaining <span>{percent}% used</span></p>}
            </section>;
          })}</div>}
        </article>
        <article className="panel form-panel budget-form-panel"><p className="eyebrow">{editing ? "UPDATE YOUR PLAN" : "SET A LIMIT"}</p><h2>{editing ? "Edit budget" : "Create a budget"}</h2><p className="form-hint">Choose a category and monthly spending limit.</p><form key={editing?.id ?? "new"} onSubmit={save}>
          <label>Category<input name="categoryId" placeholder="Groceries" defaultValue={editing?.categoryId ?? ""} required maxLength={60} /></label>
          <label>Month<input name="month" type="month" defaultValue={editing?.month ?? month} required /></label>
          <label>Monthly limit<input name="limit" type="number" min="0.01" step="0.01" placeholder="0.00" defaultValue={editing ? (editing.limitCents / 100).toFixed(2) : ""} required /></label>
          <button className="primary-button" disabled={busy}>{editing ? "Save changes" : "Create budget"}<span>↗</span></button>
          {editing && <button type="button" className="cancel-edit" onClick={() => setEditing(null)}>Cancel editing</button>}
        </form></article>
      </section>
      <footer className="footer">Build a little breathing room. <span>Personal Ledger · {new Date().getFullYear()}</span></footer>
    </main>
  </div>;
}
