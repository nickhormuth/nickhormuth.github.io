// Rows.gs — dedup by Application ID and write to Applicants + Analyses.
//
// Correctness invariant: on re-sync, the four manual columns (Status,
// Interest, Interview Date, Notes) must never be overwritten, even if the
// AI analysis changes.

function upsertApplicant_(candidate, analysis, statuses) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_NAMES.APPLICANTS);
  const headers = sh.getRange(1, 1, 1, APPLICANTS_COLUMNS.length).getValues()[0];

  const appIdCol = headers.indexOf('Application ID');
  if (appIdCol < 0) throw new Error('Applicants sheet is missing "Application ID" column.');

  // Locate existing row, if any.
  const lastRow = sh.getLastRow();
  let targetRow = -1;
  if (lastRow >= 2) {
    const ids = sh.getRange(2, appIdCol + 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i][0] === candidate.applicationId) { targetRow = i + 2; break; }
    }
  }

  const computed = computeApplicantsRow_(headers, candidate, analysis, statuses);

  if (targetRow < 0) {
    // New applicant: append full row.
    const appendRow = headers.map(h => computed[h] != null ? computed[h] : '');
    sh.appendRow(appendRow);
    const writtenRow = sh.getLastRow();
    applyRowLinks_(sh, writtenRow, headers, candidate);
    return { created: true, row: writtenRow };
  } else {
    // Existing: update only non-manual columns.
    const existing = sh.getRange(targetRow, 1, 1, headers.length).getValues()[0];
    const merged = headers.map((h, i) => {
      if (MANUAL_COLUMNS.indexOf(h) >= 0) return existing[i]; // preserve
      return computed[h] != null ? computed[h] : existing[i];
    });
    sh.getRange(targetRow, 1, 1, headers.length).setValues([merged]);
    applyRowLinks_(sh, targetRow, headers, candidate);
    return { created: false, row: targetRow };
  }
}

function computeApplicantsRow_(headers, candidate, analysis, statuses) {
  const a = analysis || {};
  const subs = (a && a.subscores) || {};
  const row = {};

  row['Received']        = candidate.receivedAt || '';
  row['Position']        = candidate.position || '';
  row['Name']            = candidate.name || '';
  row['Overall']         = numOrBlank_(a.overall_score);
  row['Recommendation']  = a.recommendation || (a._fallback ? 'Manual Review' : '');
  row['Takeaway']        = a.one_line_takeaway || '';
  row['Role Fit']        = numOrBlank_(subs.role_fit);
  row['SF']              = numOrBlank_(subs.sf_connection_score);
  row['Enthusiasm']      = numOrBlank_(subs.enthusiasm_specificity);
  row['Reliability']     = numOrBlank_(subs.reliability_professionalism);
  row['Genericness']     = numOrBlank_(subs.genericness_score);
  row['Confidence']      = a.confidence || '';
  row['LLM?']            = a.llm_likelihood || '';
  row['Age']             = a.age || 'Not stated';
  row['Career Stage / Availability'] = a.career_stage_availability || '';
  row['Location']        = a.location || '';
  row['Strengths']       = bulletJoin_(a.strengths);
  row['Concerns']        = bulletJoin_(a.concerns);
  row['Evidence']        = bulletJoin_(a.evidence);
  row['Interview Questions'] = bulletJoin_(a.interview_questions);
  row['Email']           = candidate.email || '';
  row['Phone']           = candidate.phone || '';
  row['Resume']          = candidate.resumeFileName || '';
  // Manual columns: only seed defaults for brand-new rows (handled by caller).
  row['Status']          = 'New';
  row['Interest']        = '';
  row['Interview Date']  = '';
  row['Notes']           = '';
  row['Thread']          = candidate.threadPermalink || '';
  row['Application ID']  = candidate.applicationId || '';
  row['Analysis Version'] = ANALYSIS_VERSION;

  return row;
}

function applyRowLinks_(sh, rowNum, headers, candidate) {
  const threadCol = headers.indexOf('Thread');
  if (threadCol >= 0 && candidate.threadPermalink) {
    const richText = SpreadsheetApp.newRichTextValue()
      .setText('open')
      .setLinkUrl(candidate.threadPermalink)
      .build();
    sh.getRange(rowNum, threadCol + 1).setRichTextValue(richText);
  }
}

function writeAnalysisAudit_(candidate, analysis, statuses, errorReason, rawJson, roleSpec) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_NAMES.ANALYSES);
  const headers = sh.getRange(1, 1, 1, ANALYSES_COLUMNS.length).getValues()[0];

  const idCol = headers.indexOf('Application ID');
  const lastRow = sh.getLastRow();
  let targetRow = -1;
  if (lastRow >= 2) {
    const ids = sh.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i][0] === candidate.applicationId) { targetRow = i + 2; break; }
    }
  }

  const vals = {};
  vals['Application ID']     = candidate.applicationId || '';
  vals['Received']           = candidate.receivedAt || '';
  vals['Position']           = candidate.position || '';
  vals['Name']               = candidate.name || '';
  vals['Email']              = candidate.email || '';
  vals['Gmail Thread ID']    = candidate.threadId || '';
  vals['Gmail Message ID']   = candidate.messageId || '';
  vals['Thread Permalink']   = candidate.threadPermalink || '';
  vals['Parse Status']       = statuses.parse || '';
  vals['Analysis Status']    = statuses.analysis || '';
  vals['Reply Status']       = statuses.reply || '';
  vals['Processed At']       = nowIso_();
  vals['Prompt Version']     = PROMPT_VERSION;
  vals['Spec Version']       = (roleSpec && roleSpec.specVersion) || SPEC_VERSION;
  vals['Analysis Version']   = ANALYSIS_VERSION;
  vals['Raw Role Spec']      = truncate_((roleSpec && roleSpec.idealProfile) || '', 5000);
  vals['Cover Letter Full']  = truncate_(candidate.coverLetter || '', 20000);
  vals['Resume Text Extract']= truncate_(candidate.resumeText || '', 20000);
  vals['Attachments Found']  = (candidate.attachmentsFound || []).join(', ');
  vals['Resume Parse Status']= candidate.resumeParseStatus || '';
  vals['Error Reason']       = errorReason || '';
  vals['Raw JSON Analysis']  = truncate_(rawJson || '', 20000);

  const row = headers.map(h => vals[h] != null ? vals[h] : '');
  if (targetRow < 0) {
    sh.appendRow(row);
  } else {
    sh.getRange(targetRow, 1, 1, headers.length).setValues([row]);
  }
}

function numOrBlank_(n) {
  return (n == null || n === '' || isNaN(Number(n))) ? '' : Number(n);
}

function bulletJoin_(items) {
  if (!items) return '';
  if (!Array.isArray(items)) return String(items);
  return items.filter(Boolean).map(x => '• ' + String(x)).join('\n');
}
