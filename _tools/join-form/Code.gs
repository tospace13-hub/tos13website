/**
 * TOS13 join form backend (Google Apps Script web app).
 *
 * Receives the join form (https://space13.to/join/): adds one row per
 * submission to the first tab of the "TOS13 join form responses" sheet and
 * emails NOTIFY_EMAIL.
 * Receives the unsubscribe form (https://space13.to/unsubscribe/): stops
 * newsletter emails to that address, logs the request on the Unsubscribe tab
 * and emails NOTIFY_EMAIL. Responses stay in the sheet.
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

// Filled in afterwards (KvK lookup, comparison with TELL), never by the form.
const TEAM_COLUMNS = ['kvk', 'tell_match', 'team_notes'];

const REQUIRED = ['name', 'email', 'trade_name', 'website', 'city', 'tier', 'tags', 'consent_privacy'];

// A person needs more than this to fill in the join form; faster means a bot.
const MIN_FILL_SECONDS = 3;

const MAX_LENGTH = 2000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UNSUBSCRIBE_SHEET = 'Unsubscribe';
const UNSUBSCRIBE_COLUMNS = ['submitted_at', 'email', 'responses_updated'];

function doPost(e) {
  const params = (e && e.parameters) || {};
  // Checkbox groups arrive as several values under one name; join them.
  const value = key => (params[key] || [])
    .map(v => String(v).trim())
    .filter(Boolean)
    .join('; ');

  // Spam trap: answer bots with success so they don't retry, but store nothing.
  if (value('fax')) return reply_({ ok: true });

  return value('form') === 'unsubscribe' ? unsubscribe_(value) : join_(value);
}

function join_(value) {
  // Filled in faster than a person could: treat as a bot, as above. Not used
  // for unsubscribing, which takes one click when the address is prefilled.
  const startedAt = Number(value('started_at'));
  if (startedAt && Date.now() - startedAt < MIN_FILL_SECONDS * 1000) return reply_({ ok: true });

  const missing = REQUIRED.filter(key => !value(key));
  if (missing.length) return reply_({ ok: false, error: 'Missing: ' + missing.join(', ') });
  if (!EMAIL_PATTERN.test(value('email'))) return reply_({ ok: false, error: 'Invalid email address' });

  const row = COLUMNS.map(key => {
    if (key === 'submitted_at') return new Date();
    if (TEAM_COLUMNS.includes(key)) return '';
    return asCellText_(value(key));
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

function unsubscribe_(value) {
  const email = value('email').toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return reply_({ ok: false, error: 'Invalid email address' });

  let updated = 0;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    updated = stopNewsletter_(spreadsheet.getSheets()[0], email);
    const log = spreadsheet.getSheetByName(UNSUBSCRIBE_SHEET)
      || spreadsheet.insertSheet(UNSUBSCRIBE_SHEET, spreadsheet.getSheets().length);
    if (log.getLastRow() === 0) log.appendRow(UNSUBSCRIBE_COLUMNS);
    log.appendRow([new Date(), asCellText_(email), updated]);
  } finally {
    lock.releaseLock();
  }

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: 'TOS13 unsubscribe: ' + email.replace(/[\r\n]+/g, ' '),
    body: email + ' asked to stop receiving TOS13 emails.\n'
      + 'consent_newsletter set to No on ' + updated + ' response(s); the responses stay in the sheet.\n'
      + 'If the newsletter is sent from another tool, remove the address there too.\n\n'
      + 'Responses and the unsubscribe log: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
  });
  // The same answer whether or not the address is in the sheet, so the form
  // can't be used to find out who is on the list.
  return reply_({ ok: true });
}

// Sets consent_newsletter to "No" on every response from this address and
// returns how many rows changed. Nothing else in the rows is touched.
function stopNewsletter_(sheet, email) {
  const rowCount = sheet.getLastRow() - 1;
  if (rowCount < 1) return 0;
  const emailIndex = COLUMNS.indexOf('email');
  const newsletterIndex = COLUMNS.indexOf('consent_newsletter');
  const rows = sheet.getRange(2, 1, rowCount, COLUMNS.length).getValues();
  let changed = 0;
  rows.forEach((row, i) => {
    if (String(row[emailIndex]).trim().toLowerCase() === email && row[newsletterIndex] !== 'No') {
      sheet.getRange(i + 2, newsletterIndex + 1).setValue('No');
      changed++;
    }
  });
  return changed;
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
