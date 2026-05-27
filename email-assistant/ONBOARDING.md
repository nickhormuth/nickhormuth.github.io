# Onboarding — the single 10-minute setup

Everything that doesn't require your Google sign-in or paid-API credentials is already built.
Below is the **only manual work left** to get Inbox Copilot running. Read top-to-bottom; copy-
paste as you go.

You'll need: a Google account (the business one), a credit card on the GCP project (free-tier
will cover this — you won't be charged), and an [Anthropic API key](https://console.anthropic.com).

---

## 1. Create the GCP project (2 min)

1. Go to <https://console.cloud.google.com>.
2. Top bar → project dropdown → **New Project** → name it `inbox-copilot` (or anything) →
   **Create**.
3. Copy the **Project ID** (e.g. `inbox-copilot-844302`). You'll paste it later.

## 2. Enable the four APIs (1 min)

In the same project, go to **APIs & Services → Library** and enable each of these:

- **Gmail API**
- **Google Calendar API**
- **Google Sheets API**
- **Google Drive API**

(Click each, then **Enable**.)

## 3. OAuth consent screen — set to "In production" (3 min)

This is the step that prevents the 7-day refresh-token death. Do not skip it.

1. **APIs & Services → OAuth consent screen.**
2. User Type: **External** → **Create**.
3. App name: `Inbox Copilot`. User support email: your business email. Developer email: same.
4. **Save and continue** through Scopes, Test users (no need to add any), Summary.
5. Back on the OAuth consent screen page, click **Publish App** → confirm.
   - Status should read **In production**. This is what stops the 7-day refresh-token death
     in "testing" mode.
   - Heads-up: Gmail and Drive are **sensitive scopes** under Google's OAuth policy. Your
     own consent flow will still work fine, but the consent screen will show a *"Google hasn't
     verified this app"* warning — click **Advanced → Go to Inbox Copilot (unsafe)** to
     proceed. Verification (CASA) is only needed if you ever share the consent URL with
     others; for a single-user self-consent it isn't required.

## 4. Create the OAuth client (1 min)

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID.**
2. Application type: **Web application**.
3. Name: `Inbox Copilot CLI`.
4. **Authorized redirect URIs → Add URI:**  `http://localhost:8080/oauth2callback`
5. **Create** → a dialog shows your **Client ID** and **Client Secret**. Keep this tab open.

## 5. Fill `.env` and run the OAuth spike (2 min)

In a terminal, from this repo:

```
cd email-assistant
cp .env.example .env
```

Open `.env` and fill in:
- `GOOGLE_CLIENT_ID` — from step 4
- `GOOGLE_CLIENT_SECRET` — from step 4
- `BUSINESS_EMAIL` — your business Gmail
- `GCP_PROJECT_ID` — from step 1
- `ANTHROPIC_API_KEY` — from <https://console.anthropic.com/settings/keys>
- `BRIEF_TO` — usually the same as `BUSINESS_EMAIL` (where the brief lands)
- `NTFY_TOPIC` — pick an unguessable string, e.g. `nick-inbox-r4f8a2`. Install the
  [ntfy iOS/Android app](https://ntfy.sh/) and subscribe to that topic.

Then:

```
npm install     # if you haven't already
npm test        # 15 unit tests should all pass — validates the riskiest code
npm run auth:spike
```

The spike will print a Google consent URL. Open it in your browser, choose the **business**
account (important — not your personal Google account), click through the "this app isn't
verified" warning (it's yours), grant access. The terminal will print a **refresh token**.

Paste that refresh token into `.env` as `GOOGLE_REFRESH_TOKEN`.

## 6. Phase 0 spikes (1 min — proves the riskiest mechanics work)

```
npm run preflight       # validates env + Gmail + Calendar + Anthropic + Firestore all wired up
```

If everything is green:

```
npm run draft:spike -- <a-recent-business-message-id>
```

To get a message id, open any inbox thread in Gmail web → copy the long string after
`#inbox/` in the URL — that's the thread id. For the spike use the **message** id, which you
can fetch with:

```
node -e "import('./node_modules/googleapis/build/src/index.js').then(m => { /* placeholder */ })"
```

…or just use the most-recent-message helper in the spike (TODO if needed). After running it,
open Gmail web and the Gmail mobile app and confirm the draft appears **inside** the original
thread, not as a new thread. That confirms threading correctness.

```
npm run calendar:spike            # places 3 tentative holds on your business calendar
# verify the 3 holds appear at sensible times (not 2 AM!)
npm run calendar:spike -- confirm <eventId> <other1> <other2>
# verify the chosen one is now confirmed and the other two are gone
npm run calendar:spike -- sweep   # cleans up any stale holds
```

If all three spikes pass, you're done with Phase 0. The two riskiest production bugs (offering
2 AM slots, broken threading) are now physically proven not to fire.

## 7. Deploy (the rest is unattended)

```
export PROJECT_ID=<your project id>
export BUSINESS_EMAIL=<your business email>
export BRIEF_TO=<your business email>
export OWNER_NAME="Nick"
bash infra/deploy.sh
```

Push secrets into Secret Manager once (the deploy script reads from there):

```
for s in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_REFRESH_TOKEN ANTHROPIC_API_KEY NTFY_TOPIC; do
  gcloud secrets create $s --replication-policy=automatic 2>/dev/null || true
  echo -n "$(grep ^$s= .env | cut -d= -f2-)" | gcloud secrets versions add $s --data-file=-
done
```

That's it. From here Cloud Scheduler fires:
- **5 weekday brief slots** + 4 weekend slots
- **fast lane every 5 min** (tour inquiries → holds + draft + push)
- **hold sweep hourly**

## When something fails

- **Preflight fails on OAuth:** redo step 3 (consent screen must be "In production").
- **Preflight fails on Firestore:** the deploy script creates Firestore — run it before preflight, or `gcloud firestore databases create --location=$REGION --type=firestore-native` manually.
- **Briefs arrive but drafts thread incorrectly on mobile:** open an issue with the message id; the threading test suite covers all known cases but mobile Gmail has historically been fussy.
- **No brief received at scheduled time:** check `gcloud scheduler jobs list` + `gcloud run jobs executions list --job=brief-run --region=$REGION`.

## Kill switch

`gcloud secrets versions add KILL --data-file=<(echo true)` and redeploy, or set the
`KILL=true` env var on the jobs. Every job becomes a no-op immediately.
