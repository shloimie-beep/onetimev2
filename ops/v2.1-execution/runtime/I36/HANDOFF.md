# I36 P08 v2 Interface Merge and Release

## Identity

- Branch: `codex/v21-integration`
- Reconciled claim target:
  `931b6fe7b160a1b77e316b2212ad46f02d5698fc`
- P08 merge result:
  `c389287c20e4813106cc9af67f01fd2a91a48f3b`
- Exact merge parents:
  `931b6fe7b160a1b77e316b2212ad46f02d5698fc` and
  `e15a7af6cde557ff7f0fbbd55c12244780ca2321`
- Containing merge authorization:
  `3cdb7851dc5009c99ab732f27b8add82d423117b`
- Sole authorization parent / acquisition:
  `4d4ae9e7a047aa14cb04e95c0b9e0fd9e431565a`
- Claim: `2b9e5c96-4e10-45a9-9f59-aa2d7110cdd3`
- RELEASE_INTEGRATOR lease:
  `1975bc3e-446f-473a-9872-92dd927fdc48`
- Lease issued: `2026-07-29T02:32:11Z`
- Lease released: `2026-07-29T02:52:51Z`
- P08 merge id: `6fc2b7ae-b59a-4344-9399-669a5d79212b`
- Rebound canonical merge digest:
  `683cb0421dd30d87b36f2c36aa857088bd6b9c661714459cde7fff7cd29c64cf`
- P08 source:
  `e15a7af6cde557ff7f0fbbd55c12244780ca2321`
- Required source and merge base:
  `49431959f58f284bdc13ca931acf09f980fc483a`
- External effects: attempted 0; succeeded 0; reconciled 0

## Result

I36 admitted exactly the queued fifteen-path P08 delta and created the required
two-parent merge. The P08 source is an ancestor of the merge result, and its
first-parent delta is exactly the authorized path list.

Verification passed:

- focused P08 contract, domain, server, and client suites: 4 files, 17 tests;
- workspace TypeScript typecheck;
- committed-blob Prettier verification for all fifteen source paths;
- Git diff hygiene, exact parent order, source ancestry, and path scope.

No P08 or P10 steward request was applied. No P10 source was integrated. No
product or shared path changed beyond the exact P08 merge, and no provider or
external effect was attempted.

This release checkpoint changes only `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md` under the I36 runtime directory. Its exact final head is
reported after commit and remote readback.

## Exact next action

Push and report the merge head, metadata-only release head, exact parents,
tests, scope, and remote readback. Then stop for C00 reconciliation.
