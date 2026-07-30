# P31 Handoff

## Identity

- Branch: `codex/v21-p31-email-copy-approval`
- Start SHA: `80c281b7ae5826ed2c6abe95ba68a033ffa52174`
- Implementation SHA before this handoff metadata commit: `8b3ed597115fe4c11a85f8ab35a1b2feb6f58649`
- Current handoff commit: derive with `git rev-parse HEAD` after checkout; C00 records the observed remote head in `TASK-REGISTRY.yaml`
- Task packet digest: `bd03248c56abc9ea91dfbff449ec76dac0996fcd0eb336dccca28b96f184c374`
- Context digest: `c0a24633dbad28172a423203bfb228fa190faedd442fe5457925ad3fc6fa7342`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`

## Completed behavior

The canonical catalog now defines the exact three sender identities, Rabbi greeting/signoff, Resend-only account setup and password-reset copy, and GHL lifecycle fragments for Parent activation, class reminder, recording, newsletter, legacy migration, and former-member reactivation. Under exact request `P30-copy-registration-001`, OT-15 step 2 and step 3 now publish owner-authored immutable bodies, their fixed subjects, day-4/day-9 approval-launch offsets, required variables, and canonical digests `530df43199316af56f2227090e164c898988d24a07e2fd08998e26539b6678c4` and `e2bdbc3063431caa10bfd2ae2a2e6768a99d1f07a5b7f83d5e53b52faa0e4087`. Step 1 and its digest `ff7fd5af4c77c5e9dfd62c5340ff0cb058f48d427ce407f8d6976593f1420ae2` remain unchanged.

The approval guard checks every WNC-9 gate and automatically blocks on content, subject, or sequence-day digest drift, missing named approval or required current consent, wrong sender, over-budget audience, Student contact, delivery/approval gaps, bounce/complaint thresholds, provider failures, and unrelated effects. No provider call or live send was made.

## Remaining work

No P31 implementation work remains. C00/I36 must review and integrate interface implementation `8b3ed597115fe4c11a85f8ab35a1b2feb6f58649`; P30 can then consume the two registrations and re-run its blocked OT-15 launch contract.

## Exact next action

Await C00/I36 review and integration of the exact semantic contract `1.1.0` checkpoint.

## Coverage

- Requirements: OTV2-EMAIL-139 through OTV2-EMAIL-146 are implementation_ready.
- Acceptance cases: OTV2-EMAIL-139-AC01 through OTV2-EMAIL-146-AC01 are implementation_ready; candidate-bound live proof remains V38/operator work only.

## Changed files and migrations

- `ops/v2.1-execution/runtime/P31/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/P31/HANDOFF.md`
- `ops/v2.1-execution/runtime/P31/NEXT-PROMPT.md`
- `ops/v2.1-execution/runtime/P31/INTERFACE-CHECKPOINT.yaml`
- `packages/domain/src/communications/copy/catalog.ts`
- `packages/domain/src/communications/copy/approval.ts`
- `integrations/highlevel/v21/copy/catalog.ts`
- `apps/web/src/server/features/email/templates/security.ts`
- `tests/unit/communications/copy-catalog.test.ts`
- No migrations.

## Verification

`npm run typecheck` passed. The focused Vitest contract passed 3 tests covering the exact two registrations and digests, the unchanged step 1 contract, GHL publication with no token-bearing content, named approval/current consent, and fail-closed body/subject/day drift. Scoped Prettier, YAML parsing, `npm run secret:scan`, `git diff --check`, and the owned-path scope audit passed. The refreshed P31 interface contract digest is `a759c3db1cd946549d97359a68f394e8f8bd6af5c4c615748993bd901bb27f3a`.

## External effects

Authority: none. Attempted: 0. Succeeded: 0. Reconciled: 0. No provider or live effects are authorized or performed.

## Security, privacy, and data handling

No secrets, tokens, provider payloads, child data, Zoom/Vimeo bearers, or live sends are included. P31 must retain the adult-only GHL and digest-approval invariants.

## Blockers, deviations, and recovery

No blocker. COPY_CATALOG lease `d03dd6a9-384f-4b52-aaaf-3ac5752a36da` was released at `2026-07-30T04:43:17Z`, before its `2026-07-30T05:56:56Z` expiry. Reopen only under a new C00-issued resume lease for a reproduced P31-scoped finding.

## P30 copy registration atomic claim

- Claim parent: `ba811b3b2682ab46de1859334f5aa4ad5d7f5f0d`
- Claim authorization control: `30689e76f3697ab11dedab3b77d5bb5cbededde5`
- Reconciliation control: `a0599de4502994d5028c9b24084b400d48f72f98`
- READY parent control: `1b5e5dd662390dd5affc159990a59b3b8d99c127`
- Claim: `ff4a79d9-158b-4e3f-a150-03b171427749`
- COPY_CATALOG lease: `d03dd6a9-384f-4b52-aaaf-3ac5752a36da`
- READY digest: `53c8b3774408a96350e8050746a2e2894ab65a7c418b7932bb05f5e2f9e375cb`
- Request digest: `0fbfef8bc01adcbc6d683be66afc59ceb5e2981d69756edb5d2089f9d1dbc9cf`
- Implementation: `8b3ed597115fe4c11a85f8ab35a1b2feb6f58649`
- Request disposition: implemented exactly
- Step 2 digest: `530df43199316af56f2227090e164c898988d24a07e2fd08998e26539b6678c4`
- Step 3 digest: `e2bdbc3063431caa10bfd2ae2a2e6768a99d1f07a5b7f83d5e53b52faa0e4087`
- Lease released: `2026-07-30T04:43:17Z`
- Effects: `0/0/0`

The exact P31-owned registration and interface checkpoint are ready for
review. No provider configuration, activation, enrollment, or send is
authorized.
