# GHL Event Workflow Handoff

Status: live workflow verified for the single operator-owned confirmation. No broad audience send is authorized.

Workflow:

- ID: `a34ea513-4612-4f53-8bd8-49e89e6610f9`
- Name: `OT-E01 | Event | Tisha B'Av 2026 Confirmation + Reminders`
- Provider status: `published`
- Active operator enrollments: `1`
- Current action: wait until the one-hour reminder at `2026-07-23T18:00:00.000Z`
- Confirmation executions for the operator: `1`
- Duplicate enrollment requests: skipped by HighLevel
- Recovery enrollment: confirmation skipped; contact resumed at the one-hour wait
- Provider contact tags: exact registered and event-source tags verified; weekly-newsletter tag absent

The former 24-hour wait and email were removed. Re-entry was enabled only for the bounded recovery enrollment and was restored to off. The immediate confirmation action was re-enabled before the workflow was saved and published.

Location:

- `pBSnOK2nkdxp6gf9Rg3o`

Visible sender:

- `Rabbi Eli Scheller | One Time Mishnayos`

From and Reply-To:

- `info@onetimeonetime.com`

Required tags:

- `OT | Event | Tisha B'Av 2026 | Invited`
- `OT | Event | Tisha B'Av 2026 | Registered`
- `OT | Event | Tisha B'Av 2026 | Attended`
- `OT | Event | Tisha B'Av 2026 | No Show`
- `OT | Event | Tisha B'Av 2026 | Replay Sent`
- `OT | Source | Tisha B'Av 2026`

Registration sync behavior:

- Upsert one adult contact by normalized email.
- Preserve unrelated tags by only adding event tags.
- Set custom field `One Time Signup Source` to `Tisha B'Av 2026 Landing`.
- Add `OT | Weekly Newsletter` only when explicit newsletter consent is true.
- Request the event confirmation/reminder workflow idempotently.

Workflow copy requirement:

- Canonical catalog version: `tisha-bav-2026-email-copy-v1`.
- Executable catalog: `packages/domain/src/events/tisha-bav-communications.ts`.
- Verbatim source: `EMAIL-COPY-RAW.md`.
- Validated intent packet: `EMAIL-COPY-SPEC.json`, `EMAIL-COPY-RECEIPT.md`, and `EMAIL-COPY-CODEX-PROMPT.md`.
- Confirmation and reminders must not include a raw Zoom URL until the protected meeting mapping is ready.
- Confirmation copy must say the private access details will be emailed before the program, not that they already were delivered.

## Atomic schedule contract

Canonical event start:

- Thursday, July 23, 2026
- 3:00 PM Eastern
- 10:00 PM Israel
- `2026-07-23T19:00:00.000Z`

Live workflow order for registered contacts:

1. Send the registration confirmation immediately after successful registration.
2. Wait until `2026-07-23T18:00:00.000Z` (2:00 PM Eastern / 9:00 PM Israel), then send the one-hour reminder.
3. Wait until `2026-07-23T18:50:00.000Z` (2:50 PM Eastern / 9:50 PM Israel), then send the ten-minute reminder.

These are fixed event-relative instants, not delays measured from the registration time. A contact entering after a reminder instant must not receive that reminder retrospectively. If the event time changes, change the canonical event start and regenerate/revalidate all dated email copy and both reminder instants together.

## Shared sender and protected destinations

Use for all four messages:

- From name: `Rabbi Eli Scheller | One Time Mishnayos`
- From email: `info@onetimeonetime.com`
- Reply-To: `info@onetimeonetime.com`

CTA destinations:

- `Reserve My Place` -> `/tisha-bav`
- `View Event Details` -> `/tisha-bav`
- `Open the Live Event Page` -> `/tisha-bav/live`
- `Join the Live Program` -> `/tisha-bav/live`

Use the deployed One Time origin for these relative paths. Do not place a raw Zoom URL in any email.

## Warm invitation

Delivery status: prepared only. Do not attach it to the registration workflow and do not send until an exact adult recipient segment is approved.

HighLevel campaign record: `OT-C01` (`f28d8b8a-c26a-4a4f-a9f2-d2a8e94af1ae`) remains draft with zero recipients and zero messages sent.

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

## Registration confirmation

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

## One-hour reminder

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

## Ten-minute reminder

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
