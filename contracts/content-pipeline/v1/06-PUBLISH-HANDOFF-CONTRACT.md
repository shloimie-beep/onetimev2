# Authenticated, signed, idempotent BNA → One Time publish handoff

## Transport

The initial transport is an internal HTTPS endpoint owned by One Time:

`POST /internal/content-publications/v1/manifests`

BNA sends the exact UTF-8 JSON bytes validated by `04-CONTENT-PUBLISH-MANIFEST.schema.json`. Publication is asynchronous: the endpoint authenticates, validates, durably stores an inbox receipt and raw body, and returns without rebuilding an index in the request thread.

One Time classroom/library/search/helper requests never call this endpoint and never call BNA.

## Authentication and signature

Use server-side secret material selected by key id:

- `OT86_PUBLISH_SIGNING_KEY_ID`
- `OT86_PUBLISH_SIGNING_SECRET`
- One Time supports a current and previous key during rotation without changing message semantics.

Required headers:

- `Content-Type: application/json`
- `X-OT86-Key-Id`: configured key id
- `X-OT86-Timestamp`: Unix epoch seconds in ASCII
- `X-OT86-Delivery-Id`: exactly the manifest `message_id`
- `X-OT86-Signature`: `v1=` followed by lowercase hexadecimal HMAC-SHA256

The signing input is the byte concatenation:

```text
ASCII(X-OT86-Timestamp) + "." + exact raw UTF-8 request body bytes
```

Reject unknown key ids, malformed signatures, non-constant-time comparisons, timestamps outside a 300-second window, delivery-id/body mismatch, invalid JSON, invalid schema, and manifest checksum mismatch. Never log the signing secret or full signature.

`manifest_sha256` is the lowercase SHA-256 of canonical JSON using RFC 8785 JSON Canonicalization Scheme after removing the `manifest_sha256` member. Runtime validation must recompute it.

## Durable receipt and response semantics

Before acknowledging, One Time stores atomically:

- delivery/message id;
- idempotency key;
- tenant/content/version ids and sequence;
- key id;
- raw-body SHA-256;
- received time;
- validation result;
- processing state.

Responses:

- `202 Accepted`: new valid delivery durably recorded for async application.
- `200 OK`: identical replay already recorded or applied; response identifies it as duplicate without leaking data.
- `400 Bad Request`: malformed JSON or required header.
- `401 Unauthorized`: unknown key id, stale timestamp, or invalid signature.
- `409 Conflict`: same delivery id/idempotency key/sequence reused with different bytes or incompatible action.
- `422 Unprocessable Entity`: schema, checksum, transition, approval, or privacy contract invalid.
- `503 Service Unavailable`: durable inbox storage unavailable; BNA retries with the same identifiers and bytes.

Do not return `202` before durable inbox persistence.

## Application semantics

A background worker applies messages transactionally:

- `publish`: create or activate the local immutable version, sections, artifact references, and index documents.
- `correct`: create/activate the replacement, mark the superseded version inactive/corrected, replace index documents, and invalidate caches atomically.
- `revoke`: make the specified version unavailable immediately, remove it from active search, invalidate caches, and retain an audit tombstone.
- `retire`: retire the content aggregate from library/search while retaining audit and version lineage.

Enforce strictly increasing sequence per `(tenant_id, content_id)`. An out-of-order future sequence waits; a stale sequence is an idempotent no-op only when its bytes match an already applied message. No action may expose a version whose approval/privacy data is absent or invalid.

## BNA outbox and retries

BNA writes publication intent and outbox event in the same transaction as the approved-version state change. Delivery uses stable message bytes and exponential backoff with jitter. Authentication, schema, privacy, and conflict responses are non-transient and require operator review; network and `503` failures are retryable.

## One Time independence test

With BNA network access blocked, One Time must still serve already published classroom pages, library pages, deep links, and authorized retrieval from local data. Publishing new changes may queue, but serving existing data may not degrade into a BNA dependency or BNA UI shell load.
