# CODEX PROMPT - SPEC-20260721-010

Spec fingerprint: df3cbccf409bfe09788297eec926817918c86fe3e326a98d915f02f308709f39
Raw source: C:/Users/User/.onetime-worktrees/TISHA-BAV-2026-FUNNEL/ops/codex-runs/TISHA-BAV-FUNNEL/EMAIL-COPY-RAW.md
Raw SHA-256: c970d6cae8311ace88c20bb0702e4a1f022f36ef165ad554bffa7af5b10a050f
Workspace/project: rabbi_sheller_provider / one_time_mishnah_class
Routes: /tisha-bav, /tisha-bav/live

## Operating Order

VERBATIM RAW -> ATOMIC SPEC -> CHANGE RECEIPT -> AMBIGUITY RESOLUTION -> PQC -> GENERATED CODEX PACKET -> IMPLEMENTATION -> ASSERTIONS/EVIDENCE

Report implementation status and evidence per change ID. Do not implement changes outside these IDs.

## Scoped Files / Routes

- Inferred files unavailable; inspect only the routes and targets listed below.

## Included Changes

### CHG-20260721-010

- Classification: HARD_EXACT
- Target: /tisha-bav > Canonical event schedule > Email catalog and workflow schedule > 2026-07-23T15:00:00-04:00
- Operation: behavior
- Current state: The event schedule exists, but exact email copy and reminder waits are not bound to one validated communication catalog.
- Required state: The event remains Thursday, July 23, 2026 at 3:00 PM Eastern / 10:00 PM Israel. Every dated email and the one-hour and ten-minute workflow waits must derive from the same canonical event start and fail validation when they diverge.
- Exact payload: {"event_start":"2026-07-23T15:00:00-04:00","event_start_israel":"2026-07-23T22:00:00+03:00","display_date":"Thursday, July 23, 2026","display_time_eastern":"3:00 PM Eastern","display_time_israel":"10:00 PM Israel","one_hour_reminder_offset_minutes":-60,"ten_minute_reminder_offset_minutes":-10}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: The event starts during Tisha B'Av. | A time change updates all dated copy and reminder waits together.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - CHG-20260721-010:S01 [0, 245]: "**# Tisha B'Av 2026 Email Copy**\n\n**## Event assumptions**\n\n`text\nThursday, July 23, 2026\n3:00 PM Eastern\n10:00 PM Israel\n`\n\nThe event starts during Tisha B'Av.\n\nIf the final event time changes, update every email and workflow wait together."
- Positive assertions:
  - CHG-20260721-010-POS-001: **# Tisha B'Av 2026 Email Copy**

**## Event assumptions**

```text
Thursday, July 23, 2026
3:00 PM Eastern
10:00 PM Israel
```

The event starts during Tisha B'Av.

If the final event time changes, update every email and workflow wait together.

- CHG-20260721-010-POS-002: The reminder schedule resolves to 2026-07-23T18:00:00.000Z and 2026-07-23T18:50:00.000Z.
- CHG-20260721-010-POS-003: A contract test verifies every message date/time line and every workflow wait against the canonical start.
- Negative assertions:
  - CHG-20260721-010-NEG-001: No message or reminder uses an independently maintained event timestamp.

### CHG-20260721-011

- Classification: HARD_EXACT
- Target: /tisha-bav > Warm invitation > HighLevel email template > Reserve My Place
- Operation: add
- Current state: No exact warm-invitation template is encoded in the event configuration or provider handoff.
- Required state: Preserve the operator's From, Reply-To, subject, preview, body, merge token, line order, and CTA label exactly; map the CTA to /tisha-bav.
- Exact payload: {"from_name":"Rabbi Eli Scheller | One Time Mishnayos","from_email":"info@onetimeonetime.com","reply_to":"info@onetimeonetime.com","subject":"Join me live this Tisha B'Av","preview":"A live program from Eretz Yisrael on Thursday at 3:00 PM Eastern.","cta_label":"Reserve My Place","cta_path":"/tisha-bav"}
- Placement: parent=email; before=; after=; order=greeting > invitation > schedule > access promise > CTA > signoff
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: {{default contact.first_name "there"}} | No raw Zoom URL in the template.
- Must remove: (none)
- Dependencies: CHG-20260721-010
- Supersedes: (none)
- Source spans:
  - CHG-20260721-011:S01 [247, 904]: "**## Warm invitation**\n\nFrom:\n\n`text\nRabbi Eli Scheller | One Time Mishnayos\n<info@onetimeonetime.com>\n`\n\nReply-To:\n\n`text\ninfo@onetimeonetime.com\n`\n\nSubject:\n\n`text\nJoin me live this Tisha B'Av\n`\n\nPreview:\n\n`text\nA live program from Eretz Yisrael on Thursday at 3:00 PM Eastern.\n`\n\nBody:\n\n`text\nHi {{default contact.first_name \"there\"}},\n\nThis Tisha B'Av, I will be hosting a live online program from Eretz Yisrael.\n\nThursday, July 23, 2026\n3:00 PM Eastern\n10:00 PM Israel\n\nRegister below and we'll email the private access before the program begins.\n\n[Reserve My Place]\n\nI hope you can join me.\n\nRabbi Eli Scheller\nOne Time Mishnayos\n`"
