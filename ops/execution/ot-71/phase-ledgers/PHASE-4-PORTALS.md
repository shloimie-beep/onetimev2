# Phase 4 Ledger: Parent And Student Portals

Status: completed

## Scope

- Mount recovered portals with canonical auth, shell, class, content, support, and optional billing interfaces. Preserve parent household scope and single-learner student scope.

## Evidence

- `apps/web/src/server/app.ts` mounts protected `/app/parent` and `/app/student` shells plus `/api/v1/portals/parent` and `/api/v1/portals/student` routers on canonical auth/session/CSRF primitives.
- Parent actor resolution reads active `portal_guardian_relationships`; student actor resolution reads active `account_learner_identity_links` and active `portal_student_access_state`.
- Portal services use `createPortalRepository`, `createClassPortalAccessAdapter`, `createContentPortalAccessAdapter`, local progress summaries, and `createAccountLifecycleCredentialAdapter`.
- `packages/domain/src/portals/account-lifecycle-adapter.ts` maps portal student setup/reset/suspend/restore to Phase 3 lifecycle functions without returning raw token material.
- `apps/web/src/client/app/portal-entry.tsx` and `portal-api.ts` mount the parent/student client shells; `scripts/build-public-pages.ts` generates `/app/parent` and `/app/student`.
- `packages/contracts/src/portals/index.ts` now includes mounted-role coverage, parent learner materials, and optional student access setup/reset request details.
- `tests/integration/portals/portal-mount.test.ts` covers parent shell redirects, parent default dashboard, cross-household denial, student access setup, raw-token non-persistence, wrong-role denial, student sibling isolation, class launch CSRF, and session expiry after parent suspend.
- Verification passed: focused portal integration tests, legacy OT-52 portal tests, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run secret:scan`, `git diff --check`, and `npm run test`.

## Notes

- No live provider URLs, credential sends, production database writes, deployment, billing portal activation, or external support/helper sends were performed.
- Billing remains a disabled summary seam unless explicitly enabled by later billing work; helper and support remain local/default-off seams.
