#!/usr/bin/env node
/**
 * Aggregate Codex exec JSONL usage (stdin or files).
 * Usage: node eval/scripts/cost-roll-up-codex.mjs <session.jsonl> [...]
 */
import { readFileSync, existsSync } from "node:fs";

function extract(raw) {
  const totals = {
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    cacheWriteTokens: 0,
    turns: 0,
    models: {},
  };
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.type !== "turn.completed" || !entry.usage) continue;
    const u = entry.usage;
    const input = Number(u.input_tokens ?? 0) || 0;
    const output = Number(u.output_tokens ?? 0) || 0;
    const cached = Number(u.cached_input_tokens ?? u.cached_tokens ?? 0) || 0;
    const cacheWrite = Number(u.cache_write_input_tokens ?? 0) || 0;
    totals.inputTokens += input;
    totals.outputTokens += output;
    totals.cachedTokens += cached;
    totals.cacheWriteTokens += cacheWrite;
    totals.turns += 1;
    const model = entry.model || "unknown";
    if (!totals.models[model]) {
      totals.models[model] = { inputTokens: 0, outputTokens: 0, cachedTokens: 0, turns: 0 };
    }
    totals.models[model].inputTokens += input;
    totals.models[model].outputTokens += output;
    totals.models[model].cachedTokens += cached;
    totals.models[model].turns += 1;
  }
  return totals;
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error("Usage: node eval/scripts/cost-roll-up-codex.mjs <jsonl> [...]");
  process.exit(2);
}
const aggregate = extract(
  files
    .map((f) => {
      if (!existsSync(f)) throw new Error(`missing ${f}`);
      return readFileSync(f, "utf8");
    })
    .join("\n"),
);
console.log(
  JSON.stringify(
    {
      billingMode: "chatgpt_subscription_included",
      estimatedCostUsd: null,
      totals: aggregate,
      files,
    },
    null,
    2,
  ),
);
