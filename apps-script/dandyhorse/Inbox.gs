// Inbox.gs — source selection: Craigslist replies OR the Applicants/Inbox label.
// The Processed label is kept as a hint (fast filter) but dedup is enforced by
// the Application ID lookup in Rows.gs, not by the label alone.

function ensureLabel_(name) {
  const existing = GmailApp.getUserLabelByName(name);
  return existing || GmailApp.createLabel(name);
}

function collectCandidateThreads_() {
  ensureLabel_(LABELS.INBOX);
  ensureLabel_(LABELS.PROCESSED);
  ensureLabel_(LABELS.ERROR);

  const seen = {};
  const out = [];

  const addAll = (threads) => {
    for (const t of threads) {
      const id = t.getId();
      if (!seen[id]) { seen[id] = true; out.push(t); }
      if (out.length >= MAX_THREADS_PER_RUN) return;
    }
  };

  addAll(GmailApp.search(GMAIL_QUERY_CRAIGSLIST, 0, MAX_THREADS_PER_RUN));
  if (out.length < MAX_THREADS_PER_RUN) {
    addAll(GmailApp.search(GMAIL_QUERY_LABEL, 0, MAX_THREADS_PER_RUN - out.length));
  }

  logInfo('Inbox scan found threads', { count: out.length });
  return out;
}

function markThreadProcessed_(thread) {
  const processed = ensureLabel_(LABELS.PROCESSED);
  thread.addLabel(processed);
  const inbox = GmailApp.getUserLabelByName(LABELS.INBOX);
  if (inbox) thread.removeLabel(inbox);
}

function markThreadErrored_(thread) {
  const err = ensureLabel_(LABELS.ERROR);
  thread.addLabel(err);
}
