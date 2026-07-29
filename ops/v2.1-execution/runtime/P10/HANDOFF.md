# P10 Corrected Handoff

## Identity

- Branch: `codex/v21-p10-admin-directory`
- Authorized start: `49431959f58f284bdc13ca931acf09f980fc483a`
- Correction claim checkpoint:
  `0b34fdf6b43cc3cdd7b003234a89f119b7e4a5c7`
- Corrected implementation head:
  `bedada77101d6cb161969a046552726049663abe`
- Reconciled continuation controller:
  `f84e9d3da1e131cab0714bd24441b08133b7c1a6`
- Continuation controller sole parent:
  `34d3cea8cf05d2de7b2d9c74eb0fc04f61274df4`
- Containing correction controller:
  `b0aeb1d1ba9ed25b27b7b519b9f06ba6bbbe7dfc`
- Correction ready parent/acquisition:
  `c743420931244135bcd61578ea1f322851b325a8`
- Correction ready-entry digest:
  `526ce8d0d61a88d2def1cf58d9d8d8e8375e03760e7c00db3dec5fab70168467`
- Claim mode: `resume_existing_branch`
- Correction claim: `0f061200-ff84-449d-aaa7-b0ebd7cd9c02`
- Writer: `codex-p10-worker-0f061200`
- ADMIN_DIRECTORY lease:
  `c3ee876e-793d-4c19-9a4c-40de4f27e758`
- Lease issued: `2026-07-29T01:39:10Z`
- Lease expiry: `2026-07-29T02:39:10Z`
- Lease released task-locally: `2026-07-29T02:06:44Z`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the observed remote head
- Task packet digest: `fe7abc1af5110c1007c34927fe9909bc3643998dd10615c195046f30423f7e28`
- Context digest: `a27b3c710d277153d8273f82d5d8e745d620fdd5ecacc619f6f7b9a5772bab17`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Implementation artifact digest: `8750cace376894caaa28f0a9d98566ac5744faf606af071bf5d651dbba3d31d4`
- Steward-request digest: `a4306c04f912e446472ab2e6c2cbe18dc3a7e733c3cb13eed6ec20188683a934`

## Corrected behavior

Fetched the exact control and task refs. Verified that controller
`b0aeb1d1ba9ed25b27b7b519b9f06ba6bbbe7dfc` has sole parent
`c743420931244135bcd61578ea1f322851b325a8`, independently recomputed the
canonical P10 ready payload digest, and matched the exact existing remote head,
claim, active writer lease, and empty effect-lock list.

This checkpoint changes only:

- `ops/v2.1-execution/runtime/P10/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/P10/HANDOFF.md`
- `ops/v2.1-execution/runtime/P10/NEXT-PROMPT.md`

The corrected contract accepts only the exact current F03
`argon2id-v1$v=19$...` structure through F03 policy validation. Credential,
Student, adult, and household security changes use one exhaustive
`revokeAllActiveAccess` transaction operation with complete session,
enrollment, classroom, and playback readback; callers cannot submit a subset.

Student create/restore locks household access and capacity, aggregate versions,
global normalized username, and current exact service-account acceptance, then
commits profile, credential, canonical enrollment, evidence, audit, and receipt
atomically. Adult/household rules deny disabled-account reactivation,
final-active-Admin archive, owner archive, invalid owner restoration, and
uncontracted seat changes. Family capacity is exactly three.

The client now provides URL-backed search, kind/status filters, archived
visibility, sorting, pagination, and safe empty/error states. Lifecycle,
ownership transfer, and Student credential reset first show explicit
consequences and require confirmation. Existing passwords are never displayed.

## Remaining work

I36 must independently review/integrate the corrected implementation and
disposition the refreshed migration/registration requests. Candidate-bound
persistent-staging and production-operator-canary proof remains assigned to the
verification/release lanes.

## Exact next action

Review/integrate `bedada77101d6cb161969a046552726049663abe`, independently
recompute `8750cace376894caaa28f0a9d98566ac5744faf606af071bf5d651dbba3d31d4`,
and disposition steward digest
`a4306c04f912e446472ab2e6c2cbe18dc3a7e733c3cb13eed6ec20188683a934`.

## Coverage

All eight P10 requirements and exact acceptance cases are implementation-ready.
The focused suite maps one positive test to each exact case and adds role,
scope, stale-version, request-hash, replay, credential-secrecy, accessibility,
and fresh-service persistence denial/proof assertions.

## Verification

- Reconciled C00 continuation, exact claim head, dependency bindings, and active lease: passed.
- Full workspace typecheck: passed.
- Full workspace lint: passed.
- Focused corrected domain/server/client suite: 18/18 passed.
- Focused Prettier and diff hygiene: passed.
- Repository-wide secret scan: passed across 2719 text files.
- Exact implementation/steward Git-blob digest derivation: passed.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security, privacy, and data handling

No live provider call, account mutation, credential reset, ownership transfer,
customer/child record, secret, message, deployment, or canary was accessed or
attempted. The implementation contains no provider adapter or fake fallback.

The brand checker still reports a pre-existing raw-color finding in
`scripts/ops/validate-ot-launch-governance.ts`; P10 did not change that file or
introduce raw color.
