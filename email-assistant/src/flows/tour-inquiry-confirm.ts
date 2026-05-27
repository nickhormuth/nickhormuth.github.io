// Close the tour-inquiry loop: detect the guest's reply, match it against the 3 proposed
// slots, confirm one, delete the other two, draft a confirmation reply. Without this the
// "propose 3 holds" mechanic is theater — the holds always just expire.

import { anthropic, TRIAGE_MODEL } from "../core/anthropic.js";
import {
  addLabel,
  createDraftReply,
  getMessage,
  headerOf,
  parseAddress,
  plainTextBody,
  type GmailClient,
} from "../google/gmail.js";
import {
  confirmHold,
  deleteEvent,
  type CalendarClient,
} from "../google/calendar.js";
import { draftReply } from "../core/draft-reply.js";
import { getHold, markHold, type HoldRecord } from "../store/holds.js";
import { LABEL_FOR } from "../config/categories.js";
import { pushNtfy } from "../notify/ntfy.js";

interface MatchResult {
  matchedIndex: number | null; // 0,1,2 or null if no clear pick
  confidence: number; // 0..1
  reason: string;
}

async function matchReplyToSlot(
  replyText: string,
  proposedSlots: { start: string; end: string }[],
  timeZone: string,
): Promise<MatchResult> {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const list = proposedSlots
    .map((s, i) => `[${i}] ${fmt.format(new Date(s.start))}`)
    .join("\n");

  const res = await anthropic().messages.create({
    model: TRIAGE_MODEL,
    max_tokens: 200,
    system: `You match a customer's reply to one of three proposed meeting times. Return ONLY JSON:
{"matchedIndex": 0|1|2|null, "confidence": 0..1, "reason": "..."}

Rules:
- If they clearly picked one of the three, return its index with high confidence.
- If they suggested a different time or none of the three, matchedIndex must be null.
- If ambiguous, prefer null over a wrong guess (confidence < 0.7).`,
    messages: [
      {
        role: "user",
        content: `Proposed slots:\n${list}\n\nCustomer reply:\n${replyText.slice(0, 3000)}`,
      },
    ],
  });
  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { matchedIndex: null, confidence: 0, reason: "no-json" };
  try {
    return JSON.parse(match[0]) as MatchResult;
  } catch {
    return { matchedIndex: null, confidence: 0, reason: "parse-error" };
  }
}

export interface ConfirmTourInquiryInput {
  gmail: GmailClient;
  cal: CalendarClient;
  messageId: string; // the GUEST's reply message id
  hold: HoldRecord;
  ownerName: string;
  ownerEmail: string;
  timeZone: string;
  ntfyTopic?: string;
}

export async function handleTourInquiryReply(
  input: ConfirmTourInquiryInput,
): Promise<{ confirmedIndex: number | null; needsManualReview: boolean }> {
  const { gmail, cal, messageId, hold } = input;
  const msg = await getMessage(gmail, messageId);
  const fromHeader = headerOf(msg, "From");
  const inquirer = parseAddress(fromHeader);

  // Safety: only act if the reply is from the original inquirer (don't confirm based on a
  // forwarded thread or an unrelated participant).
  if (!inquirer || inquirer.email.toLowerCase() !== hold.inquirerEmail.toLowerCase()) {
    return { confirmedIndex: null, needsManualReview: false };
  }

  const replyText = plainTextBody(msg);
  const match = await matchReplyToSlot(replyText, hold.proposedSlots, input.timeZone);

  if (match.matchedIndex === null || match.confidence < 0.7) {
    // Ambiguous — leave the holds in place, draft nothing automatic, surface in ntfy so the
    // owner can manually confirm.
    if (input.ntfyTopic) {
      await pushNtfy({
        topic: input.ntfyTopic,
        title: "🎫 Tour reply — manual confirm",
        message: `From ${inquirer.email}\nCouldn't auto-match their reply to one of the 3 slots. Confirm manually.`,
        priority: 4,
      });
    }
    return { confirmedIndex: null, needsManualReview: true };
  }

  const chosenIdx = match.matchedIndex;
  const chosenSlot = hold.proposedSlots[chosenIdx];
  const chosenEventId = hold.holdIds[chosenIdx];
  if (!chosenSlot || !chosenEventId) {
    return { confirmedIndex: null, needsManualReview: true };
  }

  // Atomically: confirm the chosen, delete the other two. Mark Firestore last so a crash
  // mid-way leaves the calendar consistent (we'd rather drop a hold than double-book).
  await confirmHold(cal, hold.calendarId, chosenEventId);
  for (let i = 0; i < hold.holdIds.length; i++) {
    if (i === chosenIdx) continue;
    const eventId = hold.holdIds[i];
    if (!eventId) continue;
    try {
      await deleteEvent(cal, hold.calendarId, eventId);
    } catch (e) {
      console.warn(`confirm: failed to delete sibling hold ${eventId}`, e);
    }
  }
  await markHold(hold.inquiryThreadId, {
    status: "confirmed",
    confirmedSlot: chosenSlot,
    confirmedEventId: chosenEventId,
  });

  // Draft a confirmation reply.
  const messageIdHeader = headerOf(msg, "Message-ID") ?? headerOf(msg, "Message-Id") ?? "";
  const refsHeader = headerOf(msg, "References") ?? "";
  const subject = headerOf(msg, "Subject") ?? "Tour inquiry";
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: input.timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const confirmBody = await draftReply({
    fromName: input.ownerName,
    recipientName: inquirer.name,
    recipientEmail: inquirer.email,
    subject,
    threadText: replyText.slice(0, 4000),
    extraInstructions: `The guest confirmed their preferred time. Acknowledge it clearly, confirm the time (${fmt.format(new Date(chosenSlot.start))}), and say you'll send a calendar invite. Brief and warm. Two-three sentences max.`,
  });

  await createDraftReply(gmail, {
    threadId: hold.inquiryThreadId,
    to: inquirer,
    subject,
    inReplyTo: messageIdHeader,
    references: refsHeader,
    from: { name: input.ownerName, email: input.ownerEmail },
    bodyText: confirmBody,
  });

  await addLabel(gmail, messageId, LABEL_FOR.tour_inquiry);

  if (input.ntfyTopic) {
    await pushNtfy({
      topic: input.ntfyTopic,
      title: "✅ Tour time confirmed",
      message: `${inquirer.name ?? inquirer.email} picked ${fmt.format(new Date(chosenSlot.start))}. Confirmation draft ready.`,
      priority: 5,
    });
  }

  return { confirmedIndex: chosenIdx, needsManualReview: false };
}

// Fetch the pending hold for a given thread (helper for fast-lane integration).
export async function holdForThread(threadId: string): Promise<HoldRecord | null> {
  const hold = await getHold(threadId);
  return hold && hold.status === "pending" ? hold : null;
}
