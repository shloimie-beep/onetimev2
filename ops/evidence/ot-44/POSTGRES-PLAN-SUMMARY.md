# OT-44 PostgreSQL Plan Summary

No migration or index was added.

Reason:

- The packet requires real disposable PostgreSQL before adding any index.
- This local environment has no `OT44_TEST_DATABASE_URL`, `psql`, or `docker`.
- pg-mem is not equivalent proof.

Status: `integration_pending`.

Later command:

```bash
OT44_TEST_DATABASE_URL=<disposable-test-db> npm run test -- --run tests/integration/communications/postgres-plan.test.ts
```

Acceptance thresholds before any future `1200..1299` migration:

- More than 1,000 candidate outbox rows read to return 26; or
- disk-backed or large explicit sort; or
- selective/contact query performs a full outbox sequential scan; or
- 30-run warm SQL p75 above 100 ms.
