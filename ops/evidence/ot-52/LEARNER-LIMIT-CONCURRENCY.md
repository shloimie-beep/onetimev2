# OT-52P Learner Limit And Concurrency

## Local Proof

- `tests/ot-52/portal-services.test.ts` exercises the three active learner invariant through the repository and migration on `pg-mem`.
- Repository create/restore paths run inside transactions and lock the household row before counting active learners.
- The test proves:
  - first three active learners succeed;
  - fourth active learner fails;
  - archived learner stops counting;
  - restore fails when three active learners exist.

## Real PostgreSQL Proof

- Harness: `tests/ot-52/real-postgres-concurrency.ts`.
- Evidence: `REAL-POSTGRES-CONCURRENCY.json`.
- Status: blocked locally because no explicit safe Postgres target was provided.
- Required env to run: `OT52_POSTGRES_URL` and `OT52_ALLOW_POSTGRES_WRITE=true`.

No production database or external database was mutated.
