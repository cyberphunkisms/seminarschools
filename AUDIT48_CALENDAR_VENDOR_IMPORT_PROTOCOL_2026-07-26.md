# Audit 48 calendar vendor-import protocol

Date: 2026-07-26  
Release: `2026-07-26-site-audit48-external-validation-interoperability-final`

Use a dedicated temporary test calendar in each vendor account. Importing or subscribing is an external account write; do not use a personal or production calendar unless its owner explicitly chooses it.

## Release fixtures

| Case | Release file |
|---|---|
| Exact-time event | `/polymythseminars/ics/research-2d7cd27e6650.ics` |
| All-day event | `/polymythseminars/ics/research-e91d49b9af13.ics` |
| Legacy event URL | `/polymythseminars/ics/98410ad8a93b.ics` |
| Canonical target of legacy URL | `/polymythseminars/ics/3018f2437e1f.ics` |
| Subscription feed | `/polymythseminars/feeds/all.ics` |

The legacy and canonical event files are byte-identical and carry the same stable UID. The account-level check must confirm that importing or refreshing them does not create two distinct logical events.

## Google Calendar

1. On desktop, create an empty calendar named `Polymythcal Audit 48`.
2. Import the exact-time, all-day, legacy, and canonical files into that calendar.
3. Confirm the exact-time event’s local date and time, the all-day event’s date span, Unicode title rendering, description line breaks, location, and source URL.
4. Confirm the legacy and canonical files resolve to one logical UID without an identity mismatch.
5. After deployment, add the HTTPS `all.ics` URL by subscription and record the first successful refresh time.

Google’s official import instructions: https://support.google.com/calendar/answer/37118?hl=en

## Apple Calendar

1. On macOS, create an empty calendar named `Polymythcal Audit 48`.
2. Import the same four files with File → Import.
3. Check local time, all-day span, Unicode, line breaks, location, URL, and legacy/canonical identity.
4. After deployment, subscribe to the HTTPS `all.ics` URL and record the first successful refresh time.

Apple’s official import instructions: https://support.apple.com/guide/calendar/import-or-export-calendars-icl1023/mac

## Outlook

1. Create an empty Outlook calendar named `Polymythcal Audit 48`.
2. Import the same four files through Outlook desktop or Outlook on the web.
3. Check local time, all-day span, Unicode, line breaks, location, URL, and legacy/canonical identity.
4. After deployment, subscribe to the HTTPS `all.ics` URL and record the first successful refresh time.

Microsoft’s official import/subscription instructions: https://support.microsoft.com/en-us/office/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web-cff1429c-5af6-41ec-a5b4-74f2c278e98c

## Refresh and cleanup

After one real event update is deployed, record when each subscribed calendar updates the existing stable UID and whether any duplicate appears. Export or screenshot non-sensitive results, remove the subscription, and delete the temporary calendar.

Record:

```text
Vendor:
Application and version:
Operating system and version:
Account/calendar selected by:
Release ID:
Import results:
Subscription start:
First refresh:
Post-update refresh:
Duplicate UID observed:
Evidence:
Retest:
```
