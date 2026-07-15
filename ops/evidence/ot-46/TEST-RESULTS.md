# OT-46 Test Results

## Completed

- `npm ci`: passed, 0 vulnerabilities.
- `npm run secret:scan`: passed across 104 repo text files.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npx vitest run --config vitest.unit.config.ts tests/unit/ot46-billing-config-policy.test.ts`: 17/17 passed.
- `npx vitest run --config vitest.integration.config.ts tests/integration/ot46-billing-services.test.ts`: 9/9 passed.
- `npm run unit`: 24/24 passed.
- `npm run integration`: 20/20 passed.
- `npm run build`: passed.
- `npx tsx scripts/check-bundles.ts`: passed with `public_js_bytes=5646`, `public_css_bytes=10626`, `crm_js_bytes=204369`.
- `npm run e2e`: 7/7 passed.
- `npm run accessibility`: 3/3 passed.
- `npm run performance`: 3/3 passed and bundle scan passed.
- `git diff --check`: passed.
- Scoped OT-46 Prettier check: passed.

## Covered

- config defaults off
- absent billing config valid
- live mode/key/event rejection
- legacy aliases rejected
- browser/public source free of billing/Stripe imports
- public signup unchanged and adapter invocation count zero
- missing/forged/changed signatures
- oversized and parsed-body webhook misuse
- replay and digest mismatch
- out-of-order stale event
- unknown event
- live/wrong account/wrong product
- wrong customer correlation
- checkout CSRF/RBAC denial surfaces through router dependency contracts and service auth tests
- browser provider fields rejected
- checkout idempotency
- fixture livemode webhook rejected
- provider outage safe error
- feature-disabled denial
- checkout creation does not grant entitlement
- no persistent browser billing cache in reference UI

## Baseline Format Note

`npm run format` fails on 56 pre-existing baseline files outside OT-46 ownership. OT-46-owned files pass scoped Prettier check and were formatted with `npx prettier --write --ignore-unknown`.
