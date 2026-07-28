# One Time Mishnayos — Source-of-Truth and Provider Contracts

**Package:** `ONE-TIME-PRODUCTION-SPEC-v2.1`  
**Document:** `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`  
**Status:** Normative product contract  
**Decision source:** `03-DECISION-REGISTER-v2.1.md`  
**Domain source:** `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md`  
**Repository baseline:** `shloimie-beep/onetimev2` at `73dda293079f602c83929d1bbccb8dd5b9d1a455`

## 1. Purpose

This document assigns authoritative ownership to One Time and each external provider and defines the contracts for synchronization, idempotency, failure, recovery, privacy, and readback. It prevents:

- competing sources of truth;
- a provider tag or UI label granting product access;
- duplicate sends, charges, meetings, registrants, uploads, or publications;
- test/live resource crossover;
- child identities entering adult CRM systems;
- raw provider targets entering ordinary URLs, logs, emails, or UI;
- silent success when a provider result is unknown.

These contracts are provider boundaries, not implementation steps.

## 2. Source-of-truth hierarchy

### 2.1 Governing order

For product behavior, authority is:

1. v2.1 decision register;
2. v2.1 normative product/domain/privacy contracts;
3. verified local One Time durable state created under those contracts;
4. signed provider event and provider readback;
5. provider registry identity;
6. derived UI/status projection;
7. historical evidence.

Historical Board state, demo/test data, old PR language, provider screenshots, a GHL tag, a browser return URL, or a Telegram message may not override the hierarchy.

### 2.2 Ownership matrix

| Domain | Canonical owner | One Time stores | Explicitly not authoritative |
|---|---|---|---|
| Authentication/sessions | One Time | accounts, hashed credentials/tokens, sessions, audit | GHL, email delivery state |
| Adult identity/dedupe | One Time identity linked to GHL canonical contact | stable adult and exact GHL reference | name/phone-only match |
| Adult CRM/lifecycle | HighLevel | summarized linked projection/readback | local ad-hoc tags |
| Household/Students | One Time | full household and local Student records | HighLevel child/contact rows |
| Consent evidence | One Time for product acceptance; HighLevel for adult channel suppression/campaign projection | versioned evidence and synchronized projection | workflow membership alone |
| Campaign authoring/execution | HighLevel | workflow registry identity, readiness/readback, governed control events | a second One Time campaign editor |
| Standard financial truth | Stripe | minimized signed receipts, correlations, reconciliation, access projection | GHL tag, browser success page |
| Operator billing workflow | HighLevel using Stripe integration | linked adult/household status projection | copied invoice ledger |
| Effective product access | One Time | `free`, `active`, `grace`, `inactive` projection | Stripe/GHL UI label alone |
| Account/security email | Resend | durable intent, delivery receipt, safe status | GHL |
| Live meeting | Zoom | encrypted meeting/registrant refs, protected grants, attendance reconciliation | raw join URL |
| Class schedule/roster | One Time | class series, occurrences, enrollment, roster snapshot | Zoom recurrence/registrant list |
| Classroom capture | OBS under Admin/teacher control | occurrence-bound capture evidence and source checksum | Zoom cloud recording, local filename alone |
| Source intake provenance | One Time direct upload or registered Drive tree | OBS/Drive provenance, protected origin reference, intake state | filename alone |
| Canonical managed source video | One Time private versioned Amazon S3 staging | checksum, S3 object version, lifecycle | Drive file or worker disk after confirmed import |
| Published video asset | Vimeo | private asset reference/digest and playback projection | Vimeo public/unlisted link |
| Transcript/material truth | approved One Time ContentVersion | approved English transcript/material/version | unapproved processor draft |
| Transcription and draft generation | OpenAI API under pinned processing contracts | protected draft, model/prompt/schema version, request/result digest | model output before human approval |
| Student questions/support | One Time | private question/support record | Telegram/GHL child conversation |
| Internal notification/action transport | Telegram | safe delivery/action receipt | Telegram message as durable truth |
| WhatsApp reminders | Dormant until separately activated | preference intent and disabled/readiness projection | claimed delivery while disabled |

## 3. Global provider-operation contract

### 3.1 Runtime tier and verification-environment ID

Every process, provider credential, provider resource, webhook receipt, and ProviderOperation stores two distinct fields:

- `runtime_tier`: the credential/data isolation boundary, exactly `isolated_staging` or `production`;
- `verification_environment_id`: the bounded verification or operating lane, exactly one value in the following table.

| `verification_environment_id` | Required `runtime_tier` | External-effect boundary |
|---|---|---|
| `ci` | `isolated_staging` | emulators or provider-off only; no real messages, charges, or customer data |
| `provider_sandbox` | `isolated_staging` | provider test mode or operator-owned seed only; Stripe test charges only |
| `persistent_staging` | `isolated_staging` | test/sink resources and operator-owned acceptance records only |
| `production_read_only` | `production` | live readback only; all mutations forbidden |
| `production_operator_canary` | `production` | live mutation only to the explicitly approved operator-owned canary cohort |
| `production_broad` | `production` | ordinary live customer operation after release approval |

The mapping is immutable for an operation. A `verification_environment_id` is not a third provider mode and never weakens its `runtime_tier`.

- Production rejects test/sandbox credentials, resources, event modes, and provider test clocks.
- Isolated staging rejects production credentials, destinations, customers, meetings, files, videos, webhooks, chats, and customer data.
- `production_read_only` rejects every outbound mutation even when the credential itself could mutate.
- Canary authorization is bound to exact allowlisted adult, household, destination, and provider resources; a canary request outside that set fails before dispatch.
- Provider resource records include both fields and canonical account/location/project identity.
- Web and worker processes use the same immutable application source, configuration digest, and provider-contract version.
- A missing, mismatched, or impossible pair fails closed before a provider request.
- Synthetic fixtures and sinks are verification tools only and never appear as a production product lane.

### 3.2 Provider identity registry

For each provider, One Time maintains a protected registry containing:

- provider name;
- canonical account/location/project identity;
- `runtime_tier` and `verification_environment_id`;
- credential key identifiers and rotation version, never secret values;
- webhook endpoint identity/version;
- enabled capabilities;
- sender/host/folder/domain/chat identities;
- configuration fingerprint;
- last successful readback;
- activation state;
- safe blocker codes.

A provider ID discovered ad hoc in UI or a historical file is not authority until it matches the registry.

### 3.3 Stable idempotency

Each logical external effect has one stable idempotency key derived from:

- product, `runtime_tier`, and `verification_environment_id`;
- operation type;
- aggregate identifier;
- immutable source version;
- intended recipient/resource;
- policy/contract version where behavior changes.

Rules:

1. Retry uses the same logical idempotency key.
2. A key reused with a different canonical request hash is rejected.
3. A worker-attempt number is not part of provider-operation identity.
4. Provider acceptance is durably recorded before the local operation becomes complete.
5. If a provider supports idempotency, the same stable key is sent on every safe retry.
6. If a provider lacks adequate idempotency or cannot confirm acceptance after timeout, the operation enters `acceptance_unknown` and is reconciled before another effect.
7. No contract claims exactly-once transport; it guarantees one logical operation with deduplication, durable evidence, and conservative recovery.

### 3.4 Webhook intake

Provider webhooks must:

- receive the unparsed raw body when signature verification requires it;
- reject a body larger than 2 MiB before parsing and enforce the provider's exact registered content type;
- verify signature/secret, a maximum five-minute timestamp skew, provider account, `runtime_tier`, `verification_environment_id`, and event mode;
- record provider event ID and raw-body digest before processing;
- reject wrong-account, wrong-mode, stale-signature, and malformed events;
- treat duplicate same-digest events idempotently;
- quarantine duplicate IDs with different digests;
- store a minimized parsed payload rather than an unrestricted raw provider body;
- acknowledge only after durable receipt or an explicit safe rejection;
- process business effects asynchronously and replay-safely.

