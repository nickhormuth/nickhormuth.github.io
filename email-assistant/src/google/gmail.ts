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

// Parse an RFC 5322-ish From/To header into a structured Address. Handles `"Name" <a@b>`,
// `Name <a@b>`, and bare `a@b`. Tolerates the common malformed cases.
export function parseAddress(raw: string | undefined): { name?: string; email: string } | null {
  if (!raw) return null;
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<\s*([^>\s]+@[^>\s]+)\s*>\s*$/);
  if (m && m[2]) {
    const name = m[1]?.trim();
    return name ? { name, email: m[2].trim() } : { email: m[2].trim() };
  }
  const bare = raw.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  if (bare) return { email: bare[0] };
  return null;
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

export interface Address {
  name?: string;
  email: string;
}

export interface DraftInput {
  threadId: string;
  to: Address; // structured — never pass a raw From header through
  cc?: Address[];
  subject: string;
  inReplyTo: string; // Message-ID of the message being replied to
  references: string; // existing References header value (space-separated msg-ids)
  from: Address;
  bodyText: string;
}

function encodeBase64Url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}

// Wrap a Message-ID in angle brackets if the upstream server forgot them. Some contact-form
// senders emit malformed Message-IDs without brackets and that breaks threading silently.
export function normalizeMessageId(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) return trimmed;
  return `<${trimmed.replace(/[<>]/g, "")}>`;
}

// Strip any number of locale "Re:"/"RE:"/"Fwd:"/"Aw:" prefixes (with optional whitespace/colons)
// before re-adding our own "Re: ", to avoid "Re: Re: Re:" chains.
export function rePrefix(subject: string): string {
  const stripped = subject.replace(/^\s*(re|fwd?|aw|sv|antw|wg)\s*:\s*/gi, "").trim();
  return `Re: ${stripped}`;
}

// RFC 2047 encode if the string has non-ASCII bytes (smart quotes, accents, emoji).
function encodeHeader(s: string): string {
  // eslint-disable-next-line no-control-regex
  if (!/[^\x00-\x7F]/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;
}

function formatAddress(a: Address): string {
  if (!a.name) return a.email;
  // Quote names containing characters that would break the header (commas, angle brackets, etc.)
  const name = /[",<>@]/.test(a.name) ? `"${a.name.replace(/"/g, '\\"')}"` : a.name;
  return `${encodeHeader(name)} <${a.email}>`;
}

export function buildRawReply(d: DraftInput): string {
  const inReplyTo = normalizeMessageId(d.inReplyTo);
  const existingRefs = d.references.trim();
  const refs = [existingRefs, inReplyTo].filter(Boolean).join(" ");
  const subject = encodeHeader(rePrefix(d.subject));
  const headers = [
    `From: ${formatAddress(d.from)}`,
    `To: ${formatAddress(d.to)}`,
    d.cc?.length ? `Cc: ${d.cc.map(formatAddress).join(", ")}` : undefined,
    `Subject: ${subject}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : undefined,
    refs ? `References: ${refs}` : undefined,
    `Date: ${new Date().toUTCString()}`,
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
