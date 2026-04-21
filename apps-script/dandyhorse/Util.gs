// Util.gs — logging, hashing, date + text helpers shared across modules.

function logInfo(msg, meta)  { log_('INFO',  msg, meta); }
function logWarn(msg, meta)  { log_('WARN',  msg, meta); }
function logError(msg, meta) { log_('ERROR', msg, meta); }

function log_(level, msg, meta) {
  const line = meta == null ? msg : msg + ' ' + safeStringify_(meta);
  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);
}

function safeStringify_(obj) {
  try { return JSON.stringify(obj); } catch (e) { return String(obj); }
}

function nowIso_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(),
    "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function formatDate_(d) {
  if (!d) return '';
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
}

// Strip common quoted-reply markers so the LLM doesn't re-analyze an old
// outgoing message appended to the thread.
function stripQuotedReply_(text) {
  if (!text) return '';
  let t = String(text).replace(/\r\n/g, '\n');

  const markers = [
    /\n>.*$/s,
    /\nOn .{0,120}wrote:\s*\n[\s\S]*$/,
    /\n-----Original Message-----[\s\S]*$/,
    /\nFrom:\s.+\nSent:\s[\s\S]*$/,
    /\n________________________________\s*\nFrom:[\s\S]*$/,
  ];
  for (const m of markers) {
    const idx = t.search(m);
    if (idx > 0) t = t.slice(0, idx);
  }
  return t.trim();
}

function extractEmail_(text) {
  if (!text) return '';
  const m = String(text).match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return m ? m[0] : '';
}

function extractPhone_(text) {
  if (!text) return '';
  // North American phone heuristic: 10-digit with optional formatting.
  const m = String(text).match(
    /(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/);
  return m ? '(' + m[1] + ') ' + m[2] + '-' + m[3] : '';
}

// Guess a name from the From header ("First Last <x@y>" / "x@y").
function nameFromFromHeader_(fromHeader) {
  if (!fromHeader) return '';
  const m = String(fromHeader).match(/^\s*"?([^"<]+?)"?\s*<.+>\s*$/);
  if (m && m[1].trim()) return m[1].trim();
  const local = String(fromHeader).split('@')[0].replace(/[._-]+/g, ' ').trim();
  return local.replace(/\b\w/g, c => c.toUpperCase());
}

function truncate_(s, n) {
  if (s == null) return '';
  s = String(s);
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function debugEnabled_() {
  return String(getProp_(PROPERTY_KEYS.DEBUG_LOG, '')).toLowerCase() === 'true';
}
