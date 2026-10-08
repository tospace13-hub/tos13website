/**
 * TOS13 join form backend (Google Apps Script web app).
 *
 * Receives submissions from https://space13.to/join/, adds one row per submission to
 * the "TOS13 join form responses" sheet and emails NOTIFY_EMAIL.
 * Setup steps are in README.md next to this file.
 */

const NOTIFY_EMAIL = 'hello@space13.to';

// Column order of the response sheet. Organisation columns use TELL's field
// names (tell.newtexeco.nl) so each row can be matched against TELL.
const COLUMNS = [
  'submitted_at', 'name', 'email', 'role',
  'trade_name', 'website', 'city', 'postcode', 'kvk', 'employees', 'year_start',
  'tier', 'tier_other', 'category', 'tags', 'outside_nl', 'on_tell',
  'interests', 'dpp_data', 'question',
  'consent_privacy', 'consent_newsletter', 'consent_tell',
  'tell_match', 'team_notes',
];

// Filled in by the team when comparing with TELL, never by the form.
const TEAM_COLUMNS = ['tell_match', 'team_notes'];

// Number-like answers that must stay text, e.g. a KvK number starting with 0.
const TEXT_COLUMNS = ['kvk'];

const REQUIRED = ['name', 'email', 'trade_name', 'website', 'city', 'tier', 'tags', 'consent_privacy'];

// A person needs more than this to fill in the form; faster means a bot.
const MIN_FILL_SECONDS = 3;

const MAX_LENGTH = 2000;

function doPost(e) {
  const params = (e && e.parameters) || {};
  // Checkbox groups arrive as several values under one name; join them.
  const value = key => (params[key] || [])
    .map(v => String(v).trim())
    .filter(Boolean)
    .join('; ');

  // Spam traps: answer bots with success so they don't retry, but store nothing.
  if (value('fax')) return reply_({ ok: true });
  const startedAt = Number(value('started_at'));
  if (startedAt && Date.now() - startedAt < MIN_FILL_SECONDS * 1000) return reply_({ ok: true });

  const missing = REQUIRED.filter(key => !value(key));
  if (missing.length) return reply_({ ok: false, error: 'Missing: ' + missing.join(', ') });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value('email'))) {
    return reply_({ ok: false, error: 'Invalid email address' });
  }

  const row = COLUMNS.map(key => {
    if (key === 'submitted_at') return new Date();
    if (TEAM_COLUMNS.includes(key)) return '';
    const text = asCellText_(value(key));
    return TEXT_COLUMNS.includes(key) && text ? "'" + text : text;
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) sheet.appendRow(COLUMNS);
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }

  notify_(value);
  return reply_({ ok: true });
}

// Opening the web app URL in a browser shows this, which confirms the deployment works.
function doGet() {
  return reply_({ ok: true, service: 'TOS13 join form' });
}

// Store answers as plain text: cap the length, and keep a value that starts
// with = + - @ from being read as a spreadsheet formula.
function asCellText_(text) {
  const capped = text.slice(0, MAX_LENGTH);
  return /^[=+\-@]/.test(capped) ? "'" + capped : capped;
}

function notify_(value) {
  const oneLine = text => text.replace(/[\r\n]+/g, ' ');
  const body = COLUMNS
    .filter(key => key !== 'submitted_at' && !TEAM_COLUMNS.includes(key))
    .map(key => key + ': ' + (value(key) || '-'))
    .join('\n');
  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    replyTo: value('email'),
    subject: oneLine('TOS13 join form: ' + value('trade_name') + ' (' + value('name') + ')'),
    body: body + '\n\nAll responses: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
  });
}

function reply_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