Webhook URL-validation challenges are isolated from event processing and expose no protected data.

### 3.5 Timeouts, retry, and acceptance uncertainty

Provider clients use these exact operational defaults:

| Control | Required value |
|---|---|
| Worker lease | 5 minutes |
| Lease heartbeat | every 60 seconds |
| Maximum worker attempts | 8 dispatch attempts per automated recovery generation, including the first dispatch |
| Retry schedule | after failed dispatch attempt `n`, full jitter sampled uniformly from zero through `min(30 minutes, 30 seconds × 2^(n-1))`; a valid provider `Retry-After` is an additional not-before constraint and never authorizes a ninth attempt |
| Exhaustion | `dead_letter` after the eighth unsuccessful dispatch attempt |
| Acceptance uncertainty | immediate `acceptance_unknown`; no blind dispatch retry and no attempt-counter reset |
| Webhook body limit | 2 MiB |
| Webhook signature time tolerance | 5 minutes |
| Classroom bootstrap grant | 60 seconds, one use |
| Live-device heartbeat/lease | heartbeat every 30 seconds; lease expires after 90 seconds without a valid heartbeat |
| Playback grant | 5 minutes |
| OAuth/callback state | 10 minutes, one use |

The five-minute lease is fenced by generation. A stale worker may not write after lease loss. Long-running multipart upload, transcode, transcription, and provider-processing waits are split into bounded resumable steps; no single network request is allowed to outlive its lease, and each step renews the lease through the 60-second heartbeat.

Failure classes:

| Class | Examples | Required disposition |
|---|---|---|
| Permanent rejection | invalid destination, invalid resource, permission denied, policy denied | `rejected` or `dead_letter`; no blind retry |
| Safe transient before dispatch | rate limit before acceptance, provider unavailable before request | bounded backoff with same key |
| Acceptance unknown | timeout/network break after dispatch may have reached provider | quarantine and provider readback |
| Contract/configuration | wrong `runtime_tier`/`verification_environment_id`/account/sender/scope, missing secret | provider-off; no request |
| Suppression/consent | withdrawn or suppressed recipient | suppressed/skipped; no request |
| Conflict | stale version, changed preview, idempotency digest mismatch | conflict; regenerate governed intent |

Backoff is exponential with jitter and provider `Retry-After` support. Retries are bounded. Exhaustion enters a visible dead letter. Manual recovery does not manufacture a new logical effect.

### 3.6 ProviderOperation state machine

`ProviderOperation` states have exact meanings:

| State | Meaning |
|---|---|
| `not_started` | durable governed intent exists; no worker owns it and no dispatch has occurred in the current recovery generation; any prior generation remains immutable history |
| `leased` | one fenced worker generation owns the operation but has not dispatched |
| `in_flight` | that worker has begun the provider request |
| `accepted` | the provider has durably acknowledged the logical effect or returned its canonical resource/event identity; required local readback/projection is not yet committed |
| `retry_wait` | dispatch was proven not accepted and the next bounded retry time is set |
| `acceptance_unknown` | dispatch may have been accepted; only reconciliation/readback is allowed |
| `rejected` | the provider or contract definitively and permanently rejected this intended effect |
| `dead_letter` | bounded safe attempts or reconciliation attempts are exhausted and Admin action is required |
| `complete` | provider acceptance/readback and every required local correlation/projection have been durably committed |
| `canceled` | the still-unaccepted intent was invalidated before dispatch; no provider effect may exist |

`accepted` is deliberately not `complete`. For an asynchronous provider, accepted upload, workflow enrollment, email, meeting, checkout, transcription, or video-processing work remains `accepted` until the contract-specific readback proves the required resource/state and the local result is committed. A later delivery, payment, processing, or attendance event is a separate correlated operation/event when it represents a different logical fact.

Allowed transitions are:

| From | To | Required evidence |
|---|---|---|
| `not_started` | `leased` | due intent acquired under a new lease generation |
| `not_started` | `canceled` | authorized invalidation before dispatch |
| `leased` | `in_flight` | request identity and canonical request hash durably fixed |
| `leased` | `retry_wait` | pre-dispatch transient failure; provider could not have accepted |
| `leased` | `canceled` | authorized invalidation and proof no dispatch occurred |
| `in_flight` | `accepted` | canonical provider acknowledgment/resource identity |
| `in_flight` | `complete` | synchronous acceptance/readback plus local result committed atomically |
| `in_flight` | `retry_wait` | definitive proof provider did not accept and failure is retryable |
| `in_flight` | `acceptance_unknown` | response lost, timeout after dispatch, or ambiguous acknowledgment |
| `in_flight` | `rejected` | permanent provider/contract rejection |
| `retry_wait` | `leased` | due time reached and total worker attempts remain below eight |
| `retry_wait` | `dead_letter` | eighth worker attempt has failed safely |
| `retry_wait` | `canceled` | authorized invalidation before the next dispatch |
| `accepted` | `complete` | required provider readback and local correlation/projection committed |
| `acceptance_unknown` | `accepted` | reconciliation proves the provider accepted and identifies the resource |
| `acceptance_unknown` | `complete` | reconciliation proves acceptance and the required local result is committed |
| `acceptance_unknown` | `retry_wait` | provider readback definitively proves no effect exists and a safe retry remains |
| `acceptance_unknown` | `rejected` | provider readback proves a permanent rejection |
| `acceptance_unknown` | `dead_letter` | bounded reconciliation cannot establish a safe disposition |
| `dead_letter` | `not_started` | explicit audited Admin resume after remediation opens a new recovery generation for the same logical operation, canonical request hash, and idempotency identity |

The eighth unsuccessful dispatch attempt in a recovery generation enters `dead_letter`. An Admin resume never resets or erases the lifetime attempt history; it records a new recovery generation with its own maximum of eight dispatch attempts. `complete`, `rejected`, and `canceled` are terminal. A changed intended effect creates a new ProviderOperation with a new canonical request hash; reopening may never mutate the meaning of an existing idempotency key.

### 3.7 Reconciliation

Reconciliation:

- uses provider GET/readback or a signed canonical event source;
- never relies solely on browser success/cancel return parameters;
- compares canonical provider account, resource reference, amount/price where relevant, source version, and expected state;
- records `verified`, `stale`, `contradictory`, `missing`, or `unknown`;
- applies product state only when the provider evidence meets the relevant contract;
- creates an Admin-visible case for contradictory/unknown outcomes;
- exposes safe summaries and opaque references, not credentials or private URLs.

### 3.8 Logging and observability

Every provider operation carries a correlation ID and safe opaque resource reference. Logs, metrics, audit, and Admin Operations may include:

- provider;
- operation type;
- safe digest/reference;
- `runtime_tier` and `verification_environment_id`;
- lifecycle state;
- latency;
- attempt count;
- safe error code;
- event age;
- queue age.

They must not include:

- passwords or account tokens;
- webhook secrets or signatures;
- raw Zoom/Vimeo targets;
- raw setup/reset links;
- full provider payloads;
- Student email aliases used only for provider mechanics;
- unnecessary adult or Student names;
- private Student question/support bodies.

### 3.9 Authentication and session controls at provider boundaries

Provider launch, portal, upload, export, callback, and Admin operation gates inherit the One Time credential/session contract:

| Subject/control | Required value |
|---|---|
| Admin/Parent password | 12–128 Unicode code points |
| Student password | 8–64 Unicode code points |
| Password rule | no composition rule; reject compromised/common values and values normalization-equivalent to the applicable normalized email, adult name, Student username, or Student name |
| Password storage | versioned Argon2id hash with a unique salt; successful authentication upgrades an obsolete valid hash |
| Login throttling | 5 failures per account-and-IP pair per 15 minutes and 50 failures per IP per 15 minutes |
| Reset throttling | 5 requests per account per hour and 20 per IP per hour |
| Setup resend throttling | 3 requests per account per hour |
| Admin session | 30-minute idle timeout; 12-hour absolute lifetime |
| Parent session | 24-hour idle timeout; 30-day absolute lifetime |
| Student session | 7-day idle timeout; 30-day absolute lifetime |
| Setup token | 7 days, single use |
| Password-reset token | 60 minutes, single use |

