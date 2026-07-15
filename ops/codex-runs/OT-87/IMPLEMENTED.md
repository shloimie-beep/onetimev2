# OT-87 Implemented

## Initial Checkpoint

- Copied the full prompt into `ops/codex-runs/OT-87/ORIGINAL-PROMPT.md`.
- Copied the commercial policy without semantic alteration into `ops/commercial/ot87/family-plan.v1.json`.
- Copied the supplied external mutation schema and run-state contract into the OT-87 run folder for local validation/reference.
- Created initial state, base-resolution, input inventory, external mutation, canary, migration checksum, blocker, test, and resume files.

## Local Implementation

- Added strict OT-87 policy loading from `ops/commercial/ot87/family-plan.v1.json`.
- Added protected TEST-only config parsing for `LIVE_STRIPE_CHARGES_AUTHORIZED=NO`, Stripe test resource names, emergency entitlement mode, and redacted config fingerprints.
- Added `stripe:test:resources:validate`, `stripe:test:resources:setup`, `billing:reconcile:test`, and `billing:reconcile:test:apply` scripts.
- Added the official Stripe SDK client behind the accepted Stripe test adapter seam while preserving fixture injection.
- Extended checkout to pre-create/reuse TEST customers, store raw Stripe Checkout/Portal URLs only in the server redirect vault, and return local redirect handles.
- Added additive migration `packages/db/migrations/2000_ot87_stripe_test_entitlements.sql` and repository support for checkout lifecycle, subscription/invoice projections, entitlement grants, refund/dispute fields, and redirect vault.
- Implemented webhook event handling for checkout completion/expiry, subscription lifecycle, invoice payment/failure/action-required, refund, and dispute events.
- Implemented deterministic local entitlement evaluation for paid USD 6700 invoices, zero grace, no trial, scheduled-end access, refunds/disputes/manual review, and emergency deny-all.
- Enforced local household entitlement before paid class launch/content access while keeping parent billing recovery available.
- Added authenticated parent billing UI with exact family plan truth, checkout action, portal action, local status, recovery state, period end, and cancellation status.
- Registered new visible billing actions in the day-one action registry.
- Added/updated unit and integration coverage for OT-87 billing, OT-46 compatibility, adapter behavior, migration sequencing, and portal/content/class entitlement fixtures.

## Safety

- No live Stripe charges were authorized or created.
- No TEST Stripe resources, Checkout Sessions, subscriptions, refunds, disputes, or webhook deliveries were created in this environment.
- No raw Stripe secrets, IDs, URLs, webhook bodies, payment details, or PII were written to repo evidence.
