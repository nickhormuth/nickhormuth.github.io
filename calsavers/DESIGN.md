# CalSavers ↔ Gusto Automation — Design v0.1

**Status:** Draft. Pending: (a) Codex red-team review (run locally), (b) real CalSavers template upload to confirm schema, (c) confirmation that the existing Vestwell↔Gusto 360° integration does **not** already remit for Nick.

**Branch:** `claude/calsavers-gusto-automation-sjk04`

**Target tier:** Tier 3 (scheduled, hands-off) with automatic **Tier-1 fallback** (email the CSV to Nick) on any portal failure. Rationale: Nick wants "don't have to think about it"; portal automation will occasionally break, so failure path must still hit the 7-day deadline by handing off the CSV.

---

## Goal

After each Gusto biweekly payroll, automatically submit per-employee CalSavers contributions to the Vestwell employer portal within the 7-day legal window. Happy path is zero human action.

## Architecture

```
GitHub Actions cron (post-payroll trigger)
        │
        ▼
calsavers-remit (Python single-repo app)
  ├─ gusto_client/   OAuth2 — list processed payrolls + per-employee deductions
  ├─ mapper/         Gusto deductions → CalSavers contribution rows
  ├─ csv_writer/     Emit Excel-compatible CSV matching CalSavers template
  ├─ submitter/      Playwright headless: login → 2FA → upload → confirm
  ├─ reconciler/     Verify submission appears in Vestwell payroll history
  └─ notify/         Email Nick — success summary OR fallback CSV on failure
```

## Data flow per run

1. Identify pay date(s) in last N days that haven't been remitted yet (dedupe key = `check_date`).
2. `GET /v1/companies/{uuid}/payrolls?processed=true&include=deductions,benefits` over the window.
3. For each `employee_compensation`, extract the line labelled `Vestwell State IRA` / `CalSavers`.
4. Join with `GET /v1/companies/{uuid}/employees` for SSN/ITIN (sensitive scope).
5. Build CSV rows in the CalSavers template schema.
6. Submit via Playwright → capture confirmation receipt + submission ID.
7. **Happy path:** log submission ID, persist dedupe marker, email Nick a one-line summary.
8. **Failure path:** email Nick the CSV attachment + portal URL + remaining days to deadline.

## Best-guess CalSavers CSV schema *(replace with downloaded template)*

| Column | Type | Source in Gusto |
|---|---|---|
| SSN | string, 9 digits no dashes | `employee.ssn` |
| First Name | string | `employee.first_name` |
| Last Name | string | `employee.last_name` |
| Pay Date | `MM/DD/YYYY` | `payroll.check_date` |
| Contribution Amount | decimal, 2dp | `deduction.employee_deduction` |
| Status (optional) | enum (Active/Terminated/Leave) | derived from `employment_status` |

## Secrets (GitHub Actions encrypted)

- `GUSTO_CLIENT_ID`, `GUSTO_CLIENT_SECRET`, `GUSTO_REFRESH_TOKEN`
- `CALSAVERS_USERNAME`, `CALSAVERS_PASSWORD`
- `CALSAVERS_TOTP_SECRET` *(only if portal supports TOTP — open question)*
- `NOTIFY_EMAIL_TO`, SMTP creds (or Resend/SendGrid token)

## Red-team self-review (Codex unreachable from this sandbox)

1. **MFA type unknown.** If CalSavers offers only SMS/email codes, full Tier-3 is impossible — degrades to "tool prepares CSV + emails Nick, Nick uploads." Need Nick to confirm.
2. **PII in CI.** SSNs pass through GitHub Actions. Acceptable: runner is ephemeral, secrets encrypted at rest. Hard rule: contribution CSVs **never committed**. `.gitignore` enforces.
3. **Portal UI drift.** Vestwell can redesign anytime; Playwright will break. Mitigation = the email-CSV fallback so deadlines never slip even on breakage.
4. **Gusto refresh-token expiry.** 60-day idle limit. Cron runs every payroll keeps it fresh; add a defensive weekly "health-check" run.
5. **Voided payrolls.** Filter `processed && !voided`. Dedupe by `check_date` so reruns are safe.
6. **The 360 integration may already cover this.** Strongest risk: we may be building a solution to a non-problem. Mitigation = confirm with Vestwell/CalSavers support before writing submitter code.
7. **Storing portal password.** Password + TOTP secret in CI = real footgun. Lower-blast-radius alternative: run submitter on Nick's Mac via launchd, secrets in macOS Keychain. Trade-off: less "set and forget" but tighter blast radius.

## Open questions (blocking)

1. CalSavers MFA type? (TOTP / SMS / email / push)
2. Real CSV schema from the downloaded template
3. Confirmation: Vestwell↔Gusto 360° integration does **not** already remit for Nick
4. Biweekly pay date pattern (which day of week, which weeks of month)
5. Notification channel preference: email only? SMS too?
6. Runtime preference: GitHub Actions (cloud, password in CI) vs. local Mac launchd (Keychain, requires laptop online)

## Out of scope (v1)

- Employer match (n/a — Roth IRA, employee-only)
- Census/roster updates (Vestwell↔Gusto handles)
- Year-end tax reporting (CalSavers handles)
- Other states' auto-IRA programs (single-state for now)
