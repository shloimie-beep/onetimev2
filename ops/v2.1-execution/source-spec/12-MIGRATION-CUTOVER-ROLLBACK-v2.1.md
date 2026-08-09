# One Time Mishnayos — Migration, Cutover, and Rollback Contract

**Package:** `ONE-TIME-PRODUCTION-SPEC-v2.1`  
**Document:** `12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md`  
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
- `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md`;
- `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md`;
- `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`;
- `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`;
- `10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`;
- `11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml`;
- `13-OPERATIONS-SLO-DR-INCIDENT-v2.1.md`;
- `14-TRACEABILITY-CROSSWALK-v2.1.yaml`.

## 1. Purpose and safety boundary

This contract defines the behavior of legacy-user re-entry, adult CRM deduplication, production data preparation, domain cutover, rollback, reconciliation, and retirement of the old authenticated application.

It does not authorize migration, deletion, DNS mutation, customer communication, provider activation, payment mutation, or production deployment. Those effects occur only through separately approved, candidate-bound execution.

## 2. Migration outcome

### MIG-001 — clean-account migration

Legacy users enter v2.1 through a clean signup and setup flow.

The migration does not copy:

- passwords or password hashes;
- login codes or setup/reset tokens;
- sessions or cookies;
- old Parent application accounts;
- old Student accounts or credentials;
- child profiles;
- class enrollments;
- attendance or progress;
- payment status;
- product access;
- general marketing consent;
- Tisha event-only consent.

The old system is an adult-audience and provenance source, not an authentication, child-data, billing, or access source for v2.1.

### MIG-002 — what is retained

The following may be retained when exact and lawfully usable:

- the existing adult HighLevel contact;
- stable HighLevel contact ID;
- normalized adult email;
- adult name and phone with provenance;
- explicit consent and suppression facts;
- lifecycle/source classification;
- historical provider and migration evidence;
- immutable audit and migration history.

Retained data does not itself create a v2.1 account or access grant.

## 3. Source manifests

### MIG-010 — required migration manifest

Every source used for migration or cleanup is represented in a versioned manifest containing:

- source system and export name;
- creation timestamp;
- immutable checksum;
- row count;
- schema/column inventory;
- normalization version;
- duplicate count;
- invalid-row count;
- suppressed/denied count;
- exact provenance;
- authorized use;
- retention classification.

An unmanifested file or ad hoc spreadsheet is not a production migration source.

### MIG-011 — immutable database history

Applied database migrations remain immutable. New behavior uses a new forward-only migration with:

- globally unique prefix/name;
- checksum;
- transaction or explicit resumability contract;
- compatibility classification;
- read-only verification;
- duplicate-prefix rejection;
- exact applied-ledger readback.

No historical migration file or applied checksum is edited to make v2.1 appear clean.

## 4. Adult identity and HighLevel deduplication

### MIG-020 — email normalization

The v2.1 normalized email algorithm:

1. trims leading and trailing whitespace;
2. applies Unicode normalization;
3. validates exactly one syntactically valid email address;
4. lowercases the full address for product identity matching;
5. preserves the user-entered display value separately when needed.

The product does not remove dots, remove plus-addressing, rewrite domains, or apply provider-specific mailbox equivalence.

### MIG-021 — matching precedence

An adult signup matches in this order:

1. an already verified local-to-GHL contact link;
2. one exact normalized-email GHL match;
3. manual identity quarantine.

Name-only and phone-only matches never auto-merge.

### MIG-022 — ambiguous HighLevel identity

If multiple HighLevel contacts share the normalized email, or identifiers point to different contacts:

- the local signup transaction may complete;
- one local adult identity is created or reused;
- the submitted local password and login remain usable;
- pre-expiry free household access remains usable;
- no new GHL contact is created;
- no existing GHL contact is overwritten;
- no campaign enrollment occurs;
- no GHL-hosted paid checkout or billing projection begins;
- the provider projection enters `identity_review`;
- an Admin sees a sanitized conflict with exact provider references;
- a governed Admin resolution selects or merges the adult CRM identity in HighLevel before projection resumes.

