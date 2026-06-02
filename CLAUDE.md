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
