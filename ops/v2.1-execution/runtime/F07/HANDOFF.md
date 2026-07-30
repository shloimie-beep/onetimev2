# F07 Handoff

## Identity

- Branch: `codex/v21-f07-design-system-shells`
- Start SHA: `80c281b7ae5826ed2c6abe95ba68a033ffa52174`
- Implementation SHA before this handoff metadata commit: `80c281b7ae5826ed2c6abe95ba68a033ffa52174`
- Current handoff commit: derive with `git rev-parse HEAD` after checkout; C00 records the observed remote head in `TASK-REGISTRY.yaml`.
- Task packet digest: `49f22b90f9dad8292f306513e6b1f009d3dfa489091efdc83672109018fa943b`
- Context digest: `db8e35e981fa83a06a032d425761e4cf96d5ba287f271bc922472a2b9fef6408`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim: `fde01134-98bf-440f-9f0b-194e8f3712ca`, held by `codex-f07-worker-fde01134`.
- Lease expiry: `2026-07-28T16:56:52Z`
- Containing control head: `af76c4e990f954794de72db639576b3c9dc73ff4`
- Ready payload digest: `d4e47e74d85994342c752c1d89287009ac48a8888cc9882781d89683cc93ce1f`

## Completed behavior

Created the isolated F07 branch from the exact F01-integrated authorization SHA and corrected the claim metadata to the exact containing control head. Verified the exact remote repository, control authorization, ready entry, claim, DESIGN_SYSTEM lease, F01 interface checkpoint, and 200 locked files plus source/task/context digests from immutable Git blobs. Added an additive v2.1 contract that publishes canonical tokens, the exact Admin primary navigation, English date formatting, explained-disabled-control behavior, accessible role shell/navigation/state patterns, and a calendar agenda equivalent. Scoped responsive/reduced-motion CSS is available under the F07-owned v2.1 style root.

The interface contract is stable at implementation head `a90baae8cf69d6823af6d741161fe0e9e7441321`; `INTERFACE-CHECKPOINT.yaml` records exact symbols, artifact hashes, and combined digest `366a1b30f724afc35e525f3f3175a4c84a45b7c13681cea1a17060bee75e4188` (SHA-256 of sorted `path=artifact-sha256` export lines). Every artifact digest was computed from immutable Git blob bytes. I36 must merge the checkpoint before C00 authorizes the listed downstream tasks.

## Remaining work

C00/I36 must validate and merge the published interface checkpoint before authorizing downstream consumers. Any future worker needs a C00-issued resume lease and should address review/integration feedback only.

## Exact next action

Await C00/I36 interface integration; after a new C00-issued lease, address only review or integration feedback.

## Coverage

- Requirements: all nine assigned requirements are implemented through the shared foundation contract.
- Acceptance cases: all nine assigned cases are implementation-ready; candidate-bound browser evidence is intentionally deferred to the allowed verification lanes.

## Changed files and migrations

Added the versioned F07 package exports and scoped v2.1 style contract plus F07 runtime persistence. No migration was created, deleted, or edited; central composition was not changed.

## Verification

- Repository identity, fetched control head, registry/queue identity, F01 dependency, absent F07 remote branch, claim, and lease: passed.
- Immutable Git-blob verification: 200/200 locked files passed; source/task/context digests matched.
- `npm run typecheck`: passed after `npm ci` in the isolated clone.
- `npx vitest run packages/brand-system/src/v21.contract.test.tsx`: passed (3 tests).
- Focused F07 CSS governance smoke passed; `npm run brand:check` now reports only the pre-existing out-of-scope raw color in `scripts/ops/validate-ot-launch-governance.ts`.

## Final task status

`ready_for_review`. Interface metadata head: `47a2bb6b76225951e0599683499a95f4dc9881be`; implementation head: `a90baae8cf69d6823af6d741161fe0e9e7441321`.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security, privacy, and data handling

No provider call, live effect, secret, customer data, child data, private question, or bearer URL was read or recorded.

## Blockers, deviations, and recovery

None.
