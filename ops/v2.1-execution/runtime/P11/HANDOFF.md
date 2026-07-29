# P11 Superseding Retained-Credential Binding Final Handoff

## Identity

- Branch: `codex/v21-p11-admin-operations`
- Rejected final:
  `17538da1ff15066c3e242567970062db4589577b`
- Atomic claim:
  `bd40e5f0547eb9ad629c47fb4ab294982765978f`
- Superseding implementation:
  `89064e8319813ff37879413cbc7a9692bc063f52`
- Containing authorization:
  `54df8a79e1d2beb0e2ea7289dcbd13617ed90197`
- Sole acquisition parent:
  `930b5ab55c1f7e40b1143a757417bee1ca9ae49e`
- Reconciled control:
  `320cb1c53dee8d4e0b6300fa832060fc2ac37349`
- Reconciliation parent:
  `024e8860153b53ca44740bc7e8e7a063291687c0`
- READY digest:
  `daa56dabb6b8f3d28f7a4d23ce252143d51f8b8b08fbad35802ac9fedef34dcb`
- Claim: `95a4b423-1906-4b24-846b-c4f9d3c1c32a`
- Writer: `codex-p11-worker-95a4b423`
- ADMIN_OPERATIONS_UI lease:
  `c9c69acd-9df5-4411-9cbd-887f33f237f1`
- Lease released: `2026-07-29T11:09:17Z`, before its
  `2026-07-29T11:44:39Z` expiry.

## Superseding correction

Every retained private Admin search result page, initial or last request, and
recent-query snapshot now carries the exact Admin credential version that
produced it. The component accepts retained inputs only when every supplied
snapshot matches the current exact Admin credential version.

Private query, loading/error, request, result, selection, pagination, and
recent-query state fail closed synchronously before initialization or render
when authorization is not Admin, any retained snapshot is absent from the
current credential version, or the Admin credential rotates while the state
remains Admin. The existing invalidation path then clears private state and
drops in-flight completions.

The correction is limited to the shared private-completion helper, Admin global
search component, and its focused test. All earlier revoked-render,
generation/authorization completion guards, server-resolved navigation,
injective IDs, Bearer filtering, provider provenance, 24-hour window,
Asia/Jerusalem labels, privacy, and accessibility behavior remains covered.

## Exact digests

- Implementation artifact digest:
  `d9c91d976d336a8283ddffd2a761d3720454893f75dd4292c14b82c6b1bf4419`
  over 14 exact implementation/test Git blobs.
- Unchanged P11-registration-001 payload digest:
  `68a99cc059304f66570f2296a5872bfa379062ae854401c54c196ec12b56fa42`.
- Unchanged request aggregate:
  `2327a180d429e131be3de3d65ada907ed964031496aa49b7eb2524bd797a7f8e`.

## Verification

- Four focused files and 21 direct positive/negative tests passed.
- Workspace typecheck passed.
- Focused ESLint and Prettier passed.
- Exact three-path implementation/test scope and diff hygiene passed.
- The structured request remained byte-for-byte unchanged and unapplied.
- Artifact and request digests reproduced from immutable implementation blobs.

## Independent review

C00/I36 must independently re-audit exact implementation
`89064e8319813ff37879413cbc7a9692bc063f52`, reproduce the digests, and verify
the rotated-Admin first-render, same-state credential-version invalidation, and
mixed retained-snapshot fail-closed proofs while preserving every prior P11
boundary.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.
