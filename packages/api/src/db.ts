import { DatabaseSync } from "node:sqlite";

/** Open the local SQLite database and ensure the persistence schema exists. */
export function openDatabase(filename: string): DatabaseSync {
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL,
      month TEXT NOT NULL,
      limit_cents INTEGER NOT NULL CHECK (limit_cents > 0),
      created_at INTEGER NOT NULL,
      UNIQUE (user_id, category_id, month)
    );
    CREATE INDEX IF NOT EXISTS budgets_user_month_idx ON budgets(user_id, month);
    CREATE TABLE IF NOT EXISTS recurrence_rules (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      description TEXT,
      start_date TEXT NOT NULL,
      schedule_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS recurrence_rules_user_idx ON recurrence_rules(user_id);
    CREATE TABLE IF NOT EXISTS recurrence_applications (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rule_id TEXT NOT NULL REFERENCES recurrence_rules(id) ON DELETE CASCADE,
      occurrence_date TEXT NOT NULL,
      transaction_id TEXT NOT NULL,
      PRIMARY KEY (user_id, rule_id, occurrence_date)
    );
  `);
  return db;
}
