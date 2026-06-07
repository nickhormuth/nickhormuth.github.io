# Red-Team v0.1 (self, standing in for Codex CLI)

**Status:** Codex CLI was invoked at session 019ea3e3-4cc6-7fa1-b454-10d4cb942e9e
with `model=gpt-5.5`, `reasoning=high`. It failed at the network layer
(`403 Host not in allowlist, url: https://api.openai.com/v1/responses`) — this
sandbox blocks all OpenAI hosts. Per `CLAUDE.md`, performing a self red-team in
the meantime; **Nick should still run Codex locally and append its findings**
before code lands.

Reviewed: `calsavers/DESIGN.md`, `calsavers/RUNBOOK_GUSTO_DEV_APP.md`.

---

## Critical (must address before any code)

1. **Risk #6 in DESIGN is mis-prioritised.** "The Vestwell↔Gusto 360 integration may already cover remittance" is listed sixth. It's actually a *gate*: if true, the whole project is wasted effort. **Promote to a Stage-0 verification step.** Concrete check: Nick emails Vestwell client services (855-650-6916) and asks verbatim, "Does my CalSavers account have the Gusto 360 integration enabled, and does it auto-remit contributions, or do I still need to upload contribution files?" Without this answer, every other task on this project is speculative.

2. **MFA assumption is probably wrong.** Design assumes TOTP. Vestwell/CalSavers portal MFA is most likely SMS OR push-to-app (Okta Verify / DUO style) — those are the norm for financial portals; TOTP is rare. **If SMS:** Tier-3 requires either (a) a Twilio number to receive codes (~$1/mo + setup), (b) SIM forwarding, or (c) degrades to email-the-CSV-Nick-uploads. **If push:** Tier-3 is essentially impossible without compromising the second factor's whole purpose. Verify MFA type before designing the submitter.

3. **Automated portal login likely violates Vestwell's TOS.** Most retirement-platform terms explicitly prohibit "automated access" or "credential sharing with bots." Risk: account lockout when detected, possible fiduciary/compliance exposure since this is retirement plan data. **Mitigation:** Read the Vestwell TOS before building the Playwright submitter. If prohibited, the legal path is SFTP/API access — Nick may have to apply as a "payroll partner" or accept Tier-1 (manual upload of generated CSV) as the ceiling.

4. **Idempotency hole = duplicate ACH debits.** Design proposes dedupe-by-`check_date` after submit. If submit succeeds at Vestwell but our code crashes before recording the dedupe marker, next run re-submits → Vestwell drafts double from Nick's bank. **Fix:** Query Vestwell's payroll history *before* submitting and skip if the `(check_date, employee, amount)` triple already posted. The reconciler should run before the submitter, not after.

5. **SSN handling in CI logs.** Design says "runner is ephemeral, secrets encrypted." True, but GitHub Actions log lines persist. A stray `print(employee)` leaks SSN into a public-ish log. **Required:** explicit log-scrubbing layer; never put `employee` objects in any log statement; CI step that greps the log for 9-digit patterns before exit.

## High (fix before submitter code)

6. **Dedupe key is incomplete.** `check_date` alone collides when a bonus run lands on the same date as a regular payroll. Use `(payroll_id, employee_id)` — Gusto's payroll_id is unique and stable.

7. **Gusto SSN scope is probably gated.** `employee:read` typically does NOT include SSN. Gusto requires explicit elevated permission (often a manual review by their compliance team) before exposing SSN/DOB on API responses. **Action:** check the actual current Gusto scope catalogue; budget 1–2 weeks of partner-app review if needed.

8. **Gusto refresh-token rotation is undefended.** Some OAuth providers rotate the refresh token on every use. Code must persist the rotated token after every call back to GitHub Secrets (requires `actions:write` permission). Not in the design.

9. **CalSavers "Pay Date" field is ambiguous.** Best-guess maps it to `payroll.check_date`. Could equally be `period_end_date`. Wrong field = a compliance flag and a Vestwell phone call to clean up. Confirm against the real template + the per-employee history view.

10. **No dry-run / no first-N-manual-review gate.** Real money moves on submit. Design needs:
    - `--dry-run` mode (emits CSV, no submit, sends to Nick for inspection)
    - Mandatory dry-run for first 3 cycles before unattended runs
    - Per-employee sanity cap (e.g., refuse to submit if any single contribution > $1,500 or > 50% of gross — likely a data error)