Authentication, setup, and reset endpoints return generic responses that do not disclose whether an account exists. Throttling never creates a permanent lock. Provider grants may never extend the underlying One Time session, survive account/session revocation, or substitute for current authorization.

### 3.10 Provider retention and deletion operations

Every provider artifact containing or correlating personal data is created with:

- data subject/household/occurrence/content correlations;
- the exact retention class from `10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`;
- retention trigger timestamp and materialized `due_at`;
- provider account/runtime tier and opaque target digest;
- reference count where one asset serves more than one retained record;
- legal/privacy hold state;
- deletion/anonymization ProviderOperation and readback state.

At `due_at`, One Time first revokes product grants/references, then issues the provider-specific delete or anonymize operation through the provider authority defined in this document. Stripe financial-object changes remain GHL-orchestrated or operator-only in the Stripe Dashboard outside One Time; One Time never dispatches a Stripe write. An accepted delete request is not completion. Completion requires canonical-account readback proving the exact target absent, inaccessible, or irreversibly anonymized as the provider contract allows, followed by a minimized deletion tombstone. Timeout after dispatch is `acceptance_unknown`; a “not found” response from the wrong account, tier, or target is not proof.

Provider outcomes are tracked independently for One Time, GHL, Stripe, Resend, Zoom, Drive, S3, OpenAI processing artifacts, Vimeo, WhatsApp if activated, and Telegram. Shared artifacts are held/unpublished while subject-level redaction is adjudicated and cannot be destroyed until reference/hold rules permit. A legal exception records authority, fields retained, new review date, and access restriction; it never produces a false “fully deleted” status.

## 4. One Time local authority

One Time is authoritative for:

- role/capability and account lifecycle;
- households and account ownership;
- Student identity, credentials, consent, and seat limits;
- class series, occurrences, automatic enrollment, and roster versions;
- effective access;
- protected Zoom/Vimeo launch authorization;
- attendance projection;
- content source/version, approval, assignment, and publication state;
- questions, support, learning events, badges, leaderboards, and in-app notices;
- provider operation and audit state.

An external provider may make its own resource unavailable. That changes readiness and may remove effective availability, but it does not rewrite One Time history or authorize a substitute resource without a governed operation.

## 5. HighLevel contract

### 5.1 Scope

HighLevel owns:

- adult contacts and adult CRM timeline;
- website lead-capture bot;
- adult conversations;
- adult lifecycle/campaign tags;
- campaign/workflow authoring and execution;
- sender identity and deliverability projection;
- adult consent/suppression/DND/unsubscribe/complaint/hard-bounce projection;
- operator-facing Stripe workflow and linked financial activity.

One Time may display governed status/readback and Start/Pause actions exposed by the provider contract. One Time is not a second email-template or workflow-canvas editor.

One real adult has one normalized One Time adult identity, one HumanAccount login, and one GHL adult contact. Admin and Parent are role memberships on that single login; adding or removing a Parent membership, selecting a household, or giving the existing Admin a Parent membership does not create a second login, setup email, GHL contact, or Stripe Customer. Every provider-facing operation resolves the current role membership and, where applicable, the server-selected household independently.

One adult contact may relate to multiple household-keyed GHL account/opportunity records. Each such record has:

- immutable One Time `household_id` as its external key;
- current account-owner adult contact reference;
- Family/School/complimentary classification;
- household-specific access and billing projection;
- household-specific lifecycle and service-reminder preference projection plus a reference to the adult contact’s canonical consent/suppression state; the household record does not copy or independently weaken contact-level DND, unsubscribe, complaint, hard-bounce, or consent;
- exact Stripe Customer/subscription correlations when applicable;
- provider revision and last verified readback.

Household values never live only in single-valued adult-contact fields when doing so would overwrite another household. Campaign membership, lifecycle changes, and billing actions are keyed by both adult contact and `household_id`.

### 5.2 Adult-only boundary

- Only adults enter HighLevel.
- Student name, Student email alias, Student credential, Student question, Student support conversation, attendance detail, progress detail, and raw classroom/content target are forbidden.
- An adult support case may link one GHL conversation.
- Aggregate Parent-safe class or account status may be sent only when required for the approved adult workflow.

### 5.3 Identity matching

When an adult submits Family or School signup:

1. use an existing verified GHL contact reference when present;
2. otherwise match exact normalized email;
3. if provider reference and email disagree, enter `identity_review`;
4. never merge by name or phone alone;
5. update the existing adult contact rather than create a duplicate;
6. preserve suppression and unrelated canonical tags;
7. record source and policy/consent evidence.

Provider failure does not roll back the already committed One Time signup. A durable outbox retries the same upsert/link operation.

`identity_review` is a CRM-link state, not a One Time authentication state. A GHL mismatch:

- quarantines only GHL contact creation/update, campaign enrollment, conversation linkage, and normal billing orchestration for that adult/household;
- creates an Admin identity-resolution case;
- does not roll back or block the submitted local email/password login, single HumanAccount, Parent role membership, household, applicable pre-expiry local free access, or Resend security delivery; Student setup remains available only when independently valid local access permits it, and fresh public Family signup does not require a setup email;
- never permits a GHL-derived access or billing claim while unresolved.

Resolution selects or creates exactly one canonical adult contact, preserves suppression, links each household-keyed account/opportunity independently, and resumes the original idempotent outbox intents. It does not merge by name/phone or manufacture a second One Time login.

### 5.4 Household ownership transfer

An ownership transfer never changes the immutable One Time `household_id`.

- Provider reassociation cannot start until the local transfer recheck proves that the outgoing owner has no active `self` Student in the household. Before acceptance, that Student must be archived or moved—under the first-party two-household seat lock, with identity/history preserved—to another household the outgoing adult owns with an available seat. The Student is never converted to `dependent` or attached to the replacement owner.
- Dependent Students remain attached to the household. Before local transfer completion, the verified replacement owner records current authority and current `service_account` plus `recording_participation` acceptance for each exact dependent. Prior consent evidence remains immutable; optional `member_recognition` is not projected as current unless the replacement separately accepts it.
- The household-keyed GHL account/opportunity is re-linked from the prior owner contact to the verified new owner contact.
- The household-scoped Stripe Customer and subscription remain with the household; customer contact metadata is reconciled to the new owner only after the local transfer commits.
- Prior-owner campaign membership for that household exits immediately, while unrelated households and global suppression evidence remain intact.
- New-owner household workflows begin only after current policy acceptance and exact GHL readback.
- Portal/Checkout grants and billing callbacks issued to the prior owner are revoked or allowed to expire and cannot authorize the new owner.
- Ambiguous GHL or Stripe readback leaves the local transfer durable but places provider billing/campaign actions in a visible reconciliation hold.

### 5.5 Family and School behavior

Family signup:

- creates/links the adult;
- records Family classification;
- may enter only the exact approved Family lifecycle/workflow;
- receives free One Time access through local product truth only when accepted before the configured free-period expiry;
- at or after free-period expiry, commits the local login and inactive Family household, grants no Student access, and offers the household-bound GHL-orchestrated standard Checkout continuation under §6.4;
- never receives access because a tag was applied.

School submission:

- creates/links the adult School lead;
- sends one immediate acknowledgment when deliverable;
- creates no account, subscription, Student, or access automatically;
- enters no automated nurture;
- remains assigned for manual operator follow-up.

### 5.6 Website lead-capture bot

The website bot:

- is adult-facing and located only on the public site;
- captures Family/School classification and adult contact information;
- answers only approved public program facts;
- does not qualify through WhatsApp;
- does not accept child private data, payment data, credentials, support secrets, or provider links;
- does not create product access;
- transfers to the same deduplicated adult/signup contract as the public form.

