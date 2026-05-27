import { fs, COLLECTIONS } from "./firestore.js";

export interface HoldRecord {
  inquiryMessageId: string;
  inquiryThreadId: string;
  inquirerEmail: string;
  inquirerName?: string;
  calendarId: string;
  holdIds: string[]; // calendar event ids (all 3)
  proposedSlots: { start: string; end: string }[];
  createdAt: string;
  status: "pending" | "confirmed" | "expired";
  confirmedSlot?: { start: string; end: string };
  confirmedEventId?: string;
}

export async function saveHold(rec: HoldRecord): Promise<void> {
  await fs().collection(COLLECTIONS.holds).doc(rec.inquiryThreadId).set(rec);
}

export async function getHold(threadId: string): Promise<HoldRecord | null> {
  const doc = await fs().collection(COLLECTIONS.holds).doc(threadId).get();
  return doc.exists ? (doc.data() as HoldRecord) : null;
}

export async function listPendingHolds(): Promise<HoldRecord[]> {
  const snap = await fs().collection(COLLECTIONS.holds).where("status", "==", "pending").get();
  return snap.docs.map((d) => d.data() as HoldRecord);
}

export async function markHold(threadId: string, patch: Partial<HoldRecord>): Promise<void> {
  await fs().collection(COLLECTIONS.holds).doc(threadId).set(patch, { merge: true });
}