Resolution is audited and idempotent. The quarantine is scoped to CRM linkage, GHL workflow, and paid billing; it does not suspend the local identity, Resend security delivery, or otherwise valid product access.

### MIG-023 — exact HighLevel update

When there is one exact match:

- the same GHL contact is updated;
- its stable provider ID is retained;
- source and current signup facts are appended or updated according to the registry;
- existing suppression, DND, unsubscribe, complaint, and hard-bounce state is preserved;
- current Family signup projects general-marketing and Parent-newsletter permission only from the explicit integrated Terms acceptance; existing suppression, DND, unsubscribe, complaint, hard-bounce, and later withdrawal remain controlling;
- no Student or child placeholder contact is created;
- retries use one stable idempotency identity and cannot create a duplicate.

### MIG-024 — no-match HighLevel projection

When there is no match, the durable signup outbox may create one adult GHL contact. The readback must prove one and only one contact with the returned provider ID. An acceptance-unknown provider result is quarantined and reconciled before retry; it is never retried as an uncorrelated create.

### MIG-025 — active local account

If the normalized email already belongs to an active local adult:

- public signup does not create another adult identity;
- it returns the safe Sign in or reset password path;
- it does not disclose account state beyond the submitted address;
- creation of an additional household occurs only after authenticated confirmation or Admin assistance.

One adult identity may own multiple separate households. Each household retains independent billing, access, plan, school allowance, and Student seats.

One adult GHL contact is reused across those households. Each household has its own household-keyed GHL opportunity/account record and Stripe Customer. Adult marketing consent and suppression remain contact-scoped; service reminder preferences, lifecycle, commercial terms, and access remain household-scoped. Ownership transfer preserves the household and its Stripe Customer while moving the sole Parent membership and applicable household service preference to the replacement adult.

## 5. Signup transaction

### MIG-030 — Family signup

A valid Family signup performs one local database transaction that:

1. validates the adult account-owner fields;
2. hashes the submitted adult password and records the exact Terms/privacy version and acceptance timestamp;
3. consumes or records the idempotency key;
4. creates or reuses the local adult identity;
5. creates one household;
6. creates or extends one active human login with the `parent` role and sole household-owner membership;
7. before `2026-09-11T18:00:00+03:00`, grants access from the fixed free-period source; at or after that instant, records inactive access pending standard checkout;
8. records source/provenance;
9. commits the durable GHL projection intent and any applicable welcome intent.

It does not:

- collect a card;
- charge;
- create a Student;
- create a GHL child contact;
- infer marketing consent;
- import an old child profile;
- grant access from an old payment or tag;
- create a rolling free trial;
- create or charge a card from the signup form.

GHL provider failure occurs after the local commit and is retried by the durable outbox. It cannot duplicate the household or lose the signup. Before expiry, GHL failure cannot block free access. At or after expiry, the account and inactive household persist, but Student creation and learning wait for verified paid access.

### MIG-031 — Student creation after signup

After Parent authentication, the Parent creates zero to three Student profiles with new Student credentials. The Parent selects `self` or `dependent`, supplies actual name, optional display name, username, and password, and completes the separately scoped authority and recording consent required for a dependent Student. A `self` Student profile may activate without recording consent, but no recorded-class join grant is issued until the matching verified adult identity directly accepts the current recording consent from its own authenticated self-managed Student privacy route; the Parent/account-owner cannot accept that scope on the self-managed adult Student’s behalf. Date of birth, age, age band, grade, and Hebrew-specific name fields are not imported or collected. Every eligible active Student and canonical launch-class enrollment commit atomically; either both exist or neither does.

No legacy Student name, credential, attendance, or enrollment is suggested or prefilled from the old application.

### MIG-032 — School submission

A School public submission:

- creates or updates one adult lead;
- records `school` inquiry type and submitted school details;
- sends one immediate acknowledgment;
- creates no Parent user, household access, Student, subscription, or nurture enrollment;
- routes the lead for manual operator follow-up.

An approved school account is created later through an Admin-governed contract with its explicit seat allowance, price, billing start, and terms.

