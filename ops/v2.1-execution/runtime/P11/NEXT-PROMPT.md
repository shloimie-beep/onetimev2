MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: INDEPENDENT_REAUDIT_AND_INTEGRATE

Independently re-audit and integrate the superseding P11 retained-credential
binding correction.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p11-admin-operations
Authoritative control ref: origin/codex/v21-control
Task state: ops/v2.1-execution/runtime/P11/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P11/HANDOFF.md

Rejected final:
`17538da1ff15066c3e242567970062db4589577b`.
Atomic claim:
`bd40e5f0547eb9ad629c47fb4ab294982765978f`.
Superseding implementation:
`89064e8319813ff37879413cbc7a9692bc063f52`.
Containing authorization:
`54df8a79e1d2beb0e2ea7289dcbd13617ed90197`.
Sole acquisition parent:
`930b5ab55c1f7e40b1143a757417bee1ca9ae49e`.
Reconciled control:
`320cb1c53dee8d4e0b6300fa832060fc2ac37349`.
Reconciliation parent:
`024e8860153b53ca44740bc7e8e7a063291687c0`.
READY digest:
`daa56dabb6b8f3d28f7a4d23ce252143d51f8b8b08fbad35802ac9fedef34dcb`.
Claim: `95a4b423-1906-4b24-846b-c4f9d3c1c32a`.
ADMIN_OPERATIONS_UI lease:
`c9c69acd-9df5-4411-9cbd-887f33f237f1`, released
`2026-07-29T11:09:17Z` before expiry.

Reproduce:

- artifact digest
  `d9c91d976d336a8283ddffd2a761d3720454893f75dd4292c14b82c6b1bf4419`;
- unchanged P11-registration-001 digest
  `68a99cc059304f66570f2296a5872bfa379062ae854401c54c196ec12b56fa42`;
- unchanged request aggregate
  `2327a180d429e131be3de3d65ada907ed964031496aa49b7eb2524bd797a7f8e`.

Independently prove that every retained result page, initial/last request, and
recent-query snapshot is bound to the exact producing Admin credential version;
rotated Admin credentials fail closed on SSR/first render; a same-state Admin
credential-version change synchronously hides and clears private state; and one
stale retained binding closes all retained search state.

Preserve every earlier P11 revoked-render, generation and authorization
completion guard, navigation, injective ID, Bearer filtering, provider
provenance, 24-hour window, timezone, privacy, and accessibility boundary. The
structured request is unchanged and unapplied.

External authority is `none`; effects attempted `0`, succeeded `0`, reconciled
`0`. No registration, steward, provider, send, or external effect is part of
this review.
