# OT-87 Decisions

## Fixed By Packet

- Source branch: `codex/ot83-household-portals-foundation`.
- Target branch: `codex/ot87-stripe-test-entitlements`.
- Stripe mode: TEST only.
- Live Stripe charges, live resources, deployment, DNS, and production database mutation are not authorized.
- Family plan truth: `Family plan - $67/month - up to 3 active learners in one household.`
- Public landing hero and ticker must not show price or trial copy.
- Trial is disabled.
- Grace period is zero.
- School checkout and school entitlement are disabled.
- Entitlement activation requires local verified correlation, active subscription projection, paid USD 6700 invoice truth, and no holds.

## Runtime Decisions Made In This Checkpoint

- Use the exact resolved OT83 source SHA `a02d1d254ae0d17804fb657079a7871567260ea2`.
- Create a new target branch because the remote OT87 target branch was absent.
- Store run state under `ops/codex-runs/OT-87/` before protected Stripe configuration inspection.
