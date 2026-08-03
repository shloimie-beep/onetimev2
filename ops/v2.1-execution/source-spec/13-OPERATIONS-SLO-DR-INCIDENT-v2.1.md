# One Time Mishnayos — Operations, SLO, Disaster Recovery, and Incident Contract

**Package:** `ONE-TIME-PRODUCTION-SPEC-v2.1`  
**Document:** `13-OPERATIONS-SLO-DR-INCIDENT-v2.1.md`  
**Status:** Normative source of truth  
**Effective date:** 2026-07-28  
**Repository reviewed:** `shloimie-beep/onetimev2`  
**Reviewed head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`

## Normative package references

This contract is interpreted with:

- `01-PRODUCT-SPEC-v2.1.md`;
- `02-ACCEPTANCE-CONTRACT-v2.1.yaml`;
- `03-DECISION-REGISTER-v2.1.md`;
- `04-SUPERSESSION-AND-SYSTEM-DISPOSITION-v2.1.md`;
- `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`;
- `10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`;
- `11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml`;
- `12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md`;
- `14-TRACEABILITY-CROSSWALK-v2.1.yaml`.

## 1. Purpose

This contract defines measurable production reliability, monitoring, backup, restore, disaster recovery, deployment safety, incident classification, and response expectations for One Time v2.1.

All time thresholds are measured continuously. `Asia/Jerusalem` is used for operator schedules; service measurements and incident evidence use UTC.

## 2. Service boundaries and critical journeys

### OPS-001 — production services

The production service includes:

- public marketing/signup routes owned by One Time;
- authenticated Admin, Parent, and Student web/API;
- PostgreSQL;
- the transactional outbox and workers;
- class occurrence and embedded Zoom authorization;
- direct-upload and Drive content intake;
- content processing and Vimeo publication;
- Resend account-security delivery;
- HighLevel adult CRM and campaign projections;
- Stripe/GHL billing-event intake and current access projection;
- Telegram internal operational notification.

### OPS-002 — critical journeys

The highest-priority journeys are:

1. Admin, Parent, and Student authentication.
2. Student classroom authorization and join during an open occurrence.
3. Parent billing/reactivation access.
4. Correct household, Student, and role isolation.
5. Account setup and password recovery.
6. Signed billing-event processing and access correctness.
7. Admin visibility into provider, queue, backup, and incident health.

Content processing and marketing are important asynchronous services, but they may be paused without weakening authentication, authorization, classroom, billing recovery, or data integrity.

### OPS-003 — runtime tier and verification environment

`runtime_tier` and `verification_environment_id` are separate mandatory runtime fields. They are not synonyms and neither may be inferred from a hostname, branch name, provider mode, or the other field.

| `verification_environment_id` | Required `runtime_tier` |
|---|---|
| `ci` | `isolated_staging` |
| `provider_sandbox` | `isolated_staging` |
| `persistent_staging` | `isolated_staging` |
| `production_read_only` | `production` |
| `production_operator_canary` | `production` |
| `production_broad` | `production` |

The six `verification_environment_id` values and their effect permissions are defined by `11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml`. The only permitted `runtime_tier` values are `isolated_staging` and `production`.

Every web process, worker, migration process, scheduled process, webhook receiver, job, audit event, operational metric, alert, provider operation, acceptance artifact, and change record must carry both values. Process startup fails closed when either value is absent, unknown, or does not match the table. Provider effects remain disabled when processes disagree about either value. `production_read_only` remains mutation-free even though its runtime tier is `production`; the runtime tier never grants an effect permission.

## 3. Availability and latency objectives

### OPS-010 — monthly availability

Measured over a rolling calendar month:

| Surface | SLO |
|---|---:|
| Public home/signup GET routes | 99.9% successful availability |
| Authenticated application/API reads | 99.9% successful availability |
| Authentication and session validation | 99.9% successful availability |
| Authorized classroom-launch endpoint during scheduled class windows | 99.95% successful availability |
| Parent billing/reactivation shell | 99.9% successful availability |
| Admin Operations health/readback | 99.9% successful availability |

A dependency/provider outage counts against the user-visible journey even when One Time is not the root cause. Provider attribution is recorded separately.

### OPS-011 — request latency

Under the launch capacity envelope:

| Operation | Objective |
|---|---:|
| Cached/public page server response | p95 ≤ 500 ms |
| Authenticated read API | p95 ≤ 750 ms; p99 ≤ 2,000 ms |
| Local transactional mutation before async provider work | p95 ≤ 1,500 ms; p99 ≤ 3,000 ms |
| Login/session validation | p95 ≤ 1,000 ms |
| Classroom authorization response, excluding Zoom client/provider loading | p95 ≤ 1,500 ms; p99 ≤ 3,000 ms |
| Admin search first page | p95 ≤ 1,000 ms |

### OPS-012 — browser experience

At the supported production viewports and browsers:

- largest contentful paint is p75 ≤ 2.5 seconds on representative mobile broadband;
- cumulative layout shift is p75 ≤ 0.10;
- interaction to next paint is p75 ≤ 200 ms;
- no horizontal page overflow occurs at 360 CSS pixels;
- critical login, Join Class, billing recovery, and support actions remain usable when nonessential provider status is degraded.

### OPS-013 — error budget

A 99.9% monthly SLO provides no more than 43 minutes and 50 seconds of unavailable time in a 30-day month. The 99.95% classroom objective provides no more than 21 minutes and 55 seconds over the same interval.

- If 50% of a monthly error budget is consumed within seven days, nonessential releases pause.
- If 75% is consumed within the month, only reliability, security, data-integrity, and operator-approved critical fixes may deploy.
- At 100%, feature deployment freezes until the service remains within objective for seven continuous days and the causal incident actions are accepted.

Planned maintenance is excluded only when announced at least 48 hours ahead, lasts no more than 30 minutes, and does not occur Sunday–Thursday from 18:00–20:30 Jerusalem time. Emergency security maintenance is recorded as incident time, not excluded.

## 4. Capacity envelope

### OPS-020 — minimum proven launch capacity

The release candidate must sustain, without breaching the latency objectives:

- 100 concurrent authenticated Student sessions;
- a burst of 50 Student classroom-authorizations within five minutes;
- 25 concurrent Parent sessions;
- 10 concurrent Admin sessions;
- 20 local mutations per second for 60 seconds with idempotent retry;
- one 5 GiB direct upload while two content-processing jobs run;
- 1,000 queued non-marketing transactional intents without loss or duplicate external effect.

The capacity test uses isolated or provider-sink execution. It does not send 1,000 real messages or create real provider resources.

### OPS-021 — saturation behavior

When capacity is exceeded:

- authorization and billing correctness are preserved;
- mutations reject or queue truthfully rather than partially committing;
- external effects remain idempotent;
- class-launch, authentication, and billing-recovery work has priority over content and marketing;
- the Admin sees saturation, queue age, and recovery state;
- no unbounded in-memory queue is used.

## 5. Worker, queue, and asynchronous objectives

### OPS-030 — worker heartbeat

- Normal worker heartbeat age: ≤ 60 seconds.
- Warning: heartbeat age > 120 seconds.
- Critical: heartbeat age > 300 seconds.
- Web and worker source/configuration disagreement is immediately critical.

### OPS-031 — queue objectives

| Queue class | Warning oldest age | Critical oldest age |
|---|---:|---:|
| Account setup, reset, security notice | > 2 minutes | > 5 minutes |
| Classroom/access projection | > 1 minute | > 3 minutes |
| Billing/access events | > 1 minute | > 3 minutes |
| Parent service reminders | > 5 minutes | > 15 minutes |
| Adult CRM projection | > 10 minutes | > 30 minutes |
| Content processing | No progress for > 15 minutes | No progress for > 30 minutes |
| Approved marketing execution | > 30 minutes | > 60 minutes |

Queue depth alone does not declare failure; age, lease health, retry state, and throughput determine severity.

### OPS-032 — delivery state

Every provider operation durably distinguishes:

- not started;
- leased/in flight;
- accepted;
- rejected;
- acceptance unknown;
- reconciled;
- dead letter.

Acceptance-unknown operations are quarantined until provider readback establishes whether the effect occurred. They are never retried with a new identity.

### OPS-033 — content pipeline timing

For a valid source within the 5 GiB limit:

- upload receipt/checksum confirmation occurs within five minutes of completed transfer;
- validation begins within five minutes;
- a processing job reports durable progress at least every five minutes;
- a normal recording reaches Admin review within the greater of three hours or twice the recording duration plus 30 minutes;
- provider or processor failure reaches visible retry/dead-letter state within five minutes of detection.

These are processing objectives, not permission to publish without Admin approval.

### OPS-034 — leases, heartbeats, fencing, and retry

All outbox, provider, projection, reconciliation, scheduled, and content jobs use the following single operational contract:

- A lease lasts exactly five minutes from acquisition or the last successful renewal.
- The active worker renews its lease every 60 seconds while work continues.
- Every acquisition receives a monotonically increasing fencing token. A worker whose lease expired or whose fencing token is no longer current cannot commit a state transition, checkpoint, provider result, or completion.
- A worker that cannot renew stops starting new work and stops before its current lease expires. A remote request timeout must remain below the lease safety margin and must never be allowed to outlive the lease; provider-specific connect and request timeout values are registry-controlled.
- A crash or expired lease makes the job eligible for fenced reacquisition. Reacquisition continues from the last durable checkpoint and does not create a new logical effect or idempotency key.
- A retryable logical operation receives at most eight dispatch attempts in total, including the first attempt.
- After failed attempt `n`, where `n` is 1 through 7, the retry delay is full jitter sampled uniformly from zero through `min(30 minutes, 30 seconds × 2^(n-1))`. The corresponding delay ceilings are 30 seconds, 60 seconds, 2 minutes, 4 minutes, 8 minutes, 16 minutes, and 30 minutes.
- A valid provider `Retry-After` is also honored as a not-before constraint. It does not authorize a ninth attempt.
- Exhaustion of the eighth attempt enters `dead_letter`, emits an Admin-visible case, and cannot be reset by manufacturing a new operation identity.
- A permanent rejection enters `rejected` without blind retry. A configuration, account, environment, credential, consent, or suppression failure remains provider-off or suppressed until its prerequisite is repaired.
- `acceptance_unknown` is quarantined immediately. It receives no blind dispatch retry; only provider readback or a signed canonical provider event may move it to reconciled success, reconciled failure, or an explicitly authorized same-identity retry.

Attempt count, next eligible time, lease owner, lease expiry, fencing token, last durable checkpoint, last safe error code, and idempotency identity are durable state. Process-local memory is never their source of truth.

### OPS-035 — webhook ingress limits and durability

Every provider webhook endpoint enforces:

- a maximum raw request body of exactly 2 MiB; larger bodies are rejected before parsing;
- the exact endpoint content type registered for that provider, with JSON event endpoints accepting `application/json` and an optional UTF-8 charset only;
- signature verification over the unchanged raw bytes;
- a signature timestamp tolerance of exactly five minutes in either direction, using a synchronized server clock;
- exact provider account, event mode, `runtime_tier`, and `verification_environment_id` agreement;
- durable recording of provider event ID, raw-body SHA-256 digest, verified account/mode, receipt time, and minimized parsed fields before a success acknowledgment;
- idempotent success for a repeated event ID with the same digest and quarantine plus a security alert for a repeated event ID with a different digest;
- no business mutation in the ingress request beyond durable receipt and duplicate/quarantine classification.

Malformed, oversized, stale, wrong-signature, wrong-account, wrong-mode, or wrong-environment requests are rejected without durable business effects. The unrestricted raw body is held only long enough to verify, digest, and minimize it; it is not retained as an operational log. Business processing occurs asynchronously under OPS-034.

## 6. Monitoring and alerts

### OPS-040 — required telemetry

Operations telemetry includes:

- public health and protected readiness;
- exact release, image, semantic source, configuration, migration identity, `runtime_tier`, and `verification_environment_id`;
- web/worker agreement;
- database availability, connections, locks, latency, storage, and migration drift;
- authentication successes/failures, session revocation, and rate limiting;
- API latency/error rate by critical journey;
- queue depth, oldest age, lease age, retries, acceptance-unknown, and dead letters;
- signup and identity-review outcomes;
- billing-event signature, replay, reconciliation, and access-projection failures;
- classroom authorization and provider launch outcomes;
- content intake/processing progress;
- provider availability and credential validity;
- backup age, PostgreSQL archive-lag/RPO health, uploaded-original receipt-journal health, purge-ledger primary/replica health, and restore-proof age;
- redacted incident and audit events.

### OPS-041 — immediate Sev-1 alerts

Any one of the following pages both Admins immediately:

- cross-household, sibling, workspace, or role data exposure;
- raw credential, setup/reset token, child private data, Zoom URL, Vimeo URL, or secret leakage;
- unintended charge, refund, customer send, workflow enrollment, provider deletion, or publication;
- production database unavailable for two consecutive one-minute probes;
- public/authenticated application unavailable for two consecutive one-minute probes;
- web and worker artifact/config mismatch;
- a missing, unknown, mismatched, or forbidden `runtime_tier`/`verification_environment_id` pair;
- applied migration checksum drift or an unknown applied migration;
- evidence that a queue can duplicate a financial, communication, or provider effect;
- Student access granted while the household is inactive or the Student is archived;
- backup recovery path known to be unusable;
- a completed deletion or accepted upload whose required independent recovery-journal record cannot be read back.

### OPS-042 — Sev-2 alerts

A Sev-2 alert is created when:

- 5xx responses exceed 5% for five minutes;
- 5xx responses exceed 1% for 15 minutes;
- p95 latency exceeds twice its objective for 15 minutes;
- a critical queue-age threshold is crossed;
- worker heartbeat exceeds 300 seconds;
- a required provider is unavailable for 15 minutes;
- password setup/reset accepted delivery falls below 95% over 15 minutes;
- classroom authorization success falls below 99% during a class window;
- database storage exceeds 85%, connection utilization exceeds 85% for ten minutes, or blocking locks exceed 60 seconds;
- current backup age exceeds 24 hours;
- PostgreSQL point-in-time archive lag exceeds 15 minutes;
- purge-ledger cross-region replication has not completed within 15 minutes;
- restore proof is outside its required freshness window.

### OPS-043 — warning alerts

Warnings are created for:

- warning queue or heartbeat thresholds;
- provider credential expiry within 14 days;
- database storage above 70%;
- backup age above 18 hours;
- PostgreSQL point-in-time archive lag above five minutes;
- dead-letter count above zero;
- acceptance-unknown provider state above zero;
- identity-review item older than 24 hours;
- one SLO consuming 25% of its monthly budget within seven days.

Warnings become Sev-2 when they exceed the associated critical threshold or affect a critical journey.

### OPS-044 — alert routing

- Shloimie is the primary operational incident owner.
- Rabbi Eli receives all Sev-1 alerts and every live-class/content incident affecting teaching.
- Sev-1 and Sev-2 alerts route through the secure `OT` operations channel and in-app Admin Operations.
- Student questions do not enter the operations alert channel.
- Alerts contain safe record references, counts, time, environment, and deep links; they contain no secrets, raw provider URLs, password/reset values, or unnecessary child data.

## 7. Logging, audit, and evidence

### OPS-050 — log rules

Application and worker logs:

- use structured event names and correlation IDs;
- identify `runtime_tier`, `verification_environment_id`, and release;
- redact passwords, tokens, cookies, email setup/reset links, raw Zoom/Vimeo destinations, and provider secrets;
- minimize names, emails, phone numbers, and Student text;
- never log card data;
- distinguish local commit from provider acceptance;
- record idempotency identity only in a non-secret safe form.

### OPS-051 — retention

- Detailed operational logs are retained for 30 days.
- Security and material mutation audit events are retained according to the privacy/data-governance contract and never less than 12 months unless deletion lawfully requires otherwise.
- Aggregated non-PII reliability metrics are retained for 13 months.
- Browser traces and screenshots containing real accounts are sanitized before retention.
- Incident artifacts inherit the most restrictive retention of the data they contain.

### OPS-052 — production evidence

Production evidence records:

- exact candidate/source/configuration;
- UTC timestamp, `runtime_tier`, and `verification_environment_id`;
- actor class and sanitized fixture reference;
- action and expected result;
- actual result;
- provider/database readback;
- forbidden-effect counters;
- cleanup result;
- evidence checksum.

Evidence never includes a live credential, token, raw child-private content, or raw provider destination.

## 8. Backup objectives

### OPS-060 — database protection

Production PostgreSQL has:

- point-in-time recovery with an RPO of 15 minutes or less;
- an encrypted daily backup;
- an encrypted pre-deploy backup/restore point before every schema or migration change;
- 35-day backup retention;
- backup storage isolated from the running application credentials;
- automated backup-success and age monitoring.

Write-ahead-log/archive lag is measured independently from daily-backup age. Lag above five minutes warns and lag above 15 minutes is Sev-2. A daily backup does not satisfy the 15-minute RPO when the point-in-time archive stream is unhealthy.

### OPS-061 — backup acceptance

A backup is accepted only when it records:

- exact source database;
- creation and completion timestamps;
- encryption state;
- schema and migration fingerprint;
- aggregate row-count fingerprint;
- object/checksum verification;
- retention expiry;
- restore procedure/version.

A provider “backup completed” status without integrity metadata is insufficient.

### OPS-062 — uploaded originals

The managed original store is AWS S3 in `eu-central-1`, using S3 Standard multi-AZ storage. Its logical production resource is `content-originals-production` and it must have:

- all four S3 Block Public Access controls enabled at both account and bucket level;
- Object Ownership set to bucket-owner-enforced with ACLs disabled;
- versioning enabled;
- default and policy-enforced SSE-KMS encryption with a customer-managed production key dedicated to One Time content originals;
- bucket-policy denial of public access, non-TLS requests, unencrypted writes, writes using the wrong KMS key, and access from any identity outside the approved upload, processing, retention, recovery, and audit roles;
- opaque object keys that contain no name, email, username, phone number, question/support text, or other customer-supplied label;
- no static public URL, public object policy, public ACL, or cross-product credential;
- lifecycle abortion of incomplete multipart uploads after 24 hours;
- retention-class tags and governed deletion jobs that enforce the exact source/draft/published/superseded/erasure periods in PCR-012; no blanket noncurrent-version or delete-marker rule may delete a retained published original early.

Governed deletion enumerates every object version and delete marker for the target, aborts incomplete multipart residue, verifies deletion/readback, and records provider reconciliation. Writing only a delete marker is not deletion. A scoped legal hold may delay only its named subject/category and must follow PCR-012.

Direct application uploads larger than 100 MiB use S3 multipart upload with 64 MiB parts except the final part. Each part is checksum-protected, the completed object is bound to the canonical full-source SHA-256, and a 5 GiB upload is never buffered in full by web or worker memory. A direct upload is confirmed only after:

1. S3 completes the multipart upload;
2. a protected readback verifies bucket, key, object version ID, byte count, checksum, storage class, and the required KMS key;
3. an immutable upload-receipt record is written to and read back from the recovery journal defined in OPS-063;
4. one database transaction stores the same object version/checksum and changes the upload intent to confirmed.

The user receives no confirmed-receipt response before all four steps succeed. An object whose S3 completion succeeded but whose journal or database commit failed remains an inaccessible orphan under its upload intent; reconciliation either completes the same confirmation or deletes it under retention policy. The product never confirms durable receipt while the only copy is a browser, worker-local temporary file, uncompleted multipart upload, or Drive source.

A Drive-ingested source is copied into this same managed original store and passes the same checksum/readback/journal confirmation before the Drive source may be moved, deleted, or treated as the sole recoverable source.

### OPS-063 — confirmed-upload recovery journal

The confirmed-upload recovery journal is outside PostgreSQL and its backup chain. Its logical resource is the separate `content-upload-receipts-production` bucket using S3 Standard multi-AZ storage in `eu-central-1`, versioning, Block Public Access, bucket-owner-enforced ownership, and SSE-KMS with a dedicated customer-managed key. Its writer can create a unique immutable receipt object but cannot overwrite or delete one. Each receipt contains only opaque internal identifiers and the minimum fields required to recover a confirmed object mapping: receipt ID, upload-intent ID, safe household/content identifiers, bucket/key reference, S3 object version ID, byte count, canonical SHA-256, KMS-key identifier, confirmation UTC time, `runtime_tier`, `verification_environment_id`, and release/configuration digest.

Receipt objects are read back before upload confirmation. Reconciliation compares the journal with database upload intents and S3 object-version readback. Under ordinary retention, a receipt remains for the life of the original plus 35 days, then expires with the same authorized retention outcome. Verified erasure deletes an eligible subject-correlatable receipt within 30 days after the governed original/object purge and reconciliation are proven; the independent hash-only purge ledger, not the receipt, preserves erasure evidence. Receipt-journal durability is part of the zero-RPO confirmed-object claim; ordinary PostgreSQL metadata remains subject to the 15-minute database RPO.

### OPS-064 — independent deletion and purge ledger

Deletion, anonymization, consent-withdrawal redaction, and provider-purge tombstones that must survive database restore are recorded in an append-only purge ledger outside PostgreSQL, its snapshots, and the application AWS account.

The ledger uses a dedicated security-account S3 bucket in `eu-central-1` with versioning, SSE-KMS under a dedicated ledger key, S3 Object Lock in compliance mode with seven-year default retention, Block Public Access, bucket-owner-enforced ownership, and an append-only unique-object writer. S3 cross-region replication copies every protected version to a separately administered `eu-west-1` bucket with versioning, SSE-KMS, Object Lock, and the same remaining retention. The application runtime has no delete, overwrite, retention-shortening, bucket-policy, replication, or ledger-read authority. Restore has a separately approved read role.

Ledger records contain no names, usernames, emails, phone numbers, question/support text, media, raw provider IDs, or object paths. Subject, household, Student, record, provider-reference, and object-key identifiers are represented only as HMAC-SHA-256 values made with the dedicated purge-ledger HMAC key and its recorded key version. The key is retained and access-controlled for at least the ledger retention period so restored identifiers can be compared. Each immutable canonical record contains:

- random ledger event ID and UTC time;
- deletion/request audit digest;
- policy and consent version;
- one or more HMAC identifier/scope pairs;
- required disposition (`delete`, `anonymize`, `suppress`, `unpublish`, or `block_recreation`);
- effective time and legal-hold state;
- source `runtime_tier`, `verification_environment_id`, release, and configuration digest;
- record SHA-256 and prior related event digest where applicable.

A destructive data-rights operation is not marked completed until the primary Object-Lock version and its cross-region replica are read back and verified. Replication incomplete after 15 minutes is Sev-2 and pauses completion; it never permits an unledgered purge. Minimal suppression tombstones may also remain in the canonical store as required by `10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`, but they do not replace this independent recovery control.

## 9. Recovery objectives and restore drills

### OPS-070 — recovery objectives

| Recovery scope | RPO | RTO |
|---|---:|---:|
| PostgreSQL account/access/class data | ≤ 15 minutes | ≤ 30 minutes |
| Authentication/classroom authorization service | Same committed database state | ≤ 30 minutes |
| Configuration and application source | 0; immutable Git/artifact history | ≤ 30 minutes |
| Transactional outbox state | ≤ 15 minutes | ≤ 30 minutes |
| Durable uploaded-original bytes and confirmed-upload receipt after product confirmation | 0 confirmed objects | ≤ 30 minutes when AWS S3 `eu-central-1` is available |
| Independent purge-ledger event after deletion completion | 0 completed events in primary and cross-region copies | ≤ 30 minutes to load and apply before restored traffic |
| Reconstructable private Vimeo projection | ≤ 15 minutes of accepted projection state; source original retained | ≤ 30 minutes to restore One Time projection capability, excluding an independently unavailable Vimeo service |
| Marketing and noncritical content job state | ≤ 15 minutes | ≤ 30 minutes to restore durable queue processing |

The 30-minute service RTO applies to an application, deployment, worker, or database recovery in which the managed AWS regional object service remains available. A total `eu-central-1` S3 regional outage is a provider outage under OPS-090: confirmed objects retain the zero-data-loss objective under S3 regional durability, but restoration of upload/content access has a provider-dependent RTO and the product must report it as degraded rather than falsely claim the internal 30-minute RTO. The independently replicated purge ledger remains available from `eu-west-1`.

### OPS-071 — restore drill frequency

A full isolated restore drill occurs:

- before first broad production launch;
- before first paid-conversion activation;
- at least once every calendar quarter;
- after a material database, backup-provider, encryption, or migration-process change.

Restore evidence remains valid for 90 days unless a material change invalidates it.

### OPS-072 — restore drill proof

The isolated restore must prove:

- backup decrypts and restores;
- migration ledger and checksums match;
- aggregate row fingerprints reconcile;
- both Admin identities exist with correct role but no production session is reused;
- household and Student isolation queries pass;
- free/active/grace/inactive access projections reconcile;
- one class, content item, audit event, and outbox record read correctly;
- the confirmed-upload recovery journal reconciles against restored upload intents and exact S3 object versions without exposing an orphan;
- the independent purge ledger loads from an approved read identity, verifies Object-Lock/version/checksum/replication evidence, and is applied before any application traffic or provider-effect worker starts;
- a seeded record deleted after the selected database restore point does not reappear in account/profile, private question/support, search/index, content mapping, notification, session, outbox, or provider-recreation state after purge-ledger replay;
- provider effects remain disabled;
- measured RPO and RTO meet the table;
- the restore target is destroyed or sanitized after evidence capture under exact authorization.

The drill records the database recovery point, latest confirmed-upload receipt time, latest primary and replicated purge-ledger event times, replay counts, deletion proof, application-ready time, and provider-effects-disabled proof. An RTO measurement ends only after purge replay and all required verification complete; it does not end when PostgreSQL merely starts.

### OPS-073 — failed restore drill

A failed or expired restore drill blocks:

- schema-changing deployment;
- production cutover;
- broad customer migration;
- paid-conversion activation.

Ordinary read-only operation may continue while remediation proceeds if current production data is not at immediate risk.

### OPS-074 — restore traffic gate and tombstone replay

Every restore starts with customer traffic, scheduler dispatch, webhooks, outbox dispatch, provider mutations, publishing, and outbound communications disabled. The recovery operator must:

1. restore the selected PostgreSQL point and verify migrations;
2. load and integrity-check the independent purge ledger through the approved recovery role;
3. replay all applicable ledger records, including records later than the selected restore point;
4. recompute HMAC identifiers for restored rows and remove, anonymize, suppress, unpublish, or block recreation according to every matching scope;
5. revoke restored sessions/grants and remove pending sends, publications, provider creates, search documents, and outbox work for deleted subjects;
6. reconcile confirmed-upload receipts and quarantine unmatched journal/object/database states;
7. run negative queries across every affected aggregate, index, cache, queue, and object mapping;
8. prove that no deleted record is reachable and no provider recreation can dispatch;
9. record signed recovery evidence;
10. enable read traffic, then mutation traffic, and finally bounded provider effects only after explicit recovery approval.

If the purge ledger is unavailable, fails integrity/replication verification, cannot be fully replayed, or any deleted-data negative proof fails, the restored system remains traffic-off. An operator may not waive this gate to meet the RTO.

## 10. Deployment and rollback operations

### OPS-080 — immutable deployment

Production web and worker use the same immutable application image or provably identical build output. Each exposes protected readback of:

- semantic application SHA;
- artifact digest;
- configuration digest;
- migration/schema version;
- build timestamp;
- `runtime_tier`;
- `verification_environment_id`.

### OPS-081 — deployment gates

Every production deployment requires:

- exact approved candidate;
- complete automated suite;
- security, accessibility, migration, concurrency, and browser gates;
- current backup and restore proof;
- a recorded migration-compatible rollback artifact;
- provider-effect scope;
- stop conditions;
- post-deploy verification;
- explicit production authority.

### OPS-082 — migration safety

- Migrations are forward-only and checksummed.
- One process applies migrations under an exclusive advisory lock.
- Other processes verify read-only.
- Application changes remain backward compatible for at least one recorded rollback artifact whenever a migration is deployed.
- A migration that removes or rewrites required data uses an expand/migrate/contract sequence across separate releases.

### OPS-083 — deployment observation

After deployment:

- automated probes run immediately;
- one bounded operator journey runs before broad effects;
- critical metrics are observed for at least 60 minutes;
- the prior artifact remains deployable throughout the observation period;
- no nonessential second deployment obscures the result.

### OPS-084 — customer-policy approval gate

The following exact customer-policy files form the v2.1 legal-policy bundle:

1. `legal/terms-of-service.html`;
2. `legal/privacy-notice.html`;
3. `legal/student-data-and-recording-consent.html`;
4. `legal/cancellation-policy.html`;
5. `legal/refund-policy.html`.

`legal/legal-policy-manifest.json` is the external approval record and sixth required artifact. It must contain:

- bundle and schema version;
- the exact path and lowercase 64-character SHA-256 of each of the five files;
- the deployed route and exact rendered-document digest for each file;
- an immutable policy version, effective date, and superseded-version relationship;
- `product_owner_full_name`, `product_owner_approved_at`, and the five approved hashes;
- `qualified_legal_reviewer_full_name`, `qualified_legal_reviewer_credential_or_firm`, `legal_approved_at`, review scope covering all five files and their runtime presentation, and the same five hashes;
- repository SHA, application-content SHA, and release/configuration digest.

The release manifest and acceptance evidence each record the lowercase 64-character SHA-256 of the exact `legal-policy-manifest.json` bytes. The release candidate, rendered routes, consent records, and approval manifest must all read back the same policy-file hashes. Any missing artifact, empty person name, role label without a person, placeholder text, stale or mismatched hash, unsigned substitution, rendered-content mismatch, missing reviewer credential/firm, expired/superseded approval, or approval that does not cover all five exact files fails closed.

This is an external `production_broad` gate. Codex may implement only the approved artifacts and cannot draft, approve, infer, substitute, or silently weaken their legal text. The gate cannot be satisfied by automated acceptance, an Admin checkbox, product-owner approval alone, or Rabbi content/classroom approval. `ci`, `provider_sandbox`, `persistent_staging`, `production_read_only`, and `production_operator_canary` restricted to operator-owned records may verify the mechanism, but no real-customer account activation, consent acceptance, recorded-class participation, charge, marketing enrollment, or broad operation is authorized until the named product owner and identified qualified legal reviewer have approved the exact deployed bundle.

## 11. Provider outage behavior

### OPS-090 — fail independently

A provider outage is contained to its owned capability:

- Resend outage: local account/signup persists; setup/reset is queued and clearly pending.
- HighLevel outage: local product continues; adult CRM/campaign projection queues; no duplicate contact is guessed.
- Stripe/billing-event outage: last verified access remains until reconciliation policy determines otherwise; no charge or access state is fabricated.
- Zoom outage: calendar and product remain available; Join Class shows a truthful unavailable state and Admin incident control.
- Vimeo outage: published metadata remains; playback shows unavailable without exposing an alternate raw URL.
- Drive outage: direct upload remains available; Drive intake pauses without duplicate ingest.
- AWS S3 or content KMS outage: new upload confirmation and content processing pause; durable intents remain queued, completed-but-unconfirmed objects stay inaccessible, and no browser/worker-local or public-storage fallback is used.
- Telegram outage: tickets and questions remain stored in One Time; internal notifications retry.

No provider outage causes a fallback to raw links, insecure credentials, child GHL contacts, or unapproved manual customer sends.

### OPS-091 — credential failure

Provider authentication failure:

- disables new provider effects for that provider;
- does not erase durable intents;
- alerts Admins;
- does not expose the credential;
- requires successful readback before effects resume;
- does not cause automated credential substitution from another workspace.

## 12. Incident management

### OPS-100 — severity

| Severity | Definition | Acknowledge | Contain/mitigate target | Update cadence |
|---|---|---:|---:|---:|
| Sev-1 | Security/privacy isolation failure, financial or messaging side effect, material data corruption/loss, or complete critical-journey outage | 5 minutes | 15 minutes | Every 30 minutes |
| Sev-2 | Major degradation affecting multiple users or one critical journey without confirmed data exposure/loss | 15 minutes | 60 minutes | Every 60 minutes |
| Sev-3 | Limited degradation, retryable provider failure, or noncritical workflow outage | 4 business hours | 2 business days | Daily while open |
| Sev-4 | Cosmetic or low-impact operational defect | 1 business day | Normal prioritized maintenance | At status change |

### OPS-101 — incident command

- Shloimie is incident commander by default.
- Rabbi Eli may command a live-class incident and remains the teaching/content decision owner.
- One incident commander is identified in the incident record.
- The commander may immediately pause affected workers, provider effects, signup, classroom launch, or publishing to contain risk.
- Destructive recovery, customer-wide sends, refunds, and production data deletion still require their specific authority.

### OPS-102 — response sequence

Every Sev-1 or Sev-2 incident follows:

1. Detect and timestamp.
2. Classify severity and affected journeys.
3. Contain external effects and preserve evidence.
4. Identify exact release, configuration, migrations, providers, and cohort.
5. Decide rollback, roll-forward, or provider isolation.
6. Communicate truthful status to affected adults when required.
7. Recover and verify.
8. Reconcile database, queue, provider, access, communication, and billing state.
9. Close only after monitoring is stable.
10. Complete a blameless review and accepted preventive actions.

### OPS-103 — incident record

The incident record includes:

- incident ID, start/end, severity, commander;
- detection source;
- affected environment, release, routes, roles, and providers;
- user and data impact using sanitized counts;
- known external effects;
- containment and recovery decisions;
- backup/restore/rollback references;
- communication timeline;
- reconciliation results;
- root cause and contributing conditions;
- preventive acceptance/test/runbook changes.

### OPS-104 — customer communication

Customer communication:

- goes only to affected adult account owners;
- uses the governed adult channel and consent/service basis;
- does not expose another household or Student;
- states known impact, current behavior, and next action without speculation;
- is approved by an Admin before broad delivery unless a preapproved emergency template exactly applies.

Student devices receive only the minimum relevant in-app class/access notice.

### OPS-105 — incident closure

A Sev-1 or Sev-2 incident closes only when:

- the harmful/degraded condition is removed;
- production source and configuration read back exactly;
- queues and acceptance-unknown effects reconcile;
- access/billing/communication/provider state reconciles;
- no duplicate effect remains possible;
- monitoring is healthy for at least 60 minutes;
- affected-user communication is complete where required;
- follow-up actions have owners, acceptance conditions, and due dates in the current v2.1 status system.

## 13. Operational security and change control

### OPS-110 — secrets

- Secrets exist only in the approved secret store/environment.
- Production and nonproduction credentials are distinct.
- BNA and One Time credentials are distinct.
- Secret values never enter Git, evidence, logs, screenshots, Telegram, or customer UI.
- Rotation revokes old credentials and verifies all consuming services.
- Suspected compromise is Sev-1 until disproven.

### OPS-111 — least privilege

Web, worker, database migration, provider, backup, and monitoring identities have separate minimum permissions where supported. A public web process cannot use a destructive backup credential. A content worker cannot acquire billing authority. Telegram cannot become database authority.

### OPS-112 — production change record

Every production change records:

- exact requested scope;
- approved candidate, `runtime_tier`, and `verification_environment_id`;
- approver and time;
- expected external effects;
- forbidden effects;
- backup and rollback;
- start/stop conditions;
- actual result and readback.

An approval for one slice never authorizes another provider, cohort, route, campaign, or destructive action.

## 14. Operations acceptance

Operations readiness is accepted only when:

1. Availability, latency, browser, queue, and capacity objectives are proven.
2. Every required metric and alert is visible to Admins.
3. Alert thresholds produce the expected severity and safe payload.
4. Web and worker source/configuration agreement is enforced.
5. Database recovery meets the 15-minute RPO and 30-minute RTO, confirmed uploaded originals meet zero RPO under the explicitly stated S3-availability scope, and the purge ledger meets zero completed-event RPO with replay inside the restore RTO.
6. The current restore drill is within 90 days and matches the current material architecture.
7. A migration-compatible rollback artifact and procedure are proven.
8. Provider outages fail independently without insecure fallback or duplicate effect.
9. Sev-1/Sev-2 incident flow, routing, evidence, and closure are exercised in a nonproduction simulation.
10. Logs, screenshots, traces, and evidence pass secret/PII/provider-link scanning.
11. Production change records cannot imply broader authority.
12. No unresolved Sev-1 or Sev-2 incident exists at release.
13. Every runtime process and operational/acceptance artifact exposes a valid `runtime_tier`/`verification_environment_id` pair from OPS-003.
14. The five exact legal-policy files, `legal/legal-policy-manifest.json`, deployed renderings, hashes, and external named approvals satisfy OPS-084 before `production_broad`.
15. The S3 original store, confirmed-upload recovery journal, independent Object-Lock purge ledger, cross-region replica, and restore-before-traffic deletion proof satisfy OPS-062–OPS-064 and OPS-070–OPS-074.
