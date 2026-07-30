# I36 Integration Releases

## Identity

- Branch: `codex/v21-integration`
- Reconciled claim target:
  `d53c1d22dfa84806b07c51e599997c7ebc053849`
- Containing authorizing control:
  `7bce3ea3a8976f2a4eb8dd713c4bfc96bcd3939a`
- Sole acquisition parent:
  `e25d0b521ada437c6e19236bfb7aaf59f0579889`
- READY state: consumed when C00 reconciled exact claim head `d53c1d22`.
- Claim: `d2ba6c12-e7c2-49b1-b4cd-883a1c394adb`
- RELEASE_INTEGRATOR lease: `6c88e2a7-e2fc-48be-acae-4b4a5e9839ad`
- Lease window: `2026-07-30T01:54:35Z` through
  `2026-07-30T03:54:35Z`
- Lease released: `2026-07-30T03:04:04Z`
- Phase scope: `P16_P32_F02_compatibility_integration`
- Release head: derive with `git rev-parse HEAD`; C00 independently audits the
  exact pushed head, ordered merge ancestry, and I36 triplet digests.

## Ordered merge results

1. P16 source `55544f557f5b7aee01d264fba688fc56b971ad4b`
   merged at `44100afb13c58506a18b0612ebce07113caff47e` from claim target
   `d53c1d22` with exact five-path first-parent scope. Final rebound payload:
   `58695dcb553d55502ba509ea54783b5e78d1edd9094ea9333f6467eca9a7fcf2`.
2. P32 source `92a7ee6377d9507140def1159a440fbfd1733123`
   merged at `f53a0592438df77f3d34d0e7b67e90d9924dbcdf` from P16 merge
   `44100afb` with exact thirteen-path first-parent scope. Final rebound payload:
   `18378a2ea0fae5b91640def9946c8ccf2e54f11c1d879ecbab55fbcf27af5836`.
3. F02 source `cd2d7c2fe3bfeb250c320bc02c9bfebb3bd04911`
   merged at `1b83575ab6fcba9be7b7f16e6ef44001f07d5623` from P32 merge
   `f53a0592` with exact ten-path first-parent scope. Final rebound payload:
   `e85b0073845c7bd7489d8596e5b68ddfe5792a0653ab376bdd69c7fdfa701195`.

Every source is an ancestor of the final integration result. The P15, P16,
P32, integrated-base, and F02 Lease A merge-after dependencies passed.

## Verification

The corrected remote control, acquisition parent, reconciled claim target,
consumed READY state, unchanged claim and lease, final rebound queue payloads,
source manifests, merge-after identities, and zero effects matched exactly.

Focused P16/P32 compatibility tests passed 36/36. Disposable native PGlite
PostgreSQL and repository-runner pg-mem applied and verified the full 75/75
migration inventory through 2244; all six native/pg-mem checksum pairs and
compatibility table probes passed with zero pending migrations.

Workspace typecheck, full ESLint, raw Git-byte focused Prettier, diff hygiene,
YAML, the 200/200 locked and 15/15 source-package Git-byte manifests, package
structure/coverage counts, and the repository secret scan passed.

No steward request or central allocation/registration was applied. No provider
was inspected or mutated; no deployment, send, migration apply against an
external database, or external effect occurred.

## Next action

C00 must independently audit the exact pushed metadata release head, its sole
parent `1b83575a`, the ordered three-merge ancestry, exact 31-path release delta,
released lease, I36 triplet digests, and effects `0/0/0`. I36 must stop.

## Effects

Authority none; attempted/succeeded/reconciled `0/0/0`.

## P29/P30 final source integration

Containing control `fe95eacb2a958ba043cc9f89c1c27e09e20b9324`
with sole acquisition/state-basis parent
`d2f7c554d2e3aa55c0621882b3591fb18a7c8818` consumed READY and reconciled
atomic claim `c698da9826572c486f3ddf14cb01785dd2a120cf`.

The unchanged claim is `4ec8712e-8ed3-4164-8774-c03c67748ec4`.
RELEASE_INTEGRATOR lease `2ed546f8-d65b-4fe3-b86c-042d441e3015`
was released at `2026-07-30T04:02:31Z`, before its
`2026-07-30T05:45:23Z` expiry.

