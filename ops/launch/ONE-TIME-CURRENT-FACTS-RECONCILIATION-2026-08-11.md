# Current Launch Facts Reconciliation — 2026-08-11

## Authority and exact sources

- Integration baseline: PR #166 merge `9b987dabdd45266dde63cdf4e55b17947152ae11`; it is merged but not deployed.
- Current production: `06c67372e0735c9f997550db1bd72670fea33b6a`.
- This record is documentation-only. It changes no application, provider, account, browser, database, deployment, or production state.

## Current facts

- Parent and Student sign-in are human-proven.
- The Student sees Questions, Calendar, Library, and the sole recurring 7:00 PM class.
- Classroom entry is unavailable. Library has zero approved lessons.
- Admin Content has a false `content.view` denial and unrelated CRM controls.
- A Student credential is exactly a six-digit numeric PIN. Adult password rules are unchanged.

## Locked immediate scope

- Basic protected Zoom entry to the one 7:00 PM class is required for immediate launch.
- One real protected library video is required for immediate launch.
- Stage Host and OBS remain later.
- Buffer/Social is OFF.

## Boundaries

The two required journeys remain unproven until they have their own protected acceptance evidence. The Admin Content defect requires a separately scoped application repair; it authorizes neither CRM nor provider action. PR #166 must not be described as production until it is deployed and read back.
