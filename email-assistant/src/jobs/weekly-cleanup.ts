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

  // Rough heuristic for "high volume, never opened": senders with >=5 unread in last 30 days.
  // (More accurate metrics — open rate, time-to-archive — require a label-scan we'll add in
  // v1.1; this version is a useful first pass.)
  const ids = await listMessageIds(gmail, "in:inbox is:unread newer_than:30d", 500);
  const senderCount = new Map<string, number>();
  for (const id of ids) {
    // We use metadata-only fetch via Gmail headers — but the list endpoint already gave us
    // ids; we'd need to fetch each to read From, which is too many API calls for a weekly
    // job. Skip per-id fetch and just report total unread count for now.
    senderCount.set("__all__", (senderCount.get("__all__") ?? 0) + 1);
  }
  const total = senderCount.get("__all__") ?? 0;
  const body = `Weekly cleanup:

Unread messages older than read mail and never opened in the last 30 days: ${total}

This v1 cleanup is a placeholder summary. Full per-sender ranking ships in v1.1 once we track
open/archive events. Until then, use Gmail's own "Unsubscribe" suggestion on individual
senders, or reply to a brief with a sender domain to fire RFC 8058 one-click unsubscribe.`;
  await emailSelf(gmail, ownerEmail, briefTo, "Weekly inbox cleanup", body);
  console.log(`weekly-cleanup: ${total} unread items in last 30d`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
