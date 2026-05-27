import { authedClient } from "../google/auth.js";
import {
  gmailClient,
  listMessageIds,
  getMessage,
  headerOf,
  plainTextBody,
} from "../google/gmail.js";
import { calendarClient } from "../google/calendar.js";
import { triageEmail } from "../core/triage.js";
import { handleTourInquiry } from "../flows/tour-inquiry.js";
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

  const ids = await listMessageIds(gmail, TOUR_INQUIRY_QUERY, 50);
  let handled = 0;

  for (const id of ids) {
    // Idempotency: only one job should process a given message.
    if (!(await claim(`fastlane:${id}`))) continue;

    const msg = await getMessage(gmail, id);
    const triage = await triageEmail({
      fromAddress: headerOf(msg, "From") ?? "",
      subject: headerOf(msg, "Subject") ?? "",
      snippet: msg.snippet ?? "",
      bodyText: plainTextBody(msg),
    });

    if (triage.category !== "tour_inquiry") {
      // Not actually a tour inquiry — let the next brief handle it.
      continue;
    }

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
    handled++;
  }

  console.log(`fast-lane: scanned ${ids.length}, handled ${handled} tour inquiries`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
