import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (_client) return _client;
  _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export const TRIAGE_MODEL = process.env.TRIAGE_MODEL || "claude-haiku-4-5-20251001";
export const DRAFT_MODEL = process.env.DRAFT_MODEL || "claude-opus-4-7";