### MIG-033 — setup delivery

Legacy invitations, Admin-created adults, ownership-transfer acceptance, and any other passwordless adult claim use Resend:

- the setup link is single-use;
- validity is seven days;
- a newly issued setup link invalidates earlier unused links;
- delivery failure is visible and retryable;
- no token appears in HighLevel, Telegram, logs, screenshots, or Admin UI;
- account existence is not disclosed through public error wording.

## 6. Audience migration and communication

### MIG-040 — audience classifications

Every legacy adult is classified into exactly one operational outcome:

- eligible service/migration contact;
- separately consented marketing lead;
- former/canceled contact eligible for approved reactivation;
- suppressed/denied;
- identity or permission review.

Historical active status, portal presence, payment, attendance, event registration, or email capability does not equal current v2.1 access or general marketing permission.

### MIG-041 — migration invitation

A migration invitation:

- explains that the user must sign up again;
- links only to the current public signup;
- does not claim that passwords, Students, payment, or access transferred;
- does not contain a raw provider or classroom link;
- is sent only to the approved exact adult segment;
- rechecks suppression and eligibility at send time;
- uses immutable approved copy and audience fingerprints;
- never creates a v2.1 account merely because the email was sent.

### MIG-042 — communication rollout

Migration communication uses these bounded gates:

1. one operator-owned seed contact;
2. an individually approved cohort of no more than five eligible adult contacts;
3. reconciliation of delivery, suppression, replies, signup attribution, and duplicate counts;
4. the remaining exact approved eligible segment.

Each gate requires separate activation approval. A failure, audience drift, copy change, sender change, or suppression mismatch invalidates the next gate.

## 7. Production preparation

### MIG-050 — exact release identity

The cutover candidate is identified by:

- repository commit SHA;
- built artifact/image digest;
- application semantic source SHA;
- web and worker digest;
- database migration inventory and checksums;
- configuration digest;
- provider-registry digest;
- public asset digest;
- v2.1 specification and acceptance digest.

Web and worker must use the same immutable application artifact. A Git governance-only commit may differ from the semantic application source only when the relationship is explicit, reproducible, and included in the candidate manifest.

### MIG-051 — pre-cutover gates

Cutover cannot begin until all of the following pass:

- the v2.1 supersession contract;
- exact-role authentication for both Admins;
- one operator-owned Family signup;
- Parent setup and three Student credentials;
- canonical-class enrollment and separate-device classroom acceptance;
- direct app and Drive content ingestion acceptance;
- private Vimeo playback and denial acceptance;
- free, active, grace, and inactive access-state acceptance;
- GHL adult dedupe and Resend setup acceptance;
- zero fictional/demo production records or controls;
- exact web/worker/migration readback;
- current backup and restore proof;
- rollback compatibility proof;
- Operations dashboards and alerts;
- zero unauthorized send, enrollment, charge, refund, provider deletion, or customer mutation.

### MIG-052 — production data baseline

Immediately before cutover, a sanitized baseline records:

- local adults, households, Parent users, Students, and access states by aggregate count;
- active and archived counts;
- duplicate normalized emails;
- households above configured Student allowance;
- orphaned foreign keys;
- pending/leased/retry/dead-letter outbox counts;
- GHL linked/unlinked/review counts;
- applied migration count and checksum state;
- production sessions by role and version;
- known operator-owned acceptance records;
- provider asset manifests.

Names, emails, tokens, raw provider URLs, and child details are excluded from the artifact.

### MIG-053 — backup gate

A new encrypted production database backup or recoverable point-in-time marker is completed no more than 30 minutes before the first schema or data mutation. Restore proof must be within the freshness window defined by the operations contract.

The backup identifier, source database identity, schema fingerprint, row-count fingerprint, creation time, encryption state, retention expiry, and restore target are recorded.

## 8. Cutover sequence

### MIG-060 — ordered cutover

The cutover uses this fixed order:

