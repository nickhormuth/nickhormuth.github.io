import type { GmailClient } from "../google/gmail.js";
import {
  createDraftReply,
  getMessage,
  headerOf,
  plainTextBody,
  addLabel,
} from "../google/gmail.js";
import {
  freeBusy,
  proposeSlots,
  insertTentativeHold,
  type CalendarClient,
} from "../google/calendar.js";
import { draftReply } from "../core/draft-reply.js";
import { saveHold, type HoldRecord } from "../store/holds.js";
import { LABEL_FOR } from "../config/categories.js";
import { pushNtfy } from "../notify/ntfy.js";
import { HOLD_TTL_HOURS } from "../config/schedule.js";

export interface TourInquiryInput {
  gmail: GmailClient;
  cal: CalendarClient;
  messageId: string;
  ownerName: string;
  ownerEmail: string;
  businessCalendarId: string;
  timeZone: string;
  ntfyTopic?: string;
}

function parseFromHeader(s?: string): { name?: string; email: string } {
  if (!s) return { email: "" };
  const match = s.match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>\s*$/);
  if (match && match[1] && match[2]) return { name: match[1].trim(), email: match[2].trim() };
  return { email: s.trim() };
}

export async function handleTourInquiry(input: TourInquiryInput): Promise<HoldRecord | null> {
  const { gmail, cal, messageId } = input;
  const msg = await getMessage(gmail, messageId);
  const threadId = msg.threadId!;
  const fromHeader = headerOf(msg, "From");
  const subject = headerOf(msg, "Subject") ?? "(no subject)";
  const messageIdHeader = headerOf(msg, "Message-ID") ?? headerOf(msg, "Message-Id") ?? "";
  const refsHeader = headerOf(msg, "References") ?? "";
  const inquirer = parseFromHeader(fromHeader);
  if (!inquirer.email) return null;

  // Find 3 candidate slots in the next 7 business days, 30-min each.
  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60_000);
  const busy = await freeBusy(cal, input.businessCalendarId, now, horizon, input.timeZone);
  const slots = proposeSlots(busy, {
    from: new Date(now.getTime() + 60 * 60_000), // earliest = 1h from now
    to: horizon,
    durationMin: 30,
    count: 3,
    businessStartHourLocal: 9,
    businessEndHourLocal: 17,
    timeZone: input.timeZone,
  });
  if (slots.length < 3) {
    // Not enough availability — still draft a reply asking what works for them.
    return null;
  }

  // Place 3 tentative holds on the business calendar.
  const holdIds: string[] = [];
  for (const slot of slots) {
    const hold = await insertTentativeHold(cal, {
      calendarId: input.businessCalendarId,
      summary: `HOLD: tour inquiry — ${inquirer.name ?? inquirer.email}`,
      description: `Auto-hold from inbox-copilot. Expires in ${HOLD_TTL_HOURS}h if not confirmed.\nReply thread: ${threadId}`,
      start: slot.start,
      end: slot.end,
      timeZone: input.timeZone,
    });
    holdIds.push(hold.eventId);
  }

  // Draft the reply proposing those 3 times.
  const tzFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: input.timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const slotLines = slots.map((s) => `- ${tzFmt.format(new Date(s.start))}`).join("\n");

  const bodyText = await draftReply({
    fromName: input.ownerName,
    recipientName: inquirer.name,
    recipientEmail: inquirer.email,
    subject,
    threadText: plainTextBody(msg).slice(0, 4000),
    extraInstructions: `This is a private-tour inquiry. Acknowledge warmly, briefly mention we'd love to host them, and offer these three times for a quick 30-minute intro call. Ask them to reply with their pick. End with a sentence inviting them to share any specific dates/group size they have in mind.

Times to propose (verbatim — do not change formatting):
${slotLines}

If none of these work, invite them to share alternatives.`,
  });

  await createDraftReply(gmail, {
    threadId,
    to: fromHeader ?? inquirer.email,
    subject,
    inReplyTo: messageIdHeader,
    references: refsHeader,
    fromAddress: `${input.ownerName} <${input.ownerEmail}>`,
    bodyText,
  });

  await addLabel(gmail, messageId, LABEL_FOR.tour_inquiry);

  const record: HoldRecord = {
    inquiryMessageId: messageId,
    inquiryThreadId: threadId,
    inquirerEmail: inquirer.email,
    inquirerName: inquirer.name,
    calendarId: input.businessCalendarId,
    holdIds,
    proposedSlots: slots,
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  await saveHold(record);

  if (input.ntfyTopic) {
    await pushNtfy({
      topic: input.ntfyTopic,
      title: "🎫 Tour inquiry — draft ready",
      message: `From ${inquirer.name ?? inquirer.email}\n${subject}\n3 holds placed.`,
      priority: 4,
    });
  }

  return record;
}
