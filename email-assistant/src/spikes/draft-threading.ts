// Phase 0 spike (b): prove a reply draft threads correctly on Gmail web AND mobile.
//
// Run:  npm run draft:spike <gmail-message-id-to-reply-to>
//
// Picks the given message, builds a reply draft with In-Reply-To + References + threadId set
// correctly, creates the draft. You then verify on web AND on the Gmail mobile app that the
// draft appears inline in the thread (not as a new thread).

import { authedClient } from "../google/auth.js";
import {
  gmailClient,
  getMessage,
  headerOf,
  createDraftReply,
  parseAddress,
} from "../google/gmail.js";

async function main() {
  const targetId = process.argv[2];
  if (!targetId) {
    console.error("Usage: npm run draft:spike -- <gmail-message-id>");
    process.exit(1);
  }
  const ownerEmail = process.env.BUSINESS_EMAIL;
  if (!ownerEmail) throw new Error("BUSINESS_EMAIL required.");

  const auth = authedClient();
  const gmail = gmailClient(auth);
  const msg = await getMessage(gmail, targetId);
  const from = headerOf(msg, "From") ?? "";
  const subject = headerOf(msg, "Subject") ?? "(no subject)";
  const messageIdHeader = headerOf(msg, "Message-ID") ?? headerOf(msg, "Message-Id") ?? "";
  const refsHeader = headerOf(msg, "References") ?? "";

  const to = parseAddress(from);
  if (!to) throw new Error(`Could not parse From header: ${from}`);
  const draft = await createDraftReply(gmail, {
    threadId: msg.threadId!,
    to,
    subject,
    inReplyTo: messageIdHeader,
    references: refsHeader,
    from: { email: ownerEmail },
    bodyText:
      "This is a Phase 0 threading spike from inbox-copilot. If you're reading this inline in the original thread on both Gmail web AND the Gmail mobile app, the spike PASSES. Delete this draft when done.",
  });

  console.log(`Draft created: ${draft.draftId}`);
  console.log(`Open Gmail web: https://mail.google.com/mail/u/0/#drafts/${draft.draftId}`);
  console.log("Then open the Gmail mobile app and confirm the draft appears INSIDE the original thread.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