1. Freeze the exact candidate and v2.1 evidence.
2. Enable a production change window and external-effect guard.
3. Capture the pre-cutover baseline and backup.
4. Deploy the migration-compatible web and worker artifact with provider effects held.
5. Apply forward-only migrations once.
6. Run read-only migration and schema verification.
7. Verify public health, protected readiness, database, web/worker identity, queues, and provider configuration.
8. Run the bounded operator-owned Admin, Parent, and Student acceptance.
9. Enable only the product/provider effects explicitly accepted for launch.
10. Point public login and signup calls to action to `app.onetimeonetime.com`.
11. Keep `join.onetimeonetime.com` as the public transition funnel.
12. Run post-cutover reconciliation.
13. End the change window only after the stability gate passes.

No later step is permitted when an earlier gate fails.

### MIG-061 — domain behavior

At cutover:

- `app.onetimeonetime.com` serves the authenticated v2.1 application over HTTPS;
- the canonical marketing site links to the new app;
- `join.onetimeonetime.com` continues as the public transition/signup funnel for at least 30 continuous days;
- old login bookmarks redirect to the v2.1 login;
- old signup bookmarks redirect to the v2.1 public signup;
- safe source/UTM parameters may be preserved;
- credentials, tokens, email addresses, provider references, and arbitrary redirect targets are never copied into a redirect;
- authenticated old-app mutations are disabled.

### MIG-062 — old application read-only state

During the transition window, the old authenticated application:

- cannot create or edit accounts, Students, access, classes, communications, or payments;
- cannot issue a legacy login challenge;
- cannot create new sessions;
- presents a migration explanation and link to new signup/login;
- retains only the minimum read-only operational access required for verified rollback and support;
- emits no customer communication or provider effect.

### MIG-063 — stability gate

The initial production change window closes after:

- at least 60 continuous minutes of healthy production service;
- successful Admin, Parent, and three-Student readback;
- no Sev-1 or Sev-2 alert;
- no migration drift;
- no unexpected provider effect;
- no identity duplication or orphaned account;
- all critical queues below their warning age;
- web and worker still report the exact candidate.

## 9. Reconciliation

### MIG-070 — required zero-tolerance checks

The following must equal zero:

- duplicate local normalized-email adult identities;
- unauthorized duplicate GHL contacts;
- Student or child GHL contacts;
- orphaned household, Parent, Student, access, enrollment, content, or audit records;
- households above their configured active-Student allowance;
- access grants inferred from legacy payment, tag, attendance, or event state;
- legacy sessions accepted by v2.1;
- unexpected sends, enrollments, charges, refunds, meeting deletions, or publications;
- migration checksum mismatches;
- unknown production-visible demo or test records.

### MIG-071 — asynchronous provider reconciliation

An asynchronous GHL or Resend intent may remain pending only when:

- the local transaction is complete;
- the intent has one stable idempotency identity;
- the provider outcome is known not to have duplicated;
- the retry time is visible;
- the age is within the operations threshold;
- user-facing behavior remains truthful.

An acceptance-unknown provider effect is quarantined, not blindly retried.

### MIG-072 — acceptance-record cleanup

Operator-owned production acceptance records are tagged with exact provenance at creation.

- They are never confused with fictional/demo data.
- They remain only when the operator chooses to keep them as real accounts.
- Otherwise they are archived through normal product actions after evidence capture.
- Provider resources created solely for the acceptance are reconciled and removed only by exact ID and explicit cleanup authority.

## 10. Rollback

### MIG-080 — rollback triggers

Rollback or immediate containment begins when any of these occurs during the change window:

- cross-household, sibling, or role authorization failure;
- raw credential, token, child data, Zoom URL, or Vimeo URL exposure;
- unintended charge, refund, customer send, workflow enrollment, meeting deletion, or publication;
- database migration mismatch or corruption;
- inability of either production web or worker to report the exact candidate;
- production unavailability meeting the Sev-1 threshold;
- loss of Parent billing/recovery access;
- Student access granted in an inactive state;
- unreconciled duplicate account or GHL contact creation;
- queue behavior capable of repeating an external effect.

### MIG-081 — containment before rollback

Containment has priority over cosmetic recovery:

