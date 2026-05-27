import { fs, COLLECTIONS } from "./firestore.js";

// Returns true if we've already processed this Gmail message id (and records it if not).
// Keys are doc-id-safe (Gmail msg ids are hex-ish, fine for Firestore).
export async function claim(messageId: string): Promise<boolean> {
  const ref = fs().collection(COLLECTIONS.processed).doc(messageId);
  try {
    return await fs().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) return false;
      tx.set(ref, { processedAt: new Date().toISOString() });
      return true;
    });
  } catch (e) {
    // On contention, assume the other run won — skip.
    return false;
  }
}
