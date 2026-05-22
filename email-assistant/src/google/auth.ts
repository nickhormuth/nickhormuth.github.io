import { createServer } from "node:http";
import { google } from "googleapis";

// Scopes for v1 (business account only). Keep minimal — fewer scopes = lighter OAuth review.
export const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify", // read, label, draft (no hard delete)
  "https://www.googleapis.com/auth/calendar.events", // free/busy + create tentative holds
  "https://www.googleapis.com/auth/spreadsheets", // expense sheet
  "https://www.googleapis.com/auth/drive.file", // only files this app creates (receipt PDFs)
];

export function oauthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (see .env.example).");
  }
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI ?? "http://localhost:8080/oauth2callback",
  );
}

// Phase 0 spike (a): run `npm run auth:spike`, click consent, capture a refresh token,
// then confirm it still works after >7 days (OAuth app must be "in production", not "testing").
async function runConsentFlow() {
  const client = oauthClient();
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
  console.log("\nOpen this URL, approve, and the token will be captured here:\n", url, "\n");

  await new Promise<void>((resolve) => {
    const server = createServer(async (req, res) => {
      const code = new URL(req.url ?? "", "http://localhost:8080").searchParams.get("code");
      if (!code) {
        res.writeHead(400).end("missing code");
        return;
      }
      const { tokens } = await client.getToken(code);
      console.log("\nREFRESH TOKEN (store in Secret Manager / .env GOOGLE_REFRESH_TOKEN):\n");
      console.log(tokens.refresh_token, "\n");
      res.writeHead(200).end("Authorized. You can close this tab.");
      server.close();
      resolve();
    });
    server.listen(8080, () => console.log("Listening on http://localhost:8080 for the OAuth callback…"));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runConsentFlow().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
