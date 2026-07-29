# v2.1 Runtime Operations

## Purpose

This runbook covers the protected v2.1 runtime identity, health, alerts, and
leakage-monitoring surfaces. It never authorizes a provider mutation or a
production write.

## Startup identity gate

Every declared process must publish schema `3.0.0` identity containing its exact
candidate `runtime_id`, role, repository SHA, immutable application-source SHA,
role-specific artifact digest, configuration digest, migration-inventory digest,
provider-registry digest, release, canonical build timestamp, migration schema
version, runtime tier, and verification environment.
The candidate declares the complete runtime, queue, worker, and provider
inventory plus the maximum evidence age. Missing, duplicate, extra, malformed,
stale, or unqualified observations fail readiness.

The only valid environment mappings are:

| Verification environment     | Runtime tier       |
| ---------------------------- | ------------------ |
| `ci`                         | `isolated_staging` |
| `provider_sandbox`           | `isolated_staging` |
| `persistent_staging`         | `isolated_staging` |
| `production_read_only`       | `production`       |
| `production_operator_canary` | `production`       |
| `production_broad`           | `production`       |

Missing, unknown, or mismatched identity fails closed. The exact web and worker
cards must agree with the candidate. A source, artifact, configuration,
migration-inventory, provider-registry, release, tier, or environment mismatch
is Sev1. `production_read_only` never authorizes mutation.

## Protected diagnostics

Mount `createOperationsDiagnosticsRouter` only with `authorizeAdmin` backed by
the current server session. It must return the typed exact Admin principal;
anonymous, Parent, Student, stale, or client-asserted roles remain concealed:

- `GET /runtime-identity` reports candidate, web, worker, and agreement.
- `GET /health` reports database, migration, queue, worker, provider, and
  leakage state.
- `GET /alerts` emits safe alerts to `ot_secure_operations` and
  `admin_operations`.

Responses are private, no-store, noindex, and contain no raw exception. Each
response is built from an explicit allowlist and the exact serialized body is
scanned. Any unsafe source or final-body finding yields only the fixed safe 503
envelope. Do not expose these routes publicly or use diagnostics as an
authorization source.

## Health interpretation

Migration history is a nonempty immutable forward-only inventory when required
by the candidate. Its canonical digest must equal the candidate
`migration_inventory_digest`. Negative/duplicate ordinals, invalid names or
SHA-256 values, an unknown applied ordinal, a missing expected migration,
name/checksum drift, stale/unqualified evidence, or failed read-only readback is
Sev1. Do not edit an applied migration; stop traffic and reconcile the exact
release and inventory.

Queue age warning/critical thresholds are:

| Queue class          | Warning | Critical |
| -------------------- | ------: | -------: |
| security delivery    |   2 min |    5 min |
| classroom access     |   1 min |    3 min |
| billing access       |   1 min |    3 min |
| parent reminder      |   5 min |   15 min |
| adult CRM projection |  10 min |   30 min |
| content processing   |  15 min |   30 min |
| approved marketing   |  30 min |   60 min |

Acceptance-unknown work remains quarantined. Dead letters and expired leases
warn. Any credible duplicate external-effect risk is Sev1. Never retry an
acceptance-unknown provider operation until canonical non-acceptance is proven.
Queue evidence also includes exact active-lease count and oldest age, unfenced
lease count, fencing-token high watermark, scheduled/exhausted retries, and
content last-progress time/age. An active lease is stale at the exact
five-minute worker-lease expiry even with valid fencing. Retry count must equal
scheduled plus exhausted retry evidence. Missing fencing, any unfenced or stale
active lease, unmatched retry counts, contradictory content progress, or a
stalled content queue fails readiness.

Worker heartbeat is normal through 60 seconds, warning after 120 seconds, and
critical after 300 seconds. Publication also compares health generation time to
the actual publication clock and rejects stale or future caller-generated
snapshots. A source/configuration mismatch is immediately Sev1.

Provider status is explicit for Resend, GHL, Stripe, Zoom, Vimeo, Drive, and
Telegram. `not_configured` is truthful and must not be replaced by a fake ready
state. A required provider unavailable for 15 minutes is Sev2. Credential expiry
within 14 days warns.

## Leakage incident

Operational payloads must contain only safe references, counts, times, digests,
release, tier, and verification environment. Secrets, authorization/cookies,
bearer/JWT material, card data, database URLs, names, email, phone, Student
private text, and raw Zoom/Vimeo/Drive URLs are prohibited.

Credential-shaped keys, Basic/Bearer/JWT values, secret hashes, signed query
URLs, and secret-bearing `safe_context` or error text are leakage findings in
addition to the protected material above. Raw links for Resend, GHL, Stripe,
Zoom, Vimeo, Drive, and Telegram and common name/address/birth/identifier PII
keys are covered, including street-address, address-line, street-line, and
qualified common-address variants. Any finding is Sev1:

1. Stop distribution of the affected diagnostic and restrict access to the
   secure operations channel.
2. Preserve only the safe finding code, count, time, release, and environment.
   Do not copy the leaked excerpt into a ticket, alert, chat, or evidence file.
3. Rotate or revoke exposed credentials through separately authorized incident
   procedure.
4. Patch the producer and run the scanner over a synthetic payload.
5. Reopen distribution only after a clean scan and operator readback.

## Safe verification

Use isolated staging unless an exact production-read-only observation is
authorized. Compare candidate and runtime cards, perform read-only migration
inventory verification, inspect queue/provider observations, and scan the
serialized diagnostic payload. This runbook does not authorize deployment,
secret access, provider calls, retries, or cleanup.
