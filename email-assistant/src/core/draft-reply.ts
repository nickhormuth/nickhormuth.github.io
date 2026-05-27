import { anthropic, DRAFT_MODEL } from "./anthropic.js";

export interface DraftContext {
  fromName: string; // the owner's name (e.g. "Nick")
  recipientName?: string;
  recipientEmail: string;
  subject: string;
  threadText: string; // recent thread quoted for context
  voiceHints?: string; // optional notes about tone (defaults to friendly + concise)
  extraInstructions?: string; // flow-specific (e.g. tour inquiry → propose times)
}

const SYSTEM = `You draft email REPLIES on behalf of a small hospitality/tour-business owner.

Style defaults:
- Warm, concise, professional. Plain text only.
- Match the recipient's tone (formal vs. casual).
- Sign off with the owner's first name only — no taglines, no signatures.
- Never invent facts (prices, dates, names) you weren't given. If unsure, say "I'll confirm and follow up."
- Output ONLY the body of the reply. No subject line, no greeting commentary, no "Here's a draft:" preamble.`;

export async function draftReply(ctx: DraftContext): Promise<string> {
  const userParts = [
    `Owner: ${ctx.fromName}`,
    ctx.recipientName ? `Recipient: ${ctx.recipientName} <${ctx.recipientEmail}>` : `Recipient: ${ctx.recipientEmail}`,
    `Subject: ${ctx.subject}`,
    ctx.voiceHints ? `Voice hints: ${ctx.voiceHints}` : "Voice: warm, concise, conversational.",
    ctx.extraInstructions ? `Special instructions:\n${ctx.extraInstructions}` : "",
    "---",
    "Recent thread:",
    ctx.threadText.slice(0, 6000),
  ]
    .filter(Boolean)
    .join("\n");

  const res = await anthropic().messages.create({
    model: DRAFT_MODEL,
    max_tokens: 800,
    system: SYSTEM,
    messages: [{ role: "user", content: userParts }],
  });
  return res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")
    .trim();
}
