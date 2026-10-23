# Local API reference

The API is served by the local Express process, normally at `http://127.0.0.1:3000`. All endpoints accept and return JSON except endpoints documented with a `204` response. Requests with a body must use `Content-Type: application/json`.

## Authentication

The API uses an HttpOnly `ledger_session` cookie. Send the cookie returned by registration or login with subsequent requests. Sessions last seven days. Authenticated data is scoped to the signed-in user; missing or invalid sessions return `401` with `{ "error": "authentication required" }`.

| Method | Path | Body / result |
| --- | --- | --- |
| `POST` | `/auth/register` | `{ "username": "...", "password": "..." }`; returns `201` and `{ "user": { "id", "username" } }`, and sets the session cookie. Usernames are normalized to lowercase and must contain 3–32 letters, numbers, or underscores. Passwords must be non-empty and no more than 1024 UTF-8 bytes. |
| `POST` | `/auth/login` | Same body; returns the user and sets a session cookie. Invalid credentials return `401`. |
| `GET` | `/auth/me` | Returns `{ "user": { "id", "username" } }`; requires a session. |
| `POST` | `/auth/logout` | Clears the session cookie and returns `204`. |

Duplicate usernames return `409`. Malformed or invalid input generally returns `400` with an `error` message.

## Budgets

All budget routes require authentication and are mounted under `/api/budgets`. Amounts use integer cents. A month is `YYYY-MM`; each category can have one budget per month for a user.

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/budgets?month=YYYY-MM` | Lists budgets for a month. Without `month`, lists all the user's budgets. |
| `POST` | `/api/budgets` | Creates a budget from `{ "categoryId": "Groceries", "month": "2026-10", "limitCents": 45000 }`; returns `201` and the created budget. The limit must be positive. |
| `GET` | `/api/budgets/:id` | Gets one budget belonging to the current user. |
| `PATCH` | `/api/budgets/:id` | Updates supplied budget fields and returns the updated budget. |
| `DELETE` | `/api/budgets/:id` | Deletes the budget and returns `204`. |
| `GET` | `/api/budgets/:id/status` | Returns the budget with `spentCents`, `remainingCents`, and `percentUsed`. Currently status reports `spentCents: 0`; ledger transactions are not yet aggregated into budget spending. |
| `GET` | `/api/budgets/summary?month=YYYY-MM` | Returns `{ month, budgetCount, limitCents, spentCents, remainingCents, budgets }`. The month parameter is required; current spending values are zero. |

Budget objects contain `id`, `userId`, `categoryId`, `month`, and `limitCents`. Duplicate category/month budgets return `409`; a missing or other user's ID returns `404`.

## Recurrence

All recurrence routes require authentication and are mounted under `/api/recurrence`. Dates use valid UTC calendar dates in `YYYY-MM-DD` format. Amounts are non-zero integer cents; negative amounts represent expenses. A rule's `accountId` must refer to an account in that user's ledger.

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/recurrence` | Lists the current user's rules. |
| `POST` | `/api/recurrence` | Creates a rule and returns `201` with its representation. |
| `GET` | `/api/recurrence/:id` | Gets one rule belonging to the current user. |
| `PATCH` | `/api/recurrence/:id` | Updates supplied rule fields and returns the updated rule. |
| `DELETE` | `/api/recurrence/:id` | Deletes the rule and returns `204`. |
| `POST` | `/api/recurrence/apply-due` | Materializes due occurrences into ledger transactions. Optional body: `{ "asOf": "2026-10-23" }`; omitted `asOf` defaults to today's UTC date. Returns `{ asOf, applied: [{ ruleId, transactionId, date }] }`. Repeating the request is safe and does not apply an occurrence twice. |

A rule has `accountId`, `amountCents`, optional `description`, `startDate`, and `schedule`. Supported schedules:

```json
{ "frequency": "weekly", "interval": 1, "weekdays": [1, 3] }
{ "frequency": "monthly", "interval": 1, "dayOfMonth": 15 }
{ "frequency": "custom", "interval": 2, "unit": "weeks" }
```

Weekly day numbers are UTC weekdays from `0` (Sunday) to `6` (Saturday). `interval` is a positive integer and defaults to `1` for weekly and monthly schedules. A monthly day above the length of a month uses that month's final day. Custom units are `days`, `weeks`, or `months`. Applying due rules is an explicit operation; creating a rule alone does not create transactions. A request is limited to 1000 occurrences per rule.

## Local development and tests

Start the API with `npm run start --workspace @personal-ledger/api`. To use persistent local storage, set `DATABASE_PATH`; set `PORT` to change the default port `3000`. Set a stable, long random `SESSION_SECRET` for sessions that must survive API restarts. The default development secret is ephemeral.

From the repository root, `npm test` runs the workspace Vitest suites. `npm run test:e2e --workspace @personal-ledger/web` runs Playwright against local services and a temporary SQLite database.
