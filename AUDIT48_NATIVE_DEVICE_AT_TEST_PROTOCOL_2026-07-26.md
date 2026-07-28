# Audit 48 native device and assistive-technology test protocol

Date: 2026-07-26  
Scope: native-browser, screen-reader, physical-device, and real-user validation that cannot be truthfully simulated by the Linux release container.

## Automated prerequisite evidence

Run:

```text
npm run verify:audit48-assistive-technology
```

The gate scans every source HTML document and blocks release on missing document languages, incorrect main-landmark counts, incorrect H1 structure, positive tab order, duplicate static IDs, unresolved static ARIA references, unresolved skip links, missing image alternatives, or unnamed static buttons. Existing keyboard, visible-input-label, zoom, responsive, forced-colors, and browser accessibility gates remain independently release-blocking.

Passing this gate means the native test matrix is ready to execute. It does not mean a native screen reader, physical device, or human participant ran.

## Test routes

Use the production-equivalent build for each row:

1. `/`
2. `/polymythseminars/`
3. `/polymythseminars/fr/`
4. `/polymythseminars/submit/`
5. `/polymythseminars/subscribe/`
6. `/leizu/`
7. `/leizu/fr/`
8. `/leizu/zh-hans/intake/`
9. `/leizu/fa/`
10. `/teacherresources/`
11. `/polymyth/methodologylist/`
12. `/polymyth/campaigncodex/`
13. `/bb/why/`
14. `/bookwormcard/`
15. `/saul/`

For an event-detail task, select the first current event linked from `/polymythseminars/` at test time. Record the event URL instead of relying on a time-sensitive fixture.

## Native matrix

| ID | Platform | Browser | Assistive technology | Required |
|---|---|---|---|---|
| VO-SAFARI | Current supported macOS | Safari | VoiceOver | Yes |
| NVDA-FF | Windows 11 | Firefox | NVDA | Yes |
| NVDA-CHROME | Windows 11 | Chrome | NVDA | Yes |
| IOS-VO | Current supported iPhone | Safari | VoiceOver | Yes |
| ANDROID-TB | Current supported Android phone | Chrome | TalkBack | Yes |
| REAL-USER | A participant using their normal device and access setup | Their normal browser | Their normal access setup | Yes |

Record exact operating-system, browser, and assistive-technology versions for each run.

## Screen-reader pass criteria

For every route in the matrix:

- The announced page title and primary language match the visible page.
- Landmark navigation exposes one main landmark.
- Heading navigation starts with one effective H1. On Bookwormcard, only the active progressive-enhancement H1 is exposed.
- The skip link becomes visible on focus, is announced meaningfully, and moves focus to main content.
- Tab and reverse-tab order follow the visual and DOM order without a trap.
- Links, buttons, form fields, filters, dialogs, and expanded/collapsed states have meaningful names and states.
- Search and filter status changes are understandable without unsolicited repetitive announcements.
- Validation errors are announced, identify the affected field, and remain understandable when revisited.
- Locale changes produce the expected pronunciation and do not silently change organizer-authored source-language text.
- Calendar download and subscription controls identify their purpose and selected event.

Record `pass`, `fail`, or `blocked`, the route, the control or heading involved, the exact spoken output needed to explain a failure, and a screenshot or short recording where consent allows.

## Physical-device pass criteria

On iPhone and Android:

- Portrait and landscape layouts remain usable without horizontal page scrolling at the default text size.
- Browser text enlargement and operating-system large text do not hide actions or overlap content.
- Touch targets are distinguishable and operable without accidental neighboring activation.
- Sticky controls do not cover focused fields, headings, messages, or calendar actions.
- The on-screen keyboard does not obscure the active input or its validation message.
- Reduced-motion settings avoid nonessential animation.
- Back navigation restores a coherent task state.

## Real-user task

Ask the participant to complete these tasks without coaching:

1. Find one relevant upcoming event.
2. Explain why it is relevant using only the information on the site.
3. add it to their calendar or describe which calendar action they would choose;
4. change language and find the corresponding submission or intake action;
5. locate one Teacher Resources item.

Capture task completion, misclicks, points of hesitation, unclear labels, and the participant’s own description of anything confusing. Do not record sensitive form content. Obtain consent before recording audio, video, or identifying information.

## Result record

For each matrix row, record:

```text
ID:
Date and tester:
Device and OS:
Browser and version:
Assistive technology and version:
Build or production release ID:
Routes completed:
Passes:
Failures:
Blocked checks:
Evidence locations:
Retest result:
```

Native status can be changed from `requires-native-operating-systems-physical-devices-and-human-observation` only after every required matrix row has evidence and every release-blocking failure has passed a retest.

## Official references

- Apple VoiceOver User Guide: https://support.apple.com/guide/voiceover/welcome-voic010/mac
- Apple VoiceOver webpage landmarks: https://support.apple.com/guide/voiceover/vo35709/mac
- NVDA User Guide: https://download.nvaccess.org/documentation/en/userGuide.html
- NV Access help and training: https://www.nvaccess.org/get-help/
