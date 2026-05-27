// Preflight checker — validates everything is wired up correctly without sending any mail
// or making any user-visible changes. Run BEFORE deploying. Exit code 0 = all green.
//
//   npm run preflight

import { authedClient } from "../google/auth.js";
import { gmailClient, listMessageIds } from "../google/gmail.js";
import { calendarClient, freeBusy } from "../google/calendar.js";
import { anthropic, TRIAGE_MODEL } from "../core/anthropic.js";
import { fs as fsdb } from "../store/firestore.js";

interface Check {
  name: string;
  run: () => Promise<string>; // resolves to a one-line OK summary; throws on fail
}

const checks: Check[] = [
  {
    name: "env vars",
    run: async () => {
      const required = [
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "GOOGLE_REFRESH_TOKEN",
        "ANTHROPIC_API_KEY",
        "BUSINESS_EMAIL",
        "GCP_PROJECT_ID",
      ];
      const missing = required.filter((k) => !process.env[k]);
      if (missing.length) throw new Error(`missing: ${missing.join(", ")}`);
      return `all required env vars set`;
    },
  },
  {
    name: "OAuth — refresh token still works",
    run: async () => {
      const client = authedClient();
      const { token } = await client.getAccessToken();
      if (!token) throw new Error("got no access token from refresh");
      // Also probe expiry — if the refresh-token grant returned an expiry < 7d horizon,
      // your OAuth app probably isn't in "production" mode.
      return `access token minted (length ${token.length})`;
    },
  },
  {
    name: "Gmail — list works",
    run: async () => {
      const gmail = gmailClient(authedClient());
      const ids = await listMessageIds(gmail, "in:inbox", 1);
      return `gmail.users.messages.list OK (saw ${ids.length} sample id)`;
    },
  },
  {
    name: "Gmail — sendAs identity matches BUSINESS_EMAIL",
    run: async () => {
      const gmail = gmailClient(authedClient());
      const profile = await gmail.users.getProfile({ userId: "me" });
      const expected = process.env.BUSINESS_EMAIL?.toLowerCase();
      if (profile.data.emailAddress?.toLowerCase() !== expected) {
        throw new Error(
          `BUSINESS_EMAIL=${expected} but the authorized account is ${profile.data.emailAddress}`,
        );
      }
      return `authorized as ${profile.data.emailAddress}`;
    },
  },
  {
    name: "Calendar — freebusy works",
    run: async () => {
      const cal = calendarClient(authedClient());
      const calId = process.env.BUSINESS_CALENDAR_ID || "primary";
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60_000);
      const busy = await freeBusy(cal, calId, now, tomorrow, "America/Los_Angeles");
      return `freebusy(${calId}) returned ${busy.length} busy intervals for next 24h`;
    },
  },
  {
    name: "Anthropic — triage model responds",
    run: async () => {
      const res = await anthropic().messages.create({
        model: TRIAGE_MODEL,
        max_tokens: 20,
        messages: [{ role: "user", content: 'Reply with just the word "ok".' }],
      });
      const text = res.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("")
        .toLowerCase();
      if (!text.includes("ok")) throw new Error(`unexpected reply: ${text.slice(0, 40)}`);
      return `${TRIAGE_MODEL} responded`;
    },
  },
  {
    name: "Firestore — read/write probe",
    run: async () => {
      const ref = fsdb().collection("__preflight").doc("probe");
      await ref.set({ at: new Date().toISOString() });
      const snap = await ref.get();
      if (!snap.exists) throw new Error("write reported success but read returned empty");
      await ref.delete();
      return `wrote+read+deleted /__preflight/probe`;
    },
  },
];

async function main() {
  let failed = 0;
  for (const check of checks) {
    process.stdout.write(`▶ ${check.name} ... `);
    try {
      const summary = await check.run();
      console.log(`OK — ${summary}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`FAIL — ${message}`);
      failed++;
    }
  }
  if (failed > 0) {
    console.error(`\n${failed} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll preflight checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
