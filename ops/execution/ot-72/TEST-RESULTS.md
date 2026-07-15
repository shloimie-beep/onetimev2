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

## Known Verification Note

- An earlier local handoff recorded a source-branch Prettier baseline failure. The latest remote Node 24 verify run for checked head `4ec55d7bd6ade9ec2dd21e4557a88ac43b4ceb44` passed the `npm run format` step.
- A fresh Windows checkout rerun of full `npm run format` still reports the broader source baseline; OT-72 packet files changed in the CI handoff update were formatted with scoped `npx prettier --write`.
- The SQL migration remains manually reviewed because this repo has no SQL parser configured.

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

## Remote CI Snapshot

- PR: https://github.com/webcraft-media/onetimev2/pull/18
- Head at PR creation: `b2a92917b9dd730957c55d8add6f573518506a85`
- Latest checked head: `4ec55d7bd6ade9ec2dd21e4557a88ac43b4ceb44`
- PostgreSQL 16 assurance harness: PASS
- Node 24 verify: PASS
- Node 24 verify covered secret scan, format, lint, typecheck, unit, integration, build, Playwright e2e, Playwright accessibility, Playwright performance and bundle gates.
