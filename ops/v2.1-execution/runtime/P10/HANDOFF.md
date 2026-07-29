# P10 Bounded Correction Handoff

## Identity

- Branch: `codex/v21-p10-admin-directory`
- Authorized start: `49431959f58f284bdc13ca931acf09f980fc483a`
- Reconciled claim head:
  `6ec92d288e4ed511449e5061d21a2dfb49c1abae`
- Corrected implementation head:
  `da5576d3f675b90a5db812d293801f9f5fa17d38`
- Original claim authorization:
  `04ebe46bc1cff1223bdade3379457cf774c0dce1`
- Reconciled containing controller:
  `802b522f2a5ff0613bdba6cb754cb2eeb340537f`
- Reconciliation acquisition:
  `81f10c6535db733cc0505b43f37fe5a3e7887934`
- Correction ready-entry digest:
  `e7b8877ba11a9299d1421888420f4c7eac111275496ede7cc4a1e98469597f5b`
- Claim mode: `resume_existing_branch`
- Correction claim: `cd15a4ba-db91-44ff-b522-f111fbcd9a0d`
- Writer: `codex-p10-worker-cd15a4ba`
- ADMIN_DIRECTORY lease:
  `f7660370-d954-4ee3-8513-4069bef54025`
- Lease issued: `2026-07-29T02:12:48Z`
- Lease expiry: `2026-07-29T03:12:48Z`
- Lease released: `2026-07-29T02:38:56Z`
- Final handoff commit: derive with `git rev-parse HEAD`; C00 records the observed remote head
- Task packet digest: `fe7abc1af5110c1007c34927fe9909bc3643998dd10615c195046f30423f7e28`
- Context digest: `a27b3c710d277153d8273f82d5d8e745d620fdd5ecacc619f6f7b9a5772bab17`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Implementation artifact digest: `07d90e33e041eed1e3cdfd02e2fbf8b31c13e5f8fa188e7edffcd57fbc581873`
- Steward-request digest: `0bb00ea1993634956d0bedba776b4eb2b20d32aec9f18b88edeb7e2823143aea`

## Corrected behavior

Service-account acceptance now binds the Student and household to the exact
current locked household owner, active AdultIdentity, and active Parent
HumanAccount. An unrelated adult, inactive identity/account, non-Parent
membership, mismatched relationship, stale policy, or cross-scope evidence is
rejected before persistence.

Student restore now requires the current locked canonical enrollment to be
revoked and to match the exact Student, household, scope, and enrollment
identity. Restore preserves that enrollment ID, writes only its next monotonic
version, and binds the fresh current acceptance evidence.

Ownership transfer now uses one independently locked, scope-bound, exhaustive
inventory of outgoing and replacement sessions, billing sessions, grants,
setup/reset tokens, and effect-authority records. Caller-supplied subsets are
rejected. Every exact inventory item must appear in complete atomic revocation
readback before transfer aggregates, audit, or receipt can persist; any
mismatch rolls the transaction back.

The bounded correction changes five implementation/test contracts, the P10
steward request, and the three final runtime-memory files. It does not edit
shared adapters, migrations, route composers, UI, provider code, or any
unrelated task surface.

## Exact next action

I36 should independently review/integrate implementation
`da5576d3f675b90a5db812d293801f9f5fa17d38`, reproduce artifact digest
`07d90e33e041eed1e3cdfd02e2fbf8b31c13e5f8fa188e7edffcd57fbc581873`,
and disposition steward digest
`0bb00ea1993634956d0bedba776b4eb2b20d32aec9f18b88edeb7e2823143aea`.

## Verification

- Reconciled controller, acquisition, exact claim head, bounded scope, lease,
  and zero-effect authority: passed.
- Workspace typecheck and lint: passed.
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
customer/child record, secret, message, deployment, or canary was accessed or
attempted. The brand checker continues to report only the pre-existing raw
color in `scripts/ops/validate-ot-launch-governance.ts`, outside P10 scope.
