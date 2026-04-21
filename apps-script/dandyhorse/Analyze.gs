// Analyze.gs — call the Anthropic Messages API, parse JSON, validate, retry once.
// Never throws to the caller: returns {ok, data, raw, error} so the caller can
// still write a row when analysis fails.

function analyzeCandidate_(candidate, roleSpec) {
  const apiKey = getProp_(PROPERTY_KEYS.ANTHROPIC_API_KEY);
  if (!apiKey) {
    return { ok: false, error: 'Missing ANTHROPIC_API_KEY in Script Properties.', raw: '' };
  }
  const model = getProp_(PROPERTY_KEYS.ANTHROPIC_MODEL, DEFAULT_MODEL);
  const { system, user } = buildMessages_(roleSpec, candidate);

  const first = callAnthropic_(apiKey, model, system, [{ role: 'user', content: user }]);
  if (!first.ok) return first;

  const parsed = parseAndValidate_(first.raw);
  if (parsed.ok) return { ok: true, data: parsed.data, raw: first.raw };

  logWarn('First JSON parse failed; retrying with corrective turn', { err: parsed.error });
  const corrective =
    'Your previous response could not be parsed as JSON: ' + parsed.error + '\n' +
    'Return ONLY a single JSON object matching the schema. No markdown, no ' +
    'code fences, no commentary.';
  const second = callAnthropic_(apiKey, model, system, [
    { role: 'user',      content: user },
    { role: 'assistant', content: first.raw },
    { role: 'user',      content: corrective },
  ]);
  if (!second.ok) return second;

  const parsed2 = parseAndValidate_(second.raw);
  if (parsed2.ok) return { ok: true, data: parsed2.data, raw: second.raw };
  return { ok: false, error: 'JSON validation failed twice: ' + parsed2.error, raw: second.raw };
}

function callAnthropic_(apiKey, model, system, messages) {
  const payload = {
    model: model,
    max_tokens: 2000,
    system: system,
    messages: messages,
  };
  try {
    const res = UrlFetchApp.fetch(ANTHROPIC_API_URL, {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      payload: JSON.stringify(payload),
    });
    const code = res.getResponseCode();
    const body = res.getContentText();
    if (code < 200 || code >= 300) {
      return { ok: false, error: 'HTTP ' + code + ': ' + truncate_(body, 500), raw: body };
    }
    const json = JSON.parse(body);
    const text = (json.content || [])
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n')
      .trim();
    if (!text) return { ok: false, error: 'Empty model response.', raw: body };
    return { ok: true, raw: text };
  } catch (e) {
    return { ok: false, error: 'UrlFetch failed: ' + String(e), raw: '' };
  }
}

// Accept either bare JSON or JSON inside a ```json ... ``` fence.
function parseAndValidate_(raw) {
  let text = String(raw || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  // Greedy: some models prepend a sentence. Grab the outermost {...}.
  const first = text.indexOf('{');
  const last  = text.lastIndexOf('}');
  if (first >= 0 && last > first) text = text.slice(first, last + 1);

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: 'JSON.parse: ' + String(e) };
  }
  const v = validateSchema_(data);
  if (!v.ok) return { ok: false, error: v.error };
  return { ok: true, data: v.data };
}

function validateSchema_(d) {
  if (!d || typeof d !== 'object') return { ok: false, error: 'not an object' };

  const reqTop = [
    'overall_score', 'recommendation', 'confidence', 'subscores',
    'one_line_takeaway', 'location', 'sf_connection_summary', 'age',
    'career_stage_availability', 'strengths', 'concerns', 'evidence',
    'enthusiasm_signals', 'authenticity_notes', 'llm_likelihood',
    'interview_questions', 'missing_information', 'summary',
  ];
  for (const k of reqTop) {
    if (!(k in d)) return { ok: false, error: 'missing key: ' + k };
  }

  const subs = d.subscores;
  const reqSubs = [
    'role_fit', 'sf_connection_score', 'enthusiasm_specificity',
    'reliability_professionalism', 'genericness_score',
  ];
  if (!subs || typeof subs !== 'object') return { ok: false, error: 'subscores not object' };
  for (const k of reqSubs) {
    const v = subs[k];
    if (typeof v !== 'number' || v < 1 || v > 5 || !Number.isFinite(v)) {
      return { ok: false, error: 'subscore out of range: ' + k + '=' + v };
    }
    subs[k] = Math.round(v);
  }

  const overall = Number(d.overall_score);
  if (!Number.isFinite(overall) || overall < 1 || overall > 10) {
    return { ok: false, error: 'overall_score out of range' };
  }
  d.overall_score = Math.round(overall);

  const rec = String(d.recommendation);
  if (DROPDOWNS.Recommendation.indexOf(rec) < 0) {
    return { ok: false, error: 'bad recommendation: ' + rec };
  }
  const conf = String(d.confidence);
  if (DROPDOWNS.Confidence.indexOf(conf) < 0) {
    return { ok: false, error: 'bad confidence: ' + conf };
  }
  const llm = String(d.llm_likelihood);
  if (['Low', 'Medium', 'High'].indexOf(llm) < 0) {
    return { ok: false, error: 'bad llm_likelihood: ' + llm };
  }

  // Coerce arrays.
  ['strengths', 'concerns', 'evidence', 'interview_questions', 'missing_information']
    .forEach(k => { if (!Array.isArray(d[k])) d[k] = d[k] ? [String(d[k])] : []; });

  // Coerce strings.
  ['one_line_takeaway', 'location', 'sf_connection_summary', 'age',
   'career_stage_availability', 'enthusiasm_signals', 'authenticity_notes',
   'summary'].forEach(k => { d[k] = d[k] == null ? '' : String(d[k]); });

  return { ok: true, data: d };
}
