import { Firestore } from "@google-cloud/firestore";

let _fs: Firestore | null = null;

export function fs(): Firestore {
  if (_fs) return _fs;
  _fs = new Firestore({
    projectId: process.env.GCP_PROJECT_ID,
    databaseId: process.env.FIRESTORE_DATABASE || "(default)",
  });
  return _fs;
}

export const COLLECTIONS = {
  cursor: "cursor",
  processed: "processed",
  holds: "holds",
  receipts: "receipts",
  senderStats: "sender_stats",
  audit: "audit",
} as const;
