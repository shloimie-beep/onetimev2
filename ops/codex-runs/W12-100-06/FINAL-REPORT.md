# W12-100-06 Final Report

## Summary

Implemented the account and portal readiness lane for a safe, isolated first One Time identity set. The new provisioning tool creates the synthetic owner/admin, parent/guardian, and three separate student identities with environment gates, explicit account/product scope, redacted output, idempotent outcomes, audit entries, and no admin impersonation of parent/student setup.

Added focused integration coverage for the complete synthetic journeys requested by the lane, including activation, assurance, login/logout, revocation, recovery, parent household scope, student setup, sibling isolation, suspended/revoked behavior, trusted-device expiry, class/content visibility, support access, and production rejection of the portal test-lab/provisioning path.

External actions count: `0`
Production mutations count: `0`
Provider resource mutations count: `0`

No staging or production deploy was performed.

## Changed Files

- `scripts/w12-100/identity/provision-first-identity-set.ts`
- `tests/integration/accounts/w12-100-identity-provisioning.test.ts`
- `ops/codex-runs/W12-100-06/ORIGINAL-PROMPT.md`
- `ops/codex-runs/W12-100-06/STATE.json`
- `ops/codex-runs/W12-100-06/FINAL-REPORT.md`
- `ops/codex-runs/W12-100-06/RESUME.md`
- `ops/codex-runs/W12-100-06/CHANGED-FILES.txt`
- `ops/codex-runs/W12-100-06/STAGING-OPERATOR-RUNBOOK.md`

## Validation

- `npm ci` - passed, 0 vulnerabilities.
- `npx prettier --write scripts/w12-100/identity/provision-first-identity-set.ts tests/integration/accounts/w12-100-identity-provisioning.test.ts` - completed for the two new implementation/test files only.
- `npx vitest run --config vitest.integration.config.ts tests/integration/accounts/w12-100-identity-provisioning.test.ts` - passed, 3 tests, 11.79s on the final focused rerun.
- `npm run unit` - passed, 38 test files, 196 tests, 5.75s.
- `npm run integration` - passed, 39 test files, 187 tests, 56.06s.
- `npm run secret:scan` - passed across 1300 repo text files.
- `npm run brand:check` - passed manifest, token drift, route scan, and raw source scan; 27 routes.
- `npm run lint` - passed.
- `npm run typecheck` - passed.
- `npm run build` - passed; build completed client/page generation and typecheck. Vite emitted the existing runtime font-resolution warning for `/assets/fonts/dm-serif-display-latin.woff2`.

## Safety Notes

- No production database connection was opened or inspected.
- No private source rows, destinations, raw message bodies, activation/reset tokens, passwords, database URLs, or provider links were printed, serialized, screenshotted, or committed.
- The provisioning report is redacted by construction and tests assert that no raw activation/reset/token/password material appears in serialized output.
- Delivery remains sink-only; protected activation delivery is deferred to a later authorized lane and described in the staging operator runbook.

## Blockers

None.