### 5.7 Workflow registry

Every GHL workflow has one immutable canonical registry key, exact provider ID, purpose, trigger, audience, sender, message class, exit rules, desired state, and last readback.

The OT-11/OT-12 collisions are invalid production state. Registry migration must:

- assign unique canonical identities;
- preserve historical aliases as non-executable history;
- prove no workflow ID is mapped to two purposes;
- prevent a renamed historical workflow from becoming current authority;
- prevent publication/enrollment until provider ID, purpose, and registry agree.

### 5.8 Campaign launch and suppression

Before any enrollment/send:

- exact audience count and excluded count are read back;
- sender and reply path match the registry;
- exact content/version and cadence are approved;
- consent purpose and channel are valid;
- suppression, DND, unsubscribe, complaint, and hard bounce are rechecked;
- any release-verification canary uses only the approved operator-owned destination and is invoked outside ordinary product navigation;
- Start/Pause is audited.

Suppression wins immediately. Workflow enrollment never grants product access.

### 5.9 GHL retention and deletion

A household closure or subject request first exits the exact household-keyed workflows and deletes/anonymizes that household's account/opportunity/conversation projection when due. It does not delete the canonical adult contact while another active/retained household or adult support relationship still references it. The adult contact is eligible for deletion/anonymization only after all such references expire and financial/legal exceptions are separated. A minimal suppression tombstone remains only as allowed by the privacy retention schedule and may not reconstitute a profile.

GHL deletion completion requires readback showing the household record removed/anonymized, workflow membership absent, and conversation/contact disposition correct. Deleting a single-valued contact field while a household record or conversation remains is not completion.

## 6. Stripe and billing-through-HighLevel contract

### 6.1 Authority split

- Stripe is the underlying financial processor and canonical source for customers, payment methods, checkout/subscription schedules, subscriptions, invoices, retries, refunds, and disputes.
- HighLevel is the normal operator-facing and customer-action orchestration surface using its Stripe integration. It creates hosted Checkout and Customer Portal sessions, subscription schedules/subscriptions, period-end cancellation requests, retry workflows, refunds, and billing-repair actions.
- Stripe sends access-affecting events directly to One Time's registered Stripe webhook. Those signed events plus Stripe readback are the only external financial evidence that may change the local access projection.
- One Time holds only minimum household-scoped provider correlations, signed event receipts/digests, reconciliation state, and effective access projection. It exposes a server-authorized Parent billing entry point and Admin readback, but it never mutates Stripe financial objects or implements a second billing workflow.
- One Time does not copy or fabricate a parallel invoice/payment ledger.

Every standard Stripe Customer is household-scoped:

- uniqueness is `(runtime_tier, household_id, billing_program)`;
- one adult owning two households has two isolated Stripe Customers and two isolated billing relationships;
- one household has at most one current standard Family subscription;
- a portal or Checkout session is resolved from the authenticated Parent's server-selected household and may expose only that Customer;
- the Customer metadata includes the immutable One Time `household_id`, `runtime_tier`, `verification_environment_id`, and the current account-owner adult correlation;
- household ownership transfer preserves the Customer/subscription and replaces only verified owner/contact metadata.

GHL keeps the Stripe Customer/subscription reference on the household-keyed account/opportunity record, never solely on the adult contact. An adult's selected household can neither view nor mutate another household's billing resources.

### 6.2 Billing commands and operator-only recovery

For a normal Parent billing action:

1. One Time authenticates the single adult login, verifies current Parent membership, resolves the selected household server-side, rechecks ownership/account state, CSRF, `runtime_tier`, and `verification_environment_id`, and creates one household-keyed billing intent.
2. GHL receives the governed intent under a stable idempotency key and creates the corresponding Stripe-hosted Checkout or Portal session through the registered integration.
3. One Time returns the short-lived hosted redirect only after the GHL/Stripe correlation is read back; it never accepts a Customer, subscription, price, or return target from the browser.
4. Browser return is display/navigation evidence only. Stripe's signed event and readback drive the durable projection.

One Time web, worker, and Admin surfaces have no Stripe write credentials or direct Stripe mutation path. When GHL billing orchestration is unavailable or contradictory, One Time billing mutations fail closed and the durable intent enters visible reconciliation.

An explicitly authorized operator may perform a required recovery action manually in the Stripe Dashboard, outside One Time. That external operator action requires an approved incident/change record naming one household, operation, reason, expected effect, and operator. One Time accepts its result only through the normal signed Stripe event plus canonical Stripe readback, reconciles the household-keyed GHL record before clearing the case, and records immutable audit. Manual Dashboard action never lets One Time call a Stripe write API, bypass price/consent/refund policy, treat a browser return as success, or write access directly.

### 6.3 Environment and catalog

Test and live use separate:

- Stripe accounts/modes;
- API/webhook secrets;
- products/prices;
- portal configurations;
- customers/subscriptions;
- event stores;
- GHL integration state.

The standard live Family offer is exactly:

```text
One Time Live + Library
USD 67.00 monthly
normally up to three active Students
```

The canonical catalog maps one runtime-tier-specific Stripe product/price to one immutable One Time offer key. Wrong account, mode, tier, product, price, currency, or amount fails closed.

Approved Schools use manually recorded terms and may not use the Family checkout if the contracted price/limit differs.

### 6.4 Checkout and free-expiry behavior

Family signup collects no card.

If a Parent accepts paid continuation before the configured free end:

- the GHL-orchestrated, Stripe-hosted flow clearly displays the $67 monthly offer and start date;
- the standard subscription is scheduled/trialed so the first charge occurs no earlier than `2026-09-13T19:24:00+03:00`;
- successful card collection or browser return alone does not replace signed Stripe event/readback;
- no immediate-charge exception is allowed unless the UI separately states the immediate amount/date and the Parent explicitly confirms it;
- one household may have at most one current standard subscription.

At or after the configured free-period expiry, a fresh Family signup still commits the submitted local adult login and Family household, but the household begins `inactive` and Student access is not granted. The Parent is then offered the household-bound GHL-orchestrated, Stripe-hosted standard Checkout continuation. If GHL linkage is in `identity_review` or billing orchestration is unavailable, the local inactive account/household remains usable only under the inactive-household allowlist below, the Checkout effect fails closed into a visible reconciliation state, and no browser return, card form, GHL tag, or pending intent grants access.

For a household whose valid free source reaches expiry, the local projection becomes `inactive` unless another independently valid access source wins. Student authentication and learning access remain denied until signed Stripe event plus canonical readback establish a current paid source.

### 6.5 Financial event receipt

Access-affecting Stripe events are accepted only from the canonical signed Stripe webhook and verified provider account. HighLevel may mirror and act on the same financial lifecycle but may not substitute a tag for the signed event.

One Time stores:

- Stripe event ID/type/created time/mode;
- raw-body and minimized-payload digest;
- safe customer/subscription/invoice correlations;
- source revision/provider-updated time;
- disposition and reconciliation status;
- resulting access event reference.

It does not store card data or unrestricted invoice payloads.

### 6.6 Access projection

- valid free source grants `free`;
- verified current paid/contract source grants `active`;
- a verified payment failure atomically invalidates/ends the previously winning paid AccessSource at that Stripe source revision and creates exactly one seven-day grace AccessSource for the same household/subscription;
- because the stale paid source is no longer valid, the effective projection becomes `grace` unless another independently valid active source wins;
- verified recovery creates a new current paid-source revision, ends the grace source in the same transaction, and returns the effective projection to `active`;
- grace expiry ends the grace source and becomes `inactive` when no independently valid free, paid, contracted School, or complimentary source remains;
- period-end cancellation remains `active` through the verified paid period and then becomes `inactive`;
- `inactive` permits only this exact Parent allowlist: `overview/status`, `household switcher`, `billing/reactivation`, `support list/detail`, `account`, `privacy`, and `data rights`, and denies Student access;
- refund/dispute events enter manual reconciliation and do not invent automatic refund policy;
- manual School or complimentary access remains independently auditable.

