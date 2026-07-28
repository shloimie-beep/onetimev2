# P31 Handoff

## Identity

- Branch: `codex/v21-p31-email-copy-approval`
- Start SHA: `80c281b7ae5826ed2c6abe95ba68a033ffa52174`
- Implementation SHA before this handoff metadata commit: `c815cbc8eb5fe301ca0b693eaa64e8db22752213`
- Current handoff commit: derive with `git rev-parse HEAD` after checkout; C00 records the observed remote head in `TASK-REGISTRY.yaml`
- Task packet digest: `bd03248c56abc9ea91dfbff449ec76dac0996fcd0eb336dccca28b96f184c374`
- Context digest: `c0a24633dbad28172a423203bfb228fa190faedd442fe5457925ad3fc6fa7342`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`

## Completed behavior

The canonical catalog now defines the exact three sender identities, Rabbi greeting/signoff, Resend-only account setup and password-reset copy, and GHL lifecycle fragments for Parent activation, class reminder, recording, newsletter, legacy migration, and former-member reactivation. The approval guard checks every WNC-9 gate and automatically blocks on digest drift, missing approval, wrong sender, over-budget audience, Student contact, delivery/approval gaps, bounce/complaint thresholds, provider failures, and unrelated effects. No provider call or live send was made.

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

`npm run typecheck` passed. Focused runtime assertions passed for: exact approval success; rejection for missing gates/over-budget/Student contact; Resend-only token setup rendering; and the absence of token-bearing GHL fragments. The P31 interface artifacts have combined digest `ad924a549e3eddd6fdb5ba3c9d485b78a9e75de320c003561557128ea9b77f8e`.

## External effects

Authority: none. Attempted: 0. Succeeded: 0. Reconciled: 0. No provider or live effects are authorized or performed.

## Security, privacy, and data handling

No secrets, tokens, provider payloads, child data, Zoom/Vimeo bearers, or live sends are included. P31 must retain the adult-only GHL and digest-approval invariants.

## Blockers, deviations, and recovery

No blocker. The C00-issued lease expires at `2026-07-28T17:37:00Z`; do not continue after that time without a C00-issued resume lease.
