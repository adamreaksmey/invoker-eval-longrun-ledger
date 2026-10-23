#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function run(label, cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
    ...opts,
  });
  if (result.status !== 0) {
    console.error(`[verify] FAIL: ${label}`);
    process.exit(result.status ?? 1);
  }
  console.error(`[verify] PASS: ${label}`);
}

const tierIdx = process.argv.indexOf("--tier");
const tier = tierIdx >= 0 ? Number(process.argv[tierIdx + 1] ?? 0) : 0;

run("npm ci", "npm", ["ci"]);

if (tier === 0 || tier >= 1) {
  run("npm test", "npm", ["test"]);
  run("npm run build", "npm", ["run", "build"]);
}

if (tier === 0 || tier >= 2) {
  run("playwright smoke", "npm", ["run", "test:e2e"], {
    env: { ...process.env, CI: "1" },
  });
}

console.error("[verify] All requested tiers passed.");
