# P30 Corrected-Binding Atomic Claim Handoff

## Identity

- Branch: `codex/v21-p30-campaign-workflows`
- Authorized integration start:
  `49431959f58f284bdc13ca931acf09f980fc483a`
- Expected existing/local/remote observed repair implementation head:
  `f6d074e964cebefe032042b9627d7c7b47304bdd`
- Superseded correction claim:
  `2f2aa5c9d2395ce771bbcd4afb9df19e308c3918`
- This corrected-binding atomic claim head: derive with `git rev-parse HEAD`; C00
  records the pushed head
- Repaired containing controller:
  `0c911664217efe3dbb89b93b6fe29eb9eda2fec3`
- Ready-entry parent:
  `e54ea923a743caf760ef47638a2c8d8a875faf34`
- Ready-entry digest:
  `380e1f3ddfa39b986befe6aa58506783f7e295c4aa5e421a6b69821226a51553`
- Claim: `87608f7e-3d2b-448b-8376-da025b05d1b7`
- Writer: `codex-p30-worker-87608f7e`
- GHL_CAMPAIGNS lease:
  `a77f21df-1741-46ea-a8c7-f13f6aa9e5f0`
- Lease expiry: `2026-07-29T01:13:59Z`

## Atomic claim result

The repaired containing controller `0c911664` has sole parent exact
`e54ea923`. Its `resume_existing_branch` entry adopts the observed repair
implementation head `f6d074e9`; the canonical ready-entry digest recomputes
exactly, all dependency and package bindings match, and local plus remote P30
both equal that exact expected head.

This checkpoint changes only the three P30 runtime files. It does not alter the
already-observed repair implementation, workflow fragment, steward requests,
registry, composer, migration, package, provider, or external state.

## Observed repair disposition

1. The original OT-15 launch validated only step 1. Observed repair head
   `f6d074e9` fails closed until all three canonical exact-content approvals
   exist.
2. The original OT-16 planner trusted caller-supplied operation IDs. The
   observed repair recomputes and rejects every adult, expiry, or checkpoint
   mismatch.
3. The original OT-16 worker could reuse initial eligibility at dispatch. The
   observed repair refreshes paid, decline, and custom-School eligibility after
   reservation and immediately before provider access.

These findings and the already-observed repair implementation remain unchanged.
No product or finalization work is authorized until C00 reconciles this exact
atomic claim head and explicitly resumes P30.

## Exact next action

Push and report this exact corrected-binding atomic claim, then stop. Do not
read, modify, rerun, or finalize product work until C00 consumes the exact
remote claim head and sends an explicit resume instruction.

## External effects

Authority: none. Attempted: 0; succeeded: 0; reconciled: 0.
