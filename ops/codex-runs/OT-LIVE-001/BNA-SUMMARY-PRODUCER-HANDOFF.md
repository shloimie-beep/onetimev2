# OT-LIVE-001 independent BNA sanitized-summary producer

Status: source-only, default-off, zero external effects.

## Ownership and independence

- One Time owns this producer. No BNA module, database, session, cookie, private row, runtime, bot, token, or synchronous availability dependency is imported.
- Source contract: BNA PR #143 handoff commit `19a49c3d3e1d2513972bcc9ef83a4dd58a742d39`.
- One Time source base: `ffd1c55a50c5b16402f3dcbcbef4cb4464edcfb4`.
- Runtime files:
  - `packages/domain/src/bna-control-summary/contract.ts`
  - `packages/domain/src/bna-control-summary/producer.ts`
  - `packages/domain/src/bna-control-summary/bna-control-summary-event-v1.schema.json`
- Tests: `tests/unit/bna-control-summary/producer.test.ts`.

## Configuration handoff

- Feature flag: `BNA_CONTROL_SUMMARY_EVENTS_ENABLED=false` by default.
- Endpoint configuration: `BNA_CONTROL_SUMMARY_ENDPOINT_URL` (HTTPS only; credential-bearing URLs rejected).
- Signing key ID: `BNA_CONTROL_SUMMARY_HMAC_KEY_ID`.
- Separately provisioned signing secret: `BNA_CONTROL_SUMMARY_HMAC_SECRET`.

The producer fails closed if the flag is enabled without the endpoint, key ID, or at least 32-character secret. Configuration values are never logged or copied into evidence.

## Contract and replay proof

- Only the 11 schema event types are accepted.
- Classification is fixed to `sanitized_summary` and the schema rejects additional properties.
- Explicit privacy guards reject notes, messages, transcripts, contact/student fields, credentials, cookies, private fields, contact-like summary text, and sensitive deep-link query keys.
- Deep links must be HTTPS.
- The exact raw UTF-8 JSON body is signed with HMAC-SHA256 and sent with `X-BNA-Summary-Key-Id` and `X-BNA-Summary-Signature`.
- `signed_at` is accepted only inside the fixed 300-second replay window.
- Retries reuse the same delivery plan, raw body, signature, `event_id`, `idempotency_key`, and `source_object_version`.
- Stable identity derivation changes only when an immutable source identity/version input changes.

## Enablement gate

Do not enable either side until BNA supplies the exact HTTPS consumer endpoint and a separately provisioned key ID/secret is present in the approved secret store. A later candidate-bound deployment must preserve One Time standalone availability and verify one operator-controlled replay/duplicate canary before activation.

No provider call, BNA write, deployment, environment mutation, database migration, customer mutation, or message occurred in this source slice.
