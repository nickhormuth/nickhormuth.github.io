import { authedClient } from "../google/auth.js";
import {
  gmailClient,
  listMessageIds,
  getMessage,
  headerOf,
  plainTextBody,
  parseAddress,
} from "../google/gmail.js";
import { calendarClient } from "../google/calendar.js";
import { triageEmail } from "../core/triage.js";
import { handleTourInquiry } from "../flows/tour-inquiry.js";
import { handleTourInquiryReply, holdForThread } from "../flows/tour-inquiry-confirm.js";
import { getHold } from "../store/holds.js";
import { claim } from "../store/idempotency.js";
import { TOUR_INQUIRY_QUERY, BUSINESS_TZ } from "../config/schedule.js";

async function main() {
  if (process.env.KILL === "true") {
    console.log("KILL=true → no-op");
    return;
  }
  const ownerEmail = process.env.BUSINESS_EMAIL;
  const ownerName = process.env.OWNER_NAME || (ownerEmail ?? "").split("@")[0] || "me";
  const calendarId = process.env.BUSINESS_CALENDAR_ID || "primary";
  if (!ownerEmail) throw new Error("BUSINESS_EMAIL required.");

  const auth = authedClient();
  const gmail = gmailClient(auth);
  const cal = calendarClient(auth);

  // Sweep newer-than-1d unread mail in inbox; the LLM filters to actual tour inquiries.
  // Also picks up replies to existing inquiries (same thread, new message) so we can close
  // the loop without a separate scan.
  const ids = await listMessageIds(gmail, TOUR_INQUIRY_QUERY, 50);
  let newInquiries = 0;
  let confirmedReplies = 0;
  let errors = 0;

  for (const id of ids) {
    try {
      const msg = await getMessage(gmail, id);
      const threadId = msg.threadId!;
      const fromHeader = headerOf(msg, "From");
      const fromAddr = parseAddress(fromHeader);

      // If this message is a reply on a thread we have a pending hold for, try to confirm.
      // Skip if the message is from the owner (their own reply doesn't count as a guest pick).
      const pendingHold = await holdForThread(threadId);
      if (pendingHold) {
        if (!fromAddr || fromAddr.email.toLowerCase() === ownerEmail.toLowerCase()) continue;
        if (!(await claim(id))) continue;
        const result = await handleTourInquiryReply({
          gmail,
          cal,
          messageId: id,
          hold: pendingHold,
          ownerName,
          ownerEmail,
          timeZone: BUSINESS_TZ,
          ntfyTopic: process.env.NTFY_TOPIC,
        });
        if (result.confirmedIndex !== null) confirmedReplies++;
        continue;
      }

      // New tour inquiry path. Use the SAME idempotency key as the brief so we never
      // double-triage (red-team fix #3/#4).
      const triage = await triageEmail({
        fromAddress: fromHeader ?? "",
        subject: headerOf(msg, "Subject") ?? "",
        snippet: msg.snippet ?? "",
        bodyText: plainTextBody(msg),
      });

      if (triage.category !== "tour_inquiry") continue;

      // If we already created a hold for this thread (any status), skip — prevents
      // duplicate holds if a previous run crashed before claiming.
      if (await getHold(threadId)) continue;

      await handleTourInquiry({
        gmail,
        cal,
        messageId: id,
        ownerName,
        ownerEmail,
        businessCalendarId: calendarId,
        timeZone: BUSINESS_TZ,
        ntfyTopic: process.env.NTFY_TOPIC,
      });
      // Claim only after successful handling so a crash mid-way is retried, not poisoned.
      await claim(id);
      newInquiries++;
    } catch (err) {
      errors++;
      console.error(`fast-lane: failed processing ${id}`, err);
    }
  }

  console.log(
    `fast-lane: scanned ${ids.length}, new ${newInquiries}, confirmed ${confirmedReplies}, errors ${errors}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
