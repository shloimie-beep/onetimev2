# P11 Superseding Authorization/Race/Identity/Secret Final Handoff

## Identity

- Branch: `codex/v21-p11-admin-operations`
- Rejected final:
  `899ef6a7fad4f0946378721a0af7d7ed66c25c81`
- Atomic claim:
  `77c168d0a4a27b81ba1f7cddaa8d31821a8654f6`
- Superseding implementation:
  `17924328cdc820e3cc9a8928f0685b868df4df74`
- Containing authorization:
  `46a7bfeb51401d2b1df03f0eb58fa800751ba1e1`
- Sole acquisition parent:
  `6cd1efc5fdba8c2c6369ce15877eb3f008149f2b`
- Reconciled control:
  `dcb7fba1231d635af45a8a346f134559f2de08e9`
- Reconciliation parent:
  `637d1c389977da17a8c1ae52aa7862ff4aff9f0d`
- READY digest:
  `aeea25ddac610fb96f090609a9c17e3b67400aeff8209772b0b99e3efa85c456`
- Claim: `d76c097a-d2df-4e8c-ae99-659deba00c64`
- Writer: `codex-p11-worker-d76c097a`
- ADMIN_OPERATIONS_UI lease:
  `84cd0230-d35a-4149-845c-9cd4bcfb6ff5`
- Lease released: `2026-07-29T10:28:04Z`, before its
  `2026-07-29T10:40:29Z` expiry.

## Superseding corrections

Dashboard and search now fail closed synchronously on the first non-Admin
render. Retained snapshots, results, recent queries, request state, and
caller-provided private messages are not rendered while signed out or revoked.

Every in-flight search, search-result resolver, and occurrence resolver captures
a monotonic generation and exact Admin credential version. A completion may
update state or navigate only while that generation, credential, and current
Admin authorization still match.

Search option IDs now encode every target code point at fixed width. The
encoding is deterministic, injective, and DOM-safe, so dotted and colon target
IDs cannot collapse to the same option and `aria-activedescendant` remains
unique.

Protected-value validation now rejects whitespace-separated Bearer credentials
as well as the existing colon/equal forms.

## Exact digests

- Implementation artifact digest:
  `3529decc4b00ab8991bb151a49914676104ae00bb39a0711f2c8596019352986`
  over 14 exact implementation/test Git blobs.
- Unchanged P11-registration-001 payload digest:
  `68a99cc059304f66570f2296a5872bfa379062ae854401c54c196ec12b56fa42`.
- Unchanged request aggregate:
  `2327a180d429e131be3de3d65ada907ed964031496aa49b7eb2524bd797a7f8e`.

## Verification

- Four focused files and 18 direct positive/negative tests passed.
- Workspace typecheck passed.
- Focused ESLint and Prettier passed.
- Exact seven-path scope and diff hygiene passed.
- The structured request remained byte-for-byte unchanged.
- Artifact and request digests reproduced from immutable implementation blobs.

## Independent review

C00/I36 must independently re-audit exact implementation
`17924328cdc820e3cc9a8928f0685b868df4df74`, reproduce the digests, and verify
the new revoked-first-render, stale-promise, dotted-versus-colon ID, active
descendant, and Bearer-space proofs while preserving all earlier P11 behavior.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.
