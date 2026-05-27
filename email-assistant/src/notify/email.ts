import type { GmailClient } from "../google/gmail.js";

// Send a plain "email-to-self" using the authenticated Gmail account. Used for briefs.
// No SMTP needed — we use the user's own outbox via the Gmail API.
export async function emailSelf(
  gmail: GmailClient,
  from: string,
  to: string,
  subject: string,
  bodyText: string,
): Promise<void> {
  const raw = Buffer.from(
    [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `MIME-Version: 1.0`,
      "",
      bodyText,
    ].join("\r\n"),
    "utf8",
  ).toString("base64url");
  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
}
