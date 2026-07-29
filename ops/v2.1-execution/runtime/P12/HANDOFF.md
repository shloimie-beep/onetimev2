# P12 Final Handoff

## Identity

- Branch: `codex/v21-p12-parent-household`
- Authorized start: `f1cecb5343cd1461ecd5c866ce7a9ad4a78c7635`
- Atomic claim: `bd0c8122dcaccc077b9c4ef51983f9ed1321d467`
- Implementation head: `4299c6b828a23fdf79bdc976ab5630df3591ed00`
- Interface checkpoint: `f265d163d6007e91fb2a332ebff6f173da81700e`
- Final handoff commit: derive with `git rev-parse HEAD`; C00 records the
  observed remote head.
- Task packet digest:
  `37a367f92ac2af2a1e9ef17ae97ec2caed3d80ea608d7bcbbeeb6ecc64a0c2bd`
- Context digest:
  `1b1bc9f0a0624836ba69e7c35acb2d70ea43f71347cb434be9796b307e418b73`
- Source package digest:
  `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim: `776c6b8b-8729-49ea-a9ca-f505fbaf320c`
- Writer: `codex-p12-worker-776c6b8b`
- Containing control authorization:
  `ab393d7eb3b7f55b910ba110949c05c40b7383e6`
- Ready-entry parent control:
  `3c4130ae4d015471ce21e7d70a39d98dde113318`
- Ready-entry digest:
  `9c85fefc71f18383c5bf674a35bce3c6026ebf6f844ed472376f77a866951c86`
- PARENT_HOUSEHOLD_UI lease:
  `992f62c1-faba-4709-bae6-6c201cc776b2`
- Lease issued: `2026-07-29T03:20:30Z`
- Lease expiry: `2026-07-29T04:20:30Z`
- Lease released: `2026-07-29T03:54:53Z`

## Published interface

- Semantic contract: `1.0.0`
- Canonical semantic digest:
  `6ba2fd50d2cbc20d8b4b9e403f66ca40586786d8ea8621c7d43933537165dbe7`
- Registration request digest:
  `501ae46b1ad26e933d2e15b4f13760f4c3c8ec93d2672dc7be0d7e372046e733`
- Downstream consumer: P13, only after I36 integrates the exact interface.

## Implemented behavior

P12 provides the isolated Parent household overview and Student management
contract, domain aggregate, server transaction service, and client workspace.
All reads and mutations bind to the authenticated Parent's exact household.
The standard allowance is three active Student seats. Creation and restoration
are revision- and capacity-bound; archive disables authentication and canonical
enrollment; restore preserves archived history while creating fresh credential
and enrollment state. Credential reset revokes prior sessions, and plaintext
credentials exist only in the immediate handoff result.

The client presents exact self/dependent actual-name guidance without age
fields, active-seat count and allowance, active and archived Students, safe
mutation states, and one-time credential display. The implementation owns no
central route or root barrel; registration remains the structured steward
request.

## Exact next action

I36 should independently review and integrate implementation
`4299c6b828a23fdf79bdc976ab5630df3591ed00` and interface checkpoint
`f265d163d6007e91fb2a332ebff6f173da81700e`, reproduce semantic digest
`6ba2fd50d2cbc20d8b4b9e403f66ca40586786d8ea8621c7d43933537165dbe7`,
and disposition registration request digest
`501ae46b1ad26e933d2e15b4f13760f4c3c8ec93d2672dc7be0d7e372046e733`.
C00 may authorize P13 only after exact interface integration.

## Changed files and migrations

- Exactly 16 start-to-final paths, all within the four P12-owned implementation
  trees or P12-local runtime/steward metadata recorded in `TASK-STATE.yaml`.
- Migrations: none.
- Steward request: `P12-registration-001`.

## Verification

- Focused domain/server/client suite: 3 files and 11 tests passed.
- Workspace typecheck: passed.
- Focused ESLint and Prettier: passed.
- Repository-wide secret scan: passed across 2750 text files.
- Exact 16-path scope audit, YAML parse, and diff hygiene: passed.
- Interface exports, canonical semantic digest, and immutable steward digest:
  reproduced from committed Git objects.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security, privacy, and data handling

No provider payload, live account, customer or child record, secret,
credential, message, deployment, enrollment mutation, or deletion was accessed
or attempted. Existing passwords are never retrievable or displayed.

## Blockers, deviations, and recovery

None. Recovery base is exact authorized start
`f1cecb5343cd1461ecd5c866ce7a9ad4a78c7635`.
