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
