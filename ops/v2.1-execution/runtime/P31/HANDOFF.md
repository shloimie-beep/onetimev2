# P31 Handoff

## Identity

- Branch: `codex/v21-p31-email-copy-approval`
- Start SHA: `80c281b7ae5826ed2c6abe95ba68a033ffa52174`
- Implementation SHA before this handoff metadata commit: `0e1f7bc6debb57826420f55f7f5c6e937761fca0`
- Current handoff commit: derive with `git rev-parse HEAD` after checkout; C00 records the observed remote head in `TASK-REGISTRY.yaml`
- Task packet digest: `bd03248c56abc9ea91dfbff449ec76dac0996fcd0eb336dccca28b96f184c374`
- Context digest: `c0a24633dbad28172a423203bfb228fa190faedd442fe5457925ad3fc6fa7342`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`

## Completed behavior

The canonical catalog now defines the exact three sender identities, Rabbi greeting/signoff, Resend-only account setup and password-reset copy, and GHL lifecycle fragments for Parent activation, class reminder, recording, newsletter, legacy migration, and former-member reactivation. The approval guard checks every WNC-9 gate and automatically blocks on digest drift, missing approval or required current consent, wrong sender, over-budget audience, Student contact, delivery/approval gaps, bounce/complaint thresholds, provider failures, and unrelated effects. Legacy migration and former-member reactivation explicitly declare approval-launch timing; the newsletter declares weekly household-local timing. No provider call or live send was made.

## Remaining work

No implementation work remains. I36 must integrate `INTERFACE-CHECKPOINT.yaml` and C00 must issue downstream integration start SHAs for P28/P29/P30. Reopen only under a C00-issued resume lease for a reproduced P31-scoped finding.

## Exact next action

Await C00/I36 observation and integration of the exact checkpoint.

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
- No migrations.

## Verification

`npm run typecheck` passed. Focused runtime assertions passed for: exact approval success; rejection for missing consent/gates/over-budget/Student contact; Resend-only token setup rendering; the absence of token-bearing GHL fragments; and approval-launch timing for active migration. The P31 interface artifacts have combined digest `d66db4101eb4b3f4a28696e6741e5f3b9a4790650c6ddc4369a13813800f4e59`.

## External effects

Authority: none. Attempted: 0. Succeeded: 0. Reconciled: 0. No provider or live effects are authorized or performed.

## Security, privacy, and data handling

No secrets, tokens, provider payloads, child data, Zoom/Vimeo bearers, or live sends are included. P31 must retain the adult-only GHL and digest-approval invariants.

## Blockers, deviations, and recovery

No blocker. The C00-issued lease expires at `2026-07-28T17:37:00Z`; do not continue after that time without a C00-issued resume lease.

## P30 copy registration atomic claim

- Claim parent: `ba811b3b2682ab46de1859334f5aa4ad5d7f5f0d`
- Containing control: `30689e76f3697ab11dedab3b77d5bb5cbededde5`
- READY parent control: `1b5e5dd662390dd5affc159990a59b3b8d99c127`
- Claim: `ff4a79d9-158b-4e3f-a150-03b171427749`
- COPY_CATALOG lease: `d03dd6a9-384f-4b52-aaaf-3ac5752a36da`
- READY digest: `53c8b3774408a96350e8050746a2e2894ab65a7c418b7932bb05f5e2f9e375cb`
- Request digest: `0fbfef8bc01adcbc6d683be66afc59ceb5e2981d69756edb5d2089f9d1dbc9cf`
- Effects: `0/0/0`

Only the P31 runtime triplet changed. Stop for C00 reconciliation before
authoring or registering the requested OT-15 step 2 and step 3 copy. No
provider configuration, activation, enrollment, or send is authorized.
