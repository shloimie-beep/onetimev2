# P10 School Seat Authority Acknowledgment Handoff

## Identity

- Branch: `codex/v21-p10-admin-directory`
- Acknowledgment parent: `5fccc34507ae9c5dbc609e234ab559576ab3a445`
- Authorized integration/evidence SHA:
  `d89a0f38dfe695c323f56a28e7c2b0bd890d4ef9`
- Corrected implementation head:
  `da5576d3f675b90a5db812d293801f9f5fa17d38`
- Live control head:
  `8b4d83ae15ebd5ddfc95d01e163f73d4865f4c73`
- Containing controller:
  `cc90f922663405d883a798db8d4278ef803bb7cb`
- Ready-entry digest:
  `b3beba3c354d96e99bcf2ac3d97295087116f29149b9ff2a5146c0300c84a018`
- Claim mode: `resume_existing`
- Claim: `e057d59f-2c37-4685-9bb4-ce407670caa4`
- Writer: `codex-p10-seat-ack-e057d59f`
- ADMIN_DIRECTORY lease:
  `215bd21b-fe00-4a12-a4b2-37959ed4b5d5`
- Lease issued: `2026-07-31T05:06:00Z`
- Lease expiry: `2026-07-31T07:06:00Z`
- Lease released: `2026-07-31T05:42:30Z`
- Final handoff commit: derive with `git rev-parse HEAD`; C00 records the observed remote head
- Task packet digest: `fe7abc1af5110c1007c34927fe9909bc3643998dd10615c195046f30423f7e28`
- Context digest: `a27b3c710d277153d8273f82d5d8e745d620fdd5ecacc619f6f7b9a5772bab17`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Implementation artifact digest: `07d90e33e041eed1e3cdfd02e2fbf8b31c13e5f8fa188e7edffcd57fbc581873`
- Steward-request digest: `0bb00ea1993634956d0bedba776b4eb2b20d32aec9f18b88edeb7e2823143aea`
- Steward-request Git blob: `6470da05b25a4afc1436fcde646d08da88caf457`

## Acknowledgment

P10 acknowledges only that immutable `P09-migration-002` supersedes the
overlapping approved-School seat/configuration authority requested by
`P09-migration-001` and `P10-MIGRATION-001`.

The successor request is exact:

- Path:
  `ops/v2.1-execution/runtime/P09/steward-requests/P09-migration-002.yaml`
- Raw SHA-256:
  `538d6509a5170efc5c164f577d2054005edcd74c17d95e6128cb84ecb37c1a62`
- Canonical payload SHA-256:
  `d9958a9def7fa6d41f5c457a20ff44df8ba265f532e76dd397532ccfcf570dbb`
- Git blob: `75cd8bb242eaaa59d7ebb215ea4d8881fb5354e1`

This acknowledgment does not apply or integrate the request, choose a migration
ordinal, write SQL, or mutate a provider. It preserves all P10 identity,
credential, enrollment, revocation, ownership-transfer, receipt, audit,
registration, product, SQL, request, and integration bytes and semantics. It
also preserves the non-overlapping P09 School inquiry, adult manual-follow-up,
and acknowledgment semantics.

The implementation remains exactly
`da5576d3f675b90a5db812d293801f9f5fa17d38` with artifact digest
`07d90e33e041eed1e3cdfd02e2fbf8b31c13e5f8fa188e7edffcd57fbc581873`.
`STEWARD-REQUESTS.yaml` remains byte-identical at raw SHA-256
`0bb00ea1993634956d0bedba776b4eb2b20d32aec9f18b88edeb7e2823143aea`
and Git blob `6470da05b25a4afc1436fcde646d08da88caf457`.

## Preserved corrected behavior

Service-account acceptance remains bound to the exact locked household owner,
active AdultIdentity, and active Parent HumanAccount. An unrelated adult,
inactive identity/account, non-Parent membership, mismatched relationship,
stale policy, or cross-scope evidence is rejected before persistence.

Student restore still requires the current locked canonical enrollment to be
revoked and to match the exact Student, household, scope, and enrollment
identity. Restore preserves that enrollment ID, writes only its next monotonic
version, and binds the fresh current acceptance evidence.

Ownership transfer still uses one independently locked, scope-bound,
exhaustive inventory of outgoing and replacement sessions, billing sessions,
grants, setup/reset tokens, and effect-authority records. Caller-supplied
subsets are rejected. Every exact inventory item must appear in complete
atomic revocation readback before transfer aggregates, audit, or receipt can
persist; any mismatch rolls the transaction back.

## Exact next action

C00 should reconcile this exact acknowledgment and retain the existing P10
implementation and every non-overlapping steward semantic byte-for-byte. Do
not resume P10 without a new exact C00 claim.

## Verification

- Live control/task heads, ready-entry digest, claim, writer, lease, and
  authorized evidence: passed.
- P09 successor request Git blob and raw SHA-256 readback: passed.
- Live-control canonical request payload binding: passed.
- P10 implementation and STEWARD-REQUESTS identities: unchanged and matched.
- Changed-path scope: exactly the three P10 runtime files.
- Workspace typecheck and lint: passed at the preserved implementation head.
- Focused domain/server/client suite: 20/20 passed.
- Direct unrelated-adult, forged enrollment, caller-subset, and incomplete
  readback rollback probes: passed.
- Focused Prettier and diff hygiene: passed.
- Repository-wide secret scan: passed across 2719 text files.
- Prior digest reproduction and refreshed implementation/steward digests:
  passed.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security, privacy, and data handling

No provider call, live account mutation, credential reset, ownership transfer,
customer/child record, secret, message, deployment, integration, or canary was
accessed or attempted. The brand checker continues to report only the
pre-existing raw color in `scripts/ops/validate-ot-launch-governance.ts`,
outside P10 scope.
