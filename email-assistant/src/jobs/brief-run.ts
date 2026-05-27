import { authedClient } from "../google/auth.js";
import {
  gmailClient,
  listMessageIds,
  getMessage,
  headerOf,
  plainTextBody,
  addLabel,
  createDraftReply,
} from "../google/gmail.js";
import { triageEmail } from "../core/triage.js";
import { draftReply } from "../core/draft-reply.js";
import { formatBrief, type BriefItem } from "../core/brief.js";
import { emailSelf } from "../notify/email.js";
import { pushNtfy } from "../notify/ntfy.js";
import { LABEL_FOR } from "../config/categories.js";
import { getCursor, setCursor, newSinceQuery } from "../store/cursor.js";
import { claim } from "../store/idempotency.js";

function threadLink(threadId: string): string {
  return `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
}

function draftLink(draftId: string): string {
  return `https://mail.google.com/mail/u/0/#drafts/${draftId}`;
}

function parseFrom(s?: string): string {
  if (!s) return "(unknown)";
  const match = s.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/);
  return match && match[1] ? match[1].trim() : s;
}

async function main() {
  if (process.env.KILL === "true") {
    console.log("KILL=true → no-op");
    return;
  }
  const slotName = process.argv[2] || new Date().toISOString().slice(0, 16);
  const ownerEmail = process.env.BUSINESS_EMAIL;
  const briefTo = process.env.BRIEF_TO || ownerEmail;
  if (!ownerEmail || !briefTo) throw new Error("BUSINESS_EMAIL and BRIEF_TO required.");

  const auth = authedClient();
  const gmail = gmailClient(auth);

  const cursor = await getCursor();
  const query = newSinceQuery(cursor, "in:inbox");
  const ids = await listMessageIds(gmail, query, 200);

  const needsYou: BriefItem[] = [];
  const fyi: BriefItem[] = [];
  const filed: BriefItem[] = [];
  const stale: BriefItem[] = [];
  const labelChanges: { messageId: string; from: string; subject: string; addedLabels: string[] }[] = [];

  for (const id of ids) {
    if (!(await claim(id))) continue; // already processed
    const msg = await getMessage(gmail, id);
    const fromHeader = headerOf(msg, "From");
    const subject = headerOf(msg, "Subject") ?? "(no subject)";
    const fromName = parseFrom(fromHeader);
    const body = plainTextBody(msg);
    const snippet = msg.snippet ?? "";

    const triage = await triageEmail({
      fromAddress: fromHeader ?? "",
      fromName,
      subject,
      snippet,
      bodyText: body,
    });

    // Tour inquiries are handled by the fast lane; only label here.
    if (triage.category === "tour_inquiry") {
      await addLabel(gmail, id, LABEL_FOR.tour_inquiry);
      labelChanges.push({ messageId: id, from: fromName, subject, addedLabels: [LABEL_FOR.tour_inquiry] });
      needsYou.push({
        category: triage.category,
        importance: "high",
        from: fromName,
        subject,
        threadLink: threadLink(msg.threadId!),
        reason: "Tour inquiry — fast lane handling it",
      });
      continue;
    }

    const label = LABEL_FOR[triage.category];
    await addLabel(gmail, id, label);
    labelChanges.push({ messageId: id, from: fromName, subject, addedLabels: [label] });

    const item: BriefItem = {
      category: triage.category,
      importance: triage.importance,
      from: fromName,
      subject,
      threadLink: threadLink(msg.threadId!),
      reason: triage.reason,
    };

    const important = triage.importance === "high" || triage.importance === "medium";
    if (important && triage.needsReply) {
      const bodyText = await draftReply({
        fromName: ownerEmail.split("@")[0] ?? "me",
        recipientEmail: (fromHeader ?? "").replace(/.*<|>.*/g, "") || fromHeader || "",
        recipientName: fromName,
        subject,
        threadText: body.slice(0, 4000),
      });
      const messageIdHeader = headerOf(msg, "Message-ID") ?? headerOf(msg, "Message-Id") ?? "";
      const refsHeader = headerOf(msg, "References") ?? "";
      const draft = await createDraftReply(gmail, {
        threadId: msg.threadId!,
        to: fromHeader ?? "",
        subject,
        inReplyTo: messageIdHeader,
        references: refsHeader,
        fromAddress: ownerEmail,
        bodyText,
      });
      item.draftLink = draftLink(draft.draftId);
      needsYou.push(item);
    } else if (important) {
      needsYou.push(item);
    } else if (
      triage.category === "newsletter" ||
      triage.category === "promotional" ||
      triage.category === "receipt"
    ) {
      filed.push(item);
    } else {
      fyi.push(item);
    }

    if (triage.idealReplyByISO && new Date(triage.idealReplyByISO) < new Date()) {
      stale.push(item);
    }
  }

  const { subject, body } = formatBrief({
    slotName,
    needsYou,
    fyi,
    filed,
    stale,
    labelChanges,
  });

  await emailSelf(gmail, ownerEmail, briefTo, subject, body);
  if (process.env.NTFY_TOPIC && needsYou.length > 0) {
    await pushNtfy({
      topic: process.env.NTFY_TOPIC,
      title: `Inbox brief — ${slotName}`,
      message: `${needsYou.length} need you. ${stale.length} stale. ${filed.length} filed.`,
      priority: needsYou.length > 3 ? 4 : 3,
    });
  }

  await setCursor({ lastRunAt: new Date().toISOString() });
  console.log(`brief sent: ${needsYou.length} need-you / ${fyi.length} fyi / ${filed.length} filed / ${stale.length} stale`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
