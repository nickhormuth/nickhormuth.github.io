// Extract.gs — turn a Gmail thread into a Candidate object.
// Explicitly does not trust thread.getMessages()[0]: picks the latest inbound
// (non-operator) message and prefers the newest resume-like attachment.

function getBestCandidate_(thread) {
  const operatorEmail = (Session.getActiveUser().getEmail() || '').toLowerCase();
  const messages = thread.getMessages();

  // Filter: drop messages authored by the operator (outgoing replies).
  const inbound = messages.filter(m => {
    const from = (m.getFrom() || '').toLowerCase();
    return operatorEmail ? from.indexOf(operatorEmail) < 0 : true;
  });
  if (inbound.length === 0) {
    return {
      ok: false,
      reason: 'No inbound messages (thread appears to be operator-only).',
      threadId: thread.getId(),
    };
  }

  // Pick the newest inbound message. Stable sort by getDate().
  inbound.sort((a, b) => b.getDate().getTime() - a.getDate().getTime());
  const msg = inbound[0];

  // Pool all attachments across the thread; prefer newest resume-like file.
  const resumeAttachment = pickResumeAttachment_(messages);
  const allAttachmentNames = messages
    .flatMap(m => m.getAttachments({ includeInlineImages: false, includeAttachments: true }))
    .map(a => a.getName())
    .filter(Boolean);

  const bodyRaw = msg.getPlainBody() || msg.getBody() || '';
  const body = stripQuotedReply_(bodyRaw);

  const fromHeader = msg.getFrom() || '';
  const email = extractEmail_(fromHeader) || extractEmail_(body);
  const phone = extractPhone_(body);
  const name  = nameFromFromHeader_(fromHeader);

  const resume = resumeAttachment
    ? extractResumeText_(resumeAttachment)
    : { text: '', parseStatus: STATUS.SKIPPED, fileName: '' };

  const threadId  = thread.getId();
  const messageId = msg.getId();

  return {
    ok: true,
    applicationId: applicationId_(threadId, messageId),
    threadId:      threadId,
    messageId:     messageId,
    threadPermalink: threadPermalink_(threadId),
    receivedAt:    msg.getDate(),
    subject:       msg.getSubject() || '',
    from:          fromHeader,
    name:          name,
    email:         email,
    phone:         phone,
    coverLetter:   body,
    resumeText:    resume.text,
    resumeFileName: resume.fileName,
    resumeParseStatus: resume.parseStatus,
    attachmentsFound: allAttachmentNames,
    parseStatus:   STATUS.OK,
  };
}

function pickResumeAttachment_(messages) {
  const scored = [];
  for (const m of messages) {
    const atts = m.getAttachments({ includeInlineImages: false, includeAttachments: true });
    for (const a of atts) {
      const name = a.getName() || '';
      const type = a.getContentType() || '';
      const score = attachmentScore_(name, type);
      if (score > 0) {
        scored.push({ att: a, when: m.getDate().getTime(), score: score });
      }
    }
  }
  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score || b.when - a.when);
  return scored[0].att;
}

function attachmentScore_(name, type) {
  const n = (name || '').toLowerCase();
  const t = (type || '').toLowerCase();
  let score = 0;
  if (/resume|cv\b/.test(n)) score += 5;
  if (t.indexOf('pdf') >= 0 || n.endsWith('.pdf')) score += 3;
  if (t.indexOf('word') >= 0 || n.endsWith('.docx') || n.endsWith('.doc')) score += 3;
  if (n.endsWith('.txt')) score += 1;
  if (n.endsWith('.rtf')) score += 1;
  return score;
}

// Extract text from a resume attachment via Drive. PDFs and DOC(X) files are
// converted to a temporary Google Doc, then plain text is exported and the
// temp file is trashed. Any failure returns an empty string + error status —
// caller still gets a valid Candidate so the applicant isn't lost.
function extractResumeText_(att) {
  const name = att.getName() || 'resume';
  try {
    const blob = att.copyBlob();
    const tmp = Drive.Files.insert(
      { title: '[tmp dandyhorse] ' + name, mimeType: 'application/vnd.google-apps.document' },
      blob,
      { convert: true }
    );
    try {
      const doc = DocumentApp.openById(tmp.id);
      const text = doc.getBody().getText();
      return { text: text || '', parseStatus: STATUS.OK, fileName: name };
    } finally {
      try { Drive.Files.remove(tmp.id); } catch (e) {}
    }
  } catch (e) {
    logWarn('Resume text extraction failed', { name: name, err: String(e) });
    return { text: '', parseStatus: STATUS.ERROR, fileName: name };
  }
}

// Derive a position name from the subject line. Craigslist replies look like
// "reply to Mechanic (SF bike shop) - u24l2..." — strip prefixes and suffixes.
function inferPosition_(subject) {
  if (!subject) return '';
  let s = String(subject);
  s = s.replace(/^\s*(re|fw|fwd)\s*:\s*/i, '');
  s = s.replace(/^\s*reply to\s*:?\s*/i, '');
  s = s.replace(/\s*\([^)]*\)\s*$/, '');
  s = s.replace(/\s*-\s*[a-z0-9]{6,}\s*$/i, '');
  return s.trim();
}