P29 source `aa7b363812676afce8ac9ebd13f335e65551bb1f` merged at
`4f4a11e3ee248af656d8443bbfb676a7de8d237e` from exact claim head
`c698da98` with rebound payload
`d26853a6ae2eeb0b7c15c5730a5ccd83ff6b318b29fcea997d9e622a023e87d3`
and exact fifteen-path first-parent scope.

P30 source `772d4783f82b7eb89a5c98d897601b444cd3c2f4` merged at
`3033f13b06d95f6018113033521131cc4429cff3` from P29 merge
`4f4a11e3` with rebound payload
`e005f5c019ccc58160fb46e273abdb00068ea9f482fe670597707cb2cee76884`
and exact fourteen-path first-parent scope.

Both sources and the P28/P29/P31 merge-after heads are ancestors of the final
result. Focused P29/P30 workflow and worker tests passed 70/70. Workspace
typecheck, full ESLint, raw Git-byte focused Prettier, YAML parsing, repository
secret scan, diff hygiene, exact 29-path combined scope, ancestry, source
digests, and zero-effects checks passed.

All steward requests remain committed evidence only and unapplied. No central
registry/config/copy state was changed, no provider was inspected or mutated,
and no deployment, send, or external effect occurred.

C00 must independently audit the pushed metadata release head, its sole parent
`3033f13b`, ordered merge ancestry/scopes, released lease, I36 triplet digests,
and effects `0/0/0`. I36 must stop.

## F02/P28/P31 direct-prerequisite atomic claim

Containing control `ee21ee69cae87a77c4ee5519b61490fa2e453c3f`
with sole acquisition/state-basis parent
`07a1fa98b39a6b7d8eec8aec0ff9c60df4a25190` authorizes an atomic
runtime-triplet-only claim from exact release
`42068ace48fe1a93302ce7d5533e11803b526d5b`.

READY payload
`b60c929884c5bd974b66c1f02fe56d23fd50cceee35e929b5138a2d3c912bda1`
was recomputed exactly. Claim `ff36a180-ce16-4787-841b-5e10a7aabfec`
is held by `codex-i36-release-integrator-ff36a180` under sole
RELEASE_INTEGRATOR lease `0430520f-6a94-4550-a1ea-f01f8d5173b2`
through `2026-07-30T06:35:30Z`.

The exact queued order and source bindings are:

1. F02 `6d16d6eb2c901c58cc4d0c2bb3298b5543af3d9f`, base
   `cd2d7c2fe3bfeb250c320bc02c9bfebb3bd04911`, payload
   `bfb510daf058ad44252e823bf6313a366b4fa949499e2cb5cd2582b31d0ad9e8`.
2. P28 `a2025a768ae6e69a15ec5605379a9e359cf2deec`, base
   `f891f16eb13593d0eb3bbe53c076513d12b07c23`, payload
   `f3e7df0d4f6ec528688aff5e252faddb7b5000841552ebb5e3d3847ab5ef7324`.
3. P31 `d72dda5669627695edaf9dbf20f7650c9b5c9ded`, base
   `ba811b3b2682ab46de1859334f5aa4ad5d7f5f0d`, payload
   `f9922704c6683b09949f121955ca19d4c6c707622cdba4b14a37de2cd6f7b8d9`.

This checkpoint changes only the I36 TASK-STATE/HANDOFF/NEXT-PROMPT triplet.
No source was merged, no steward or central state was applied, no provider was
inspected or mutated, and no deployment, send, or external effect occurred.
Effects remain `0/0/0`.

C00 must independently audit this exact atomic claim and reconcile/consume
READY with queue targets rebound to the pushed claim head before I36 may merge
any source. I36 must stop.

## F02/P28/P31 direct-prerequisite source integration

Reconciled containing control
`2718c23f19cc3f76f161a5e4f2562f9d7265f68e` with sole
authorization/state-basis parent
`ee21ee69cae87a77c4ee5519b61490fa2e453c3f` consumed READY for exact atomic
claim `1b8335f8bdad4bc4ac1aa65838314faa7d65ebd0` and rebound all three queue
targets to that claim.

