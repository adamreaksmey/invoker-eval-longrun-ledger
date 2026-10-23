# Personal ledger

## Development

This repository uses npm workspaces. The active library is `packages/core`; `packages/api` and `apps/web` are placeholders for later stages.

- `npm install` installs workspace dependencies.
- `npm test` runs tests in workspaces that define a test script.
- `npm run build` runs build scripts in workspaces that define one.

Core tests use Vitest. No ledger behavior, API server, or web UI is implemented yet.
