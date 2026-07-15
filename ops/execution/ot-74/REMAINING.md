# OT-74 Remaining Work

1. Verify migration namespace `1200-1299` is free.
2. Inspect existing CRM, communications, lead, migration, unit-test, and
   integration-test patterns.
3. Add feature-local audience reconciliation contracts and domain logic.
4. Add forward-only migration(s) in namespace `1200-1299`.
5. Add synthetic CSV/XLSX-shaped parser and mapper fixtures.
6. Add a dry-run report tool that emits counts/reasons only.
7. Add feature-local API/component contracts and leave them unmounted.
8. Test duplicate inputs, conflicting identities, same-name people, missing
   email, phone normalization, replay, rollback, cross-account isolation,
   archived/suppressed contacts, school handling, and 10k synthetic rows.
9. Record PostgreSQL 16 proof if available; otherwise record the local blocker.
10. Push branch and open a draft PR against OT-60R if GitHub auth allows it.
11. Leave exact OT-80 wiring instructions.
