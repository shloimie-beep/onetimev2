## Summary

- Adds a gated, non-production W12 Portal Test Lab at `/app/portal-test-lab`.
- Seeds one fictional parent household plus three separate fictional student login identities for local/test use only.
- Adds integration and Playwright coverage for owner/admin lab access, parent portal management, separate learner sessions, sibling isolation, protected class launch state, content/review/progress/rewards/questions/helper, and responsive/a11y evidence.
- Registers the new visible route/actions and release-manifest route entries.

## Guardrails

- No production user mutation.
- No production database access.
- No external sends or provider mutations.
- No role impersonation: parent and each student authenticate as separate fictional identities.
- The lab page does not expose current passwords, session tokens, protected class URLs, or provider URLs.

## Validation

- ZIP safety and `SHA256SUMS.txt`: passed.
- `npm run secret:scan`: passed.
- `npm run brand:check`: passed.
- Scoped Prettier on changed source/test/registry files: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run --config vitest.integration.config.ts tests/integration/portals/portal-test-lab.test.ts`: passed.
- `npx vitest run --config vitest.unit.config.ts tests/unit/day-one/visible-action-registry.test.ts tests/unit/ot83r-portal-registry.test.ts`: passed.
- `npx vitest run tests/ot-52/portal-ui.test.ts`: passed.
- `npx playwright test tests/e2e/w12-03-portal-test-lab.spec.ts`: passed.

Repo-wide `npm run format` remains red on inherited baseline formatting issues across existing files, so this branch uses a scoped Prettier check for changed source/test/registry files instead of mass-formatting the release base.
