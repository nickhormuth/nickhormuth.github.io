#!/usr/bin/env bash
# Deploy inbox-copilot to Google Cloud Run Jobs + Cloud Scheduler.
# Idempotent — safe to re-run.

set -euo pipefail

PROJECT_ID="${PROJECT_ID:?set PROJECT_ID}"
REGION="${REGION:-us-west1}"
SERVICE="${SERVICE:-inbox-copilot}"
IMAGE="${IMAGE:-${REGION}-docker.pkg.dev/${PROJECT_ID}/inbox/${SERVICE}:latest}"
SA="${SA:-inbox-copilot@${PROJECT_ID}.iam.gserviceaccount.com}"
TZ="${TZ:-America/Los_Angeles}"

# --- one-time setup (safe to re-run) -----------------------------------------

gcloud config set project "$PROJECT_ID"

# APIs
gcloud services enable \
  run.googleapis.com \
  cloudscheduler.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  gmail.googleapis.com \
  calendar-json.googleapis.com \
  sheets.googleapis.com \
  drive.googleapis.com

# Artifact Registry repo
gcloud artifacts repositories describe inbox --location="$REGION" >/dev/null 2>&1 \
  || gcloud artifacts repositories create inbox --repository-format=docker --location="$REGION"

# Service account
gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 \
  || gcloud iam service-accounts create inbox-copilot --display-name "Inbox Copilot"

for role in roles/datastore.user roles/secretmanager.secretAccessor roles/run.invoker; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${SA}" --role="$role" >/dev/null
done

# Scheduler must be able to mint OIDC tokens for the SA — otherwise the scheduled HTTP call
# to Cloud Run Jobs `:run` returns 403.
gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --member="serviceAccount:${SA}" \
  --role="roles/iam.serviceAccountTokenCreator" >/dev/null

# Firestore native mode (in $REGION)
gcloud firestore databases describe --database="(default)" >/dev/null 2>&1 \
  || gcloud firestore databases create --location="$REGION" --type=firestore-native

# --- secrets -----------------------------------------------------------------
# These must be set OUT OF BAND (paste values once):
#   gcloud secrets create GOOGLE_CLIENT_ID --replication-policy=automatic
#   echo -n "<id>" | gcloud secrets versions add GOOGLE_CLIENT_ID --data-file=-
# Repeat for: GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, ANTHROPIC_API_KEY, NTFY_TOPIC

# --- build image -------------------------------------------------------------
gcloud builds submit --tag "$IMAGE" .

# --- Cloud Run Jobs ----------------------------------------------------------
deploy_job() {
  local name="$1"
  local args="$2"
  gcloud run jobs deploy "$name" \
    --image "$IMAGE" \
    --region "$REGION" \
    --service-account "$SA" \
    --args="$args" \
    --set-env-vars "GCP_PROJECT_ID=${PROJECT_ID},BUSINESS_EMAIL=${BUSINESS_EMAIL:?set BUSINESS_EMAIL},BUSINESS_CALENDAR_ID=${BUSINESS_CALENDAR_ID:-primary},OWNER_NAME=${OWNER_NAME:-},BRIEF_TO=${BRIEF_TO:?set BRIEF_TO},RECEIPT_SHEET_ID=${RECEIPT_SHEET_ID:-},RECEIPT_DRIVE_FOLDER_ID=${RECEIPT_DRIVE_FOLDER_ID:-}" \
    --set-secrets "GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,GOOGLE_REFRESH_TOKEN=GOOGLE_REFRESH_TOKEN:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,NTFY_TOPIC=NTFY_TOPIC:latest"
}

deploy_job brief-run       "src/jobs/brief-run.ts"
deploy_job fast-lane       "src/jobs/fast-lane.ts"
deploy_job sweep-holds     "src/jobs/sweep-holds.ts"
deploy_job weekly-cleanup  "src/jobs/weekly-cleanup.ts"

# --- Cloud Scheduler ---------------------------------------------------------
# Pass a SLOT_NAME via the job's overrides so brief-run can label the digest in subject lines.
# (argv[2] under `npx tsx` is the script path, not our positional arg — env var is the only
# safe way.)
schedule() {
  local name="$1" cron="$2" job="$3" slot="${4:-}"
  local uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/jobs/${job}:run"
  local body='{}'
  if [[ -n "$slot" ]]; then
    body=$(cat <<JSON
{ "overrides": { "containerOverrides": [ { "env": [ { "name": "SLOT_NAME", "value": "$slot" } ] } ] } }
JSON
)
  fi
  gcloud scheduler jobs describe "$name" --location "$REGION" >/dev/null 2>&1 && \
    gcloud scheduler jobs delete "$name" --location "$REGION" --quiet
  gcloud scheduler jobs create http "$name" \
    --location "$REGION" \
    --schedule "$cron" \
    --time-zone "$TZ" \
    --uri "$uri" \
    --http-method POST \
    --headers "Content-Type=application/json" \
    --message-body "$body" \
    --oauth-service-account-email "$SA"
}

# 5 brief slots (weekdays)
schedule brief-0730       "30 7  * * 1-5" brief-run "early-morning"
schedule brief-1100       "0  11 * * 1-5" brief-run "late-morning"
schedule brief-1330       "30 13 * * 1-5" brief-run "early-afternoon"
schedule brief-1630       "30 16 * * 1-5" brief-run "late-afternoon"
schedule brief-2000       "0  20 * * 1-5" brief-run "evening"
# weekend slots
schedule brief-0830-wknd  "30 8  * * 6,0" brief-run "weekend-morning"
schedule brief-1200-wknd  "0  12 * * 6,0" brief-run "weekend-midday"
schedule brief-1600-wknd  "0  16 * * 6,0" brief-run "weekend-afternoon"
schedule brief-2000-wknd  "0  20 * * 6,0" brief-run "weekend-evening"

# fast lane every 5 min
schedule fast-lane "*/5 * * * *" fast-lane

# sweep stale holds hourly
schedule sweep-holds "0 * * * *" sweep-holds

# weekly cleanup — Sunday 21:00 local
schedule weekly-cleanup "0 21 * * 0" weekly-cleanup

echo
echo "Deployed. Manually trigger any job with: gcloud run jobs execute <name> --region $REGION"
