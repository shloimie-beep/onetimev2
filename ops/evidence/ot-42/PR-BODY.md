## Summary

Integrates OT-42 as an additive CRM module surface on top of the OT-60R recovery branch after OT-39.

Adds:

- CRM capability and schema contracts
- role-to-capability mapping
- strong ETag and canonical request hash helpers
- migration `1000_ot42_crm_module_v1.sql`
- injectable CRM router/register hook
- memory-only protected cache and lazy protected tab loader
- focused unit and integration tests
- OT-42 integration manifest and final report

The module intentionally does not mount into the live app/server wiring yet; the existing canonical PR #2/#5/#7 CRM routes remain active until concrete OT-42 repository implementations are added.

## Verification

Passed:

- `npm ci`
- focused OT-42 unit tests
- focused OT-42 integration tests
- `npm run typecheck`
- `npm run build`
- focused auth/CRM integration regression

## Known Blockers

- Real PostgreSQL assurance remains pending for the later OT-37 / PR #6 phase after all selected migrations are integrated.

## Integration Notes

See `ops/evidence/ot-42/INTEGRATION-MANIFEST.md`.

Future wiring should call `registerOt42CrmModule(app, deps)` with real session/CSRF guards and repository implementations. Communications tab wiring is intentionally omitted until a qualifying communications read model exists.
