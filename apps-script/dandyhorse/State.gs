// State.gs — locking, durable IDs, status enums.

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_WAIT_MS);
  } catch (e) {
    logWarn('Could not acquire lock; another run is in progress.');
    return { ok: false, skipped: true };
  }
  try {
    return fn();
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// application_id is a deterministic hash of threadId+messageId. Truncating the
// SHA-1 hex to 16 chars is still unique enough for a solo hiring queue and
// keeps the column readable.
function applicationId_(threadId, messageId) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_1,
    String(threadId) + '|' + String(messageId));
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] & 0xff;
    hex += (b < 16 ? '0' : '') + b.toString(16);
  }
  return 'app_' + hex.slice(0, 16);
}

function threadPermalink_(threadId) {
  return 'https://mail.google.com/mail/u/0/#inbox/' + threadId;
}