Out-of-order events are ordered by provider revision/update time and validated against current provider readback. A stale event cannot reverse newer verified state.

The paid source is never represented by an unbounded Boolean. It records household, Stripe Customer/subscription, current paid-through/service-period boundary, provider revision, validity interval, and invalidation reason. A repeated failure or recovery event at the same revision is idempotent and may not extend grace.

For an inactive selected household, the exact deny list includes `Students`, `calendar/class`, `progress`, `updates`, `newsletter`, `reminder preferences`, and all Student routes. First-party authorization denies before protected render, before a protected loader returns content, and before any provider call; hidden navigation is not authorization. The `household switcher` resolves only server-proven owned households and re-evaluates the destination household’s access projection.

### 6.7 Customer portal and return paths

Billing management uses a short-lived Stripe-hosted portal session created through the normal GHL orchestration contract and issued only after:

- authenticated Parent;
- server-resolved active household ownership;
- exact provider customer correlation;
- CSRF and current access/account checks.

Return paths are same-origin allowlisted paths. Provider customer/session references are not accepted from the browser as authority.

### 6.8 Billing retention and deletion

Account cancellation changes subscription/access state and does not delete financial history. A verified privacy/closure case:

- disables new household Checkout/Portal issuance and removes unnecessary GHL billing projection;
- routes permitted Stripe Customer metadata/contact minimization through GHL or records an explicitly authorized operator-only Stripe Dashboard action outside One Time; One Time never mutates the Stripe object directly;
- preserves only the minimized signed-event, transaction, refund/dispute, consent, and reconciliation evidence allowed by `10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`;
- never claims deletion of Stripe records the processor must retain;
- records separate GHL, Stripe, and One Time dispositions and exception reasons.

An ownership transfer is not a deletion of the household Customer/subscription; it replaces verified owner contact metadata and revokes prior-owner portal authority.

## 7. Resend contract

### 7.1 Allowed purposes

Resend sends only:

- Admin setup;
- Parent setup;
- adult password reset;
- security notices.

Marketing, newsletter, nurture, class reminder, recording announcement, payment lifecycle, and general adult campaign email remain GHL responsibilities.

### 7.2 Token-bearing email

Setup/reset flow:

- local account/token transaction commits first;
- one encrypted durable delivery intent is created;
- GHL never receives the token;
- setup tokens are single-use for seven days;
- password-reset tokens are single-use for 60 minutes;
- issuing a replacement invalidates earlier unused tokens for that purpose/subject;
- only a token hash/reference is stored outside the encrypted delivery payload;
- the same-origin HTTPS completion page uses no third-party analytics or referrer-bearing assets;
- token consumption, expiry, invalidation, and replay are audited without logging the token.

### 7.3 Delivery behavior

- Sender domain, From, Reply-To, SPF, DKIM, DMARC, and webhook identity must match the production registry.
- Each email uses one stable Resend idempotency key.
- Delivery acceptance, bounce, complaint, and failure are durably processed.
- Permanent bounce/complaint updates the appropriate adult communication/security-delivery projection and creates an Admin-visible recovery issue.
- Security/setup delivery failure does not delete or duplicate the account.
- Provider outage is visible; resend retry is bounded and replay-safe.

### 7.4 Resend retention and deletion

Encrypted token-bearing delivery payload is destroyed immediately after terminal acceptance/failure or token invalidation, whichever occurs first; only the redacted receipt/security evidence permitted by the privacy retention schedule remains. A subject deletion removes provider recipient/message metadata when the provider supports it and separately verifies local encrypted payload deletion. Resend delivery-log retention may not be silently treated as One Time product retention or contain the setup/reset token.

## 8. Zoom contract

### 8.1 Provider applications

Production Zoom uses:

- one canonical Server-to-Server OAuth application for app-owned meeting/registrant/attendance operations;
- one canonical Meeting SDK application for embedded authenticated Student and Admin host experiences;
- one canonical host identity associated with Rabbi Eli’s teaching profile;
- registered production origin `https://app.onetimeonetime.com`.

Credentials are separate by capability, held in protected configuration, and never exposed through status UI.

### 8.2 Meeting model

- One app-owned meeting exists per ClassOccurrence.
- Each included Student has a separate registrant.
- No shared family registrant or manually pasted raw link exists.
- Meeting topic, start, 60-minute duration, `Asia/Jerusalem` timezone, and occurrence correlation derive from One Time schedule truth.
- Zoom cloud recording and automatic recording are disabled at account, meeting-template, and occurrence levels; readback must prove `auto_recording=none` or its provider-equivalent before the occurrence is ready.
- Waiting room is disabled.
- Participant rename, chat, screen sharing, file transfer, and invite are disabled.
- Students join muted.
- Participant video follows browser/Zoom consent and cannot be falsely represented as force-enabled.
- Closing/canceling the occurrence revokes launch grants and marks registrants unavailable.

### 8.3 Schedule and preparation boundary

The canonical launch series is Sunday through Thursday at 7:00 p.m. `Asia/Jerusalem` for 60 minutes. One Time, not Zoom, owns recurrence:

- occurrences are generated in a rolling 90-day horizon from Jerusalem-local dates using the active timezone-database version;
- automatic preparation begins exactly 24 hours before scheduled start;
- an Admin may prepare earlier through the same versioned saga;
- Student join authorization opens 10 minutes before scheduled start;
- once the occurrence is `live`, join remains open until explicit Admin close, verified meeting end, cancellation, or automatic close;
- absent Admin extension or earlier close, One Time automatically closes the occurrence 15 minutes after its scheduled 60-minute end;
- the account-owner reminder is scheduled 30 minutes before start through the approved GHL workflow and current preference/suppression contract.

Zoom recurrence is not used as schedule truth. Preparation is bound to the immutable occurrence and roster/consent snapshot version. An Admin extension updates the occurrence end boundary and audit before additional launch grants are issued; it does not rewrite the original scheduled duration used for attendance evidence.

### 8.4 Provider-required Student identity

If Zoom registration technically requires an email-shaped value, One Time generates a non-routable, occurrence-scoped technical alias. It:

- is not a Student email address;
- is never shown to the Student or Parent;
- receives no mail;
- is not stored in HighLevel;
- is not reused as identity or consent;
- is stored only encrypted or as a digest where provider reconciliation requires it.

The Zoom participant display name uses the Student’s actual approved classroom name so Rabbi Eli can identify the Student.

### 8.5 Embedded launch

The Student uses a constant authenticated One Time classroom route. A same-origin CSRF-protected bootstrap:

- resolves Student/session/household/occurrence server-side;
- rechecks current Student state, enrollment, access, current `service_account` and `recording_participation` consent, occurrence openness, registrant state, and concurrent session;
- consumes one 60-second, one-use launch grant;
- returns only the minimum ephemeral Meeting SDK bootstrap fields;
- sets no raw join URL in browser history, email, GHL, logs, local storage, or UI.

Provider network requests required by the embedded SDK are not treated as a user-visible durable link. Referrer and cache controls prevent reuse.

### 8.6 Concurrency and late join

- One concurrent live Zoom session is permitted per Student.
- Same session/device lineage may reconnect. Its live-device lease heartbeats every 30 seconds and expires after 90 seconds without a valid heartbeat.
- A second device/session is denied without a provider call.
- Admin may revoke/reset the current Student live session.
- Product-level join remains available while the occurrence is `live`, even after scheduled start.
- Join closes on occurrence cancellation/completion/explicit Admin close or verified meeting end.

### 8.7 Attendance

Zoom webhook events are signature-verified and mapped through exact meeting/registrant correlations. Embedded-client events provide provisional UI status. Reconciliation:

