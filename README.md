# Personal Ledger

## Development

This repository uses npm workspaces. The active library package is
`packages/core`; `packages/api` and `apps/web` are placeholders for later work.

```sh
npm install
npm test
npm run build
```

Core tests run with Vitest. The core build currently delegates to its test
command until the library has a build output.
