// Weekly cleanup job (Sunday evening). Surfaces unsubscribe candidates in a special brief
// email so the owner can confirm. v1 = surface only — actual unsubscribe firing happens when
// the owner replies "yes" with a confirmation token, OR via the dashboard later. For now we
// list candidates in the next brief; the owner can manually call the fire function.

import { authedClient } from "../google/auth.js";
import { gmailClient, listMessageIds } from "../google/gmail.js";
import { emailSelf } from "../notify/email.js";

async function main() {
  if (process.env.KILL === "true") return;
  const ownerEmail = process.env.BUSINESS_EMAIL;
  const briefTo = process.env.BRIEF_TO || ownerEmail;
  if (!ownerEmail || !briefTo) throw new Error("BUSINESS_EMAIL and BRIEF_TO required.");

  const auth = authedClient();
  const gmail = gmailClient(auth);

  // v1: total unread count in the last 30 days. v1.1 adds per-sender ranking + open-rate.
  // (Per-sender requires a getMessage call per id to read From — too expensive for a weekly
  // job at 500-msg scale without a metadata-only batch endpoint.)
  const ids = await listMessageIds(gmail, "in:inbox is:unread newer_than:30d", 500);
  const total = ids.length;
  const body = `Weekly cleanup (v1 placeholder):

Unread messages in your inbox from the last 30 days: ${total}

This summary is intentionally simple in v1. v1.1 will rank by sender + flag high-volume
never-opened senders for one-click RFC 8058 unsubscribe. Until then, use Gmail's own
"Unsubscribe" suggestion on individual senders.`;
  await emailSelf(gmail, ownerEmail, briefTo, "Weekly inbox cleanup", body);
  console.log(`weekly-cleanup: ${total} unread items in last 30d`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