1. disable the affected external-effect capability;
2. stop new queue claims when replay safety is uncertain;
3. preserve leases, idempotency records, logs, and provider readback;
4. stop new signup or login only when continuing could corrupt identity or access;
5. keep unaffected read-only product paths available when safe;
6. notify both Admins through the secure incident route.

### MIG-082 — application rollback

Application rollback uses a previously recorded migration-compatible artifact.

- Web and worker roll back together to the same artifact.
- Configuration rolls back to its matching digest.
- Provider effects remain disabled until reconciliation.
- The database is not automatically downgraded.
- The rollback artifact must be proven compatible with every migration already applied.

### MIG-083 — forward-only schema rule

Production migrations are forward-only. If the previous application cannot safely use the new schema:

- the service remains contained;
- a compatible roll-forward application fix is preferred;
- a database restore is used only under the destructive-recovery procedure;
- no reverse SQL or manual schema editing is improvised in production.

### MIG-084 — destructive database recovery

A database restore is permitted only when:

- the incident commander declares database recovery necessary;
- all application and worker writes are stopped;
- the exact restore point and data-loss window are known;
- provider effects after that restore point are inventoried;
- the restore occurs first in an isolated target and passes integrity verification;
- production replacement has explicit authority;
- post-restore provider and outbox reconciliation prevents duplicate effects.

No backup is restored over the live database without these gates.

### MIG-085 — domain rollback

If the new application cannot safely accept traffic:

- public login/signup calls to action switch to a truthful maintenance or transition page;
- the old application does not resume writes or old-password authentication;
- `join.onetimeonetime.com` remains the safe public bridge;
- DNS rollback uses the recorded prior target and does not expose a preview environment;
- cached redirects and cookie scope are verified after rollback.

Rollback does not reactivate the unsafe old product.

### MIG-086 — effect reconciliation after rollback

Every external effect accepted before rollback is read back by exact provider ID.

- Accepted effects are recorded and not repeated.
- Rejected effects may be retried only with the same idempotency key when safe.
- Acceptance-unknown effects remain quarantined for human reconciliation.
- No customer receives a duplicate migration, setup, billing, or class message.
- No payment or access state is guessed from a local rollback.

## 11. Old-application retirement

### MIG-090 — retirement criteria

The old authenticated application may be retired after all of these are true:

- the new application has operated for at least 30 continuous days;
- the previous 14 days contain zero successful old-app authentication;
- all public and campaign links have a verified redirect or terminal response;
- open identity-review and migration-support cases are zero;
- the old data/export manifest and retention treatment are complete;
- rollback no longer depends on executing the old application;
- both Admins approve retirement.

### MIG-091 — redirect retention

Verified old login, signup, and marketing redirects remain for at least 12 months after retirement. Old mutation/API endpoints return `410 Gone` and perform no write. Unknown legacy paths return a normal `404` and never fall through to a preview or unrelated application.

### MIG-092 — retirement is not deletion

Retiring runtime traffic does not itself delete old databases, exports, provider assets, or audit evidence. Their retention and eventual deletion follow the privacy/data-retention contract and require an exact target manifest.

## 12. Migration and cutover acceptance

Migration and cutover are accepted only when:

1. Every source has a checksum-backed manifest.
2. Old credentials, sessions, Students, child profiles, payment, and access were not migrated.
3. Exact-email GHL dedupe reuses one adult contact without weakening suppression.
4. Ambiguous identity quarantines without duplicate creation or campaign enrollment.
5. Family and School flows produce their exact distinct outcomes.
6. Signup survives GHL or Resend outage without duplication or loss.
7. The production candidate, configuration, migrations, web, and worker read back exactly.
8. Backup, restore, and rollback gates meet the operations contract.
9. Operator-owned Admin, Parent, three-Student, class, content, and access journeys pass.
10. All zero-tolerance reconciliation checks equal zero.
11. Old authenticated mutations and sessions are disabled.
12. Transition redirects preserve safe attribution without leaking protected values.
13. Rollback has been proven against the exact migration compatibility boundary.
14. No unauthorized send, enrollment, charge, refund, deletion, or publication occurred.
