# CalSavers ↔ Gusto Automation

Internal tool. Automates remitting CalSavers (Vestwell) retirement contributions
for Nick's employees from Gusto payroll data, within the 7-day legal window.

## Status

Planning. No code yet. See:

- [`DESIGN.md`](./DESIGN.md) — architecture, schema, risks, open questions
- [`RUNBOOK_GUSTO_DEV_APP.md`](./RUNBOOK_GUSTO_DEV_APP.md) — Nick's click-by-click to get Gusto API credentials
- [`reference/`](./reference/) — drop the downloaded CalSavers contribution template here as `contribution_template.xlsx`

## Workflow gate

Every deliverable on this project is **red-teamed via Codex** before being treated as done.
If the `codex` CLI is unreachable from the working environment, that is stated explicitly and
either Nick runs Codex locally or a self red-team stands in temporarily.
