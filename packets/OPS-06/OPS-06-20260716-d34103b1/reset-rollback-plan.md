# OPS-06 reset and rollback plan

Task ID: `OPS-06`  
Packet ID: `OPS-06-20260716-d34103b1`

## Safety invariant

Reset is a ledger-driven deletion of only synthetic rows created by one `OPS-06` run. It is not a schema rollback and must never use `TRUNCATE`, an unbounded `DELETE`, wildcard email matching, production identifiers, or a shared/live database. Run the reset twice and require the second pass to make zero changes.

## State-first preparation

1. Create `RUN_ID` exactly as Phase 0 of `DIRECT-CODEX-PROMPT.md`: `OPS-06-` plus the current UTC timestamp in `YYYYMMDDTHHMMSSZ` form plus eight lowercase hex characters derived from SHA-256 of the packet ID, local HEAD text, and 32 random bytes; retain only the random-byte digest.
2. Atomically write `ops/evidence/OPS-06/$RUN_ID/state/state.json`, initialize `state/state-transitions.jsonl`, `state/commands.ndjson`, and `state/safety.json`, and record phase `STATE_PERSISTED` before any external, database, source, or deployment mutation.
3. Record the staging URL classification, `/version` response, database server identity, database name, current user, PostgreSQL major version, and a one-way hash of the connection target. Do not record credentials.
4. Fail closed unless the host, project/environment labels, database, and application URL all prove isolated staging and differ from every production identifier.
5. Capture baseline row counts and deterministic digests for all touched tables, excluding volatile timestamps. Capture the IDs of pre-existing rows that share no `OPS-06` fixture keys.

## Fixture ledger

Use an existing audit/metadata field carrying `RUN_ID` when available. If the exact deployed source has no safe way to identify all generated rows, add test-harness-only glue in an isolated staging schema named `ops06`:

- `ops06.fixture_runs(run_id primary key, task_id, source_sha, started_at, status)`
- `ops06.fixture_rows(run_id, table_schema, table_name, primary_key_json, created_at, primary key(run_id, table_schema, table_name, primary_key_json))`

The ledger stores only table names and opaque primary keys. It must not store passwords, activation tokens, session cookies, provider URLs, raw messages, or real personal data. Creating this staging-only ledger requires additive, checksummed migration discipline and must be removable without touching product rows.

## Reset order

Resolve exact foreign-key order from PostgreSQL catalogs and delete by ledgered primary key in reverse dependency order. The expected logical order is:

1. provider-off delivery attempts, retry/dead-letter records, outbox receipts, support receipts, and learner-question queue rows;
2. session, CSRF, activation, MFA/recovery, and student-access operation rows;
3. reward events, progress events, content/class access records, tasks, communication projections, tags, notes, and relationships;
4. learners and learner-account links;
5. household relationships, subscriptions/entitlements, household records;
6. CRM audit events, signup leads, contacts;
7. `OPS-06` ledger rows and the run record after verification.

For append-only audit tables that product policy forbids deleting, use the repository's documented staging synthetic-data purge mechanism. If no such mechanism exists, the reset gate fails; do not weaken append-only production semantics or issue broad SQL.

## Transaction and concurrency requirements

- Acquire a run-scoped PostgreSQL advisory lock derived from `RUN_ID`.
- Revoke all ledgered sessions before deleting domain rows.
- Stop or drain the provider-off worker and wait until no ledgered delivery has an active lease.
- Delete in bounded batches inside transactions. Verify `RETURNING` primary keys against the ledger before commit.
- Abort if any returned key is absent from the ledger, if any row has a non-`example.test` identity, or if the connection classification changes.
- Restart the worker only after reset verification.

## Verification

A successful reset requires all of the following:

- every ledgered product row is absent or handled by an approved append-only synthetic purge;
- the second reset changes zero rows;
- baseline counts and deterministic digests match the pre-run snapshot;
- no pre-existing primary key changed;
- no session, activation, outbox lease, retry, dead-letter, question, support, subscription, entitlement, learner, or contact row remains for `RUN_ID`;
- `/health`, `/ready`, `/version`, and worker health remain green;
- secret, PII, and provider-URL scans pass on the final evidence tree.

## Code rollback

Record both the original staging SHA and any temporary rehearsal-harness deployment SHA. A staging code rollback may only restore the exact original SHA to the same isolated staging service after fixture reset and only when `OPS06_ALLOW_STAGING_DEPLOY=1` was present before the run. Never deploy to production, mutate root DNS, push to GitHub, or invoke Buffer/provider publishing. Verify `/version` after rollback and save the response.

## Failure handling

On interruption, write phase `RESET_REQUIRED` to state, preserve the ledger, and stop. Resume from the ledger; never infer rows from names alone. If safe reset cannot be proven, return verdict `FAIL_SAFETY` and leave the isolated staging environment quarantined with exact opaque row IDs in protected evidence.
