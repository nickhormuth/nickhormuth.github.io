import { anthropic, DRAFT_MODEL } from "./anthropic.js";

export interface BriefItem {
  category: string;
  importance: string;
  from: string;
  subject: string;
  draftLink?: string;
  threadLink: string;
  reason: string;
}

export interface BriefInput {
  slotName: string;
  needsYou: BriefItem[]; // important, draft-ready
  fyi: BriefItem[]; // low importance
  filed: BriefItem[]; // newsletters, receipts, promos auto-labeled
  stale: BriefItem[]; // past ideal_reply_by
  labelChanges: { messageId: string; from: string; subject: string; addedLabels: string[] }[];
}

// Format a deterministic plain-text brief (no LLM needed) so latency + cost stay low and the
// "everything is enumerated" promise is bulletproof.
export function formatBrief(b: BriefInput): { subject: string; body: string } {
  const lines: string[] = [];
  const subject = `Inbox brief — ${b.slotName} — ${b.needsYou.length} need you, ${b.stale.length} stale`;
  lines.push(`# ${subject}`, "");

  if (b.needsYou.length) {
    lines.push(`## 🔴 Needs you (${b.needsYou.length})`);
    for (const it of b.needsYou) {
      lines.push(`- [${it.importance}] **${it.from}** — ${it.subject}`);
      lines.push(`  why: ${it.reason}`);
      if (it.draftLink) lines.push(`  draft: ${it.draftLink}`);
      lines.push(`  thread: ${it.threadLink}`);
    }
    lines.push("");
  }

  if (b.stale.length) {
    lines.push(`## ⏰ Past their ideal reply-by (${b.stale.length})`);
    for (const it of b.stale) {
      lines.push(`- **${it.from}** — ${it.subject}`);
      lines.push(`  thread: ${it.threadLink}`);
    }
    lines.push("");
  }

  if (b.fyi.length) {
    lines.push(`## 🟡 FYI (${b.fyi.length})`);
    for (const it of b.fyi.slice(0, 15)) {
      lines.push(`- ${it.from} — ${it.subject}`);
    }
    if (b.fyi.length > 15) lines.push(`  …and ${b.fyi.length - 15} more`);
    lines.push("");
  }

  if (b.filed.length) {
    lines.push(`## 🧾 Filed (${b.filed.length})`);
    const byCat: Record<string, number> = {};
    for (const it of b.filed) byCat[it.category] = (byCat[it.category] ?? 0) + 1;
    for (const [cat, n] of Object.entries(byCat)) lines.push(`- ${cat}: ${n}`);
    lines.push("");
  }

  if (b.labelChanges.length) {
    lines.push(`## 🏷  Label changes (${b.labelChanges.length}) — nothing happens silently`);
    for (const c of b.labelChanges.slice(0, 30)) {
      lines.push(`- ${c.from} — ${c.subject} → ${c.addedLabels.join(", ")}`);
    }
    if (b.labelChanges.length > 30) lines.push(`  …and ${b.labelChanges.length - 30} more`);
  }

  return { subject, body: lines.join("\n") };
}

// Optional: LLM "top of the brief" summary in the owner's voice. Used only when there are
// items in needsYou — otherwise the deterministic format is enough.
export async function topOfBriefBlurb(b: BriefInput): Promise<string> {
  if (!b.needsYou.length) return "";
  const list = b.needsYou
    .map((it) => `- [${it.importance}] ${it.from}: ${it.subject} (${it.reason})`)
    .join("\n");
  const res = await anthropic().messages.create({
    model: DRAFT_MODEL,
    max_tokens: 250,
    system:
      "You write a 2–3 sentence executive headline for a personal inbox brief. Plain text. No bullet points. No greeting.",
    messages: [
      {
        role: "user",
        content: `Brief slot: ${b.slotName}\nNeeds-you items:\n${list}\n\nWrite the headline.`,
      },
    ],
  });
  return res.content
    .filter((bb) => bb.type === "text")
    .map((bb) => (bb as { text: string }).text)
    .join("")
    .trim();
}
