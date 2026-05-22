// Phase 0 spike (b): prove a reply draft threads correctly on Gmail web AND mobile.
// A draft must carry the original threadId AND RFC In-Reply-To/References headers, or it
// sends as a new thread / breaks the conversation — the most common silent failure here.
//
// TODO:
//  1. Pick a recent thread in the business inbox; read its Message-ID + References headers.
//  2. Build a raw RFC 5322 message with In-Reply-To + References set, base64url-encode it.
//  3. gmail.users.drafts.create({ message: { threadId, raw } }).
//  4. Verify on web and on the Gmail mobile app that the draft appears inline in the thread.
export {};