11. **No monitoring for silent failure.** GitHub Actions cron that fails silently = missed 7-day window = state penalty. Add Healthchecks.io or Dead Man's Snitch — alert if a run *doesn't* execute, not just when it errors.

## Medium (clean up before v1)

12. **Reconciliation as a second Playwright session doubles fragility.** v1 should skip the post-submit reconciliation pass; trust the submission receipt. Reconciliation can come in v2 if needed.

13. **Single-channel notification.** Email-only = SPOF if SMTP creds rot or land in spam. Add SMS for failure-class notifications.

14. **New-hire / leave-of-absence handling not specified.** New hires in their 30-day enrollment window have $0 deductions and shouldn't appear in the file. Employees on unpaid leave: same. Filter rule: include only `employee_compensation` rows where the CalSavers deduction `amount > 0`.

15. **Voided payroll handling underspecified.** "Filter processed && !voided" — but if a payroll is voided *after* remittance, the contribution has already been ACH-drafted. Need a documented manual-cleanup playbook; this is too rare to automate.

## Low / scope creep

16. **Documenting both Tier-1 and Tier-3 in v1 design is muddy.** Recommend: ship as "Tier-3 ambition, Tier-1 floor." v1 PR is just Tier-1; Tier-3 added in a follow-up PR after Tier-1 has 4+ clean runs.

17. **Tier-3 fallback "email Nick the CSV" requires SMTP creds, sender domain, etc.** That's a build cost being hidden under "fallback." If Tier-1 is the v1 ceiling per #16, the fallback doesn't exist yet — saves real work.

## Errors in `RUNBOOK_GUSTO_DEV_APP.md`

18. **Scope name `payroll:read` may not exist.** Gusto's App Integrations uses different scope strings; need to verify against current docs before sending Nick into the dev portal.

19. **Some Gusto plans don't expose dev API to admins.** If Nick's plan tier doesn't include API access, the runbook step 1 will fail. Document the upgrade path or call Gusto support.

20. **Redirect URI `http://localhost:8765`** — Gusto may require HTTPS even for localhost in production apps. Sandbox often allows HTTP. Verify before Nick gets stuck.

## Incorrect technical assumptions

21. **"GitHub Actions cron triggers right after payroll"** — Gusto App Integrations API does not push webhooks on payroll completion (that's Embedded only). The cron has to *poll*. Design should say so.

22. **Implicit assumption Gusto exposes a Vestwell participant ID** — it almost certainly doesn't. SSN is the only join key to CalSavers participant records. Magnifies the SSN-handling risk in #5.

23. **"GitHub Actions runner is ephemeral"** as the security argument is incomplete. The artifacts cache and the log archive persist. Both must be in scope for the SSN-scrub policy.

---

## Recommended re-prioritised plan

1. **Stage 0 (Nick, 1 phone call):** Call Vestwell client services. Confirm whether 360 integration already auto-remits. If yes → close project, this work is unnecessary.
2. **Stage 1 (Nick, 5 min):** Note MFA type on CalSavers portal sign-in. Confirms whether Tier-3 is technically possible at all.
3. **Stage 2 (Nick, 5 min):** Download contribution template → commit to `calsavers/reference/`.
4. **Stage 3 (Claude):** Revise `DESIGN.md` against this red-team. Drop reconciliation, drop fallback-email, drop Tier-3 from v1. Scope v1 strictly to: "Pull Gusto data → generate Vestwell-format CSV → email Nick the CSV → Nick uploads." Tier-1 only.
5. **Stage 4 (Nick):** Verify Gusto SSN scope availability before any code is committed.
6. **Stage 5 (Claude):** Write Gusto OAuth bootstrap + data pull + CSV writer. PR.
7. **Stage 6 (Codex, locally):** Real Codex review of the code PR before merge.

## Quick wins for the current `DESIGN.md`

- Move risk #6 to the top under a new "Stage-0 verification" section
- Remove Tier-3 from v1 scope; reference it as "v2 ambition"
- Add a "Compliance / TOS" section that includes the Vestwell-TOS check
- Add a "Logging & PII" section with the SSN-scrub rule
- Change dedupe key to `(payroll_id, employee_id)`
- Add `--dry-run` mode as a v1 requirement, not optional
