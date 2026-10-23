# Benchmark V3 spending cap

- **Hard API-equivalent ceiling:** USD 300.00 (computed from token counts × `eval/pricing-table.json`).
- **Metered usage:** Use existing Claude OAuth / subscription only; no new purchases or upgrades.
- **Stop rule:** When rolling API-equivalent total across all arms reaches USD 300, halt new agent/task launches and finish reporting from partial runs.
- **Billed vs equivalent:** Record both when Anthropic/Cursor dashboards differ from computed totals.
