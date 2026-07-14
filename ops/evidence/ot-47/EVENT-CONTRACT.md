# OT-47 Event Contract

Status: blocked before implementation by `STOP_REAL_POSTGRESQL_UNAVAILABLE`.

## Intended Contract

- Route hook: `createContentOutcomeIngestRouter(dependencies)`
- HTTP route after integration: `POST /api/internal/v1/content-events`
- Initial event type: `one_time.content_outcome.v1`
- Default state: route absent or 404 while the ingest flag is off
- Source scope: server-derived One Time account/product only
- Provider readiness: `NOT_PROVEN`

## Required Security Shape

The future route must validate a bounded versioned envelope, reject prohibited
secret/raw provider fields at any nested level, verify HMAC-SHA-256 signatures
over the exact raw request body digest, enforce timestamp skew, reject unknown
key IDs, detect replay/conflicts in PostgreSQL, and return privacy-safe errors.

## Not Implemented

No route, signature verifier, keyring, event table, worker claim, or event
application logic was implemented because real PostgreSQL proof is unavailable.
