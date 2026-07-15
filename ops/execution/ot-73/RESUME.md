# OT-73 Resume Packet

## State

- Repository: `webcraft-media/onetimev2`
- Base: `dfef7de2035e08f1ee72e0133ccf656fe7a74444`
- Branch: `codex/ot73-landing-intent-reconciliation`
- Target PR base: `codex/ot60r-recovery-convergence`
- Deployment/provider/DNS: not touched.

## Implemented

- Removed the public Rosh Hashanah campaign band from generated landing HTML.
- Removed the public client deadline listener and campaign ticker CSS.
- Updated hero height so the header flows directly into the hero with no reserved ticker space.
- Preserved exact hero copy and three large landing CTAs.
- Replaced mobile brand text hiding with a compact visible title/subtitle lockup.
- Removed yellow styling from the `Secure student portal` bullet.
- Removed the public Accomplishment internal disclaimer while preserving the Toronto image.
- Added the shared logo footer for landing/signup with the canonical line and link order.
- Added focused browser/unit assertions and OT-73 screenshot evidence.

## Validation

See `ops/execution/ot-73/TEST-RESULTS.md`.

## Evidence

- Ledger: `ops/execution/ot-73/COPY-PLACEMENT-LEDGER.md`
- Prompt: `ops/execution/ot-73/ORIGINAL-PROMPT.md`
- Screenshot harness: `ops/evidence/ot-73/capture-landing-screenshots.mjs`
- Screenshots: `ops/evidence/ot-73/screenshots/`

## Pending

- Exact operator-certified replacement copy for the Accomplishment paragraph remains unrecovered.
- No replacement campaign/offer copy was supplied; the campaign band is removed rather than replaced.