- Positive assertions:
  - CHG-20260721-011-POS-001: **## Warm invitation**

From:

```text
Rabbi Eli Scheller | One Time Mishnayos
<info@onetimeonetime.com>
```

Reply-To:

```text
info@onetimeonetime.com
```

Subject:

```text
Join me live this Tisha B'Av
```

Preview:

```text
A live program from Eretz Yisrael on Thursday at 3:00 PM Eastern.
```

Body:

```text
Hi {{default contact.first_name "there"}},

This Tisha B'Av, I will be hosting a live online program from Eretz Yisrael.

Thursday, July 23, 2026
3:00 PM Eastern
10:00 PM Israel

Register below and we'll email the private access before the program begins.

[Reserve My Place]

I hope you can join me.

Rabbi Eli Scheller
One Time Mishnayos
```

- CHG-20260721-011-POS-002: Reserve My Place resolves to /tisha-bav.
- Negative assertions:
  - CHG-20260721-011-NEG-001: The invitation is prepared only; it is not sent and no recipient segment is inferred.

### CHG-20260721-012

- Classification: HARD_EXACT
- Target: /tisha-bav > Registration confirmation > HighLevel email template and bounded fallback > View Event Details
- Operation: add
- Current state: The registration flow queues a versioned confirmation intent without an exact provider-visible copy contract.
- Required state: Preserve the exact confirmation subject, body, merge token, line order, and CTA label; map the CTA to /tisha-bav and queue it immediately after registration.
- Exact payload: {"subject":"You're registered for Rabbi Eli Scheller's live Tisha B'Av program","cta_label":"View Event Details","cta_path":"/tisha-bav","workflow_offset_minutes":0}
- Placement: parent=email; before=; after=; order=greeting > confirmation > schedule > access promise > CTA > signoff
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: {{default contact.first_name "there"}} | No raw Zoom URL in the template.
- Must remove: (none)
- Dependencies: CHG-20260721-010
- Supersedes: (none)
- Source spans:
  - CHG-20260721-012:S01 [906, 1371]: "**## Registration confirmation**\n\nSubject:\n\n`text\nYou're registered for Rabbi Eli Scheller's live Tisha B'Av program\n`\n\nBody:\n\n`text\nHi {{default contact.first_name \"there\"}},\n\nYour place is saved for Rabbi Eli Scheller's live Tisha B'Av program from Eretz Yisrael.\n\nThursday, July 23, 2026\n3:00 PM Eastern\n10:00 PM Israel\n\nWe'll email the private access details before the program begins.\n\n[View Event Details]\n\nOne Time Mishnayos\ninfo@onetimeonetime.com\n`"
- Positive assertions:
  - CHG-20260721-012-POS-001: **## Registration confirmation**

Subject:

```text
You're registered for Rabbi Eli Scheller's live Tisha B'Av program
```

Body:

```text
Hi {{default contact.first_name "there"}},

Your place is saved for Rabbi Eli Scheller's live Tisha B'Av program from Eretz Yisrael.

Thursday, July 23, 2026
3:00 PM Eastern
10:00 PM Israel

We'll email the private access details before the program begins.

[View Event Details]

One Time Mishnayos
info@onetimeonetime.com
```

- CHG-20260721-012-POS-002: View Event Details resolves to /tisha-bav.
- Negative assertions:
  - CHG-20260721-012-NEG-001: The confirmation never claims that private access has already been delivered.

### CHG-20260721-013

