# Dandyhorse SF Applicant Tracker — v3

A solo-operator hiring dashboard built on Google Sheets + Apps Script. Polls
Gmail for Craigslist replies and manually-labeled applicants, analyzes each
one with Claude, and writes interpretable, evidence-backed rows to a
spreadsheet.

This folder holds the Apps Script source for v3, stored in Git for version
control. It's clasp-ready but every file copy-pastes cleanly into the Apps
Script web editor if you prefer.

## What v3 changes

- **Interpretable scoring.** One overall 1–10 plus five 1–5 subscores
  (role_fit, SF connection, enthusiasm_specificity, reliability, genericness)
  instead of a single opaque number.
- **Evidence bullets.** Every important judgment is backed by short quotes
  pulled from the applicant's own text.
- **Age discipline.** Only populated if the applicant explicitly states their
  age. No inference from graduation dates, tone, or career stage.
- **LLM-likelihood discipline.** A soft heuristic, never disqualifying on
  its own. Treated as a hint that correlates with genericness.
- **Durable state.** Application IDs (hash of thread+message IDs) and
  explicit per-row statuses. The Gmail `Applicants/Processed` label is a
  hint, not the source of truth.
- **Graceful fallback.** If the LLM fails, the row still lands with contact
  info and a `Manual Review` recommendation so no applicant is lost.
- **Versioned analyses.** Every audit row records spec / prompt / analysis
  versions.

## File map

| File             | Role                                                        |
| ---------------- | ----------------------------------------------------------- |
| `appsscript.json`| Manifest, OAuth scopes, time zone                           |
| `Code.gs`        | `onOpen`, `syncNow`, `runTrigger`, `installTrigger`         |
| `Config.gs`      | Sheet names, labels, versions, model, column schemas        |
| `Sheets.gs`      | Idempotent sheet bootstrap + formatting                     |
| `Inbox.gs`       | Gmail query + label management                              |
| `Extract.gs`     | Picks latest inbound message, parses body + resume text     |
| `Prompt.gs`      | System prompt, rubric, JSON schema, discipline rules        |
| `Analyze.gs`     | Anthropic API call, JSON parse + validate, retry            |
| `Rows.gs`        | Upsert to Applicants + Analyses; preserves manual columns   |
| `State.gs`       | `LockService` wrapper, application ID hashing               |
| `Util.gs`        | Logging, date helpers, quoted-reply stripping               |

## Setup

### 1. Create the Sheet + bind a script

1. Create a new Google Sheet.
2. `Extensions → Apps Script`. This creates a container-bound script.
3. Copy each `*.gs` file + `appsscript.json` from this folder into the
   editor. (To see `appsscript.json` in the editor, enable
   `Project Settings → Show "appsscript.json" manifest file`.)

### Option B: clasp

```bash
npm i -g @google/clasp
clasp login
cp .clasp.json.example .clasp.json
# Edit .clasp.json and paste your script ID (from the Apps Script URL)
clasp push
```

`.clasp.json` is gitignored by convention — don't commit the script ID.

### 2. Enable the Drive advanced service

Resume text extraction converts PDFs/DOC(X) via Drive.

- Editor → `Services` (+) → `Drive API` v2 → Add.

### 3. Set Script Properties

`Project Settings → Script Properties → Add script property`:

| Key                  | Value                              |
| -------------------- | ---------------------------------- |
| `ANTHROPIC_API_KEY`  | your Anthropic API key (required)  |
| `ANTHROPIC_MODEL`    | `claude-sonnet-4-6` (optional)     |
| `DEBUG_LOG`          | `true` to enable verbose logging   |

### 4. Bootstrap the sheets

From the editor, run `setupSheets` once. Authorize the requested scopes
when prompted. You'll see `Applicants`, `Roles` (visible), and `Analyses`,
`Settings` (hidden) tabs created.

### 5. Seed a role

Open the `Roles` tab. Update the seeded row or add new rows for each
position you're hiring. Paste the Craigslist ad, your own notes, or
anything else that describes the ideal candidate into
`Ideal Candidate Profile`. Update anytime — the `Spec Version` column
keeps old analyses traceable.

### 6. Install the time trigger

Reload the Sheet (so the `Dandyhorse` menu appears). Then:

- `Dandyhorse → Install 10-min trigger` — creates the recurring sync.
- `Dandyhorse → Sync now` — manual sync while you're watching.

## Gmail labels

The script creates these labels on first run:

- `Applicants/Inbox` — apply this yourself to any non-Craigslist
  applicant email you want processed (e.g. referrals, direct emails).
- `Applicants/Processed` — applied automatically after a successful
  analysis.
- `Applicants/Error` — applied when processing fails; leaves the thread
  visible for debugging.

## Operating the sheet

### Applicants tab (visible)

One row per applicant, deduplicated by Application ID. First 5 columns
are frozen.

- AI columns (1–3, 4–23, 28–30) are rewritten on every sync.
- **Manual columns (24–27)** — `Status`, `Interest`, `Interview Date`,
  `Notes` — are **never overwritten** by re-sync. Edit freely.

### Analyses tab (hidden)

Audit layer. One row per applicant. Holds raw JSON, durable IDs, version
numbers, per-run statuses, cover letter + resume text extracts, and
error reasons. Unhide it to debug a bad analysis.

### Roles tab

Freeform per-position specs. Edit anytime; bump `Spec Version` if you want
to distinguish past analyses from current ones.

### Settings tab (hidden)

Version overrides (currently advisory — the hardcoded constants in
`Config.gs` are authoritative).

## Versioning

When you materially change the rubric, prompt, or scoring, bump the
matching constant in `Config.gs`:

- `SPEC_VERSION`     — role spec semantics.
- `PROMPT_VERSION`   — wording / schema of the prompt.
- `ANALYSIS_VERSION` — columns + post-processing of analyses.

Each `Analyses` row records all three so old entries stay interpretable.

## End-to-end test plan

1. Run `setupSheets`. Re-run. Confirm no duplicate tabs, no data loss.
2. Seed a role in `Roles`.
3. Send a test email with a cover letter + a PDF resume; apply
   `Applicants/Inbox`; `Dandyhorse → Sync now`. Check the Applicants row
   and the hidden Analyses row.
4. Run `Sync now` again. Row should update in place; manual columns
   (`Status`, `Interest`, `Notes`, `Interview Date`) should be preserved
   unchanged.
5. Break the API key (set `ANTHROPIC_API_KEY` to `bad`). Send another
   test email. Confirm the row still appears with `Manual Review` and
   contact info, and `Analyses.Error Reason` is populated.
6. Send an email that references a graduation year but not an age.
   Confirm `Age` shows `Not stated`.
7. Forward a non-Craigslist applicant email and label it
   `Applicants/Inbox`. Confirm it gets processed the same way.
8. Trigger `Sync now` while the time trigger fires. Confirm no duplicate
   rows (the `LockService` wrapper serializes them).

## Notes

- Polling every 10 minutes is intentional. No Pub/Sub, no webhooks,
  nothing to break. Solo-operator friendly.
- The Anthropic model defaults to `claude-sonnet-4-6`. For quicker/cheaper
  runs, set `ANTHROPIC_MODEL=claude-haiku-4-5-20251001`. For maximum
  analytical quality, `claude-opus-4-7`.
- The script never sends auto-replies. Adding a reply flow is a future
  extension; `reply_status` already exists in the audit schema.
