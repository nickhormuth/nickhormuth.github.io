# CalSavers ↔ Gusto Automation

Internal tool. Pulls Gusto payroll deductions and emits a CalSavers-ready
contribution file. v1 stops at the CSV — you upload it to the Vestwell employer
portal manually (per the red-team's Tier-1 recommendation).

## Quick start (on your laptop)

```bash
git clone <this repo>
cd nickhormuth.github.io/calsavers
git checkout claude/calsavers-gusto-automation-sjk04

make install              # creates .venv and installs the package + dev deps
cp .env.example .env      # then fill in GUSTO_CLIENT_ID / GUSTO_CLIENT_SECRET
make oauth                # opens browser, captures refresh token to .env
make list-companies       # find your GUSTO_COMPANY_UUID, paste into .env
make pull-recent          # prints CalSavers-relevant deductions from the last payroll
make test                 # smoke tests
make redteam              # Codex review (requires `codex` on PATH and OpenAI auth)
```

## Required prerequisites

1. Python 3.11+
2. A Gusto developer app — see [`RUNBOOK_GUSTO_DEV_APP.md`](./RUNBOOK_GUSTO_DEV_APP.md)
3. (For `make redteam` only) Codex CLI authenticated to your OpenAI account

## What works right now

- ✅ OAuth bootstrap → refresh token in `.env`
- ✅ List companies attached to the OAuth grant
- ✅ Pull processed payrolls in a date window and print CalSavers-tagged deductions
- ✅ `make redteam` to gate any change with Codex

## What's blocked

- ⛔ CSV emission — schema unknown until the real CalSavers template is dropped at
  `reference/contribution_template.xlsx`
- ⛔ Vestwell↔Gusto 360 integration check — see Stage-0 in [`RED_TEAM_v0.1.md`](./RED_TEAM_v0.1.md);
  one phone call could make this whole project unnecessary

## Design + risks

- [`DESIGN.md`](./DESIGN.md) — architecture, data flow, schema, secrets, scope
- [`RED_TEAM_v0.1.md`](./RED_TEAM_v0.1.md) — self red-team standing in until Codex runs locally
- [`RUNBOOK_GUSTO_DEV_APP.md`](./RUNBOOK_GUSTO_DEV_APP.md) — click-by-click for the Gusto dev app

## Workflow gate

Every deliverable on this project is **red-teamed via Codex** before being treated
as done. The `make redteam` target runs that gate. If Codex is unreachable, the
self red-team in `RED_TEAM_v0.1.md` is the stand-in — never the final word.

## Safety

- `.env`, `out/`, and generated `*.csv` files are gitignored. SSNs **never** land in git.
- Contribution amounts are sanity-checked (cap per row) before any future submit step.