- merges reconnect intervals;
- prevents duplicate/overlapping time;
- records provider/client mismatch;
- allows audited Admin correction;
- never uses participant display-name matching as sole identity.

### 8.8 Failure behavior

| Failure | Behavior |
|---|---|
| Zoom not configured | preparation/provider status blocked; no fake ready state |
| Meeting create timeout after dispatch | `acceptance_unknown`; search/readback before retry |
| One registrant fails | class preparation partial failure; no email naming that Student |
| Zoom unavailable at join | clear unavailable/retry state; no raw fallback link |
| Consent/access revoked | launch denied before SDK bootstrap |
| Meeting ended | occurrence launch closes and attendance reconciles |

### 8.9 OBS sole-capture contract

OBS is the sole launch recording mechanism. Zoom cloud recording, local Zoom recording, browser-side recording, and an alternate provider capture are forbidden.

For each recorded occurrence:

1. The authorized Admin/teacher arms the registered OBS profile against the exact ClassOccurrence.
2. One Time verifies that every Student admitted to the embedded meeting has current `service_account` and `recording_participation` consent; a Student without either cannot join.
3. The Student UI shows the recording disclosure before Join and a persistent recording indicator while the occurrence capture is active.
4. The Admin starts and stops OBS; One Time records occurrence ID, authorized operator, OBS profile version, start/stop timestamps, and safe source-file fingerprint.
5. OBS writes one occurrence-bound local master file. The filename is only a hint; occurrence binding plus checksum is authority.
6. That master enters One Time through the direct multipart S3 upload or registered Drive intake contract. No other import path may call itself the canonical capture.
7. Upload or Drive handoff begins within 24 hours. Local deletion occurs promptly only after One Time confirms the complete source byte count, SHA-256, exact S3 object version and KMS key through protected readback, the independent upload-receipt journal, durable ContentSource, and retention/deletion schedule. A Drive handoff without confirmed S3 import is insufficient.

If capture fails, stops unexpectedly, cannot be correlated, or cannot be confirmed in managed storage, the occurrence remains historically valid but recording status becomes visibly `failed` or `needs_review`. No empty, partial, Zoom-cloud, or unrelated file is substituted. An Admin correction preserves both the prior fingerprint and the audited rebinding.

### 8.10 Zoom retention and deletion

Meeting and registrant retention due times derive from `10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`.

- Student archive, ownership closure, or consent/access revocation immediately revokes outstanding launch grants and future registrant availability without erasing attendance history.
- After attendance reconciliation and no later than 90 days after the occurrence, One Time deletes or de-registers the exact registrant and, when no retained operational need remains, the meeting.
- A deletion operation is keyed to provider account, occurrence, meeting, registrant where applicable, and source version. Completion requires provider readback proving absence/inaccessibility.
- A missing provider resource is successful only when the registered account/readback proves it is the intended target; wrong-account `not found` is never accepted.
- Deletion timeout becomes `acceptance_unknown`. The operation retains only protected provider digests and the minimal deletion tombstone after completion.

## 9. Amazon S3 direct upload and Google Drive contract

### 9.1 Common content-source contract

Direct upload and Drive monitoring produce the same ContentSource model and checksum identity. Both finish in One Time's managed Amazon S3 source staging before processing and support:

- files up to 5 GiB;
- bounded memory;
- streamed checksum calculation;
- resumable transfer or restart from a verified boundary;
- MIME/container signature validation;
- safe filenames;
- visible progress;
- durable retry/dead-letter state;
- duplicate detection across both entry paths.

The complete file is never buffered in web or worker memory. The canonical managed source identity is `(runtime_tier, S3 bucket, object key, version_id, SHA-256)`. A Drive file ID and OBS filename remain protected provenance, not an alternative mutable source of truth after confirmed import.

### 9.2 S3 storage profile

Launch managed source storage is Amazon S3 in `eu-central-1`.

| Control | Required production value |
|---|---|
| Region | `eu-central-1` |
| Isolation | distinct production and isolated-staging buckets and customer-managed KMS keys |
| Public access | S3 Block Public Access enabled at account and bucket; ACLs disabled with bucket-owner-enforced ownership |
| Transport | TLS only; unsigned/public requests denied |
| Encryption | SSE-KMS with the environment-specific customer-managed key; bucket policy rejects missing or wrong-key encryption |
| Object protection | bucket versioning enabled; opaque non-PII object keys; object version ID stored in ContentSource |
| Upload protocol | S3 multipart upload with 64 MiB parts except the final part; at most four parts uploaded concurrently |
| Part authorization | one object/upload/part-bound signed authorization valid for 15 minutes; no reusable AWS credential reaches the browser |
| Integrity | SHA-256 for the full object plus provider checksum/readback; ETag alone is never treated as a multipart checksum |
| Incomplete upload cleanup | abort incomplete multipart upload after 24 hours |
| Retention | due time comes from `10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`; expiry deletes every retained object version and delete marker under an auditable ProviderOperation |

IAM is least-privilege by runtime tier, bucket prefix, KMS key, and capability. The web tier can create/authorize a bounded upload session but cannot list or retrieve arbitrary sources. Processing workers may read only the exact leased source and write only the exact derivative prefix. Retention workers alone may delete source versions after the due-time and legal-hold checks.

The provider-facing launch retention triggers are:

| Stored media state | Deletion trigger |
|---|---|
| unmatched, quarantined, or terminal-failure source | 30 days after entering that state |
| unapproved draft/source derivative | 90 days after last governed processing/review activity |
| published original source | while published, then 90 days after unpublish/archive |
| unpublished/superseded derivative | 30 days after unpublish, supersession, terminal failure, or abandoned upload |
| verified erasure | eligible subject data removed/anonymized within 30 days, subject to shared-media and exact legal-hold rules |

Deletion enumerates all object versions, delete markers, incomplete multipart uploads, and registered replication copies. Creating an S3 delete marker alone does not satisfy deletion.

### 9.3 Direct app upload

- Only authenticated Admins may upload.
- Upload uses the S3 multipart contract into a private staging prefix.
- Declared size is enforced before and during transfer.
- Partial files are isolated and never processable.
- Completion requires S3 `CompleteMultipartUpload`; a protected readback proving bucket, exact object version, byte count, full SHA-256, SSE-KMS key, runtime tier, and verification-environment ID; an immutable receipt written to and read back from the independent recovery journal in OPS-063; and then a committed durable ContentSource row that names the same receipt and object version.
- Repeated checksum links to the existing source.
- Private source locators are opaque and never exposed as downloadable public paths.

A client receives “upload confirmed” only after the immutable S3 object-version readback, independent journal receipt/readback, and ContentSource transaction are durable and mutually consistent. This is the zero-RPO boundary for a confirmed upload: no acknowledged upload may depend only on browser state, worker disk, an uncompleted multipart upload, an unversioned object, an asynchronous copy, or PostgreSQL metadata without its journal receipt. If S3 completion succeeds but the journal or database transaction does not, the client receives a non-success result and reconciliation adopts or expires the protected orphan by upload-session identity; it never re-uploads blindly.

### 9.4 Drive folder

Drive uses a dedicated One Time-owned private folder tree:

```text
One Time/Recordings/Incoming
One Time/Recordings/Matched
One Time/Recordings/Needs Review
One Time/Recordings/Processed
One Time/Recordings/Quarantine
```

The service identity is shared only into this dedicated tree and receives no access to personal or unrelated Drives. Its API scope permits listing, ranged download, controlled move, and retention deletion only within the registered tree.

Drive rules:

- paginate until all files are considered;
- process supported video files only;
- treat a file as stable after nonzero size and relevant metadata remain unchanged for at least 120 seconds;
- stream/range-download through bounded memory into the same S3 multipart staging contract and compute SHA-256;
- verify final Drive size/change marker and the completed S3 object version, size, checksum, encryption, and readback before ContentSource confirmation;
- move an exact matched file to `Matched`;
- move ambiguous matches to `Needs Review`;
- move rejected/unsafe files to `Quarantine`;
- move successfully ingested sources to `Processed` only after confirmed S3 import and durable ContentSource;
- never delete outside the registered folder tree;
- apply the retention contract in the privacy document.

