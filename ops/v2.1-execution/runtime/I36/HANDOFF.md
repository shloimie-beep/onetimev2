# I36 F01/F04/F05 Full-Integration Atomic Claim

## Identity

- Branch: `codex/v21-integration`
- Exact existing target:
  `408b21afa4b9ac6f100b3ce33ea87984d18d4bf7`
- Authorizing transaction:
  `f4b48937dc37518e63954ccf985815ba964253a0`
- Sole acquisition parent:
  `2b103162715c18a144cc26c329eed2e09a62b1d4`
- Latest valid observed control:
  `a4fda5d21837c7140083ce70619e301f26db2590`
- READY I36 digest:
  `5103960074b68850afdd64c58960276a278de7b6fc76ed84d1bc81b781202a96`
- Claim: `257056a3-d401-4f0f-bd90-e032d855ee3e`
- RELEASE_INTEGRATOR lease: `32382426-de6d-46c0-afb7-1157ef2f6a2e`
- Lease window: `2026-07-29T13:09:01Z` through
  `2026-07-29T14:24:01Z`
- Phase scope: `F01_F04_F05_full_integration_atomic_claim_only`
- Atomic claim head: derive with `git rev-parse HEAD`; C00 records the observed
  pushed remote head.

## Ordered queue

1. F01 merge `0b0b7015-4320-455c-959e-10e7b3cd8d0a`, source
   `b5344992a43a735a9c66047fecd83f951651de27`, payload
   `2e2a87aaa59df110135dbe20730f49b6ae055bdf69c2e182bca1b214e1341bd7`.
2. F04 merge `53241de3-f38a-4328-b35a-a7c160a17039`, source
   `54a0ac28b51d271aacab60003451dbcc66ffcac8`, payload
   `f34bd7856a4b783a189e59f99096963c5f1afd6cd691637b85ec0e3707fc5d32`.
3. F05 merge `e82068a8-509a-4bd9-8b5e-4bb4f1a7e494`, source
   `9174d845e1c04916e2f1884cfadfaef624ac6862`, payload
   `e38844ec983a49d7bf3b886f5d6d7eb513f2087176141ec380115146d871ecbd`.

## Authority verification

The fetched integration ref exactly matched the authorized target. The latest
valid control ref preserves the READY entry and ordered merge queue first
published by the authorizing transaction. The canonical READY and all three
merge-item payload digests were independently recomputed and matched. The
claim has the sole live `RELEASE_INTEGRATOR` lease and no effect lock.

This checkpoint changes only I36 `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`. No F01, F04, or F05 source was merged. No steward request,
migration, registration, product, provider, send, or external effect was
performed.

## Next action

C00 must reconcile the exact pushed atomic claim head. I36 must stop after
reporting it; the ordered source merges require a subsequent explicit resume.

## Effects

Authority none; attempted/succeeded/reconciled `0/0/0`.
