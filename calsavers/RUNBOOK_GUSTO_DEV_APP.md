# Runbook: Register a Gusto Developer App

**Time:** ~10 minutes, one time.
**Outcome:** `client_id`, `client_secret`, and (after a bootstrap script) a long-lived `refresh_token` stored in GitHub Actions secrets.

## Steps

1. Open https://dev.gusto.com/ → click **Sign Up** (top-right). Use your Gusto admin email.
2. Verify email if prompted; complete profile.
3. In the dev portal: **Applications → Create new application**.
4. Fill the form:
   - **Name:** `CalSavers Remit (Internal)`
   - **Description:** `Pulls payroll deductions to remit to CalSavers`
   - **Redirect URI:** `http://localhost:8765/oauth/callback`
   - **Scopes:** `payroll:read`, `employee:read`, `company:read`
   - **Type:** `Sandbox` first (for testing) → later add `Production`
5. Click **Create**. Copy these into 1Password / a secure note:
   - `Client ID` (semi-public)
   - `Client Secret` (treat like a password — Gusto only shows it once)
6. Tell Claude when both values are in hand. We'll then:
   - Run a one-time bootstrap script that opens your browser
   - You sign in as the company admin and approve the app
   - Script captures the long-lived refresh token
   - All three values go into GitHub Actions secrets (`GUSTO_CLIENT_ID`, `GUSTO_CLIENT_SECRET`, `GUSTO_REFRESH_TOKEN`)

## Notes

- The redirect URI port (`8765`) is arbitrary; just keep it consistent with the bootstrap script.
- Use the **App Integrations** product family, not **Embedded Payroll**.
- Sandbox mode gives you a fake company with fake employees — perfect for first runs before pointing at real payroll data.
- Refresh tokens go stale after **60 days idle**. The biweekly cron keeps it active automatically.