Filename assists matching but is never identity. Matching uses occurrence date/time, filename hints, and Admin confirmation when confidence is insufficient.

The privacy retention due time is materialized on the ContentSource and applies to the S3 source version and the corresponding file within the registered Drive tree. Retention/deletion work records each target separately, removes every governed S3 version rather than adding only a delete marker, deletes or moves the exact Drive file according to approved policy, and completes only after provider readback. A legal hold suspends both.

### 9.5 Drive failure

Missing scope/folder/permission produces provider-off status. A file remains retryable without duplicate ContentSource creation. A changed provider file after checksum is a new source version; it does not silently overwrite the prior source.

## 10. Processing and transcription contract

### 10.1 One Time ownership

One Time owns:

- trim decision;
- compression/resize policy and derivative;
- English transcript/captions;
- worksheet/review draft;
- future knowledge-base draft;
- approval and immutable version;
- occurrence assignment and publication.

Compression/transcription processors are replaceable processing dependencies, not sources of truth.

### 10.2 OpenAI processing registry

Launch uses one registered OpenAI API organization/project per runtime tier and exactly these processing contracts:

| Internal contract | Endpoint | Exact model identifier | Output authority |
|---|---|---|---|
| `OT-TRANSCRIBE-1` | Audio Transcriptions API | `gpt-4o-transcribe` | English transcript/caption draft only |
| `OT-LEARNING-DRAFT-1` | Responses API | `gpt-4.1-mini-2025-04-14` | worksheet, review, and future knowledge-artifact draft only |

`gpt-4o-transcribe` is the exact provider identifier exposed for the launch transcription model; the operation additionally pins `OT-TRANSCRIBE-1`, request-format version, language `en`, segmentation algorithm version, and prompt/instruction digest. `OT-LEARNING-DRAFT-1` uses the dated `gpt-4.1-mini-2025-04-14` snapshot, not the moving alias.

Every job stores runtime tier, OpenAI project ID digest, internal contract version, exact provider model, API/request-format version, source/ContentVersion checksum, prompt-template digest, Structured Output schema digest where applicable, provider request/result digests, timestamps, and safe disposition. A model, endpoint, segmentation rule, prompt, or schema change creates a new internal contract version and cannot mutate an approved prior result.

### 10.3 Transcription and Structured Outputs

Transcription:

- sends only the occurrence-bound audio needed for the approved source version;
- fixes language to English;
- processes long media in bounded checksum-addressed segments without buffering the full file;
- preserves segment/time provenance so an Admin edit can be traced to the source;
- treats missing, overlapping, malformed, or provider-uncertain segments as a failed/needs-review draft, never a complete transcript.

Worksheet, review, and future knowledge-artifact generation:

- uses the Responses API with `gpt-4.1-mini-2025-04-14`;
- supplies only the approved transcript/version and the minimum occurrence context;
- disables web search, external tools, autonomous provider actions, and conversation carry-over;
- requires strict Structured Outputs with the registered JSON Schema, all declared fields required, and `additionalProperties: false`;
- rejects a refusal, truncation, schema-invalid output, unexpected field, or source-version mismatch;
- records claims/questions as generated draft material, never as Rabbi Eli's approval or authored statement.

The OpenAI API is a processor only. Provider request IDs, stored model outputs, or successful HTTP responses cannot approve, publish, notify, or overwrite content.

### 10.4 Human approval and processing privacy

Every transcript, caption set, worksheet, review, and future knowledge artifact remains a draft until an authorized Admin:

1. reviews it against the exact source/version;
2. corrects errors and removes unnecessary Student-identifying or private material;
3. confirms the applicable Student consent/participant snapshot and privacy review;
4. records approval against immutable output, prompt, schema, and model versions.

Material edited after approval becomes a new ContentVersion and requires new approval. No batch rule, confidence score, provider callback, or prior approval auto-approves a different version.

OpenAI requests use the registered production project and approved API data controls. API keys stay server-side. Audio, transcripts, prompts, and responses are prohibited from ordinary logs, metrics, or Telegram. Provider-side request/output copies exist only for active processing and the approved provider period, which may not exceed 30 days. Verified erasure issues provider deletion where available and deletes local transient copies within 30 days. The retention ProviderOperation stores the provider target digest and readback without retaining the deleted content.

### 10.5 Launch transcode profile

The canonical launch transcode profile is versioned as `OT-VIDEO-1`:

| Property | Required value |
|---|---|
| Container | MP4 with web fast-start metadata |
| Video | H.264/AVC, `yuv420p`, source aspect ratio preserved |
| Dimensions | Maximum 1920×1080; never upscale either dimension |
| Frame rate | Preserve when at or below 30 fps; cap higher sources at 30 fps |
| Rate control | CRF 23, medium preset |
| Audio | AAC-LC, 48 kHz, stereo, 128 kbps |
| Orientation | Normalize rotation into display dimensions |
| Metadata | Remove unnecessary source/device metadata |

The processor records source and derivative byte counts, duration, stream properties, profile version, and SHA-256 checksum. It rejects a derivative with a missing audio or video stream, invalid duration, decode failure, or failed checksum. It reports when the compatible derivative is not smaller than the source; it never deletes or replaces the preserved original merely to satisfy a size target.

### 10.6 Processing safeguards

- Input is validated before processor execution.
- Processing is asynchronous, leased, restart-safe, and checksum-bound.
- Derivatives preserve understandable audio/video and the approved trim.
- Only English transcription is required.
- Processor requests contain only data necessary for the job.
- Transcript, captions, worksheet, review, knowledge-base, and trim results remain drafts.
- No generated Torah explanation or question is represented as Rabbi-approved before Admin approval.
- Processor timeout/uncertainty cannot publish content.
- Editing an approved result creates a new immutable version.

## 11. Vimeo contract

### 11.1 Asset and privacy

Vimeo owns the private processed video asset and caption track. Production configuration requires:

- canonical Vimeo account;
- private/non-public privacy;
- embed limited to registered One Time origins where provider capability permits;
- downloads disabled;
- no public/unlisted share link used by the product;
- captions uploaded and active;
- exact source/content-version correlation;
- provider processing readback.

### 11.2 Upload and publication

- One ContentVersion has at most one current Vimeo asset.
- Upload uses a stable idempotency/resource key and resumable provider protocol.
- Timeout after final upload enters acceptance-unknown and reconciles before re-upload.
- Provider asset reference is encrypted or protected; ordinary UI/logs use a digest.
- `approved` is local editorial state; `published` requires Vimeo asset available/private plus One Time publication readback.
- A failed or public/misconfigured Vimeo asset cannot become Student-visible.

### 11.3 Playback

Playback uses derived `playback_authorization`, not a generic or recording-consent flag. Authorization requires:

- authenticated Student session;
- exact Student assignment;
- active Student and enrollment;
- current effective access;
- current required `service_account` acceptance;
- published immutable ContentVersion;
- no Student, assignment, content, privacy-review, or account revocation.

Current `recording_participation` consent is required to join and be captured in future recorded classes; it is not re-purposed as permission to watch an already approved library item. `member_recognition` controls only approved attribution/recognition and is never a playback gate. Withdrawal of `recording_participation` triggers the privacy-review/unpublish/redaction flow for assets containing that Student, but does not silently remove unrelated library access when `playback_authorization` remains valid.

One Time issues a five-minute playback grant and renders the protected player. The provider network embed request that makes playback possible is unavoidable, but a durable raw Vimeo URL is not placed in user-visible UI, application routes, browser history, local storage, email, GHL, Telegram, or ordinary API payloads.

Unpublish/revoke prevents new playback immediately and invalidates active One Time grants. Provider/domain caching must expire within the five-minute playback-grant window.

