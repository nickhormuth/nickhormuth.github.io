import { fs, COLLECTIONS } from "./firestore.js";

export interface Cursor {
  lastRunAt: string; // ISO
  lastHistoryId?: string;
}

// Per-account cursor. v1 = "business".
export async function getCursor(account = "business"): Promise<Cursor | null> {
  const doc = await fs().collection(COLLECTIONS.cursor).doc(account).get();
  return (doc.exists ? (doc.data() as Cursor) : null);
}

export async function setCursor(cursor: Cursor, account = "business"): Promise<void> {
  await fs().collection(COLLECTIONS.cursor).doc(account).set(cursor);
}

// Build a Gmail query that fetches all mail since lastRunAt - slack. Date-bounded so an
// expired historyId never silently misses mail (red-team fix #5).
export function newSinceQuery(cursor: Cursor | null, baseQuery = ""): string {
  // 6h slack so we always re-cover the previous run, then idempotency dedupes.
  const since = cursor
    ? Math.floor(new Date(cursor.lastRunAt).getTime() / 1000) - 6 * 60 * 60
    : Math.floor(Date.now() / 1000) - 24 * 60 * 60;
  const parts = [`after:${since}`];
  if (baseQuery) parts.push(`(${baseQuery})`);
  return parts.join(" ");
}
