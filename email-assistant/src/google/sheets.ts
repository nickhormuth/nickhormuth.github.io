import { google, sheets_v4 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export type SheetsClient = sheets_v4.Sheets;

export function sheetsClient(auth: OAuth2Client): SheetsClient {
  return google.sheets({ version: "v4", auth });
}

export async function appendRow(
  sheets: SheetsClient,
  spreadsheetId: string,
  range: string,
  row: (string | number | null)[],
): Promise<void> {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}
