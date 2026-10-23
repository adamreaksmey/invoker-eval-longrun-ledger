# Personal ledger

## Development

This repository uses npm workspaces. Shared ledger and authentication rules live in `packages/core`; the local HTTP API lives in `packages/api`.

- `npm install` installs workspace dependencies.
- `npm test` runs tests in workspaces that define a test script.
- `npm run build` runs build scripts in workspaces that define one.

Tests use Vitest. Start the API with `npm run start --workspace @personal-ledger/api`; it listens on `127.0.0.1:3000` by default. Set `PORT` and `DATABASE_PATH` to override those defaults.

Set `SESSION_SECRET` to a long, random value before running the API outside local development. If it is omitted, the API prints a warning and uses an ephemeral development-only secret, which invalidates sessions after restart and must not be used for deployment. Copy `.env.example` to `.env` and supply your own secret.
