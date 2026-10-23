# Personal ledger

## Development

This repository uses npm workspaces. The personal ledger UI is in `apps/web`, backed by the JSON API in `packages/api` and ledger rules in `packages/core`.

- `npm install` installs workspace dependencies.
- `npm test` runs tests in workspaces that define a test script.
- `npm run build` builds the web application.

Core and API tests use Vitest.

## Manual web smoke test

1. Run `npm install` if you have not installed workspace dependencies.
2. In one terminal, start the API with `npx tsx packages/api/src/index.ts` (it listens on port 3000).
3. In another terminal, run `npm run dev --workspace @personal-ledger/web` and open the URL Vite prints.
4. Create an account, then add a positive amount and a negative amount. Confirm the account balance and ledger entries update.
5. Reload the page and confirm the account and entries are still available while the API process is running.
6. Run `npm run build` to produce the static app in `apps/web/dist`.

The Vite development server proxies `/accounts` and `/transactions` to `http://localhost:3000`. For a production deployment, serve the API on the same origin or configure the host to proxy those paths; `VITE_API_URL` can point the UI at an API with CORS enabled.
