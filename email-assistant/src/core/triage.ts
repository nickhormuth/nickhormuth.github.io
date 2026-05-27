import { anthropic, TRIAGE_MODEL, DRAFT_MODEL } from "./anthropic.js";
import { CATEGORIES, IMPORTANCE, type Category, type Importance } from "../config/categories.js";

export interface TriageInput {
  fromAddress: string;
  fromName?: string;
  subject: string;
  snippet: string;
  bodyText: string;
}

export interface TriageOutput {
  importance: Importance;
  category: Category;
  needsReply: boolean;
  idealReplyByISO: string | null;
  reason: string;
  confidence: number; // 0..1
}

const SCHEMA_HINT = `Return ONLY valid JSON with this exact shape:
{
  "importance": ${JSON.stringify(IMPORTANCE)},
  "category": ${JSON.stringify(CATEGORIES)},
  "needsReply": boolean,
  "idealReplyByISO": string | null,
  "reason": string,
  "confidence": number
}`;

const SYSTEM = `You are an email triage assistant for a small hospitality/tour-business owner (lighthouse, yurt, Trillium tours). Classify each email accurately and conservatively.

Key signals:
- A "tour_inquiry" is an unsolicited person asking about availability, booking, pricing, or a private tour. These are hot leads.
- "client_request" = an existing customer needs a response on an existing booking/order.
- "receipt" = transactional receipt or invoice for an expense.
- "newsletter"/"promotional" = bulk sender, not a real human waiting on a reply.
- Be conservative: when unsure, set lower importance.

${SCHEMA_HINT}`;

function buildUser(t: TriageInput): string {
  return [
    `From: ${t.fromName ? `${t.fromName} <${t.fromAddress}>` : t.fromAddress}`,
    `Subject: ${t.subject}`,
    `Snippet: ${t.snippet}`,
    "---",
    t.bodyText.slice(0, 4000),
  ].join("\n");
}

function parseJson(s: string): TriageOutput | null {
  // strip code fences if any
  const cleaned = s.replace(/```json\s*|```\s*$/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as TriageOutput;
  } catch {
    return null;
  }
}

export async function triageEmail(t: TriageInput): Promise<TriageOutput> {
  // First pass: Haiku
  const haikuRes = await anthropic().messages.create({
    model: TRIAGE_MODEL,
    max_tokens: 400,
    system: SYSTEM,
    messages: [{ role: "user", content: buildUser(t) }],
  });
  const haikuText = haikuRes.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");
  const first = parseJson(haikuText);

  if (first && first.confidence >= 0.7) return first;

  // Low confidence → re-adjudicate on Opus
  const opusRes = await anthropic().messages.create({
    model: DRAFT_MODEL,
    max_tokens: 500,
    system: SYSTEM,
    messages: [{ role: "user", content: buildUser(t) }],
  });
  const opusText = opusRes.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");
  const second = parseJson(opusText);
  return (
    second ??
    first ?? {
      importance: "low",
      category: "other",
      needsReply: false,
      idealReplyByISO: null,
      reason: "triage-fallback",
      confidence: 0,
    }
  );
}
