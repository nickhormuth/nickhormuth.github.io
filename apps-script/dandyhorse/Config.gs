// Config.gs — central knobs for the Dandyhorse v3 applicant tracker.
// Change versions here when you change the rubric or prompt so analyses
// written to the Analyses tab stay traceable.

const SPEC_VERSION     = 'spec-3.0.0';
const PROMPT_VERSION   = 'prompt-3.0.0';
const ANALYSIS_VERSION = 'analysis-3.0.0';

const SHEET_NAMES = {
  APPLICANTS: 'Applicants',
  ANALYSES:   'Analyses',
  ROLES:      'Roles',
  SETTINGS:   'Settings',
};

const LABELS = {
  INBOX:     'Applicants/Inbox',
  PROCESSED: 'Applicants/Processed',
  ERROR:     'Applicants/Error',
};

const PROPERTY_KEYS = {
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
  ANTHROPIC_MODEL:   'ANTHROPIC_MODEL',
  DEBUG_LOG:         'DEBUG_LOG',
};

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const GMAIL_QUERY_CRAIGSLIST =
  'from:(craigslist.org OR reply.craigslist.org) -label:Applicants/Processed newer_than:30d';
const GMAIL_QUERY_LABEL =
  'label:Applicants/Inbox -label:Applicants/Processed newer_than:30d';

const MAX_THREADS_PER_RUN = 25;
const LOCK_WAIT_MS = 30000;

// Applicants tab — ordered columns. Index in this array = column index (0-based).
// Keep in sync with Sheets.gs dropdowns and conditional formatting.
const APPLICANTS_COLUMNS = [
  'Received',                     //  1
  'Position',                     //  2
  'Name',                         //  3
  'Overall',                      //  4
  'Recommendation',               //  5
  'Takeaway',                     //  6
  'Role Fit',                     //  7
  'SF',                           //  8
  'Enthusiasm',                   //  9
  'Reliability',                  // 10
  'Genericness',                  // 11
  'Confidence',                   // 12
  'LLM?',                         // 13
  'Age',                          // 14
  'Career Stage / Availability',  // 15
  'Location',                     // 16
  'Strengths',                    // 17
  'Concerns',                     // 18
  'Evidence',                     // 19
  'Interview Questions',          // 20
  'Email',                        // 21
  'Phone',                        // 22
  'Resume',                       // 23
  'Status',                       // 24  manual
  'Interest',                     // 25  manual
  'Interview Date',               // 26  manual
  'Notes',                        // 27  manual
  'Thread',                       // 28
  'Application ID',               // 29
  'Analysis Version',             // 30
];

// Columns that belong to the operator and must never be overwritten on re-sync.
const MANUAL_COLUMNS = ['Status', 'Interest', 'Interview Date', 'Notes'];

const ANALYSES_COLUMNS = [
  'Application ID',
  'Received',
  'Position',
  'Name',
  'Email',
  'Gmail Thread ID',
  'Gmail Message ID',
  'Thread Permalink',
  'Parse Status',
  'Analysis Status',
  'Reply Status',
  'Processed At',
  'Prompt Version',
  'Spec Version',
  'Analysis Version',
  'Raw Role Spec',
  'Cover Letter Full',
  'Resume Text Extract',
  'Attachments Found',
  'Resume Parse Status',
  'Error Reason',
  'Raw JSON Analysis',
];

const ROLES_COLUMNS = [
  'Position',
  'Ideal Candidate Profile',
  'Last Updated',
  'Spec Version',
];

const DROPDOWNS = {
  Status:         ['New', 'Reviewing', 'Contacted', 'Interview Scheduled', 'Passed', 'Hired'],
  Interest:       ['⭐ Yes - Interview', '🤔 Maybe', '❌ Pass'],
  Recommendation: ['Interview', 'Maybe', 'Pass', 'Manual Review'],
  Confidence:     ['High', 'Medium', 'Low'],
  'LLM?':         ['Low', 'Medium', 'High'],
};

const STATUS = {
  OK:      'OK',
  PARTIAL: 'PARTIAL',
  ERROR:   'ERROR',
  SKIPPED: 'SKIPPED',
  PENDING: 'PENDING',
};

function columnIndex_(headers, name) {
  const i = headers.indexOf(name);
  if (i < 0) throw new Error('Missing column: ' + name);
  return i;
}

function getProp_(key, fallback) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  return v == null || v === '' ? (fallback == null ? '' : fallback) : v;
}
