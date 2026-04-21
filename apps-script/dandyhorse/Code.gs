// Code.gs — entry points, menu, time trigger.
//
// Externally-callable top-level functions:
//   onOpen         — Sheets hook, installs menu.
//   syncNow        — menu action, user-invoked sync.
//   runTrigger     — time-driven trigger entry.
//   installTrigger — idempotent 10-minute trigger installer.
//   setupSheets    — bootstrap tabs + formatting (in Sheets.gs).
//   rebuildDropdowns — refresh data validation (in Sheets.gs).

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Dandyhorse')
    .addItem('Sync now', 'syncNow')
    .addSeparator()
    .addItem('Setup sheets', 'setupSheets')
    .addItem('Install 10-min trigger', 'installTrigger')
    .addItem('Rebuild dropdowns', 'rebuildDropdowns')
    .addToUi();
}

function syncNow() {
  const result = withLock_(runSyncUnlocked_);
  if (result && result.skipped) {
    try {
      SpreadsheetApp.getUi().alert(
        'Another sync is already running. Try again in a moment.');
    } catch (e) {}
    return;
  }
  try {
    const { processed, created, updated, errors } = result || {};
    SpreadsheetApp.getUi().alert(
      'Dandyhorse sync complete.\n' +
      'Threads processed: ' + (processed || 0) + '\n' +
      'New applicants:   ' + (created || 0) + '\n' +
      'Updated rows:     ' + (updated || 0) + '\n' +
      'Errors:           ' + (errors || 0));
  } catch (e) {
    // Running from the script editor, not the sheet UI.
  }
}

function runTrigger() {
  withLock_(runSyncUnlocked_);
}

function runSyncUnlocked_() {
  const threads = collectCandidateThreads_();
  let processed = 0, created = 0, updated = 0, errors = 0;

  for (const thread of threads) {
    processed++;
    try {
      const outcome = processThread_(thread);
      if (outcome.created) created++;
      else if (outcome.updated) updated++;
      if (outcome.errored) errors++;
    } catch (e) {
      errors++;
      logError('Thread processing crashed', {
        threadId: thread.getId(), err: String(e), stack: e && e.stack,
      });
      try { markThreadErrored_(thread); } catch (_) {}
    }
  }

  logInfo('Sync complete', { processed, created, updated, errors });
  return { processed, created, updated, errors, ok: true };
}

function processThread_(thread) {
  const candidate = getBestCandidate_(thread);
  if (!candidate.ok) {
    logWarn('Skipping thread', candidate);
    return { created: false, updated: false, errored: false };
  }

  candidate.position = inferPosition_(candidate.subject);
  const roleSpec = getRoleSpec_(candidate.position);

  const statuses = {
    parse:    candidate.parseStatus || STATUS.OK,
    analysis: STATUS.PENDING,
    reply:    STATUS.PENDING,
  };

  let analysis = null, rawJson = '', errorReason = '';
  const result = analyzeCandidate_(candidate, roleSpec);
  if (result.ok) {
    analysis = result.data;
    rawJson  = result.raw;
    statuses.analysis = STATUS.OK;
  } else {
    analysis = analysisFallback_();
    rawJson  = result.raw || '';
    errorReason = result.error || 'unknown';
    statuses.analysis = STATUS.ERROR;
  }

  const upsert = upsertApplicant_(candidate, analysis, statuses);
  writeAnalysisAudit_(candidate, analysis, statuses, errorReason, rawJson, roleSpec);

  if (statuses.analysis === STATUS.OK) {
    try { markThreadProcessed_(thread); }
    catch (e) { logWarn('Could not label thread', { err: String(e) }); }
  } else {
    try { markThreadErrored_(thread); } catch (_) {}
  }

  return {
    created: upsert.created,
    updated: !upsert.created,
    errored: statuses.analysis === STATUS.ERROR,
  };
}

// Minimal placeholder analysis used when the LLM call fails; keeps the
// Applicants row populated with contact info so the candidate isn't lost.
function analysisFallback_() {
  return {
    overall_score: '',
    recommendation: 'Manual Review',
    confidence: 'Low',
    subscores: {
      role_fit: '',
      sf_connection_score: '',
      enthusiasm_specificity: '',
      reliability_professionalism: '',
      genericness_score: '',
    },
    one_line_takeaway: 'AI analysis failed — manual review required.',
    location: '',
    sf_connection_summary: '',
    age: 'Not stated',
    career_stage_availability: '',
    strengths: [],
    concerns: ['AI analysis failed; see Analyses tab Error Reason.'],
    evidence: [],
    enthusiasm_signals: '',
    authenticity_notes: '',
    llm_likelihood: '',
    interview_questions: [],
    missing_information: [],
    summary: '',
    _fallback: true,
  };
}

function installTrigger() {
  const existing = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'runTrigger');
  for (const t of existing) ScriptApp.deleteTrigger(t);

  ScriptApp.newTrigger('runTrigger')
    .timeBased()
    .everyMinutes(10)
    .create();

  try {
    SpreadsheetApp.getUi().alert('Installed 10-minute sync trigger.');
  } catch (e) {}
}
