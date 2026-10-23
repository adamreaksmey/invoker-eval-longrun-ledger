import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSession } from "./auth";

interface Account { id: string; name: string }
type Schedule =
  | { frequency: "weekly"; weekdays: number[] }
  | { frequency: "monthly"; dayOfMonth: number }
  | { frequency: "custom"; interval: number; unit: "days" | "weeks" | "months" };
interface Rule { id: string; accountId: string; amountCents: number; description?: string; startDate: string; schedule: Schedule }
interface ApplyResult { asOf: string; applied: Array<{ ruleId: string; transactionId: string; date: string }> }

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/recurrence${path}`, {
    method, credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? `Request failed (${response.status})`);
  }
  return response.status === 204 ? undefined as T : response.json();
}

const money = (cents: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(Math.abs(cents) / 100);
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const today = () => new Date().toISOString().slice(0, 10);
function scheduleLabel(schedule: Schedule): string {
  if (schedule.frequency === "weekly") return `Weekly · ${schedule.weekdays.map(day => days[day]).join(", ")}`;
  if (schedule.frequency === "monthly") return `Monthly · day ${schedule.dayOfMonth}`;
  return `Every ${schedule.interval} ${schedule.unit}`;
}

export default function RecurringPage({ onBack }: { onBack: () => void }) {
  const { user, logout } = useSession();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [frequency, setFrequency] = useState<Schedule["frequency"]>("weekly");

  const load = useCallback(async () => {
    try {
      const [nextAccounts, nextRules] = await Promise.all([
        fetch("/api/accounts", { credentials: "include" }).then(async response => {
          if (!response.ok) throw new Error("Could not load accounts");
          return response.json() as Promise<Account[]>;
        }), request<Rule[]>("/"),
      ]);
      setAccounts(nextAccounts);
      setRules(nextRules);
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load recurring rules"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function createRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const amount = Math.round(Number(data.get("amount")) * 100);
    const description = String(data.get("description")).trim();
    let schedule: Schedule;
    if (frequency === "weekly") {
      const weekdays = data.getAll("weekday").map(Number);
      if (!weekdays.length) { setError("Choose at least one weekday."); return; }
      schedule = { frequency, weekdays };
    } else if (frequency === "monthly") {
      schedule = { frequency, dayOfMonth: Number(data.get("dayOfMonth")) };
    } else {
      schedule = { frequency, interval: Number(data.get("interval")), unit: String(data.get("unit")) as "days" | "weeks" | "months" };
    }
    if (!Number.isFinite(amount) || amount <= 0) { setError("Enter an amount greater than zero."); return; }
    setBusy(true); setError(""); setStatus("");
    try {
      await request<Rule>("/", "POST", {
        accountId: String(data.get("accountId")), amountCents: data.get("type") === "expense" ? -amount : amount,
        description, startDate: String(data.get("startDate")), schedule,
      });
      form.reset();
      setFrequency("weekly");
      setStatus("Recurring rule created.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create recurring rule"); }
    finally { setBusy(false); }
  }

  async function remove(rule: Rule) {
    setBusy(true); setError(""); setStatus("");
    try { await request<void>(`/${encodeURIComponent(rule.id)}`, "DELETE"); setStatus("Recurring rule deleted."); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete recurring rule"); }
    finally { setBusy(false); }
  }

  async function applyDue() {
    setBusy(true); setError(""); setStatus("");
    try {
      const result = await request<ApplyResult>("/apply-due", "POST", {});
      setStatus(result.applied.length ? `Applied ${result.applied.length} ${result.applied.length === 1 ? "occurrence" : "occurrences"} through ${result.asOf}.` : `No due occurrences through ${result.asOf}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not apply due rules"); }
    finally { setBusy(false); }
  }

  return <div className="app-shell">
    <header className="topbar"><a className="wordmark" href="#" onClick={event => { event.preventDefault(); onBack(); }}><span className="brand-mark small">PL</span> Ledger</a><div className="user-actions"><button className="quiet-button" onClick={onBack}>Ledger</button><span className="user-name">{user?.username}</span><button className="quiet-button" onClick={() => void logout()}>Sign out</button></div></header>
    <main className="dashboard budgets-page">
      <div className="welcome-row"><div><p className="eyebrow">AUTOMATE YOUR ROUTINE</p><h1>Recurring rules</h1><p className="muted">Schedule regular income and expenses for your ledger.</p></div><button className="primary-button apply-due-button" disabled={busy} onClick={() => void applyDue()}>Apply due rules <span>↗</span></button></div>
      {error && <div className="notice" role="alert">{error} <button onClick={() => { setError(""); void load(); }}>Try again</button></div>}
      {status && <p className="recurrence-status" role="status">{status}</p>}
      <section className="budget-layout">
        <article className="panel budget-list-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR SCHEDULE</p><h2>Recurring transactions</h2></div><span className="activity-count">{rules.length} {rules.length === 1 ? "rule" : "rules"}</span></div>
          {rules.length === 0 ? <div className="empty-state"><div className="empty-icon">↻</div><h3>No recurring rules yet.</h3><p>Create a rule to schedule regular ledger entries.</p></div> : <div className="budget-list">{rules.map(rule => <section className="budget-item" key={rule.id}><div className="budget-title"><div><h3>{rule.description || "Recurring transaction"}</h3><span>{accounts.find(account => account.id === rule.accountId)?.name ?? "Account"} · Starts {rule.startDate}</span><p className="recurrence-meta">{scheduleLabel(rule.schedule)}</p></div><div className="budget-actions"><strong className={`transaction-amount ${rule.amountCents < 0 ? "negative" : ""}`}>{rule.amountCents < 0 ? "−" : "+"}{money(rule.amountCents)}</strong><button className="text-button danger-text" disabled={busy} onClick={() => void remove(rule)}>Delete</button></div></div></section>)}</div>}
        </article>
        <article className="panel form-panel budget-form-panel"><p className="eyebrow">SET THE RHYTHM</p><h2>Create a recurring rule</h2><p className="form-hint">Entries are added only when you choose Apply due rules.</p><form onSubmit={createRule}>
          <label>Account<select name="accountId" required disabled={!accounts.length}>{accounts.length ? accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>) : <option value="">Add an account first</option>}</select></label>
          <label>Description<input name="description" placeholder="Monthly rent" required maxLength={120} /></label>
          <div className="field-row"><label>Amount<input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required /></label><label>Type<select name="type"><option value="expense">Expense</option><option value="income">Income</option></select></label></div>
          <label>First date<input name="startDate" type="date" defaultValue={today()} required /></label>
          <label>Frequency<select value={frequency} onChange={event => setFrequency(event.target.value as Schedule["frequency"])}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="custom">Every interval</option></select></label>
          {frequency === "weekly" && <fieldset className="weekday-field"><legend>Repeat on</legend>{days.map((day, index) => <label key={day}><input type="checkbox" name="weekday" value={index} defaultChecked={index === new Date().getDay()} />{day.slice(0, 3)}</label>)}</fieldset>}
          {frequency === "monthly" && <label>Day of month<input name="dayOfMonth" type="number" min="1" max="31" defaultValue="1" required /></label>}
          {frequency === "custom" && <div className="field-row"><label>Every<input name="interval" type="number" min="1" step="1" defaultValue="1" required /></label><label>Unit<select name="unit"><option value="days">Days</option><option value="weeks">Weeks</option><option value="months">Months</option></select></label></div>}
          <button className="primary-button" disabled={busy || !accounts.length}>Create rule <span>↗</span></button>
        </form></article>
      </section>
      <footer className="footer">Your ledger, on your schedule. <span>Personal Ledger · {new Date().getFullYear()}</span></footer>
    </main>
  </div>;
}
