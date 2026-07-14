# OT-51P PostgreSQL Proof

## Migration

- File: `packages/db/migrations/1600_ot51_telegram_bot_foundation.sql`.
- SHA-256:
  `7877626FF08408B4876283DEEE33D70FF39B340B61236EE717E8AB1C691E03E6`.
- Namespace: `1600`.
- Existing namespace `1600-1699` was unused before this task.

## pg-mem Proof

Focused test:
`tests/integration/telegram-db-foundation.test.ts`.

Covered with pg-mem:

- clean initial migration apply through `runMigrations`;
- schema migration row for `1600_ot51_telegram_bot_foundation`;
- active mapping uniqueness;
- update inbox dedupe;
- generation-safe completion;
- dead-letter insert;
- confirmation single-use;
- consumer lease exclusivity and reclaim.

## Real PostgreSQL 16 Status

Blocked in this local environment: no safe disposable PostgreSQL 16
`DATABASE_URL` was provided for OT-51P. No production database was used.

Because real PostgreSQL is unavailable, the following remain activation-time
or integrator proof items:

- real apply plus rerun no-op;
- checksum drift rejection against real PostgreSQL;
- real `FOR UPDATE SKIP LOCKED` concurrency proof;
- indexed queue read explain plan;
- crash reclaim under concurrent workers.

The implementation and pg-mem tests are preserved, but this branch does not
claim real PostgreSQL concurrency proof.
