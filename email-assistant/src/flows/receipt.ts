// Phase 3 — receipt extractor.
// Detect category == "receipt" mail, extract structured fields with Opus, append a row to a
// Google Sheet, save the PDF/HTML to Drive, link it.
//
// Sheet schema (auto-created on first run if SHEET_ID is set and the sheet is empty):
//   date | vendor | amount | currency | category | business_or_personal | payment_method |
//   gmail_message_id | drive_link | confidence | added_at
//
// Only rows with confidence >= 0.8 land in the sheet; lower-confidence ones are returned
// for the brief to surface as "Confirm these receipts."

import { anthropic, DRAFT_MODEL } from "../core/anthropic.js";
import {
  getMessage,
  headerOf,
  plainTextBody,
  type GmailClient,
} from "../google/gmail.js";
import { uploadAttachment, type DriveClient } from "../google/drive.js";
import { appendRow, type SheetsClient } from "../google/sheets.js";
import { fs as fsdb, COLLECTIONS } from "../store/firestore.js";

export interface Receipt {
  date: string; // ISO date YYYY-MM-DD
  vendor: string;
  amount: number;
  currency: string;
  category: "meals" | "lodging" | "transport" | "software" | "supplies" | "fees" | "other";
  businessOrPersonal: "business" | "personal" | "unknown";
  paymentMethod?: string;
  confidence: number;
}

const SYSTEM = `Extract a single receipt/invoice into JSON. Return ONLY:
{
  "date": "YYYY-MM-DD",
  "vendor": string,
  "amount": number,           // total paid, post-tax, no currency symbol
  "currency": "USD" | "EUR" | "GBP" | ...,
  "category": "meals" | "lodging" | "transport" | "software" | "supplies" | "fees" | "other",
  "businessOrPersonal": "business" | "personal" | "unknown",
  "paymentMethod": string | null,
  "confidence": number        // 0..1, lower for ambiguous/missing fields
}

Rules:
- For ambiguous total (subtotal vs total), prefer the post-tax total.
- If the email is a SHIPPING notification or invoice receipt (not a payment receipt), set confidence below 0.6.
- If currency cannot be determined, set "USD" and reduce confidence by 0.2.
- Do not invent vendor names. If you can't identify a vendor confidently, set "unknown" and low confidence.`;

function parseJson(s: string): Receipt | null {
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Receipt;
  } catch {
    return null;
  }
}

export async function extractReceipt(
  gmail: GmailClient,
  messageId: string,
): Promise<{ receipt: Receipt | null; subject: string; from: string; messageId: string }> {
  const msg = await getMessage(gmail, messageId);
  const subject = headerOf(msg, "Subject") ?? "";
  const from = headerOf(msg, "From") ?? "";
  const body = plainTextBody(msg).slice(0, 6000);
  const res = await anthropic().messages.create({
    model: DRAFT_MODEL,
    max_tokens: 400,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `From: ${from}\nSubject: ${subject}\n---\n${body}`,
      },
    ],
  });
  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");
  return { receipt: parseJson(text), subject, from, messageId };
}

// First PDF attachment, if any. Returns the binary bytes + filename.
export async function firstPdfAttachment(
  gmail: GmailClient,
  messageId: string,
): Promise<{ data: Buffer; filename: string } | null> {
  const msg = await getMessage(gmail, messageId);
  const walk = (
    p?: import("googleapis").gmail_v1.Schema$MessagePart,
  ): { id: string; filename: string } | null => {
    if (!p) return null;
    if (p.mimeType === "application/pdf" && p.body?.attachmentId && p.filename) {
      return { id: p.body.attachmentId, filename: p.filename };
    }
    for (const child of p.parts ?? []) {
      const r = walk(child);
      if (r) return r;
    }
    return null;
  };
  const found = walk(msg.payload ?? undefined);
  if (!found) return null;
  const attachment = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: found.id,
  });
  const b64 = attachment.data.data ?? "";
  return { data: Buffer.from(b64, "base64url"), filename: found.filename };
}

export async function recordReceipt(
  gmail: GmailClient,
  drive: DriveClient,
  sheets: SheetsClient,
  opts: {
    messageId: string;
    sheetId: string;
    driveFolderId?: string;
  },
): Promise<{ ok: boolean; reason?: string; sheetRow?: (string | number | null)[] }> {
  const { receipt, subject, from, messageId } = await extractReceipt(gmail, opts.messageId);
  if (!receipt) return { ok: false, reason: "extraction-failed" };
  if (receipt.confidence < 0.8) return { ok: false, reason: "low-confidence", sheetRow: undefined };

  // Save attachment (if any) to Drive for the audit trail.
  let driveLink = "";
  const pdf = await firstPdfAttachment(gmail, messageId).catch(() => null);
  if (pdf) {
    const uploaded = await uploadAttachment(drive, {
      name: `${receipt.vendor}-${receipt.date}-${pdf.filename}`,
      mimeType: "application/pdf",
      data: pdf.data,
      folderId: opts.driveFolderId,
    });
    driveLink = uploaded.webViewLink;
  }

  const row: (string | number | null)[] = [
    receipt.date,
    receipt.vendor,
    receipt.amount,
    receipt.currency,
    receipt.category,
    receipt.businessOrPersonal,
    receipt.paymentMethod ?? "",
    messageId,
    driveLink,
    receipt.confidence,
    new Date().toISOString(),
  ];
  await appendRow(sheets, opts.sheetId, "Sheet1!A:K", row);
  await fsdb()
    .collection(COLLECTIONS.receipts)
    .doc(messageId)
    .set({ ...receipt, subject, from, driveLink, addedAt: new Date().toISOString() });

  return { ok: true, sheetRow: row };
}
