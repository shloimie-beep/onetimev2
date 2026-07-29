# P21 Atomic Claim Handoff

## Identity

- Branch: `codex/v21-p21-content-publication`
- Authorized start: `088b40476bd5ceeb0af901b6f78a4cb8c556671b`
- Implementation SHA before this metadata commit:
  `088b40476bd5ceeb0af901b6f78a4cb8c556671b`
- Containing authorization:
  `4c029e8d6e4ea3a2a4e4942affb61a39e5508129`
- Sole acquisition parent:
  `d99fde51092abdee97f42f28e8bdee8a08c5e22c`
- READY digest:
  `d2b127c6cb94a4428a39f1789f153a625b6b3153b0e4104778aa7f51c98cebe2`
- Claim: `3a93eeca-5035-4328-b685-e580f2b32ce6`
- Writer: `codex-p21-worker-3a93eeca`
- `CONTENT_PUBLICATION` lease:
  `31423c6c-74ef-43cc-b3a8-75b425568619`
- Lease issued: `2026-07-29T10:23:53Z`
- Lease expiry: `2026-07-29T11:23:53Z`
- Phase scope: `P21_atomic_claim_only`
- Task packet:
  `c04b2cf1b742e4200fe2c38790bcfa99fb9470420c5a83b9998db4d0173ef550`
- Context:
  `36e4fb76ff399ae66d3ccd9f4e5851ec31395c247d80a3d7f4392bb8ad30858e`
- Prompt:
  `81b77db37a7ecd71e39c86b6cb700acafac66c05aec0a6c16b6f03a4d1b415df`
- Package lock:
  `3d13585587ab64d063c09dd8ef37b2ffe1c40034d3f8dddf93299092a0ea8e4a`
- Source package:
  `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`

## Dependency bindings

| Task | Task head                                  | Integration proof                          | Interface source                           | Implementation                             | Checkpoint digest                                                  |
| ---- | ------------------------------------------ | ------------------------------------------ | ------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------ |
| F05  | `9174d845e1c04916e2f1884cfadfaef624ac6862` | `9782a4164662b8059a557c0969de9c35f54d0cf7` | `0656380bcfc50cc464dcea7588448dc724049599` | `1ade14c52e42e59bb8fd1d1de776b91406c45f15` | `fd17c478bfc851dcb434b8e0c2750701605b80dfdf880833a6a2993e8fad6329` |
| F06  | `ce061ca5b208cfb2a41e0c2f439a7a4b91e8ca57` | `d35166838267711a514cf73822cd2ca49a3f3ded` | `9a426ccaa294ca1f54ece20ea2a37c7ef9de1ef7` | `94281de13063203808ecabef8a818762e5ff1e2e` | `7d0e2e360036fa6e3b742053c714b13f442e29c9ff3e83ad7b6bf02c005694a0` |
| P14  | `3393169e2284d65ff0a970d797aa1f83ebf9d895` | `d35166838267711a514cf73822cd2ca49a3f3ded` | `3393169e2284d65ff0a970d797aa1f83ebf9d895` | `9c08e9c6735a61e201f7b05116a3406e6092e08b` | `1a9b86f0d39cc0e3999973fc988d9c2d00c302ccad13a50857c14c7d5e2f03e1` |

Each dependency’s interface source, implementation, and integration-proof
commit is an ancestor of the authorized start.

## Completed behavior

No product behavior was implemented. This checkpoint only consumes the
pre-issued atomic claim and records durable task identity.

## Remaining work

C00 must first reconcile the immutable remote claim. Only a later exact
reconciled authorization may permit P21 implementation and focused tests.

## Exact next action

Push and remote-verify the sole atomic claim commit, report its exact head to
C00, and stop.

## Coverage

- Requirements: all eight `not_started`
- Acceptance cases: all nine `not_started`

## Changed files and migrations

Exactly:

- `ops/v2.1-execution/runtime/P21/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/P21/HANDOFF.md`
- `ops/v2.1-execution/runtime/P21/NEXT-PROMPT.md`

Migrations: none. Steward requests: none.

## Verification

- Exact control, acquisition parent, registry, READY payload, canonical digest,
  claim, lease, branch absence, and zero effect locks: passed.
- Locked package/source/task/context/prompt hashes: passed.
- Exact F05/F06/P14 dependency bindings and ancestry: passed.
- Isolated branch base equals the authorized start: passed.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security, privacy, and data handling

No provider was inspected or mutated. No product or test file was read or
edited beyond the locked control/task/context/dependency records required for
the claim. No credential, private provider URL, child data, or external payload
was handled.

## Blockers, deviations, and recovery

C00 reconciliation of the exact pushed claim head is required before any P21
product, test, structured-request, steward, provider, or effect work.
