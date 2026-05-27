import { google, drive_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { Readable } from "node:stream";

export type DriveClient = drive_v3.Drive;

export function driveClient(auth: OAuth2Client): DriveClient {
  return google.drive({ version: "v3", auth });
}

export async function uploadAttachment(
  drive: DriveClient,
  opts: { name: string; mimeType: string; data: Buffer; folderId?: string },
): Promise<{ id: string; webViewLink: string }> {
  const res = await drive.files.create({
    requestBody: {
      name: opts.name,
      mimeType: opts.mimeType,
      parents: opts.folderId ? [opts.folderId] : undefined,
    },
    media: {
      mimeType: opts.mimeType,
      body: Readable.from(opts.data),
    },
    fields: "id, webViewLink",
  });
  return { id: res.data.id!, webViewLink: res.data.webViewLink ?? "" };
}
