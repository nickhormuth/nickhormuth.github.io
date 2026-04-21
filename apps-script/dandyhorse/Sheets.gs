// Sheets.gs — bootstrap + formatting for the four tabs.
// setupSheets() is idempotent: re-running adds missing tabs/columns without
// destroying data. Call it after pulling a new version of this script.

function setupSheets() {
  const ss = SpreadsheetApp.getActive();
  ensureApplicantsSheet_(ss);
  ensureAnalysesSheet_(ss);
  ensureRolesSheet_(ss);
  ensureSettingsSheet_(ss);
  SpreadsheetApp.getUi().alert('Dandyhorse v3: sheets are set up.');
}

function ensureApplicantsSheet_(ss) {
  const sh = ensureSheetWithHeaders_(ss, SHEET_NAMES.APPLICANTS, APPLICANTS_COLUMNS);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(5);
  applyApplicantsDropdowns_(sh);
  applyApplicantsFormatting_(sh);
  autosizeReasonable_(sh, APPLICANTS_COLUMNS);
}

function ensureAnalysesSheet_(ss) {
  const sh = ensureSheetWithHeaders_(ss, SHEET_NAMES.ANALYSES, ANALYSES_COLUMNS);
  sh.setFrozenRows(1);
  sh.hideSheet();
}

function ensureRolesSheet_(ss) {
  const sh = ensureSheetWithHeaders_(ss, SHEET_NAMES.ROLES, ROLES_COLUMNS);
  sh.setFrozenRows(1);
  sh.setColumnWidth(2, 500); // Ideal Candidate Profile
  // Seed one example row if the sheet is empty of data.
  if (sh.getLastRow() < 2) {
    sh.getRange(2, 1, 1, ROLES_COLUMNS.length).setValues([[
      'Mechanic',
      'Paste the Craigslist ad or your own freeform notes describing the ' +
      'ideal candidate here. Update anytime — the Spec Version column lets ' +
      'past analyses stay traceable.',
      new Date(),
      SPEC_VERSION,
    ]]);
  }
}

function ensureSettingsSheet_(ss) {
  let sh = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAMES.SETTINGS);
    sh.getRange(1, 1, 1, 2).setValues([['Key', 'Value']]);
    sh.getRange(2, 1, 3, 2).setValues([
      ['prompt_version',   PROMPT_VERSION],
      ['analysis_version', ANALYSIS_VERSION],
      ['spec_version',     SPEC_VERSION],
    ]);
  }
  sh.hideSheet();
}

function ensureSheetWithHeaders_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }
  const existing = sh.getLastColumn() > 0
    ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    : [];
  // Add any headers not already present, without touching existing data order.
  const merged = existing.slice();
  headers.forEach(h => { if (merged.indexOf(h) < 0) merged.push(h); });
  if (merged.length !== existing.length ||
      merged.some((h, i) => h !== existing[i])) {
    sh.getRange(1, 1, 1, merged.length).setValues([merged]);
    sh.getRange(1, 1, 1, merged.length).setFontWeight('bold');
  }
  return sh;
}

function applyApplicantsDropdowns_(sh) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const lastRow = Math.max(sh.getMaxRows(), 1000);
  Object.keys(DROPDOWNS).forEach(colName => {
    const idx = headers.indexOf(colName);
    if (idx < 0) return;
    const range = sh.getRange(2, idx + 1, lastRow - 1, 1);
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(DROPDOWNS[colName], true)
      .setAllowInvalid(true)
      .build();
    range.setDataValidation(rule);
  });
}

function applyApplicantsFormatting_(sh) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const lastRow = Math.max(sh.getMaxRows(), 1000);
  const existing = sh.getConditionalFormatRules().filter(r => {
    // Leave user-added rules alone; replace only rules tagged by our prefix
    // (Apps Script doesn't support tagging, so we replace all script-managed
    // rules by regenerating them. Users editing rules manually should be
    // aware of this.)
    return false;
  });
  const rules = existing;

  const overallIdx = headers.indexOf('Overall');
  if (overallIdx >= 0) {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .setGradientMaxpointWithValue('#57bb8a', SpreadsheetApp.InterpolationType.NUMBER, '8')
      .setGradientMidpointWithValue('#ffd666', SpreadsheetApp.InterpolationType.NUMBER, '5')
      .setGradientMinpointWithValue('#e67c73', SpreadsheetApp.InterpolationType.NUMBER, '2')
      .setRanges([sh.getRange(2, overallIdx + 1, lastRow - 1, 1)])
      .build());
  }

  const genericIdx = headers.indexOf('Genericness');
  if (genericIdx >= 0) {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThanOrEqualTo(4)
      .setBackground('#fce8e6')
      .setRanges([sh.getRange(2, genericIdx + 1, lastRow - 1, 1)])
      .build());
  }

  const recIdx = headers.indexOf('Recommendation');
  if (recIdx >= 0) {
    const recRange = sh.getRange(2, recIdx + 1, lastRow - 1, 1);
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Interview').setBackground('#d9ead3').setRanges([recRange]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Maybe').setBackground('#fff2cc').setRanges([recRange]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Pass').setBackground('#f4cccc').setRanges([recRange]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Manual Review').setBackground('#cfe2f3').setRanges([recRange]).build());
  }

  sh.setConditionalFormatRules(rules);
}

function autosizeReasonable_(sh, headers) {
  const widths = {
    'Received': 140, 'Position': 140, 'Name': 160, 'Overall': 70,
    'Recommendation': 130, 'Takeaway': 320, 'Role Fit': 70, 'SF': 60,
    'Enthusiasm': 90, 'Reliability': 90, 'Genericness': 100,
    'Confidence': 100, 'LLM?': 70, 'Age': 90,
    'Career Stage / Availability': 240, 'Location': 160,
    'Strengths': 320, 'Concerns': 320, 'Evidence': 360,
    'Interview Questions': 320, 'Email': 220, 'Phone': 130, 'Resume': 180,
    'Status': 140, 'Interest': 140, 'Interview Date': 130, 'Notes': 260,
    'Thread': 120, 'Application ID': 160, 'Analysis Version': 150,
  };
  headers.forEach((h, i) => {
    if (widths[h]) sh.setColumnWidth(i + 1, widths[h]);
  });
}

function getApplicantsHeaders_() {
  return SpreadsheetApp.getActive()
    .getSheetByName(SHEET_NAMES.APPLICANTS)
    .getRange(1, 1, 1, APPLICANTS_COLUMNS.length)
    .getValues()[0];
}

function getAnalysesHeaders_() {
  return SpreadsheetApp.getActive()
    .getSheetByName(SHEET_NAMES.ANALYSES)
    .getRange(1, 1, 1, ANALYSES_COLUMNS.length)
    .getValues()[0];
}

function getRoleSpec_(position) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAMES.ROLES);
  if (!sh || sh.getLastRow() < 2) return null;
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, ROLES_COLUMNS.length).getValues();
  // Exact match first; otherwise fall back to the first row.
  const exact = rows.find(r => String(r[0]).trim().toLowerCase() ===
    String(position || '').trim().toLowerCase());
  const row = exact || rows[0];
  return {
    position: row[0] || position || '',
    idealProfile: row[1] || '',
    lastUpdated: row[2] || '',
    specVersion: row[3] || SPEC_VERSION,
  };
}

function rebuildDropdowns() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_NAMES.APPLICANTS);
  if (sh) applyApplicantsDropdowns_(sh);
  SpreadsheetApp.getUi().alert('Dropdowns rebuilt.');
}
