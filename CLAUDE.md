# Working agreement (Nick)

## Output format — ALWAYS
Deliver every response as a tight **executive summary**:
1. **Summary** — concise: what I found + what I suggest.
2. **Next steps** — clear, actionable.
3. **Questions for you** — only the decisions/inputs I need from Nick to proceed.

Keep it scannable. No filler.

## Red-team gate — ALWAYS
Gate every deliverable (designs, code, plans) through a **Codex red-team** review
before treating it as done. If the `codex` CLI is unavailable in the environment,
say so explicitly and either (a) ask Nick to run Codex locally on the artifact, or
(b) perform a self red-team in the meantime — never silently skip the gate.

---

# Project: CalSavers ↔ Gusto contribution automation

**Goal:** Automate remitting CalSavers (Vestwell) retirement contributions for
Nick's employees (~4) from Gusto payroll data, instead of manual portal entry
every pay period.

**Branch:** `claude/calsavers-gusto-automation-sjk04`

**Key facts established (research only — no code yet):**
- CalSavers admin = Vestwell. Submission = employer portal (CSV upload or manual).
- Contributions due within **7 days** of each paycheck deduction; ACH-drafted.
- Per payroll, not per month. Roth IRA; employee deductions only, no employer match.
- Gusto public App Integrations API (OAuth2) exposes per-employee deductions per payroll.
- A Vestwell↔Gusto "360°" integration exists but Nick still remits manually — so it
  either isn't enabled or doesn't cover state-portal remittance for him.

**Open inputs needed:** Gusto dev app credentials; real CalSavers contribution
template (.xlsx) for exact schema; pay-schedule cadence; repo location decision.

---

# Resume state (read this first if you're a new Claude session)

Project lives in `calsavers/` as an installable Python package. **Everything
needed to pick up is in this repo** — read these in order before doing anything:

1. `calsavers/DESIGN.md` — architecture (Tier-3 ambition / Tier-1 floor)
2. `calsavers/RED_TEAM_v0.1.md` — self red-team, 23 findings, **stand-in until Nick runs codex locally**
3. `calsavers/RUNBOOK_GUSTO_DEV_APP.md` — Nick's click-by-click for Gusto credentials
4. `calsavers/README.md` — laptop quick start

**Last shipped:** runnable Python project, `make install / oauth / list-companies
/ pull-recent / test / lint / redteam` all wired. Smoke tests green. CSV writer
and submitter intentionally deferred.

**Blocked on Nick (in priority order):**
1. **Stage-0 phone call** — Vestwell client services (855-650-6916). Confirm
   whether the existing Gusto-Vestwell 360° integration already auto-remits for
   his CalSavers account. If yes → close the project.
2. **CalSavers MFA type** — TOTP / SMS / push? Determines whether full Tier-3 is
   even possible.
3. **Drop the real contribution template** at `calsavers/reference/contribution_template.xlsx`.
   Without it, CSV emission is speculative.
4. **Gusto dev app credentials** — runbook in `calsavers/RUNBOOK_GUSTO_DEV_APP.md`.
5. **Codex red-team** — `cd calsavers && make redteam`. Paste findings back.

**Do NOT** silently re-design, expand scope, or add Tier-3 features until
Stage-0 is resolved. The cheapest move is always: ask Nick the next blocking
question.

**Branch:** stay on `claude/calsavers-gusto-automation-sjk04` until merged.
