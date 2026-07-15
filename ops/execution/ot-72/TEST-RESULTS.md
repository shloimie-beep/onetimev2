# OT-72 Test Results

## 2026-07-15 Local Verification

- `npm run typecheck` PASS.
- `npx vitest run tests/unit/ot72-provider-adapters.test.ts tests/integration/ot72-provider-truth.test.ts` PASS, 2 files, 8 tests.
- `npm run unit` PASS, 12 files, 94 tests.
- `npm run integration` PASS, 11 files, 57 tests.
- `npm run lint` PASS.
- `npm run secret:scan` PASS across 335 repo text files.
- `git diff --check` PASS with Windows line-ending warnings only.
- `npm run build` PASS.

## Known Verification Caveat

- `npm run format` FAILS on the source-branch baseline with 183 files. OT-72 changed TS/JSON/MD files were formatted by scoped `npx prettier --write`; SQL was skipped because this repo has no SQL parser configured.

## External Mutation Counts

- Stripe test/sandbox calls: 0
- Stripe live charges: 0
- Resend/email sends: 0
- WhatsApp/WAPI sends: 0
- Zoom mutations: 0
- Vimeo mutations: 0
- Telegram sends: 0
- Webhook registrations: 0
- DNS mutations: 0
- Deployments: 0
- Production database mutations: 0
