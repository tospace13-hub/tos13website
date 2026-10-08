# Join form backend

The form at `/join/` (`join.html`) posts to a Google Apps Script web app,
`Code.gs` in this folder. The script adds a row to the
[TOS13 join form responses](https://docs.google.com/spreadsheets/d/1chDHrqV8hHkSX-RHjvYiwf3I_i83vRY11CBkHPlP1ZI/edit)
sheet in the TOS13 Google Drive folder and emails hello@space13.to.
Jekyll skips folders starting with `_`, so nothing here is published.

## Set up or update the script

1. Open the response sheet and choose **Extensions → Apps Script**.
2. Replace the contents of `Code.gs` with this folder's `Code.gs` and save.
3. Choose **Deploy → New deployment**, type **Web app**,
   *Execute as*: **Me**, *Who has access*: **Anyone**. Approve the
   permissions Google asks for (the sheet and sending email).
4. Copy the web app URL (ends in `/exec`) into `_config.yml` as
   `join_form_endpoint`.

Opening that URL in a browser should show `{"ok":true,"service":"TOS13 join form"}`.

To change the script later, edit it, then **Deploy → Manage deployments →
Edit → Version: New version**. That keeps the same URL; a *new deployment*
gets a new URL, which would then also need changing in `_config.yml`.

## Sheet columns

Organisation columns use the field names of TELL
([tell.newtexeco.nl](https://tell.newtexeco.nl)), NewTexEco's map of Dutch
textile companies, so each response can be matched against it: by website
first, then name and city. `kvk`, `tell_match` and `team_notes` are for the
team (the KvK number is looked up, not asked); the form never fills them.

## Unsubscribe

`/unsubscribe/` posts to the same web app with `form=unsubscribe`. The script
sets `consent_newsletter` to `No` on every response from that address (the
responses themselves stay), logs the request on the **Unsubscribe** tab and
emails hello@space13.to. Newsletter emails can link to
`https://space13.to/unsubscribe/?email=<address>` to fill in the address.

TELL is built from public company data. When working with NewTexEco on TELL,
share only organisation columns, never name, email or role.
