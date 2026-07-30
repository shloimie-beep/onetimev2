# P21 Composite Projection Correction — Atomic Claim Handoff

## Exact identity

- Branch: `codex/v21-p21-content-publication`
- Prior P21 remote head:
  `cecdad0989e861254987970cfa3d222319369f52`
- Adopted integration and sole claim parent:
  `99fd8c33ea023e838d8ee9c993b5de52f4763e7f`
- Integrated P20 projection authority:
  `75137bf476b4a1773f29bb41a6a149148df2623d`
- Containing control:
  `3757ee49b83027d69208f25b0f709d309d5c6c1a`
- READY state basis:
  `f295f2f55d9fda6208ef1c8dfb9c97ea2ca475a0`
- Canonical control-state digest:
  `7dfb873efe7246f60aa267e2b0c92858bc72edff5a2d2aab742b4e34b7449ade`
- READY payload:
  `ede4095b8ab517b3fe734208e14dfef82527f0f52a2b21409361acf4e0ef724b`
- Claim:
  `9e38d9dd-8293-451d-9335-ddb466e7234e`
- Active `CONTENT_PUBLICATION` lease:
  `afe1ac21-bafb-475b-967a-28bdb9bcda66` through
  `2026-07-30T10:46:00Z`

## Atomic claim boundary

This checkpoint changes only:

- `ops/v2.1-execution/runtime/P21/HANDOFF.md`
- `ops/v2.1-execution/runtime/P21/NEXT-PROMPT.md`
- `ops/v2.1-execution/runtime/P21/TASK-STATE.yaml`

The three-path inventory digest is
`4335f312329a0e5656634189b69d167460b724505d5dcd25eba5da094deb9520`;
the integration-base manifest is
`185d1ec301c61c9ec4b6c0d96f850e4eec59978a2f588278be96399823e46915`.
Source, tests, P20, migrations, steward requests, registrations, provider
configuration, and every effect byte remain unchanged.

The task branch adopted exact release `99fd8c33` because that release contains
both the exact prior P21 head and the corrected P20
`ApprovedForPublicationProjection`. C00 must verify that this atomic claim has
`99fd8c33` as its sole parent and reconcile it before any implementation work.

## Post-reconciliation authorization

Only after C00 reconciliation may P21 implement the canonical READY directives
within the exact 14-path inventory
`92698702ddafb76e5ea660ae0ce7fa1314b02dba86b5fe35be839b76003f5c61`.
P21 must consume P20 approval only through the server-side typed repository
under exact `accountKey`, `productKey`, and `contentVersionId`; caller/body
approval or scope is not authoritative.

Immutable mixed request `P21-registration-001` remains byte-identical,
superseded, withheld, and unapplied:

- raw SHA-256:
  `fb372a6d329ddde76952f5637e351ba2990e15589e9c37f957e06e4eedf9bdf3`
- canonical SHA-256:
  `b47894b8827ba9e098725355215dda28b408f8668ab5cc3ad8d0a47019d3b61a`

After reconciliation P21 may publish exactly two immutable successors:
`P21-MIGRATION-002` for F02 and `P21-registration-002` for I36. P21 may not
allocate ordinal `2250`, write or apply SQL, apply registration, inspect or
mutate a provider, deploy, send, or perform an effect.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`. No effect
lock is held.

## Exact next action

C00 independently verifies the pushed remote head, sole parent, exact
runtime-triplet scope, pair/triplet digests, READY/claim/lease bindings,
preserved non-runtime bytes, and zero effects. P21 stops until reconciliation.
