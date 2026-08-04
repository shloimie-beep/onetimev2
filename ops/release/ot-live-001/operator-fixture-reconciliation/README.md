# OT-LIVE-001.03 inert operator-fixture reconciliation design

This directory is a source-only proposal. It does not connect to a database, execute SQL, alter application code, or grant effect authority. The protected operator fixture is supplied only at a separately authorized execution boundary and must never be logged, serialized into evidence, or committed.

## Fixed scope

- Target product: `one_time_mishnayos`.
- Runtime tier: `production`.
- Verification environment: `production_operator_canary`.
- Required legacy state: exactly one active Admin account under the existing legacy account/product scope and zero or one active legacy session.
- Required create state: zero matching v2.1 AdultIdentity, HumanAccount, credential, role-membership, family-household, and session rows. Matching includes the protected fixture address, every proposed ID, and every proposed ownership link, so a collision in another runtime or verification environment also fails closed.
- Required replay state: exactly the six proposal-created rows, with the exact protected IDs and credential hash equality verified inside PostgreSQL, plus zero v2.1 sessions.
- Any partial, duplicate, differently bound, hash-mismatched, or ambiguous state aborts the transaction.

## Protected bindings

The future authority-bound runner must bind the normalized fixture address, the expected sanitized legacy row/user/session hashes, five exact new row identifiers, one household access reference, the approved seat limit, and one transaction timestamp. Binding values remain in protected process memory. SQL parameters and query rows must be redacted from logs.

The password hash is never selected into the runner or evidence. PostgreSQL requires the proven legacy `argon2id` shape with the exact Argon2 version, parameters, salt length, and digest length. It constructs the v2.1 credential by replacing only that nonsecret policy prefix with `argon2id-v1`; the version, parameters, salt, and digest suffix remain byte-for-byte equal and therefore verify the same password. The legacy hash itself remains byte-for-byte unchanged. Before/after legacy fingerprints are computed inside PostgreSQL and returned only as SHA-256 values.

The three protected legacy identifier digests are recomputed only inside PostgreSQL with their canonical sanitization domains: `legacy_account_user:`, `legacy_user_key:`, and `legacy_session:`. Raw legacy identifiers are neither returned nor compared outside the database.

## Apply protocol

An authorized runner must execute these steps on one connection:

1. Begin a `SERIALIZABLE` transaction.
2. Acquire the transaction-scoped advisory lock derived from the protected normalized fixture address.
3. Run the preflight plus the exact-field readback and require valid/distinct protected bindings, the exact legacy cardinality, canonical prefixed identifier hashes, compatible legacy Argon2id shape, configured digest function, and either exact empty or exact replay v2.1 state. The readback supplies the model's exact-ID and in-database normalized-credential-equivalence gates; a runner must not infer them from cardinality alone.
4. For the empty state only, execute the six parameterized inserts in declared order. Require `rowCount === 1` for every statement and a total of exactly six.
5. For exact replay, execute no inserts and require a total affected-row count of zero.
6. Run exact-ID and exact-field v2.1 readback and a second legacy immutable-fingerprint readback. Require the six desired rows under the exact product/runtime/environment, no v2.1 session, equality between the v2.1 hash suffix and the unchanged legacy version/parameter/salt/digest suffix inside PostgreSQL, and an unchanged legacy fingerprint/session count.
7. Commit only after every assertion passes. Any error, mismatch, unexpected row count, or result-shape difference issues `ROLLBACK`.

The forward hard ceiling is six rows:

| Row                                                                                 | Maximum |
| ----------------------------------------------------------------------------------- | ------: |
| AdultIdentity                                                                       |       1 |
| HumanAccount                                                                        |       1 |
| Admin membership                                                                    |       1 |
| Parent membership                                                                   |       1 |
| Family household                                                                    |       1 |
| Adult credential                                                                    |       1 |
| Legacy, session, Student, customer, provider, send, charge, deployment, or DNS rows |       0 |

## Idempotent replay

Replay is accepted only when the exact protected identifiers already select one row of each desired type, all bindings and roles match, the v2.1 credential still equals the deterministic prefix-normalized legacy hash inside PostgreSQL, and no v2.1 session exists. Replay performs zero writes. A partial state never attempts repair.

## Full exact-ID rollback design

Rollback is a separate authority-bound transaction using the same advisory lock and protected bindings:

1. Require the exact applied state and unchanged legacy fingerprint.
2. Delete the credential, Parent membership, Admin membership, household, HumanAccount, and AdultIdentity in reverse dependency order. Every predicate requires its exact protected ID, exact product/runtime/environment, exact creation timestamp, and proposal-created field values; the normalized credential (including suffix equivalence) and display name are re-compared to the unchanged legacy row inside PostgreSQL.
3. Require exactly one affected row for each delete and exactly six total.
4. Read back zero matching v2.1 rows and the unchanged legacy account/session fingerprint.
5. Commit only after every assertion passes; otherwise roll back the rollback transaction.

Rollback never updates or deletes a legacy account/session and cannot affect a Student, customer, provider, send, charge, deployment, or DNS record.

## Authority boundary

These artifacts are inert design evidence only. A later effect requires a new C00 authority bound to an exact source/candidate, database service/environment, protected fixture hashes, exact generated IDs, row budgets, before/after queries, rollback query set, expiry, provider lock, and fencing token. Nothing here authorizes inference or execution.
