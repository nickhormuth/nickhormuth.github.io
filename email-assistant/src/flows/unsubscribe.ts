// Phase 3 — one-click unsubscribe via RFC 8058 List-Unsubscribe-Post.
//
// Read the message's List-Unsubscribe + List-Unsubscribe-Post headers.
// If the message advertises `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, POST to the
// https URL in List-Unsubscribe with that form body. No HTML scraping.
//
// Also create a Gmail filter for the sender to auto-archive stragglers.

import type { gmail_v1 } from "googleapis";

const ONE_CLICK_FORM = "List-Unsubscribe=One-Click";

export interface UnsubInfo {
  oneClickUrl?: string;
  mailtoUrl?: string;
}

export function parseUnsubHeaders(msg: gmail_v1.Schema$Message): UnsubInfo {
  const headers = msg.payload?.headers ?? [];
  const lu = headers.find((h) => h.name?.toLowerCase() === "list-unsubscribe")?.value;
  const lup = headers.find((h) => h.name?.toLowerCase() === "list-unsubscribe-post")?.value;
  if (!lu) return {};
  const urls = Array.from(lu.matchAll(/<([^>]+)>/g))
    .map((m) => m[1])
    .filter((u): u is string => Boolean(u));
  const httpUrl = urls.find((u) => u.startsWith("http"));
  const mailto = urls.find((u) => u.startsWith("mailto:"));
  return {
    oneClickUrl: lup?.toLowerCase().includes(ONE_CLICK_FORM.toLowerCase()) ? httpUrl : undefined,
    mailtoUrl: mailto,
  };
}

export async function fireOneClickUnsub(url: string): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: ONE_CLICK_FORM,
  });
  return { ok: res.ok, status: res.status };
}
