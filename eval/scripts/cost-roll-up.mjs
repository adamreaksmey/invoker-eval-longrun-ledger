#!/usr/bin/env node
/**
 * Compute API-equivalent USD from Claude Code session JSONL files.
 * Usage: node eval/scripts/cost-roll-up.mjs <session.jsonl> [...]
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pricingPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../pricing-table.json",
);
const pricing = JSON.parse(readFileSync(pricingPath, "utf8"));

function resolveModel(id) {
  const key = (id || "unknown").trim().toLowerCase();
  const row = pricing.perMillionTokens[key];
  if (!row) return null;
  if (row.aliasOf) return pricing.perMillionTokens[row.aliasOf];
  return row;
}

function extractUsage(raw) {
  const totals = {
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    cacheCreationTokens: 0,
    byModel: {},
  };
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.type !== "assistant") continue;
    const message = entry.message && typeof entry.message === "object" ? entry.message : null;
    const usageRaw = entry.usage ?? message?.usage;
    if (!usageRaw || typeof usageRaw !== "object") continue;
    const input = Number(usageRaw.input_tokens ?? 0) || 0;
    const output = Number(usageRaw.output_tokens ?? 0) || 0;
    const cached = Number(usageRaw.cache_read_input_tokens ?? 0) || 0;
    const cacheCreate = Number(usageRaw.cache_creation_input_tokens ?? 0) || 0;
    const model =
      (typeof entry.model === "string" && entry.model) ||
      (typeof message?.model === "string" && message.model) ||
      "unknown";
    totals.inputTokens += input;
    totals.outputTokens += output;
    totals.cachedTokens += cached;
    totals.cacheCreationTokens += cacheCreate;
    if (!totals.byModel[model]) {
      totals.byModel[model] = { inputTokens: 0, outputTokens: 0, cachedTokens: 0, cacheCreationTokens: 0 };
    }
    const bucket = totals.byModel[model];
    bucket.inputTokens += input;
    bucket.outputTokens += output;
    bucket.cachedTokens += cached;
    bucket.cacheCreationTokens += cacheCreate;
  }
  return totals;
}

function estimateUsd(totals) {
  let usd = 0;
  const breakdown = {};
  for (const [model, bucket] of Object.entries(totals.byModel)) {
    const rates = resolveModel(model);
    if (!rates) {
      breakdown[model] = { usd: null, note: "unknown model" };
      continue;
    }
    const nonCachedInput = Math.max(0, bucket.inputTokens - bucket.cachedTokens);
    const part =
      (nonCachedInput * rates.input) / 1_000_000 +
      (bucket.cachedTokens * rates.cacheRead) / 1_000_000 +
      (bucket.cacheCreationTokens * (rates.cacheWrite5m ?? rates.input)) / 1_000_000 +
      (bucket.outputTokens * rates.output) / 1_000_000;
    breakdown[model] = { usd: part, ...bucket };
    usd += part;
  }
  return { usd, breakdown };
}

const files = process.argv.slice(2).filter((f) => f && !f.startsWith("-"));
if (files.length === 0) {
  console.error("Usage: node eval/scripts/cost-roll-up.mjs <session.jsonl> [...]");
  process.exit(2);
}

const aggregate = {
  inputTokens: 0,
  outputTokens: 0,
  cachedTokens: 0,
  cacheCreationTokens: 0,
  byModel: {},
  files: [],
};

for (const file of files) {
  if (!existsSync(file)) {
    console.error(`Missing session file: ${file}`);
    process.exit(1);
  }
  const partial = extractUsage(readFileSync(file, "utf8"));
  aggregate.inputTokens += partial.inputTokens;
  aggregate.outputTokens += partial.outputTokens;
  aggregate.cachedTokens += partial.cachedTokens;
  aggregate.cacheCreationTokens += partial.cacheCreationTokens;
  for (const [model, bucket] of Object.entries(partial.byModel)) {
    if (!aggregate.byModel[model]) {
      aggregate.byModel[model] = { inputTokens: 0, outputTokens: 0, cachedTokens: 0, cacheCreationTokens: 0 };
    }
    const target = aggregate.byModel[model];
    target.inputTokens += bucket.inputTokens;
    target.outputTokens += bucket.outputTokens;
    target.cachedTokens += bucket.cachedTokens;
    target.cacheCreationTokens += bucket.cacheCreationTokens;
  }
  aggregate.files.push(file);
}

const { usd, breakdown } = estimateUsd(aggregate);
console.log(
  JSON.stringify(
    {
      pricingVersion: pricing.version,
      totals: aggregate,
      estimatedCostUsd: usd,
      byModel: breakdown,
    },
    null,
    2,
  ),
);
