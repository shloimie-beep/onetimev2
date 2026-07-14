## Summary

Implements OT-42 as a merge-ready CRM module branch on top of OT-39 base `c1584577780d7b5125bce4fb81d2a454c9e84096`.

Adds:

- CRM capability and schema contracts
- role-to-capability mapping
- strong ETag and canonical request hash helpers
- migration `1000_ot42_crm_module_v1.sql`
- injectable CRM router/register hook
- memory-only protected cache and lazy protected tab loader
- focused unit and integration tests
- OT-42 integration manifest and final report

The branch intentionally does not edit central app/server wiring, app shell navigation, package files, workflows, or central barrels.

## Verification

Passed:

- `npm ci`
- focused OT-42 unit tests
- focused OT-42 integration tests
- `npm run typecheck`
- `npm run lint`
- `npm run integration`
- `npm run unit`
- `npm run test`
- `npm run secret:scan`
- touched-file Prettier check
- `git diff --check`
- `npm run build`
- `npm run e2e`
- `npm run accessibility`
- `npm run performance`

Browser totals:

- E2E: 14 passed
- Accessibility: 4 passed
- Performance: 4 passed

## Known Blockers

- Real PostgreSQL gate remains blocked locally: no `DATABASE_URL`, local port `5432` closed, no `docker`, and no `psql`.
- Repo-wide `npm run format` and therefore `npm run verify` remain blocked by pre-existing formatting drift outside this branch. Touched-file Prettier check passes.

## Integration Notes

See `ops/evidence/ot-42/INTEGRATION-MANIFEST.md`.

Future wiring should call `registerOt42CrmModule(app, deps)` with real session/CSRF guards and repository implementations. Communications tab wiring is intentionally omitted until a qualifying communications read model exists.
