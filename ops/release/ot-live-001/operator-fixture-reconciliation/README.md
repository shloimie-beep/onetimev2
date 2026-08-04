# OT-LIVE-001.03 inert operator-fixture reconciliation design

This directory is a source-only proposal. It does not connect to a database, execute SQL, alter application code, or grant effect or compensation authority. The protected operator fixture is supplied only at a separately authorized execution boundary and must never be logged, serialized into evidence, or committed.

## Fixed scope and fail-closed state

- Target product: `one_time_mishnayos`.
- Runtime tier: `production`.
- Verification environment: `production_operator_canary`.
- Required legacy state: exactly one active Admin account under the existing legacy account/product scope and zero or one active legacy session.
- Required create state: zero matching v2.1 AdultIdentity, HumanAccount, credential, Admin membership, Parent membership, family household, adult session, canonical HumanAccount/access transition event, and canonical HumanAccount/access aggregate-state rows.
- Required replay state: the exact six proposal-created identity/account/membership/household/credential rows, the exact two creation transition events, the exact two trigger-created aggregate states, and zero v2.1 sessions.
- Matching covers the protected fixture address, every proposed row/transition/idempotency key, both aggregate keys, and every ownership link. A partial row set, collision in another scope, field mismatch, or ambiguous state fails closed.

## Protected bindings and accepted safeguards

The future authority-bound runner must bind the normalized fixture address; the expected sanitized legacy row, user, and optional session hashes; five exact new row identifiers; the household access reference and seat limit; exact create and compensation timestamps; four exact transition keys; four exact idempotency keys; and separate canonical request hashes for creation and compensation. The household access reference must be `access:` plus the exact household ID, while the canonical access aggregate key is the exact household ID used by the deployed Parent-context join. All values remain in protected process memory and all SQL parameters/results must be redacted.

The password hash is never selected into the runner or evidence. PostgreSQL requires the proven legacy `argon2id` shape and constructs the v2.1 credential by replacing only that nonsecret policy prefix with `argon2id-v1`. Version, parameters, salt, and digest suffix remain byte-for-byte equal and verify the same password. The legacy hash remains byte-for-byte unchanged.

Legacy account, user, and session identifiers are recomputed only inside PostgreSQL under the canonical sanitization domains `legacy_account_user:`, `legacy_user_key:`, and `legacy_session:`. Raw identifiers never leave the database. The immutable legacy account/session fingerprint is also computed inside PostgreSQL and returned only as SHA-256.

## Create protocol

An authorized runner must execute these steps on one connection:

1. Begin a `SERIALIZABLE` transaction and acquire the transaction-scoped advisory lock derived from the protected normalized fixture address.
2. Run the exact readback. Require valid protected bindings; exact legacy cardinality, scope, prefixed identifier hashes, and Argon2id compatibility; available PostgreSQL digest support; and either the exact empty or exact replay state.
3. For exact empty state only, execute six parameterized identity/account/membership/household/credential inserts in dependency order.
4. Insert one append-only `canonical_state_transition_events` row for HumanAccount `null -> active`, version `0 -> 1`, and one for access `null -> free`, version `0 -> 1`, with `access_cause = free_period`. Both use `actor_kind = reconciler`, the declared non-PII actor key, exact protected keys/hash/timestamp, and the fixed product/runtime/environment.
5. Never write `canonical_aggregate_states` directly. The canonical trigger must create exactly one HumanAccount `active` aggregate and one access `free` aggregate.
6. Require eight explicit inserted rows, two trigger-derived aggregate rows, and ten total row effects. An error before commit rolls back all ten and leaves zero committed effects.
7. Read back every exact field, key, version, timestamp, actor, idempotency key, canonical request hash, and trigger-derived state. Require the deployed `findV21AdultLoginIdentity` / `listOwnedHouseholdContexts` ownership join to return exactly the family household with active Admin and Parent memberships.
8. Require unchanged legacy fingerprint/session cardinality, then commit. Any mismatch issues `ROLLBACK`.

| Create effect                                                                           | Maximum |
| --------------------------------------------------------------------------------------- | ------: |
| AdultIdentity, HumanAccount, Admin membership, Parent membership, household, credential |       6 |
| Explicit canonical transition-event inserts                                             |       2 |
| Trigger-derived canonical aggregate-state inserts                                       |       2 |
| Total create row effects                                                                |      10 |
| Legacy, session, Student, customer, provider, send, charge, deployment, or DNS rows     |       0 |

## Idempotent replay

Replay is accepted only when all ten exact creation effects exist and the Parent household is discoverable through the deployed join. The six application rows, two transition events, two aggregate states, product/runtime/environment, protected keys, credential equivalence, and unchanged legacy fingerprint must all match. Replay executes zero statements and causes zero writes. It never attempts partial repair.

## Separately authorized append-only compensation

Post-commit reversal is not a six-delete rollback and requires a separate exact authority. Under a new `SERIALIZABLE` transaction, the same advisory lock, and the exact applied-state preflight, compensation must:

1. Append HumanAccount `active -> archived` and access `free -> inactive` (`access_cause = household_archived`) transitions, both version `1 -> 2`, with exact compensation keys, hashes, actors, scope, and timestamp.
2. Require the trigger to update the HumanAccount aggregate to `archived` and the access aggregate to `inactive`; never directly mutate an aggregate-state row.
3. Exact-delete only the six proposal-created credential, Parent membership, Admin membership, household, HumanAccount, and AdultIdentity rows in reverse dependency order.
4. Require eight explicit affected rows, two trigger-derived aggregate updates, and ten total compensation effects, plus an unchanged legacy fingerprint/session count.
5. Read back the terminal residue: four immutable transition events and two terminal aggregate-state audit rows. Transition events are never updated or deleted, and aggregate history is never rewritten.

The terminal six audit rows deliberately remain. Compensation affects no legacy account/session, Student, customer, provider, send, charge, deployment, or DNS record.

## Authority boundary

These artifacts are inert design evidence only. A later data effect or compensation requires a new C00 authority bound to an exact source/candidate, database service/environment, protected fixture hashes, exact generated IDs and transition keys, row/effect budgets, before/after queries, expiry, lock, and fencing token. Nothing here authorizes database execution or any browser, session, provider, deployment, DNS, send, charge, Customer, or Student effect.
