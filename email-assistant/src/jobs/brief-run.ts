import { authedClient } from "../google/auth.js";
import {
  gmailClient,
  listMessageIds,
  getMessage,
  headerOf,
  plainTextBody,
  addLabel,
  createDraftReply,
  parseAddress,
} from "../google/gmail.js";
import { triageEmail } from "../core/triage.js";
import { draftReply } from "../core/draft-reply.js";
import { formatBrief, topOfBriefBlurb, type BriefItem } from "../core/brief.js";
import { emailSelf } from "../notify/email.js";
import { pushNtfy } from "../notify/ntfy.js";
import { LABEL_FOR } from "../config/categories.js";
import { getCursor, setCursor, newSinceQuery } from "../store/cursor.js";
import { claim } from "../store/idempotency.js";
import { driveClient } from "../google/drive.js";
import { sheetsClient } from "../google/sheets.js";
import { recordReceipt } from "../flows/receipt.js";

function threadLink(threadId: string): string {
  return `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
}

function draftLink(draftId: string): string {
  return `https://mail.google.com/mail/u/0/#drafts/${draftId}`;
}

function displayName(s?: string): string {
  const parsed = parseAddress(s);
  if (parsed?.name) return parsed.name;
  if (parsed?.email) return parsed.email;
  return s ?? "(unknown)";
}

async function main() {
  if (process.env.KILL === "true") {
    console.log("KILL=true → no-op");
    return;
  }
  // slotName from env, not argv — under `npx tsx`, argv[2] is the script path, not our arg.
  const slotName = process.env.SLOT_NAME || new Date().toISOString().slice(0, 16);
  const ownerEmail = process.env.BUSINESS_EMAIL;
  const ownerName = process.env.OWNER_NAME || (ownerEmail ?? "").split("@")[0] || "me";
  const briefTo = process.env.BRIEF_TO || ownerEmail;
  if (!ownerEmail || !briefTo) throw new Error("BUSINESS_EMAIL and BRIEF_TO required.");

  const auth = authedClient();
  const gmail = gmailClient(auth);
  const drive = driveClient(auth);
  const sheets = sheetsClient(auth);
  const receiptSheetId = process.env.RECEIPT_SHEET_ID;
  const receiptDriveFolder = process.env.RECEIPT_DRIVE_FOLDER_ID;

  const cursor = await getCursor();
  const query = newSinceQuery(cursor, "in:inbox");
  const ids = await listMessageIds(gmail, query, 200);

  const needsYou: BriefItem[] = [];
  const fyi: BriefItem[] = [];
  const filed: BriefItem[] = [];
  const stale: BriefItem[] = [];
  const labelChanges: { messageId: string; from: string; subject: string; addedLabels: string[] }[] = [];
  let errors = 0;

  for (const id of ids) {
    try {
      const msg = await getMessage(gmail, id);
      const fromHeader = headerOf(msg, "From");
      const subject = headerOf(msg, "Subject") ?? "(no subject)";
      const fromName = displayName(fromHeader);
      const body = plainTextBody(msg);
      const snippet = msg.snippet ?? "";

      const triage = await triageEmail({
        fromAddress: fromHeader ?? "",
        fromName,
        subject,
        snippet,
        bodyText: body,
      });

      // Tour inquiries are owned by the fast lane — do NOT claim here, or fast-lane will
      // skip and the inquiry never gets its holds/draft. Just leave it for the next
      // fast-lane run (which is within 5 min).
      if (triage.category === "tour_inquiry") {
        continue;
      }

      const label = LABEL_FOR[triage.category];
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
        const inquirer = parseAddress(fromHeader);
        if (!inquirer) {
          // Don't claim — let a future run retry once the address parses.
          continue;
        }
        const bodyText = await draftReply({
          fromName: ownerName,
          recipientEmail: inquirer.email,
          recipientName: inquirer.name,
          subject,
          threadText: body.slice(0, 4000),
        });
        const messageIdHeader = headerOf(msg, "Message-ID") ?? headerOf(msg, "Message-Id") ?? "";
        const refsHeader = headerOf(msg, "References") ?? "";
        const draft = await createDraftReply(gmail, {
          threadId: msg.threadId!,
          to: inquirer,
          subject,
          inReplyTo: messageIdHeader,
          references: refsHeader,
          from: { name: ownerName, email: ownerEmail },
          bodyText,
        });
        item.draftLink = draftLink(draft.draftId);
      }

      // Receipts: if a sheet is configured, extract + record. Failure is non-fatal (we still
      // file the message under filed/).
      if (triage.category === "receipt" && receiptSheetId) {
        try {
          await recordReceipt(gmail, drive, sheets, {
            messageId: id,
            sheetId: receiptSheetId,
            driveFolderId: receiptDriveFolder,
          });
        } catch (e) {
          console.warn(`receipt: failed for ${id}`, e);
        }
      }

      // Apply the label only after the (possibly LLM) work above succeeded.
      await addLabel(gmail, id, label);
      labelChanges.push({ messageId: id, from: fromName, subject, addedLabels: [label] });

      // Stale items are mutually exclusive from the other buckets so counts don't double.
      const isStale = triage.idealReplyByISO && new Date(triage.idealReplyByISO) < new Date();
      if (isStale) {
        stale.push(item);
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

      // Claim ONLY after every side effect succeeded — otherwise a thrown error mid-message
      // would permanently poison the message. (Red-team fix.)
      await claim(id);
    } catch (err) {
      errors++;
      console.error(`brief: failed processing ${id}`, err);
      // Do NOT claim — let the next run retry.
    }
  }

  const headline = await topOfBriefBlurb({ slotName, needsYou, fyi, filed, stale, labelChanges }).catch(
    () => "",
  );
  const { subject, body } = formatBrief({
    slotName,
    needsYou,
    fyi,
    filed,
    stale,
    labelChanges,
  });
  const finalBody = headline ? `${headline}\n\n${body}` : body;
  const finalSubject = errors ? `${subject} (${errors} errors)` : subject;

  await emailSelf(gmail, ownerEmail, briefTo, finalSubject, finalBody);
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
