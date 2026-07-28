# P15 Handoff

## Identity

- Branch: `codex/v21-p15-calendar`
- Start SHA: `81602ccc44e134288d2e8cd8d6ad71a249553be2`
- Implementation SHA before this metadata commit: `ab71afb032b8e004cc655e3e5f5a6b8286aec380`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the observed remote head
- Task packet digest: `cc6d395e0cb231a5180c9f927a64c814148b4946f869d68ee6afc1b74bc5c8df`
- Context digest: `0f4326a4a2c00120ae85466af822e8dc1304c2d6f6d975699991e8db75778a6a`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim: `dc9b1096-19bc-4d6a-91e0-e15dc06d2705`
- CALENDAR lease: `83e9dbb8-9007-4c75-bc14-5b0accfe90a1`, released task-locally at `2026-07-28T19:32:00Z`
- Authorizing control head: `44202fc53db9781c91e4015d6af004bac4ab037b`
- Ready-entry parent: `fe5219b4533fc7d7075f209f262e579906cf1e34`
- Ready payload digest: `b78cc45bd737dc76a8161321f1a656611e6cf59cdc8064eeb7de15cafc05780f`

## Completed behavior

Implemented the P15 calendar lane as an additive `2.1.0` contract. The canonical
series is Sunday through Thursday at 19:00 `Asia/Jerusalem`, 60 minutes, and
rolls forward over at least 90 local days with stable series/date identity.
Recurrence conversion uses explicit IANA zones, rejects DST gaps and unresolved
folds, supports skip/single/future edit plans with version fencing, and forbids
Friday/Saturday starts and past rewrites.

Admin, Parent, and Student projections enforce closed view sets, tenant and
household/Student scopes, access denial before result rendering, explicit
Gregorian/English labels, role-safe detail, and browser-time-zone independence.
Parent results omit Join; Student results expose only an opaque
`open_live_class` action inside the authorized window. The responsive UI uses
F07 primitives/tokens, equal keyboard-operable month cells, a persistent agenda
equivalent, explicit selected/today states, and a mobile agenda fallback.

The P16 interface is published at implementation head
`ab71afb032b8e004cc655e3e5f5a6b8286aec380` with contract digest
`2ebe108d2aa39a90908889bf9cf8f96cffb93d296e7ee9614e0d1bb5b351c3eb`.

## Remaining work

I36 must integrate the interface checkpoint before C00 authorizes P16. Shared
migration, barrel, and central route composition are intentionally not in the
P15 diff; exact requests are in `STEWARD-REQUESTS.yaml`.

## Exact next action

Review and integrate interface digest
`2ebe108d2aa39a90908889bf9cf8f96cffb93d296e7ee9614e0d1bb5b351c3eb`,
record the observed metadata head in control, then disposition
`P15-MIGRATION-001` and `P15-REGISTRATION-001`.

## Coverage

- Requirements `OTV2-CALENDAR-051` through `OTV2-CALENDAR-064`: implementation-ready.
- Acceptance cases `OTV2-CALENDAR-051-AC01` through `OTV2-CALENDAR-064-AC01`: implementation-ready; candidate-bound staging/operator-canary proof remains with the verification/release lanes.

## Changed files and migrations

Added only P15-owned calendar contract/domain/database/server/client/test roots
and P15 runtime records. No applied or new shared migration, root barrel,
central composer, global style/token, or control ledger was edited.

## Verification

- Exact authorization, claim, lease, package/source/task/context digests, and F02/F07 interface ancestry: passed.
- Locked manifests: 200/200 package files and 15/15 source files passed from immutable Git blobs.
- `npm run typecheck`: passed.
- `npm run lint -- --quiet`: passed.
- Focused domain and server-rendered UI suite: 12/12 passed.
- Prettier and `git diff --check`: passed.
- Google Calendar/provider surface inventory under P15-owned implementation paths: absent.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security, privacy, and data handling

No live provider call, secret, bearer URL, customer record, child payload,
message, deployment, or mutation was accessed or attempted. Server-derived
tenant/household/Student scopes remain inside the repository query boundary.

## Blockers, deviations, and recovery

No task-local blocker. The two shared integration changes are recorded as
steward requests rather than out-of-scope edits.