The unchanged claim is `ff36a180-ce16-4787-841b-5e10a7aabfec`.
RELEASE_INTEGRATOR lease `0430520f-6a94-4550-a1ea-f01f8d5173b2`
was released at `2026-07-30T05:43:58Z`, before its
`2026-07-30T06:35:30Z` expiry.

The ordered source merges are:

1. F02 source `6d16d6eb2c901c58cc4d0c2bb3298b5543af3d9f`
   merged at `acde075ecf50e77e57fb3bda82a18509d42345ad` from exact
   claim `1b8335f8` with rebound payload
   `54cf0dc63a9ec3df6181224f82104e3c5f7163537cd970704b28abfc6640a597`
   and exact nine-path first-parent scope.
2. P28 source `a2025a768ae6e69a15ec5605379a9e359cf2deec`
   merged at `cb7a700e24e67b306d0ecbaf96a7b49351b6fcd9` from F02
   merge `acde075e` with rebound payload
   `55ca02a580f22d764be7fe62dd4e5455a811d423bbbbac4d75b008117c5505ad`
   and exact twelve-path first-parent scope.
3. P31 source `d72dda5669627695edaf9dbf20f7650c9b5c9ded`
   merged at `5b479ac0b682889ecc3bcf1b3f33aebcbd605d8f` from P28
   merge `cb7a700e` with rebound payload
   `066ea448b424ada56611b6abdea4a56b49146707a34e0149199a0baca4509626`
   and exact eight-path first-parent scope.

Every source and declared prerequisite is an ancestor of the final integration
result. The exact combined source delta is 29 paths.

Focused F02/P28/P31 tests passed 68/68. Workspace typecheck, scoped Prettier,
YAML parsing, repository secret scan, diff hygiene, source manifests, ordered
ancestry/scopes, all five native/pg-mem migration checksum pairs, and a full
80/80 repository-runner migration apply/verify passed.

Full ESLint reports one exact admitted P31 source finding:
`tests/unit/communications/copy-catalog.test.ts:143` assigns
`_removedNamedApproval` without using it. I36 preserved the exact authorized
P31 bytes; C00 will route a separate task-owned lint-only correction.

No steward request or central registry/config/copy state was applied. No
provider was inspected or mutated, and no deployment, send, or external effect
occurred. Effects remain `0/0/0`.

C00 must independently audit the pushed metadata release head, its sole parent
`5b479ac0`, ordered merge ancestry/scopes, released lease, I36 triplet digests,
the recorded P31 lint finding, and effects `0/0/0`. I36 must stop.

## P31/P20/P17 correction-release atomic claim

Containing control `d4b22e69de04a364e9cd6e7732fbd02b2fb3c2ef` with sole
state-basis parent `a38b917f514b65c49d2d75789b8ae50d96985cdc` authorizes an
atomic runtime-triplet-only claim from exact I36 release
`3cf787409decb5beb84561ef7e37924111d398b6`.

READY payload
`f04fd32379e14f45a60988328b95ad07095463648519f4d8ae642b52542a8dce`
was independently recomputed exactly. Claim
`b3e05cde-c76b-4b54-8a63-9a32624f6a87` is held by
`codex-i36-release-integrator-b3e05cde` under sole RELEASE_INTEGRATOR lease
`dbef2b0e-c3c6-4ed9-a15f-f8fc0ae02dc7` through
`2026-07-30T09:28:30Z`.

The release-bound I36 state/handoff pair is
`3113baf292636ba9be87a7250f468ce599231cbe61815df18efdaf287f04372e`;
its runtime triplet is
`5c85deb3125732b7074aba7677a7874093983bc8b19c8f4afbe798372baab0d2`.

The exact queued order and source bindings are:

1. P31 `839ec12bb83317a63f1d064891fb2929a707f3ec`, base
   `d72dda5669627695edaf9dbf20f7650c9b5c9ded`, exact four-path source
   manifest `59afcf23b99a3b2fb6320b9b4dd8fa03697f9f0c17e537bb8d449c1342043866`,
   payload
   `bcce534a48f64b851623ca9456a12b2be029292298998491ae16d1835800459f`.
2. P20 `75137bf476b4a1773f29bb41a6a149148df2623d`, base
   `3d75b57e91c12ab3e0cad78b1a6a63497838f46f`, exact eight-path source
   manifest `955f15a7c8f15b9a96931f07ccbaebadc0918b29e928ed10038873174e3990d7`,
   payload
   `b1346d36669d5e921720d9a021ee2f39793fc13a51e9af95df2eb7657d63ccc6`.
