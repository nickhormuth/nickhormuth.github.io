import { google, gmail_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export type GmailClient = gmail_v1.Gmail;

export function gmailClient(auth: OAuth2Client): GmailClient {
  return google.gmail({ version: "v1", auth });
}

// --- read --------------------------------------------------------------------

export async function listMessageIds(
  gmail: GmailClient,
  query: string,
  max = 100,
): Promise<string[]> {
  const out: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: Math.min(max - out.length, 100),
      pageToken,
    });
    for (const m of res.data.messages ?? []) if (m.id) out.push(m.id);
    pageToken = res.data.nextPageToken ?? undefined;
    if (out.length >= max) break;
  } while (pageToken);
  return out;
}

export async function getMessage(gmail: GmailClient, id: string): Promise<gmail_v1.Schema$Message> {
  const res = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "full",
  });
  return res.data;
}

export function headerOf(msg: gmail_v1.Schema$Message, name: string): string | undefined {
  const h = msg.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? undefined;
}

export function plainTextBody(msg: gmail_v1.Schema$Message): string {
  const walk = (p?: gmail_v1.Schema$MessagePart): string => {
    if (!p) return "";
    if (p.mimeType === "text/plain" && p.body?.data) {
      return Buffer.from(p.body.data, "base64url").toString("utf8");
    }
    if (p.parts?.length) return p.parts.map(walk).join("\n");
    if (p.mimeType === "text/html" && p.body?.data) {
      // crude fallback strip
      return Buffer.from(p.body.data, "base64url")
        .toString("utf8")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    return "";
  };
  return walk(msg.payload ?? undefined);
}

// --- labels ------------------------------------------------------------------

const LABEL_CACHE = new Map<string, string>(); // name -> id

export async function ensureLabel(gmail: GmailClient, name: string): Promise<string> {
  if (LABEL_CACHE.has(name)) return LABEL_CACHE.get(name)!;
  const list = await gmail.users.labels.list({ userId: "me" });
  const existing = list.data.labels?.find((l) => l.name === name);
  if (existing?.id) {
    LABEL_CACHE.set(name, existing.id);
    return existing.id;
  }
  const created = await gmail.users.labels.create({
    userId: "me",
    requestBody: { name, labelListVisibility: "labelShow", messageListVisibility: "show" },
  });
  const id = created.data.id!;
  LABEL_CACHE.set(name, id);
  return id;
}

export async function addLabel(gmail: GmailClient, messageId: string, labelName: string): Promise<void> {
  const id = await ensureLabel(gmail, labelName);
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { addLabelIds: [id] },
  });
}

// --- drafts (CRITICAL: threading correctness — Phase 0 spike b) -------------

export interface DraftInput {
  threadId: string;
  to: string;
  cc?: string;
  subject: string;
  inReplyTo: string; // message-id of the message being replied to (with <>)
  references: string; // existing References header value (space-separated msg-ids with <>)
  fromAddress: string;
  bodyText: string;
}

function encodeBase64Url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}

export function buildRawReply(d: DraftInput): string {
  const refs = [d.references, d.inReplyTo].filter(Boolean).join(" ");
  const headers = [
    `From: ${d.fromAddress}`,
    `To: ${d.to}`,
    d.cc ? `Cc: ${d.cc}` : undefined,
    `Subject: ${d.subject.startsWith("Re:") ? d.subject : `Re: ${d.subject}`}`,
    `In-Reply-To: ${d.inReplyTo}`,
    `References: ${refs}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `MIME-Version: 1.0`,
  ].filter(Boolean) as string[];
  return `${headers.join("\r\n")}\r\n\r\n${d.bodyText}`;
}

export async function createDraftReply(
  gmail: GmailClient,
  d: DraftInput,
): Promise<{ draftId: string; messageId: string }> {
  const raw = encodeBase64Url(buildRawReply(d));
  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw, threadId: d.threadId } },
  });
  return { draftId: res.data.id!, messageId: res.data.message?.id! };
}

// --- send (unused in v1 — drafts are the trust model) ----------------------
