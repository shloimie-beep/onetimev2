MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

P21 is stopped at a runtime-triplet-only composite-projection correction claim
on branch `codex/v21-p21-content-publication`.

The atomic claim must be the sole child of adopted integration release
`99fd8c33ea023e838d8ee9c993b5de52f4763e7f`, which contains exact prior P21
`cecdad0989e861254987970cfa3d222319369f52` and integrated corrected P20
`75137bf476b4a1773f29bb41a6a149148df2623d`.

Authorization is bound to:

- containing control:
  `3757ee49b83027d69208f25b0f709d309d5c6c1a`
- READY state basis:
  `f295f2f55d9fda6208ef1c8dfb9c97ea2ca475a0`
- canonical control-state digest:
  `7dfb873efe7246f60aa267e2b0c92858bc72edff5a2d2aab742b4e34b7449ade`
- READY:
  `ede4095b8ab517b3fe734208e14dfef82527f0f52a2b21409361acf4e0ef724b`
- claim:
  `9e38d9dd-8293-451d-9335-ddb466e7234e`
- `CONTENT_PUBLICATION` lease:
  `afe1ac21-bafb-475b-967a-28bdb9bcda66`, expiring
  `2026-07-30T10:46:00Z`

This first push changes only the P21 `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`. C00 must:

1. verify the pushed head has sole parent `99fd8c33`;
2. verify the delta is exactly the P21 runtime triplet;
3. recompute the state/handoff and runtime-triplet digests;
4. verify exact READY, claim, lease, task/context/package/request/path bindings,
   preserved non-runtime bytes, and effects `0/0/0`; and
5. reconcile the claim before authorizing any source, test, or successor-request
   change.

After reconciliation, follow only the exact canonical READY directives and
14-path inventory
`92698702ddafb76e5ea660ae0ce7fa1314b02dba86b5fe35be839b76003f5c61`.
Consume P20 `ApprovedForPublicationProjection` through server-derived composite
scope, preserve immutable mixed `P21-registration-001` byte-identically as
superseded/withheld, and publish exactly `P21-MIGRATION-002` and
`P21-registration-002`.

Do not create either successor before reconciliation. Do not edit P20, allocate
a migration ordinal, write or apply SQL, apply registration, inspect or mutate
a provider, deploy, send, or perform any external effect.
