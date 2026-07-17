# Vimeo provider adapter, readiness, replay, and canary contract

## Server-only configuration

Recognized environment variable names are:

- `VIMEO_ACCESS_TOKEN`
- `VIMEO_CLIENT_ID`
- `VIMEO_CLIENT_SECRET`
- `VIMEO_WEBHOOK_SECRET`
- `VIMEO_ACCOUNT_ID`
- `OT86_ALLOW_VIMEO_CANARY_UPLOAD`

Values remain in the deployment secret store. No value may appear in client code, committed environment files, fixtures, logs, exception messages, telemetry attributes, snapshots, reports, or command output. Provider errors are mapped to sanitized internal codes.

## Adapter boundary

Implement a narrow server interface with repository-native types equivalent to:

- `readiness()` — returns `unconfigured`, `auth_invalid`, `permission_missing`, `ready`, or `degraded`, with safe reason codes.
- `beginUpload(ingest)` — creates/reuses a resumable upload ticket with a stable idempotency key.
- `reconcileUpload(providerUploadId)` — reports normalized upload state and Vimeo video id.
- `getVideo(videoId)` — retrieves safe metadata needed for processing.
- `validateManualReference(videoIdOrUrl)` — validates account/visibility/ownership without claiming an upload occurred.
- `verifyWebhook(headers, rawBody)` — authenticates the exact raw bytes.
- `normalizeWebhook(headers, rawBody)` — returns a typed internal event only after verification.

No controller, job, or UI calls Vimeo directly outside this adapter.

## Webhook and poller convergence

- Store a provider webhook receipt before dispatch using `(provider, provider_event_id)` and raw-body SHA-256.
- Reject the same provider event id with different bytes.
- Poller observations and webhook events normalize to the same internal event type and processing idempotency key.
- A late webhook after a successful poll is a no-op with audit evidence.
- A transient webhook handler failure is replayable from the stored receipt.
- Signature failure, account mismatch, and unknown video id are not retried as trusted events.

## Manual approved Vimeo reference

The manual path is a first-class fallback:

1. Authorized operator enters a Vimeo id or canonical URL.
2. Adapter validates format and, when credentials permit, account access and video metadata.
3. Operator confirms source provenance and that the reference is approved for this content item.
4. Store `reference_mode=manual_approved_reference`, actor id, time, validation result, and audit reason.
5. Continue at `transcribing` only after validation/approval.

Never emit an automated-upload success event for this path. If live validation is unavailable, keep the record in a readiness/review state rather than pretending the reference is verified.

## Fixtures and tests

Provide deterministic fixtures for upload-created, upload-complete, processing, webhook replay, invalid signature, permission denied, rate limit, missing video, and manual-reference paths. Tests must prove that tokens and webhook secrets do not appear in logs even when the provider client throws a response containing request headers.

## Canary entry point

Create executable `bin/ot86-vimeo-canary` with:

- `--mode read-only`: validates configuration presence, authenticates, confirms account identity and required read/upload/webhook capabilities, performs no write, prints only safe capability names and statuses.
- `--mode upload-private-fixture`: requires `OT86_ALLOW_VIMEO_CANARY_UPLOAD=1`, uploads a generated non-sensitive private fixture through the adapter, verifies reconciliation, and records the created provider id for authorized cleanup. It exits before writing when the gate is absent.

The command must support a machine-readable JSON result option, redact all provider data not required for readiness, and exit nonzero for missing configuration, auth failure, permission failure, or inconclusive capability.

## Required checkpoint

When any required credential, webhook secret, account id, or permission is unavailable, write exactly:

```text
READY_FOR_VIMEO_CANARY
```

to `ops/codex-runs/OT-86A/CHECKPOINT`, with one trailing newline. The checkpoint means implementation and offline verification are complete; it does not mean Vimeo is working live.
