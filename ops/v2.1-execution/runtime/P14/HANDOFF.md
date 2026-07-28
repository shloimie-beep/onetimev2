# P14 Handoff

## Identity

- Branch: `codex/v21-p14-student-app`
- Start SHA: `9782a4164662b8059a557c0969de9c35f54d0cf7`
- Implementation SHA before this metadata commit: `9c08e9c6735a61e201f7b05116a3406e6092e08b`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the observed remote head
- Task packet digest: `f35e796992e80fd947064e343a2088a069cc1a4e1e5be2719d0bbf4ced7cfac7`
- Context digest: `0f7110208e474961ca0473b7725d54d4d399e691ab55da4fe7bba0c1ae745978`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim: `cd46fd41-66f9-42c3-9215-2d12fbbf7d31`
- STUDENT_APP lease: `9bf07bbc-62cb-4905-8091-790815fd556a`, released task-locally at `2026-07-28T19:57:00Z`
- Containing control authorization: `0341f6303937bebc64e4d3cae6905168183dbb77`
- Ready-entry parent: `f2ace0993937a020a31c364f079bcf52b8c65350`
- Ready payload digest: `835d7186f4413b121f360335878d3df270b40e50cabd0d74b4f1ba85ce6097d8`

## Completed behavior

Implemented the separate Student application seam as a versioned `2.1.0`
self-only contract. Authenticated server context binds one Student and one
household; sibling, cross-household, archived, inactive, wrong-route, and
dependent privacy/data-rights access fail closed before projection.

The Student shell exposes only canonical Today, Calendar, Class, Library,
Progress, Questions, Updates, Notifications, Support, and Account surfaces.
Today prioritizes class/Join, lesson, private-question state, notices, and badge
progress. Own profile exposes only actual/display name and username. Account
provides Parent/Admin-managed credential guidance and session logout, with no
Student password change or old-password display.

The P21 interface is published at implementation head
`9c08e9c6735a61e201f7b05116a3406e6092e08b` with digest
`1a9b86f0d39cc0e3999973fc988d9c2d00c302ccad13a50857c14c7d5e2f03e1`.

## Remaining work

I36 must integrate the interface before C00 authorizes P21 and must disposition
the shared route/barrel work in `P14-REGISTRATION-001`.

## Exact next action

Review and integrate interface digest
`1a9b86f0d39cc0e3999973fc988d9c2d00c302ccad13a50857c14c7d5e2f03e1`,
record the observed metadata head in control, then disposition
`P14-REGISTRATION-001`.

## Coverage

- Requirements `OTV2-STUDENT-041` through `OTV2-STUDENT-050`: implementation-ready.
- Acceptance cases `OTV2-STUDENT-041-AC01` through `OTV2-STUDENT-050-AC01`: implementation-ready; candidate-bound browser/persistence evidence remains in verification lanes.

## Changed files and migrations

Added only P14-owned Student contract/domain/server/client/test roots and P14
runtime records. No migration, root barrel, central composer, global style, or
control ledger was edited.

## Verification

- Authorization, claim/lease, digests, locked manifests, and F03/F04/F07 ancestry passed.
- Full `npm run typecheck` and `npm run lint -- --quiet` passed.
- Focused domain/server/server-rendered UI suite: 9/9 passed.
- Prettier, diff hygiene, and raw feature palette/font inventory passed.

## External effects

Authority is `none`; attempted 0, succeeded 0, reconciled 0.

## Security, privacy, and data handling

No live effect, secret, real child data, private question body, provider
payload, email address, raw Zoom/Vimeo URL, or password was accessed or stored.
The public contract contains no sibling selector or credential mutation.

## Blockers, deviations, and recovery

No task-local blocker. Shared registration is correctly routed to I36.