- Classification: HARD_EXACT
- Target: /tisha-bav/live > One-hour reminder > HighLevel email template and workflow wait > Open the Live Event Page
- Operation: add
- Current state: No exact one-hour reminder template or schedule contract is encoded.
- Required state: Preserve the exact subject, body, merge token, line order, and CTA label; map the CTA to /tisha-bav/live and schedule it exactly 60 minutes before the canonical event start.
- Exact payload: {"subject":"We begin in one hour","cta_label":"Open the Live Event Page","cta_path":"/tisha-bav/live","workflow_offset_minutes":-60}
- Placement: parent=email; before=; after=; order=greeting > reminder > join instruction > CTA > signoff
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: {{default contact.first_name "there"}} | The Join button becomes available only when the protected event opens.
- Must remove: (none)
- Dependencies: CHG-20260721-010
- Supersedes: (none)
- Source spans:
  - CHG-20260721-013:S01 [1373, 1706]: "**## One-hour reminder**\n\nSubject:\n\n`text\nWe begin in one hour\n`\n\nBody:\n\n`text\nHi {{default contact.first_name \"there\"}},\n\nRabbi Eli Scheller's live Tisha B'Av program begins in one hour.\n\nOpen the event page below. The Join button will become available when the event opens.\n\n[Open the Live Event Page]\n\nOne Time Mishnayos\n`"
- Positive assertions:
  - CHG-20260721-013-POS-001: **## One-hour reminder**

Subject:

```text
We begin in one hour
```

Body:

```text
Hi {{default contact.first_name "there"}},

Rabbi Eli Scheller's live Tisha B'Av program begins in one hour.

Open the event page below. The Join button will become available when the event opens.

[Open the Live Event Page]

One Time Mishnayos
```

- CHG-20260721-013-POS-002: The wait resolves to 2026-07-23T18:00:00.000Z from the canonical event start.
- Negative assertions:
  - CHG-20260721-013-NEG-001: The reminder contains no raw Zoom URL.

### CHG-20260721-014

- Classification: HARD_EXACT
- Target: /tisha-bav/live > Ten-minute reminder > HighLevel email template and workflow wait > Join the Live Program
- Operation: add
- Current state: No exact ten-minute reminder template or schedule contract is encoded.
- Required state: Preserve the exact subject, body, merge token, line order, and CTA label; map the CTA to /tisha-bav/live and schedule it exactly 10 minutes before the canonical event start.
- Exact payload: {"subject":"Starting soon: join Rabbi Eli Scheller live","cta_label":"Join the Live Program","cta_path":"/tisha-bav/live","workflow_offset_minutes":-10}
- Placement: parent=email; before=; after=; order=greeting > starting soon > private-page instruction > CTA > do-not-forward notice > signoff
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: {{default contact.first_name "there"}} | Please do not forward the access page. | No raw Zoom URL in the template.
- Must remove: (none)
- Dependencies: CHG-20260721-010
- Supersedes: (none)
- Source spans:
  - CHG-20260721-014:S01 [1708, 2065]: "**## Ten-minute reminder**\n\nSubject:\n\n`text\nStarting soon: join Rabbi Eli Scheller live\n`\n\nBody:\n\n`text\nHi {{default contact.first_name \"there\"}},\n\nWe're starting shortly.\n\nUse the private One Time event page to join Rabbi Eli Scheller's live Tisha B'Av program.\n\n[Join the Live Program]\n\nPlease do not forward the access page.\n\nOne Time Mishnayos\n`"
- Positive assertions:
  - CHG-20260721-014-POS-001: **## Ten-minute reminder**

Subject:

```text
Starting soon: join Rabbi Eli Scheller live
```

Body:

```text
Hi {{default contact.first_name "there"}},

We're starting shortly.

Use the private One Time event page to join Rabbi Eli Scheller's live Tisha B'Av program.

[Join the Live Program]

Please do not forward the access page.

One Time Mishnayos
```

- CHG-20260721-014-POS-002: The wait resolves to 2026-07-23T18:50:00.000Z from the canonical event start.
- Negative assertions:
  - CHG-20260721-014-NEG-001: The reminder contains no raw Zoom URL.

## Forbidden

- Do not paraphrase exact payloads.
- Do not weaken HARD_EXACT constraints with SOFT_GOAL language.
- Do not implement unresolved ambiguous changes.
- Do not edit product code before PQC and downstream readiness gates when product/UI work is in scope.
