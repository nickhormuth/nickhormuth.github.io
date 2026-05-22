# Inbox Copilot v2

A thin, Google-native email assistant for the **business** Gmail account. Gmail is the UI
(labels + drafts), batched briefs are the product, and a fast lane turns private-tour
inquiries into booked intro calls quickly. No custom dashboard, no auto-send in v1.

Full design: `../../.claude/plans/buliild-me-an-app-zesty-quiche.md`.

## Layout

```
src/
  jobs/        brief-run.ts (batched), fast-lane.ts (tour inquiries, ~5 min)
  spikes/      Phase 0 de-risk: draft-threading.ts, calendar-holds.ts
  google/      auth.ts (OAuth) + gmail/calendar/sheets/drive wrappers (googleapis)
  core/        triage, draft-reply, brief
  flows/       tour-inquiry, receipt, unsubscribe
  store/       firestore, cursor, idempotency, holds
  notify/      email-to-self, ntfy
  config/      schedule, categories, accounts
```

## Phase 0 — de-risk before building features

1. `cp .env.example .env` and fill `GOOGLE_CLIENT_ID/SECRET`.
2. `npm install`
3. `npm run auth:spike` → consent → capture the refresh token. Confirm the OAuth app is
   **"in production"** so the token survives past 7 days.
4. `npm run draft:spike` → confirm a reply threads correctly on web + mobile.
5. `npm run calendar:spike` → confirm 3 tentative holds + confirm-by-reply + 24h sweep.

Only after all three pass do we build Phase 1 (brief) and Phase 2 (fast lane).

## Runtime

Cloud Run **Jobs** triggered by Cloud Scheduler (no always-on service, no Pub/Sub). State in
a small Firestore. ~$0–3/mo GCP + ~$5–10/mo Anthropic.
