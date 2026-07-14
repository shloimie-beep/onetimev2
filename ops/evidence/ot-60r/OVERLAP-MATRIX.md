# OT-60R Overlap Matrix

Overlaps are based on sanitized `gh pr view --json files` output.

## Hot Spots

| PR Pair | Count | Overlapping files |
| --- | ---: | --- |
| #2/#3 | 8 | `apps/web/src/server/app.ts`; `packages/config/src/index.ts`; `packages/contracts/src/index.ts`; `packages/domain/src/auth/service.ts`; `packages/domain/src/crm/service.ts`; `packages/domain/src/index.ts`; `packages/domain/src/lead/service.ts`; `tests/integration/auth-crm.test.ts` |
| #2/#4 | 2 | `.env.example`; `packages/domain/src/lead/service.ts` |
| #2/#5 | 2 | `apps/web/src/client/app/crm-entry.tsx`; `apps/web/src/client/app/crm.css` |
| #2/#7 | 4 | `apps/web/src/client/app/crm-entry.tsx`; `apps/web/src/client/app/crm.css`; `tests/e2e/crm-core.spec.ts`; `tests/performance/public-performance.spec.ts` |
| #2/#8 | 1 | `packages/domain/src/lead/service.ts` |
| #2/#9 | 14 | `apps/web/src/client/app/crm-entry.tsx`; `apps/web/src/client/public/public-entry.ts`; `apps/web/src/server/app.ts`; `packages/config/src/index.ts`; `packages/contracts/src/index.ts`; `packages/domain/src/auth/service.ts`; `packages/domain/src/crm/service.ts`; `packages/domain/src/index.ts`; `packages/domain/src/lead/service.ts`; `tests/accessibility/public-a11y.spec.ts`; `tests/e2e/crm-core.spec.ts`; `tests/integration/auth-crm.test.ts`; `tests/performance/public-performance.spec.ts`; `tests/support/test-server.ts` |
| #3/#9 | 10 | `apps/web/src/server/app.ts`; `packages/config/src/index.ts`; `packages/contracts/src/index.ts`; `packages/domain/src/auth/service.ts`; `packages/domain/src/crm/service.ts`; `packages/domain/src/index.ts`; `packages/domain/src/lead/normalize.ts`; `packages/domain/src/lead/service.ts`; `tests/integration/auth-crm.test.ts`; `tests/integration/lead-capture.test.ts` |
| #4/#8 | 16 | `apps/worker/src/delivery/config.ts`; `apps/worker/src/delivery/repository.ts`; `packages/contracts/src/delivery/types.ts`; `packages/db/migrations/0004_delivery_worker_claim_index.sql`; `packages/domain/src/delivery/eligibility.ts`; `packages/domain/src/delivery/messages.ts`; `packages/domain/src/delivery/retry.ts`; `packages/domain/src/lead/service.ts`; `tests/integration/delivery/outbox-pipeline.test.ts`; `tests/integration/delivery/postgres-repository.test.ts`; `tests/integration/delivery/web-app-independence.test.ts`; `tests/integration/lead-capture.test.ts`; `tests/support/delivery/fixtures.ts`; `tests/unit/delivery/config.test.ts`; `tests/unit/delivery/eligibility.test.ts`; `tests/unit/delivery/worker.test.ts` |
| #5/#7 | 5 | `apps/web/src/client/app/crm-entry.tsx`; `apps/web/src/client/app/crm.css`; `tests/accessibility/ot-35/app-shell-a11y.spec.ts`; `tests/e2e/ot-35/app-shell-crm.spec.ts`; `tests/performance/ot-35/crm-performance.spec.ts` |

Smaller overlaps:

- #3/#4: `packages/domain/src/lead/service.ts`, `tests/integration/lead-capture.test.ts`
- #3/#8: `packages/domain/src/lead/service.ts`, `tests/integration/lead-capture.test.ts`
- #4/#9: `packages/domain/src/lead/service.ts`, `tests/integration/lead-capture.test.ts`
- #5/#9: `apps/web/src/client/app/crm-entry.tsx`
- #7/#9: `apps/web/src/client/app/crm-entry.tsx`, `tests/e2e/crm-core.spec.ts`, `tests/performance/public-performance.spec.ts`
- #8/#9: `packages/domain/src/lead/service.ts`, `tests/integration/lead-capture.test.ts`

## Integration Implication

- PR #3/#9 are superseded except the intentionally ported login-CSRF HMAC proof.
- PR #5/#7/#11 must be integrated semantically into the canonical CRM/client shell, not by whole-file replacement.
- PR #4/#8 should be treated as one delivery lineage; PR #8 modifies the PR #4 migration/blob and delivery files.
