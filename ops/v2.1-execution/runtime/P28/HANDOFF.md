# P28 Handoff

## Identity

- Branch: `codex/v21-p28-communication-foundation`
- Start SHA: `9ba92b070eedfa3756eff4f78fd328de72507a96`
- Original foundation implementation SHA: `83355a7b6981073662d71f44a2c8f68264a307d8`
- Reminder-routing implementation SHA: `7a37ef5b57bf0e1a03114cf344a7aaf9f184b6d5`
- Interface metadata head: `aaedc3f2ec0a857658c943ea6e00dc6c1e97c46c`
- Final ready-for-review head: derive with `git rev-parse HEAD`; C00 records the pushed head
- Expected pre-claim head: `f891f16eb13593d0eb3bbe53c076513d12b07c23`
- Task packet digest: `3fd5a9c080e3a7695a415dc6fc289d095ad662d6ccfa598910f73014cf38c823`
- Context digest: `96152f74273391337a3c6b8dd576829e7ddf9467cc867fb3b35ec4cf2c3cc18c`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim: `42599e59-5e65-4269-b3d1-d10632342be6`
- Writer: `codex-p28-worker-42599e59`
- Containing control authorization: `85100180449bf234a93f107eb66a1f7bc635b4f0`
- Ready-entry state basis: `fe95eacb2a958ba043cc9f89c1c27e09e20b9324`
- Ready-entry digest: `48da940a881f37fe700d478fa1c34ae86a33fbaf2c10d000624b71c444711e6b`
- COMMUNICATION_FOUNDATION lease: `ac74a2a9-b988-418a-b429-fefb5feeeb37`
- Lease issued: `2026-07-30T04:01:19Z`
- Lease expiry: `2026-07-30T06:01:19Z`
- Lease released: `2026-07-30T04:37:00Z`
- Claim reconciliation control head: `1b5e5dd662390dd5affc159990a59b3b8d99c127`
- Effect locks: none

## Completed bounded steward request

P28 has claimed only immutable request `P17-REMINDER-ROUTING-001`, canonical
request digest
`c6015bb11b581333946e8e9de6e3676d108ed327d52ee1894f355ab921da14cf`,
from integrated P17 head
`78af71603713b6fc73fe755995bdf56193eb199a` and request-container blob
`bec8dc31dbe5d79a26434a7219d4d8696cf15f01`. The evaluated target is the exact
pre-claim P28 head `f891f16eb13593d0eb3bbe53c076513d12b07c23`.

After C00 reconciled exact claim checkpoint `79ba5cc8f903f9b88319681ae57fe959c4d11a1a`,
P28 implemented only the additive communication-foundation contract, pure
domain planner, worker adapter, and owned tests required by that request. No
P17, database, migration, registry, central composer, provider, or
steward-request file changed.

## Completed behavior

P28 now provides the versioned communication-foundation interface and its
domain, parameterized persistence, desired-state, canonical registry, and
worker boundaries. Exact Rabbi/office/brand/Resend sender truth, all
suppression gates, the four-value reminder preference, email-first dormant
WhatsApp behavior, Admin-only sanitized Communications Review, governed
Start/Pause requests, adult-only public website lead capture, and P29/P30
workflow-fragment validation are implemented.

The P17 reminder delta rejects the whole routing batch before persistence or
provider access unless every named Student has an active registrant and ready
protected portal state. It produces one account-owner intent per household,
includes sorted affected Student labels and only `/app/parent/classes`, reads
the current reminder preference, rechecks current suppression immediately
before delivery reservation, and uses the existing delivery dedupe for replay
safety. Email failure remains `retry_pending` while prepared in-app access is
reported as preserved.

The registry keeps OT-11 retired/reserved, restores OT-12 to adult support,
reserves OT-14/OT-15 for their exact purposes, and assigns OT-B01 to the
website bot without reusing the historical Complete Signup provider ID.
Provider-ID-empty entries remain non-executable pending separately authorized
realization and save/reopen readback.

## Interface checkpoint

- State: `interface_ready`
- Semantic version: `1.0.0`
- Artifact: `packages/contracts/src/communications/foundation/index.ts`
- Artifact SHA-256: `4c0bac7bb722590d039dcbefae02e1194e6b36350d8a5059cc27af29aa07b5d3`
- Contract digest: `2b8b685495e654dd1369a55086d8709f9612df26f042db676df9f0560a606c86`
- Downstream tasks: P29, P30

The additive steward delta preserves semantic version `1.0.0`. Its current
artifact SHA-256 is
`b3ec5642dea691cd81b08814d76cd3544f73b1a094333ab4d8b4ceb48f2735ea`
and its current semantic contract digest is
`f00013bbb46413c973276ef3454ef3b406e21d780349dbfcdccc004120cb1612`.
The original `INTERFACE-CHECKPOINT.yaml` remains historical evidence for the
already-integrated P29/P30 interface; I36 must integrate this exact steward
implementation head before central registration.

## Remaining work

C00 must verify this pushed ready-for-review checkpoint and hand the exact
implementation head to I36 for integration. Central caller registration
remains outside P28 and must not precede that integration.

## Exact next action

Push the runtime release checkpoint, report the exact remote head and evidence,
and await C00/I36 reconciliation. Do not perform provider inspection, sends, or
central composer edits.

## Coverage

- Requirements: nine assigned, implementation verified
- Acceptance cases: ten assigned, task-owned assertions passed

## Changed files and migrations

- Nine owned contract/domain/worker implementation and test files under the
  existing P28 globs
- P28 `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`
- Migrations: none

## Verification

- 47 focused assertions in seven files: passed
- Full TypeScript typecheck: passed
- Focused ESLint and Prettier checks: passed
- Repository secret scan across 2684 text files: passed
- Immutable P17 request digest and source blob: exact
- Contract artifact/semantic digests, owned-path scope, and diff checks: passed
- Terminal verification against clean implementation head `7a37ef5b`: passed
- Generated registry projection checks: expected stale-projection failure,
  stewarded by `P28-registry-projection-001`

## External effects

Authority: none. Attempted: 0; succeeded: 0; reconciled: 0. No provider or
effect lock exists.

## Security, privacy, and data handling

No secrets, provider payloads, learner data, raw Zoom URLs, launch grants,
technical aliases, Student authentication, live sends, workflow mutations,
enrollments, or deployments were accessed or performed.

## Blockers, deviations, and recovery

No implementation blocker. Applied migration, central registration, generated
registry projections, shared message-class coverage, and validator semantics
are explicitly requested in `P28-migration-001`, `P28-registration-001`, and
`P28-registry-projection-001`. Recovery base is implementation commit
`7a37ef5b57bf0e1a03114cf344a7aaf9f184b6d5`.