### 11.4 Captions and replacement

Caption/transcript updates create a new approved ContentVersion and update the corresponding Vimeo track through a version-bound operation. Asset replacement does not silently alter an already approved version.

### 11.5 Vimeo retention and deletion

Every Vimeo asset stores a materialized retention due time derived from `10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`, a reference count of retained ContentVersions, and any legal/privacy hold.

- Unpublish or privacy hold revokes One Time grants immediately and disables the asset for new member playback before destructive work.
- An unpublished, superseded, terminal-failure, or abandoned Vimeo asset is deleted within 30 days when no retained approved ContentVersion references it, unless a scoped legal hold applies. An approved erasure outcome follows the same 30-day maximum for eligible subject data.
- Deletion covers the video, captions/tracks, thumbnails or derivatives exposed by the account, and protected local references.
- A timeout after delete dispatch enters `acceptance_unknown`; completion requires canonical-account readback proving the asset is absent/inaccessible and a committed deletion tombstone.
- A shared recording affected by one Student request is found through `RecordingParticipantSnapshot` and `ContentParticipant`, then immediately held/unpublished. A cut/mute/blur/text-redacted replacement is a new ContentVersion and new Vimeo asset and requires human redaction approval plus provider readback. The original remains unavailable and is deleted across Vimeo, S3, Drive, and processor copies after replacement readback; if safe redaction is infeasible, it remains permanently restricted and inaccessible rather than being republished.
- Version replacement never decrements or deletes the old asset until reference, retention, legal-hold, and privacy-review checks are all durably satisfied.

## 12. WhatsApp dormant contract

### 12.1 Launch state

- There is no WhatsApp lead assistant.
- Public qualification and lead capture remain website/GHL functions.
- Email workflows operate independently and completely.
- Parent may store reminder preference `email`, `whatsapp`, `both`, or `none`.
- Until activation, UI truthfully labels WhatsApp unavailable.
- A disabled WhatsApp step is skipped without delaying or failing the email step.
- No WhatsApp send, webhook claim, delivery claim, or provider-ready label occurs.

### 12.2 Activation gates

WhatsApp remains dormant unless all of the following simultaneously exist and read back:

- one canonical provider and account;
- approved sender identity;
- production webhook and signature secret;
- approved message templates for each purpose;
- channel- and purpose-specific adult consent;
- STOP/DND/suppression integration;
- production environment isolation;
- exact canary recipient and bounded canary acceptance;
- durable idempotency, receipt, retry, and complaint/failure handling.

Activation does not create Student contacts or direct messages to Students.

## 13. Telegram contract

### 13.1 Scope

Telegram is an internal Admin notification/action transport. It is not a customer database, Student chat, payment ledger, support system of record, or consent source.

### 13.2 Identity and transport

- Bot token, webhook secret, and allowed chat/user mappings are protected configuration.
- Webhook and polling consumers are mutually exclusive.
- Only allowlisted Admin identities/chats may receive or invoke actions.
- Callback/action tokens are one-use, valid for 10 minutes, session/action scoped, and replay protected.
- Every accepted action reauthorizes against current One Time state.

### 13.3 Data minimization

Messages contain:

- `OT` namespace;
- safe category/status;
- opaque case/question/occurrence reference;
- minimal safe excerpt only when necessary;
- protected same-origin deep link.

Messages do not contain credentials, provider links, full payment data, full Student profile, private recording URL, or unnecessary private question/support body.

### 13.4 Action behavior

An allowed Telegram action writes a normal One Time command with:

- exact Admin identity;
- current aggregate version;
- idempotency key;
- authorization;
- audit.

Telegram delivery or message editing does not itself complete the action. A failed Telegram send leaves the One Time question/support/provider state intact and visible in-app.

## 14. Cross-provider event flows

### 14.1 Family signup

```text
One Time local transaction
  -> Adult/HumanAccount/Parent role/Household/time-derived access/authenticated session
  -> GHL adult upsert/link intent
  -> approved GHL Family lifecycle and welcome intent
```

Each external branch retries independently. None may duplicate the local identity or grant access independently. Fresh public signup creates no invitation, setup token, or setup email; Resend remains available for security delivery and the separately enumerated passwordless-claim cases only.

### 14.2 School lead

```text
One Time/GHL deduplicated adult lead
  -> one GHL acknowledgment
  -> manual operator follow-up
```

No account, nurture, Student, checkout, or access branch runs automatically.

### 14.3 Class preparation

```text
One Time occurrence/roster/consent/access
  -> Zoom meeting
  -> per-Student registrants
  -> protected Student portal state
  -> GHL account-owner email when approved
  -> in-app Student notices
```

No raw Zoom target crosses into GHL.

### 14.4 Billing lifecycle

```text
Parent -> One Time household authorization
  -> HighLevel billing orchestration
  -> Stripe-hosted Checkout/Portal
Stripe direct signed event/readback
  -> One Time minimized receipt/access projection
  -> HighLevel adult workflow/communication
```

A GHL tag or browser return never bypasses the Stripe verification branch.

### 14.5 Recording pipeline

```text
OBS occurrence capture
  -> Admin multipart app upload or registered Drive intake
  -> versioned S3 eu-central-1 source/checksum/readback
  -> OT-VIDEO-1 trim/compress
  -> OpenAI OT-TRANSCRIBE-1 / OT-LEARNING-DRAFT-1 drafts
  -> Admin approval
  -> private Vimeo upload/readback
  -> Admin publication
  -> One Time playback grants/notices
```

No processor or Vimeo callback auto-approves content.

### 14.6 Student question/support

```text
Student -> One Time private record
  -> minimized Telegram alert
  -> authorized Admin action in One Time
```

Student data never becomes a GHL contact/conversation.

## 15. Degraded-mode contract

| Dependency unavailable | Product behavior |
|---|---|
| PostgreSQL | readiness fails; no mutation/provider dispatch |
| GHL | local signup/account/free access remains durable; CRM work queues; no duplicate row; campaigns and billing orchestration fail closed; any operator-only Stripe Dashboard recovery remains outside One Time and follows §6.2 |
| Stripe | no new Checkout/Portal or verified financial change; current verified access remains until its defined expiry; reconciliation alerts |
| Resend | setup/reset intent queues; account is not duplicated; Admin sees delivery failure |
| Zoom | calendar remains; preparation/join truthfully unavailable; no raw fallback link |
| Amazon S3 | no upload/import confirmation or processing; incomplete multipart state remains non-source; no local-disk success fallback |
| Drive | direct S3 app upload remains available; Drive status blocked; no confirmed managed source is lost |
| OBS | class may continue only under Admin decision and truthful recording-unavailable status; Zoom recording remains disabled |
| Processing/OpenAI transcription | S3 source retained; item failed/retryable; no generated result or publication |
| Vimeo | approved item remains unpublished; no raw/local public fallback |
| WhatsApp | email and in-app continue; WhatsApp skipped/disabled |
| Telegram | One Time queue remains authoritative; in-app Admin workflow continues |

No degraded mode weakens authentication, household/Student scope, consent, access, suppression, or provider-link protection.

## 16. Provider completion criteria

A provider is production-functional only when the exact production configuration and a bounded real acceptance prove:

- canonical account, `runtime_tier`, and `verification_environment_id` identity and mapping;
- credential and webhook readiness without secret disclosure;
- correct source version;
- positive operation and durable readback;
- duplicate/replay safety;
- wrong-account/environment/subject denial;
- timeout/acceptance-unknown behavior;
- redacted logs/audit;
- provider-off/degraded behavior;
- cleanup/revocation where the operation creates a temporary resource;
- retention due-time materialization and deletion/anonymization readback;
- exact model/profile/version identity for Zoom, OBS, transcode, OpenAI processing, S3, and Vimeo where applicable.

Provider sandbox tests are required before bounded production acceptance, but no sandbox/demo surface appears in the production product.
