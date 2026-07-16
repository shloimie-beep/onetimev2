# OT-107 Resume

Current state: implementation and focused local verification completed on
`codex/ot107-student-ai-class-helper`; draft PR opened at
https://github.com/webcraft-media/onetimev2/pull/44.

Implemented:

- Shared `HelperAnswer`/citation contract requiring citations for substantive
  answers.
- Student Class Helper domain adapter using server-derived student learner,
  billing/content entitlements, OT86 approved retrieval, deterministic provider
  port, citation re-authorization, abstentions, and per-learner rate limits.
- Express wiring for `/api/v1/portals/student/helper/query`.
- Student portal Class Helper panel and private-question preview/confirm flow.
- Visible action registry coverage and OT-107 tests.

Verification passed:

- `npm run typecheck`
- `npm run lint`
- `npm run format`
- `npm run unit`
- `npm run secret:scan`
- `npx vitest run tests/ot-52/portal-ui.test.ts tests/ot-52/portal-router.test.ts tests/ot-52/portal-services.test.ts`
- `npx vitest run --config vitest.integration.config.ts tests/integration/portals/portal-mount.test.ts tests/integration/content/ot86-content-pipeline.test.ts`

Next action: PR review, optional live AI provider canary only if protected
credentials and explicit approval are provided, and deployment/live smoke only
through the normal release path.

Do not run production DB writes, provider sends, payments, access grants,
deploys, credential mutations, or live AI canaries without explicit approval.
