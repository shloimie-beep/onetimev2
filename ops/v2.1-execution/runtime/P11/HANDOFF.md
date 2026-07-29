# P11 Residual-Corrected Final Handoff

## Identity

- Branch: `codex/v21-p11-admin-operations`
- Rejected predecessor:
  `81486a86a85a3d6ffee64eb58c66119686af049e`
- Residual atomic claim:
  `ce87a6c2808216214870d4b2343c82c0a36aaf36`
- Residual-corrected implementation:
  `f27f16a77fde21d283d594a7987ccd600bc1b367`
- Containing authorization:
  `d12899a74e9f3b9e0fc47bbf836784cbc8c05180`
- Authorization acquisition parent:
  `f8154c67106ab032873fd923efa9979465f11fff`
- Reconciled control:
  `fff9a0a79f2db87ffca97451f8295080b9736549`
- Reconciliation acquisition parent:
  `ca8eb4ab9957b6616664cfd5e944a73608596020`
- READY digest:
  `6f30eeea172d702e606c181329dc3b6e899a58ec0016ec2d6b84da7b0f5e9822`
- Claim: `6efc5db3-43b4-4dad-ae3f-59031adddbd5`
- ADMIN_OPERATIONS_UI lease:
  `84e7a42a-d2a5-4c88-ba45-57b34ecc6de9`
- Lease released: `2026-07-29T09:28:50Z`, before its
  `2026-07-29T10:09:26Z` expiry.
- Final metadata head: derive with `git rev-parse HEAD`; C00 records the exact
  observed remote head.

## Three residual corrections

Provider readiness no longer stamps the requested runtime tier or verification
environment onto coarse source-environment rows. The repository reads
`runtime_tier` and `verification_environment_id` from the persisted row itself,
filters both values exactly in SQL, and parses the stored values into the
response. Coarse rows without exact provenance remain unavailable. A direct
negative test proves `provider_sandbox` cannot satisfy `persistent_staging`
even though both have coarse `staging` source environment.

All authorization invalidation paths now use one clearing helper. Sign-out,
role revocation, credential-version change, stale resolver outcome, and
bfcache restore clear query text, result page, last request/cursor state,
selection index, loading/error state, and recent queries.

Grouped search results now live inside exactly one
`id="admin-search-results"` listbox controlled by the combobox. Entity groups
are ARIA groups with presentation list structure and unique option IDs. A
multi-group render test proves exactly one ID, one listbox, one controls target,
and a valid active descendant.

## Necessary structured request update

P11-registration-001 now records the necessary steward-owned persistence duty:
provider readiness rows must store exact `runtime_tier` and
`verification_environment_id`. Existing coarse rows remain filtered out until
that immutable persistence update exists. The request was not applied.

## Exact digests

- Implementation artifact digest:
  `497dcc8690ee8dec109f6c48d5216cb3ea074089881bbc48fc57fa54e816776f`
  over 13 exact implementation/test Git blobs.
- P11-registration-001 payload digest:
  `68a99cc059304f66570f2296a5872bfa379062ae854401c54c196ec12b56fa42`.
- Steward-request aggregate digest:
  `2327a180d429e131be3de3d65ada907ed964031496aa49b7eb2524bd797a7f8e`.

## Verification

- Four focused files and 14 positive/negative tests passed.
- Workspace typecheck passed.
- Focused ESLint and Prettier passed.
- Exact residual scope and diff hygiene passed.
- Secret scan passed across 2875 repository text files.
- Artifact and request digests reproduced from immutable Git blobs.

## Review and stop

I36 must review and integrate exact implementation
`f27f16a77fde21d283d594a7987ccd600bc1b367`, reproduce the digests, and
disposition P11-registration-001 without allowing rows lacking exact persisted
provider provenance, retained private query text, or duplicate/invalid
combobox-listbox relationships.

All earlier P11 authorization, canonical-route, no-store/private-query,
redaction, time-window, cache, keyboard, timezone, real-data, and honest
available/unavailable invariants remain in force.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.
