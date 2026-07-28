# P18 Handoff

## Identity

- Branch: `codex/v21-p18-embedded-classroom`
- Start SHA: `9ba92b070eedfa3756eff4f78fd328de72507a96`
- Atomic claim SHA: `9b37f4a0a123299b0b278ffeaa7b83c763155e3b`
- Implementation SHA: `7163c2a2fda6d4f8105895ceb62f97db1f8ee56a`
- Final ready-for-review head: derive with `git rev-parse HEAD`; C00 records the observed remote head.
- Task packet digest: `e9128366095ad3d2552fbe6b5389c0b4f0f03d3f32c2f6902d9d8b755bbaa1b2`
- Context digest: `2385ac5d0555d75318577964ad92b850c55e8bc770127454e65afe776648142d`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Implementation manifest digest: `b4048000148bb93a9e3debbe4ed933dcc1732f2bbf0f8e0f20dc19530b56f4ba`
- Contract artifact digest: `de3daf2b85b15b31c4bd230599ba48e714bdf2ff4c47683854e8962fd671255c`
- Claim ID: `415e950e-cfbb-4635-9f1a-3ffd6af825ac`
- EMBEDDED_CLASSROOM lease: `d44e1690-90e5-44b6-b17f-2faa92dfb220`
- Lease released: `2026-07-28T22:23:56Z`

## Completed behavior

P18 implements the embedded classroom authorization boundary with exact
Student, household, authenticated session, occurrence, environment, access,
enrollment, registrant, revocation, and current P32 consent checks. A live
occurrence stays joinable after scheduled start until its authoritative close;
a ready occurrence opens only at its ten-minute boundary.

Launch grants are digest-only, Student/session/occurrence/version-bound,
single-use, and valid for exactly 60 seconds. Redemption atomically consumes
the grant and acquires or renews the local session before a minimal ephemeral
Meeting SDK bootstrap is signed. Responses are no-store/no-referrer and reject
raw URLs. Authorization, consent, closed-occurrence, expired/replayed grant, and
second-device denials invoke no SDK/provider port.

One concurrent live session is enforced per Student. Same app-session/device
lineage reconnects, heartbeats every 30 seconds, and holds a 90-second lease.
Expiry permits a newly authorized acquisition. Admin reset is audited and
atomically revokes the active session plus every unused Student launch grant.

Attendance keeps append-only provider, embedded-client, and Admin-correction
events. It merges reconnect overlaps without double counting, gives verified
provider intervals precedence, records provider/client mismatch, caps
percentage at 100%, and applies corrections only through later audit evidence.
The Student view model provides honest camera guidance, recording disclosure
and persistent indicator, safe denial copy, and exact heartbeat timing.

## Remaining work

P18-owned implementation and branch verification are complete. F02 must
adjudicate `P18-migration-001`; I36 must adjudicate
`P18-registration-001` and integrate this exact head. Provider-sandbox and
production-operator proof remains candidate-bound for verification lanes.

## Exact next action

C00/I36 validate and integrate this `ready_for_review` checkpoint, then
adjudicate the two structured steward requests.

## Coverage

- Requirements: all five implementation-verified.
- Acceptance cases: all six have task-owned timing, authorization, consent, isolation, concurrency, reconnect, reset, attendance, persistence, and UI assertions; candidate-bound provider proof is not claimed.

## Changed files and migrations

Twenty implementation/request artifacts were added inside the five P18-owned
roots and P18-local steward requests, plus the three P18 runtime files. No
migration, root barrel, central server/client composer, control/integration
state, package manifest, lockfile, or provider registry was edited. Migrations:
none.

## Steward requests

- `P18-migration-001`: SHA-256 `acb6ed1d81e05e338875ada7309629d418dafa4b06ee555037e40988b7b7ff1a`.
- `P18-registration-001`: SHA-256 `1157f31a58d51047b73a2ee8e757da4428d08708bc29fa7b31818b722ac098b0`.

## Verification

- Locked manifest: 200/200; task/context/prompt/package/source digests passed.
- F05/P16/P32: ancestry, three contract digests, and 27 artifacts passed.
- Full TypeScript typecheck: passed.
- Focused Vitest: 4 files, 17 assertions, all passed.
- Focused ESLint: 18 TypeScript artifacts, passed.
- Focused Prettier: 23 changed artifacts, passed.
- Exact source scope: 23 paths, passed.
- Implementation manifest, contract artifact, and request digests: verified.
- Git diff and clean-source-tree checks: passed.

## External effects

Authority `none`; attempted `0`, succeeded `0`, reconciled `0`. No provider or
live effect occurred.

## Security, privacy, and data handling

No secrets, raw launch grants, SDK bearers, raw Zoom URLs, provider payloads,
customer/child data, Student email aliases, private questions, participant
display-name matching, or external identities were accessed or recorded.

## Blockers, deviations, and recovery

No P18-owned blocker or deviation. Shared migration and central registration
work is explicitly routed to its stewards.