3. P17 `7f8a41bc09c81c53a276a32bbb667aeb1f0ee69c`, base
   `78af71603713b6fc73fe755995bdf56193eb199a`, exact fourteen-path source
   manifest `a6fc85d308c15d416f156ce6dda4828257ca25b9af9214f41aa875e40f73fd9e`,
   payload
   `134e70e40b081942f2742f81170497397a37800453c8761221d7a00906e5ceba`.

The three source inventories are pairwise disjoint. This checkpoint changes
only the I36 TASK-STATE/HANDOFF/NEXT-PROMPT triplet. No source was merged, no
steward request or central state was applied, no provider was inspected or
mutated, and no deployment, send, migration execution, or external effect
occurred. Effects remain `0/0/0`.

C00 must independently audit the exact pushed atomic-claim head and its sole
parent, consume READY, and rebind all three expected target heads to the claim
head before I36 may merge any source. I36 must stop.

## P31/P20/P17 correction-release source integration

C00 reconciled exact atomic claim
`1b0df6fa15b2ac4a5febe35fee3f18ca9b9457d7` at containing control
`60d76e2a5feb0f7cfcfd56aeaa5ee9ac58664e19`, whose sole parent is initial
authorizing control `d4b22e69de04a364e9cd6e7732fbd02b2fb3c2ef`.

The exact rebound payloads were independently recomputed before merge:

- P31: `951e354746edcce3df991a046563ca6afa355cf45a5ae5f73fe2f3c2942fd9e4`.
- P20: `a3c16a42f51ccfaf2864e10c955f9fca039c10ea5746975340ea004c42b35072`.
- P17: `1017f826bac75dd0dc23d5aa70f495678f53898381f64f13d32ba3b0ef7ef711`.

The ordered ancestry-preserving merge results are:

1. P31 source `839ec12bb83317a63f1d064891fb2929a707f3ec` merged at
   `e834523855ced654482552a5c5cda16767eb99d2` from atomic claim
   `1b0df6fa` with exact four-path first-parent scope.
2. P20 source `75137bf476b4a1773f29bb41a6a149148df2623d` merged at
   `bb4a13a39cfbe843647793775a8a07285b446d6a` from P31 merge
   `e8345238` with exact eight-path first-parent scope.
3. P17 source `7f8a41bc09c81c53a276a32bbb667aeb1f0ee69c` merged at
   `00ec4f9a4011ab125f1f5c38f3433462398a8da5` from P20 merge
   `bb4a13a3` with exact fourteen-path first-parent scope.

Every source is an ancestor of the final result, and the combined source delta
is exactly 26 pairwise-disjoint paths. The terminal I36 runtime triplet makes
the complete release delta exactly 29 paths.

Verification passed:

- 39 focused assertions across seven P31/P20/P17 files;
- workspace typecheck;
- full ESLint with zero findings;
- normalized-LF raw-Git-blob Prettier across all 26 source paths;
- merged YAML parsing and repository secret scan across 3084 text files;
- exact merge parents, ancestry, first-parent scopes, combined scope, and diff
  hygiene;
- unchanged migration and control-ledger bytes, 80 migrations through maximum
  ordinal 2249, and next ordinal 2250.

`P17-MIGRATION-002` and `P17-SERVER-WORKER-REGISTRATION-002` remain immutable
proposals and unapplied. No central ledger was edited, no provider was
inspected or mutated, and no deployment, send, migration execution, or external
effect occurred.

RELEASE_INTEGRATOR lease `dbef2b0e-c3c6-4ed9-a15f-f8fc0ae02dc7` was released
at `2026-07-30T08:32:46Z`, before its `2026-07-30T09:28:30Z` expiry. Effects
remain attempted `0`, succeeded `0`, reconciled `0`.

C00 must independently audit the exact pushed metadata release head, its sole
parent `00ec4f9a4011ab125f1f5c38f3433462398a8da5`, ordered merge ancestry and
4/8/14 scopes, released lease, I36 pair/triplet, unapplied successor requests,
and effects `0/0/0`. I36 must stop.
