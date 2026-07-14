# OT-46 Audit Inventory

## Baseline

- Repository: `webcraft-media/onetimev2`
- Construction base: `a73458d1884b8fcb4843c4852425009577f59ef7`
- Branch: `codex/ot46p-isolated-stripe-foundation`
- Worktree: `C:\Users\User\OneTimeOneTime-ot46p-stripe`
- Anchor branch: `origin/codex/parallel-base-a73458d` verified at the construction base.

## Architecture Inspection

- Server composition inspected: `apps/web/src/server/app.ts`; not edited.
- Config inspected: `packages/config/src/index.ts`; not edited.
- Migration harness inspected: `packages/db/src/index.ts`; not edited.
- Existing migrations inspected: `0001_onetime_lead_slice.sql`, `0002_crm_auth_core.sql`.
- Public signup inspected through `packages/domain/src/lead/service.ts`, `apps/web/src/client/public/public-entry.ts`, and integration tests.
- Auth/RBAC inspected through `packages/domain/src/auth/service.ts`.
- Bundle separation inspected through Vite configs and `scripts/check-bundles.ts`.

## Collision Search

Searched for `stripe`, `billing`, `checkout`, `portal`, `invoice`, `subscription`, `entitlement`, `webhook`, `customer`, `price`, `payment`, `STRIPE_`, `RABBI_STRIPE_`, `sk_test_`, `sk_live_`, `whsec_`, and `bna_stripe`.

- Active runtime collision: none found.
- Existing config placeholder: `ENABLE_PAYMENT_TRANSPORT=false`; intentionally not reused by OT-46 billing config.
- Existing docs/audit inputs: historical references only.
- Existing tests/copy: public portal/payment negative assertions only.
- Existing secret scanner: Stripe key pattern detection already present.

## Namespace

- Migration namespace 1300-1399 was unused before OT-46.
- Added exactly one migration: `packages/db/migrations/1300_ot46_billing_foundation.sql`.

## Scope Boundary

Only feature-local paths were changed. No central app registration, root package files, workflows, shared package barrels, public landing/signup code, or existing migrations were edited.
