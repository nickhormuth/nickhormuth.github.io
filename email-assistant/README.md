# Inbox Copilot v2

A thin, Google-native email assistant for the **business** Gmail account. Gmail is the UI
(labels + drafts), batched briefs are the product, and a fast lane turns private-tour
inquiries into booked intro calls quickly. No custom dashboard, no auto-send in v1.

Full design + the red-team that shaped it: `../../.claude/plans/buliild-me-an-app-zesty-quiche.md`.

## Layout

```
src/
  jobs/        brief-run.ts (5 slots/day), fast-lane.ts (~5 min), sweep-holds.ts (hourly)
  spikes/      Phase 0 de-risk: draft-threading.ts, calendar-holds.ts
  google/      auth.ts (OAuth) + gmail/calendar/sheets/drive wrappers (googleapis)
  core/        anthropic, triage (Haiku 4.5), draft-reply (Opus 4.7), brief
  flows/       tour-inquiry (live), receipt (Phase 3 stub), unsubscribe (Phase 3, RFC 8058)
  store/       firestore, cursor (date-bounded + idempotent), holds
  notify/      email-to-self (via Gmail API), ntfy (phone push)
  config/      categories, schedule
infra/         deploy.sh (gcloud + Cloud Run Jobs + Scheduler), schema.firestore.md
Dockerfile     node:22-slim → npx tsx (entrypoint takes a job path)
```

## Get started

See **`ONBOARDING.md`** for the full 10-minute setup. Short version:

1. Create a GCP project, enable Gmail/Calendar/Sheets/Drive APIs, set the OAuth consent
   screen to **In production**, create an OAuth Web client with redirect
   `http://localhost:8080/oauth2callback`.
2. `cp .env.example .env` and fill the values.
3. `npm install && npm test` — 15 unit tests for threading + timezone correctness.
4. `npm run auth:spike` → consent → paste the refresh token back into `.env`.
5. `npm run preflight` — validates env + OAuth + Gmail + Calendar + Anthropic + Firestore.
6. Phase 0 spikes: `npm run draft:spike -- <message-id>` and `npm run calendar:spike`.
7. `bash infra/deploy.sh` to ship.

## Run locally

```
npm run brief          # one batched brief pass against your business inbox
npm run fast-lane      # one fast-lane scan
```

## Deploy

`infra/deploy.sh` provisions Artifact Registry, the service account, Firestore, builds the
container, deploys three Cloud Run Jobs (`brief-run`, `fast-lane`, `sweep-holds`), and wires
Cloud Scheduler (5 weekday slots, 4 weekend slots, fast-lane every 5 min, sweep hourly).

Secrets live in Secret Manager (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_REFRESH_TOKEN`, `ANTHROPIC_API_KEY`, `NTFY_TOPIC`).

## Cost

GCP (Jobs + Scheduler + Firestore + Secrets) ~$0–3/mo on free tier; Anthropic ~$5–10/mo at
typical business-inbox volume. ~$10/mo all-in.

## Trust model

- No auto-send in v1. Every important reply lands in **Gmail Drafts**; you hit send.
- Every label change is enumerated in the brief — nothing happens silently.
- `KILL=true` env var → every job is a no-op.
