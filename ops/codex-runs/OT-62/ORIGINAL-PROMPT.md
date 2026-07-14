CODEX EXECUTION PROMPT — OT-62 ACCOUNT ACTIVATION AND CREDENTIAL LIFECYCLE

TASK ID: OT-62

TITLE

Account Invitations, Activation, Login Recovery, Password Reset, MFA Management,
Session Invalidation, and Parent/Student Provisioning Integration

ROLE

You are the sole senior identity, authentication, authorization, privacy,
data-integrity, PostgreSQL, delivery-lifecycle, accessibility, and application
integration engineer for the standalone One Time One Time product.

You are implementing one canonical, production-grade identity lifecycle for real
One Time users. You are not creating a second authentication runtime, an
impersonation mechanism, a test-user generator, a BNA bridge, or an alternate
portal shell.

You begin with no prior chat context. Treat this prompt, repository instructions,
the exact accepted base commit, actual source, tests, migrations, committed
evidence, integration manifests, and current primary security guidance as the
complete working context.

DIRECT-EXECUTION RULE

This prompt goes directly to Codex after its one SHA value is filled. Do not return
it to a director, another GPT, or another prompt-expansion process for routine
rewriting. Ask for intervention only when a hard prerequisite fails, an active
repository collision exists, a security-critical product decision cannot be
derived from accepted source, or an external action needs new authorization.

REPOSITORY AND EXACT BASE

Repository:

webcraft-media/onetimev2

Required exact accepted convergence base:

BASE_SHA={{ACCEPTED_OT60_CONVERGENCE_HEAD_SHA}}

The line above contains the sole execution-time placeholder in this prompt.

EXPECTED ISOLATED BRANCH

codex/ot62-account-activation-credential-lifecycle

MODE

After every hard gate passes, you may:

- inspect the repository and Git graph;
- create one fresh dedicated worktree from exact BASE_SHA;
- create and edit only the isolated OT-62 branch;
- add additive migrations consistent with the accepted migration policy;
- run local, synthetic, browser, accessibility, security, and disposable
  PostgreSQL verification;
- create sanitized repository evidence;
- make small intentional commits;
- push only the isolated OT-62 branch;
- open one draft pull request against the accepted OT-60 convergence branch or
  another exact base branch proven to resolve to BASE_SHA.

You may not:

- merge any pull request or branch;
- deploy any environment;
- access, inspect, copy, export, or mutate production or shared customer data;
- migrate a production or shared database;
- create a real user, membership, guardian relationship, learner, invitation,
  credential, MFA factor, recovery code, or session;
- send a real invitation, activation, recovery, reset, email, WhatsApp, Telegram,
  SMS, or other external message;
- activate or configure Resend, WAPI, Telegram, Stripe, Vimeo, Zoom, Railway,
  DNS, webhooks, provider accounts, or provider credentials;
- rotate a real credential or secret;
- grant real access;
- modify BNA or make standalone One Time depend on BNA;
- print or preserve raw passwords, password hashes, invitation/reset proofs,
  session IDs, cookies, CSRF values, TOTP seeds, QR payloads, recovery codes,
  provider credentials, private identifiers, or real database rows;
- rewrite, reset, clean, delete, or reuse an existing worktree;
- rebase, squash, amend, force-push, or rewrite accepted history;
- copy an old OT-16, OT-17, OT-19, OT-20, OT-23, or BNA authentication packet
  wholesale.

Tests must use fictional identities under reserved non-deliverable domains such
as example.test and fake or sink transports only.

PRODUCT OUTCOME

Deliver one secure end-to-end identity and credential lifecycle covering:

1. owner and administrator invitation and activation;
2. parent or guardian invitation, activation, and relationship-scoped membership;
3. parent-managed student access provisioning tied to exactly one existing
   learner;
4. login, logout, recovery initiation, password reset, password change, and
   session invalidation;
5. the accepted TOTP MFA enrollment, login challenge, recovery-code, and
   factor-management lifecycle;
6. invitation resend, revoke, expiry, supersession, delivery projection, and
   sanitized history;
7. owner/admin, parent, student, activation, reset, login, and security-settings
   surfaces integrated into the accepted canonical One Time shells and components;
8. durable concurrency, rate limiting, audit, cleanup, and disposable PostgreSQL
   assurance;
9. truthful provider-neutral delivery behavior without a second sender or any real
   external send during OT-62.

Every person authenticates as their own canonical One Time identity and receives
only their own active account, product, membership, relationship, and learner
scope.

GENERATION-TIME AUDIT CHECKPOINT — REVERIFY, DO NOT BLINDLY COPY

The following findings were true during prompt preparation. They are historical
orientation, not authority to skip a fresh audit of BASE_SHA.

1. The audited OT-38 security head was
   245649523566a7a0ace493ba70ede2a405ebdcce. Its implementation contained real
   owner/admin TOTP MFA, digest-only pre-auth proofs, encrypted factor seeds,
   hashed recovery codes, credential/session versions, server-revocable session
   families, durable login and MFA throttling, session-bound CSRF proof, and
   protected no-store responses. Its report also identified missing exposed
   factor replacement, factor disablement, and recovery-code regeneration
   settings, plus blocked real-PostgreSQL proof. Reinspect the accepted
   descendants rather than assuming those gaps remain or were resolved.
   

2. The historical OT-38 schema and domain paths included account users,
   credentials, sessions, pre-auth transactions, MFA factors, recovery codes,
   throttle buckets, credential versions, and session versions. At that point,
   account_users still combined identity, membership, role, and credential
   concerns more tightly than the target OT-62 identity model permits. Do not
   preserve that conflation merely for convenience, but also do not destructively
   split accepted data without a migration and compatibility plan.
   

3. The historical web runtime exposed login, MFA verification, logout, session,
   and CRM routes, but did not expose a complete invitation, activation, recovery,
   password reset, password change, session-management, or factor-management
   surface. Reinventory the accepted OT-60 routes before adding anything.
   

4. Public signup historically created scoped contact, lead, audit, idempotency,
   and provider-neutral outbox data transactionally. It did not create a portal
   user or membership. Preserve that boundary: a public lead or contact is not
   silently converted into an authenticated user.
   

5. The corrected delivery foundation used explicit versioned event kinds,
   sink-only execution, durable claims, FOR UPDATE SKIP LOCKED, deterministic
   delivery keys, redacted audit data, and truthful distinctions such as queued
   locally versus processed in test mode. Reuse the accepted canonical outbox and
   worker boundaries instead of creating a second sender.
   

6. The repository migration runner historically used a checksummed,
   forward-only ledger protected by a PostgreSQL advisory transaction lock.
   Therefore, “reversible” means operationally reversible through additive or
   forward-compensating changes when down migrations are not repository policy.
   Never edit an accepted migration byte.
   

7. OT-20 portal contracts establish separate parent, household, guardian,
   learner, and student-access concepts; one student subject resolves to exactly
   one learner; parents require active relationships; learner-profile creation
   and student-access creation are separate; public student registration is
   prohibited; reset and suspension preserve learner history; and staff access is
   not impersonation. Treat old contract names as historical evidence and map
   their semantics to the actual accepted OT-52 implementation.
   :contentReference[oaicite:6]{index=6}

8. The planned OT-60 convergence contract reserves central wiring to the
   convergence branch and requires one canonical auth/session runtime, one
   household/learner model, one outbox, shared capability injection, canonical
   route registration, and disposable PostgreSQL proof. BASE_SHA must be audited
   to confirm what actually converged.
   :contentReference[oaicite:7]{index=7}

Generation source: the supplied PG-14 contract. :contentReference[oaicite:8]{index=8}

CURRENT PRIMARY SECURITY BASELINE TO REVERIFY AT IMPLEMENTATION TIME

Before editing, inspect the current versions of the primary documents below and
record the titles, revision dates or commit dates where available, the exact
requirements relied on, and any material change from this generation-time
checkpoint. Prefer current OWASP, NIST, WHATWG/MDN, Node.js, Express, and accepted
repository guidance over blogs or folklore.

Generation-time findings included:

- OWASP recommends Argon2id and lists 19 MiB memory, two iterations, and one lane
  as one minimum configuration. The historical OT-38 settings matched that
  minimum, but the accepted implementation must be rebenchmarked and must not be
  weakened merely to make tests faster. :contentReference[oaicite:9]{index=9}
- OWASP forgot-password guidance calls for consistent responses and timing for
  existent and nonexistent accounts, cryptographically generated sufficiently
  long proofs, secure storage, single-use invalidation, rate limiting, and
  ordinary login after reset rather than automatic login. :contentReference[oaicite:10]{index=10}
- OWASP session guidance requires regeneration after authentication and privilege
  changes and server-enforced idle and absolute expiration. :contentReference[oaicite:11]{index=11}
- OWASP MFA guidance treats factor replacement as a high-risk operation requiring
  reauthentication with an existing factor and recognizes one-time recovery
  codes. :contentReference[oaicite:12]{index=12}
- OWASP CSRF guidance requires protection for state-changing requests, recommends
  server-validated synchronizer or session-bound signed-token patterns, and
  forbids leaking CSRF values through URLs or logs. :contentReference[oaicite:13]{index=13}
- NIST SP 800-63B Revision 4 requires at least 15 characters when a password is a
  single authentication factor, permits a minimum of eight when the password is
  always part of MFA, recommends supporting at least 64 characters, prohibits
  arbitrary composition rules and periodic forced changes, requires blocklisting
  common or compromised passwords, permits password managers and paste, and
  requires effective rate limiting. Preserve any accepted stronger product policy.
  :contentReference[oaicite:14]{index=14}
- URI fragments are processed client-side and are not sent to the server in the
  request; history.replaceState can replace the current address entry; a
  no-referrer policy omits referrer information. These properties support, but do
  not alone prove, a safe fragment-based one-time ceremony. :contentReference[oaicite:15]{index=15}
- Express 5 production guidance emphasizes TLS, input validation, safe redirects,
  security headers, secure cookies, durable session storage, and brute-force
  protection. Reconcile these with the accepted custom session implementation
  rather than adding a competing Express session package. :contentReference[oaicite:16]{index=16}

Do not quote a stale numeric recommendation without verifying that it remains
current and compatible with the exact accepted Node version, deployment resources,
and repository policy.

HARD GATE 0 — SHA, REMOTE, AND ACCEPTANCE

Perform this phase read-only. Do not create a branch, worktree, generated file,
dependency artifact, migration, evidence file, commit, push, or GitHub object until
every item passes.

1. Confirm BASE_SHA is exactly 40 lowercase hexadecimal characters.
2. Stop if BASE_SHA is absent, malformed, descriptive prose, a branch name, a PR
   number, an abbreviated SHA, or an unresolved template value.
3. Locate a repository clone whose canonical origin resolves exactly to
   webcraft-media/onetimev2.
4. Read the root AGENTS.md and every nested AGENTS.md relevant to any candidate
   file.
5. Fetch remote refs without rewriting local history.
6. Confirm BASE_SHA resolves as a commit and is reachable from the exact accepted
   OT-60 convergence remote ref or an explicitly documented accepted equivalent.
7. Confirm the remote convergence head has not moved away from BASE_SHA.
8. Read the complete OT-60 final report, merge ledger, migration ledger, conflict
   ledger, integration wiring evidence, security/role matrix, PostgreSQL assurance,
   changed-file list, and integration manifests.
9. Independently inspect source and tests. Do not treat the OT-60 report or green CI
   as sufficient.
10. Confirm the accepted base contains one canonical:
    - user or identity model;
    - credential implementation;
    - account/product membership model;
    - capability resolver;
    - session runtime;
    - CSRF mechanism;
    - MFA factor/challenge/recovery-code implementation;
    - household/guardian/learner/student-access model;
    - provider-neutral outbox and worker boundary;
    - audit convention;
    - error envelope;
    - API namespace;
    - authenticated shell and route registry.
11. Confirm the accepted OT-38 security semantics and accepted OT-52 portal
    semantics are present either through their expected ancestry or through a
    documented equivalent in OT-60.
12. Confirm every accepted migration and checksum matches OT-60 evidence.
13. Confirm disposable PostgreSQL assurance is present or truthfully marked as an
    unresolved release blocker.
14. Confirm there is no second or legacy auth runtime already being mounted.
15. Confirm ordinary One Time routes do not load or authenticate through BNA.
16. Confirm no accepted source introduces impersonation or view-as behavior.
17. Inspect open branches, pull requests, local worktrees, local-only commits,
    stashes, and untracked files for ownership collisions.
18. Specifically inspect any active OT-61 or later shell/auth branch. If another
    active branch owns the same auth, account-access, parent learner-access,
    security-settings, shell, central route, contract barrel, migration, or worker
    files, stop before writing unless the collision is resolved by an exact
    documented ownership order.
19. Confirm the proposed OT-62 branch name and worktree path do not already exist
    locally or remotely. If either exists, inspect and report it; do not delete,
    reset, reuse, or overwrite it.
20. Confirm no repository instruction requires a different branch or PR base.

On failure, stop with:

OT-62 NOT STARTED — HARD PREFLIGHT FAILED

Report the exact failed gate, expected value, observed safe metadata, and zero
repository or external mutations. Do not substitute “latest,” another branch, a
nearby SHA, a planning document, or a chat assertion.

HARD GATE 1 — SECURITY-CRITICAL PRODUCT AUTHORITY

Before writing, determine from accepted source and contracts:

1. which principals may invite an owner, administrator, parent, guardian, or
   student-access subject;
2. the exact capabilities required for issue, resend, revoke, suspend, restore,
   factor management, session revocation, and audit viewing;
3. the accepted parent/student MFA policy;
4. the accepted verified identity-delivery channels;
5. the approved recipient and channel for student setup/reset;
6. whether an existing verified user can acquire another scoped membership through
   invitation and under what conflict rules;
7. how a contact or lead may be associated with, but not silently merged into, a
   user;
8. the accepted idle and absolute session policy;
9. the accepted account-recovery policy when a privileged user has lost every MFA
   factor and recovery code;
10. the exact canonical outbox event and delivery-state vocabulary;
11. the canonical shell and route ownership;
12. whether any accepted policy permits WhatsApp account-recovery links;
13. whether any accepted policy permits support-assisted credential recovery.

Stop the affected unsafe path rather than guessing when any of these decisions is
unresolved. A support bypass, shared credential, hidden super-admin operation,
unverified email merge, arbitrary role string, or improvised child MFA policy is
not an acceptable default.

A narrowly scoped safe independent foundation may proceed only when:

- BASE_SHA and the canonical ownership gates passed;
- the unresolved decision is isolated to a clearly separable activation or
  delivery path;
- no UI advertises the blocked path as functional;
- no account, membership, relationship, credential, or proof can be activated
  through it;
- the final report identifies the exact blocker and affected routes;
- the foundation does not encode a guessed policy that will be hard to reverse.

Otherwise stop before writing.

ISOLATION AND GIT METHOD

After the hard gates pass:

1. Record:
   - origin URLs;
   - BASE_SHA;
   - exact remote convergence ref and SHA;
   - git log graph around the convergence range;
   - all worktrees and statuses;
   - branch ownership and collision findings;
   - migration files and checksums;
   - applicable AGENTS.md instructions.
2. Create one fresh external worktree from exact BASE_SHA.
3. Create branch:
   codex/ot62-account-activation-credential-lifecycle
4. Never edit an existing worktree.
5. Never modify an accepted source branch.
6. Never import commits from a stale auth branch.
7. Do not merge main, another open PR, BNA, or an unrelated feature branch.
8. Do not rebase, squash, amend, reset, force-push, or rewrite history.
9. Use small intentional commits grouped by coherent behavior.
10. Do not mass-format or perform unrelated cleanup.
11. Preserve all accepted migration bytes and checksums.
12. Reserve new migration identifiers only after reading the actual accepted
    ledger and concurrent branch reservations.
13. If the required migration range is already claimed or an active writer owns
    the same domain, stop and report the collision.

PHASE 1 — COMPLETE CURRENT-STATE AUDIT

Before designing schema or editing code, create a private implementation worksheet
and inspect all actual current source relevant to the following.

A. Identity and membership

Map exact tables, types, services, repositories, routes, and tests for:

- person or profile;
- public contact;
- signup lead;
- canonical user identity;
- normalized login identities;
- password credential;
- account membership;
- product membership or scope;
- role labels;
- capability grants and resolution;
- membership state and version;
- household;
- guardian or parent relationship;
- learner profile;
- student access/login identity;
- learner-access generation;
- verified email or other delivery identity;
- suspension, archive, closure, and deletion semantics;
- support visibility;
- audit actor and subject identifiers.

Identify every place where two of these concepts are currently conflated. Do not
assume identical emails prove that two records represent the same person.

B. Authentication and sessions

Map:

- password hashing and verification;
- hash version/work-factor migration;
- dummy verification for unknown identities;
- login rate limits;
- pre-auth transactions;
- privileged MFA requirements;
- TOTP seed encryption;
- TOTP verification window and replay defense;
- recovery-code hashing and atomic consumption;
- session creation and rotation;
- session-family or subject-version invalidation;
- credential and membership versions;
- idle and absolute expiration;
- cookie attributes and scope;
- CSRF proof creation and validation;
- return-path validation;
- private response cache headers;
- logout;
- 401 and 403 client-state handling;
- session listing and revocation support;
- account security settings;
- observability and redaction.

C. Portal authorization

Map the accepted OT-52 implementation for:

- parent subject resolution;
- household membership;
- guardian relationship;
- linked learner authorization;
- maximum active learner enforcement;
- learner profile lifecycle;
- student subject and exact learner binding;
- learner access create/reset/suspend/restore;
- consent or policy versions;
- protected content/class access;
- sibling isolation;
- shared-device state clearing;
- parent actions that remain parent-session actions;
- role and relationship negative tests.

D. Delivery and communications

Map:

- outbox schema and event kinds;
- provider-neutral intent creation;
- transaction ownership;
- deterministic delivery keys;
- sink/live mode boundary;
- worker claim, lease, retry, dead-letter, and cleanup behavior;
- suppression and verified-channel checks;
- recipient resolution;
- template rendering;
- encrypted payload or protected-secret facilities;
- communications read model;
- truthful delivery projection;
- audit and log redaction;
- provider outage behavior;
- external-network test guards.

Determine whether a one-time proof can be delivered asynchronously without storing
raw plaintext in an ordinary outbox payload. Reuse an accepted protected-envelope
facility if one exists. If none exists, design one minimal canonical delivery-secret
seam rather than placing a raw proof in generic payload JSON or creating a second
sender.

E. Routes, APIs, forms, buttons, and shells

Inventory every current:

- login page and form;
- MFA challenge/enrollment page;
- logout action;
- recovery link or placeholder;
- password reset page or placeholder;
- current-user security page;
- account/user access page;
- invitation control;
- resend/revoke control;
- suspend/restore control;
- parent learner-access control;
- student login/setup/help page;
- route-registration hook;
- API operation;
- loading state;
- error state;
- no-op handler;
- placeholder toast;
- dead button;
- client cache;
- service worker;
- analytics, metrics, error-tracking, or performance instrumentation path.

Record the exact canonical shell and component library for owner/admin, parent,
student, login, and isolated auth ceremonies. Do not create a third shell.

F. Database and engineering conventions

Map:

- migration ledger and reservation policy;
- transaction helper;
- isolation levels;
- row locks and advisory locks;
- uniqueness and partial indexes;
- optimistic concurrency or ETags;
- idempotency conventions;
- normalized identity utilities;
- clock and randomness injection;
- encryption and hashing utilities;
- error envelope;
- pagination and cursor conventions;
- audit vocabulary;
- cleanup worker patterns;
- PostgreSQL test harness;
- pg-mem limitations;
- synthetic volume conventions;
- secret scanning;
- browser and accessibility harnesses;
- package and bundle budgets.

G. Threat inventory

Explicitly look for:

- duplicate auth/session/MFA stores;
- raw tokens in a database, URL, log, analytics event, error, or screenshot;
- readable JWT identity/scope payloads used as invitation/reset proofs;
- query-string recovery or activation secrets;
- open redirects;
- host-header link construction;
- unbounded resend paths;
- process-local production rate limits;
- account enumeration by body, status, headers, timing, cache behavior, or
  delivery status;
- client-supplied roles, account IDs, product IDs, household IDs, relationship
  IDs, learner IDs, membership IDs, invitation purposes, or capabilities;
- stale membership or relationship authorization;
- session fixation;
- missing idle expiry;
- password reset that leaves sessions alive;
- factor replacement without strong reauthentication;
- last-required-factor disablement;
- TOTP timestep replay;
- recovery-code races;
- sibling selectors in student requests;
- parent retrieval of student credentials;
- automatic contact/user merging;
- provider waits in public/API requests;
- fake “sent” or “delivered” labels;
- third-party scripts on activation/reset pages;
- private state in localStorage, IndexedDB, caches, or service workers;
- BNA imports, cookies, roles, or runtime calls;
- hidden impersonation or super-admin behavior.

PHASE 2 — WRITE THE EXECUTION-GRADE IMPLEMENTATION MAP BEFORE EDITS

Create a concise internal implementation map under sanitized OT-62 evidence. It
must include:

1. current-versus-target identity entity map;
2. canonical ownership of identity, credentials, memberships, relationships,
   learner access, MFA, sessions, proofs, outbox, and UI;
3. invitation lifecycle state machine;
4. proof lifecycle state machine;
5. activation state machine;
6. password-recovery state machine;
7. MFA enrollment and management state machines;
8. student-access lifecycle;
9. exact transition authority for every state change;
10. role/capability/relationship matrix;
11. session-invalidation matrix;
12. credential and security-version matrix;
13. normalized identity and conflict matrix;
14. endpoint, method, DTO, error, cache, CSRF, reauthentication, and idempotency
    contracts;
15. transaction and rollback boundaries;
16. uniqueness, locking, optimistic-concurrency, and retry plan;
17. durable abuse-control plan;
18. token purpose, entropy, digest, expiry, generation, invalidation, and cleanup
    plan;
19. delivery event, protected-secret, template, suppression, and status ownership;
20. route/component/action inventory;
21. bundle-isolation plan;
22. migration reservation based on the actual ledger;
23. exact allowed and prohibited file ownership;
24. active branch collision resolution;
25. test and evidence plan;
26. rollback or forward-compensation plan.

Do not begin product edits until this map is internally consistent and every
visible action has one real server operation and one authorization rule.

BINDING DOMAIN INVARIANTS

1. Canonical objects remain distinct

- A contact or lead is not automatically a user.
- A person/profile is not automatically a login identity.
- A user identity is not automatically an account or product membership.
- A membership is not a household guardian relationship.
- A guardian relationship is not a global role.
- A learner profile is not a student login identity.
- Student login access is bound to exactly one learner.
- One user may hold multiple legitimate scoped relationships, but each request
  resolves one explicit active account/product context server-side.
- Creating, resetting, suspending, restoring, closing, or deleting login access
  must not delete a contact, lead, household, learner, enrollment, attendance,
  progress, rewards, content assignment, question, or audit history.
- Do not use unverified email or phone equality as an automatic person merge.

2. Real users only

- Rabbi Scheller authenticates as the real owner membership.
- Shloimie authenticates as the real administrator membership.
- Parents and guardians authenticate as themselves.
- Students authenticate as their own student identity tied to one learner.
- No “View as Rabbi,” “View as Parent,” “View as Student,” session assumption,
  shared password, reusable administrator magic link, borrowed capability, or
  hidden bypass.
- Parent launch of learner-authorized content or class access remains an audited
  parent action in the parent session. It never mints a student session.
- Staff may inspect sanitized state only through explicit capabilities while the
  audit actor remains the real staff identity.
- Support cannot retrieve passwords, hashes, active proofs, MFA seeds, recovery
  codes, session tokens, or raw provider links.

3. Server-authoritative scope

For every protected request and again immediately before every consequential
write, derive and verify server-side:

- current canonical user;
- active account and product;
- active membership;
- current capability set;
- current membership/security version;
- active parent/guardian relationship where relevant;
- active household and learner relationship where relevant;
- exact student-to-learner binding where relevant;
- learner-access generation and suspension state;
- required consent/policy state;
- recent reauthentication where required.

The browser must never authoritatively choose a role, account, product, household,
guardian relationship, learner, invitation purpose, membership capability, or
student binding.

TARGET SEMANTIC ENTITY MODEL

Adapt physical names to accepted source. Preserve these semantic separations even
if compatibility views or transitional columns are needed.

A. Canonical user identity

Represents the real person who authenticates. It may be associated with multiple
verified login identities and multiple scoped memberships. It is not itself an
authorization grant.

B. Login identity

Represents a normalized, verified identifier such as an email address or accepted
student username. Preserve original display form separately where appropriate.
Apply the accepted normalization algorithm consistently. Do not invent aggressive
email canonicalization that changes provider-specific local-part semantics.

C. Credential

Represents password verifier metadata and credential/security version. Password
hashes remain separate from ordinary user and membership DTOs.

D. Account/product membership

Represents authorization to one exact account/product context. Role labels are
display or grouping data; capabilities and current membership state control
authorization.

E. Household guardian relationship

Represents an explicit scoped relationship between a parent user/person and a
household or linked learner. It is not a global parent role.

F. Learner profile

Represents the managed learner and durable learning history.

G. Student access identity

Represents login access for exactly one learner, with its own access generation,
state, credential binding, and session invalidation boundary. It must not become a
household-wide identity.

H. Invitation

Represents an operator-authorized proposed activation or membership action,
including exact purpose, scope, intended normalized identity, inviter, proposed
capabilities, and any relationship or learner binding.

I. One-time proof

Represents the digest, purpose, generation, expiry, state, and consumption metadata
for one activation, reset, or student setup ceremony. Do not store raw plaintext in
ordinary records.

J. Delivery intent

Represents provider-neutral asynchronous delivery work and truthful delivery
projection. Invitation lifecycle and delivery lifecycle are related but not the
same state machine.

K. MFA factor and challenge

Extend the canonical accepted MFA store and pre-auth flow. Do not create a second
factor table, recovery-code model, challenge mechanism, or session assurance
system.

MIGRATION REQUIREMENTS

1. Never edit an accepted migration.
2. Use the next actually free identifier or reserved OT-62 range from the accepted
   ledger.
3. Add only schema required for the canonical target.
4. Follow the repository’s forward-only/checksummed policy.
5. Where down migrations are not policy, provide a documented forward-compensation
   and feature-disable strategy.
6. Preserve existing accepted data and identifiers.
7. Do not destructively split or rewrite account users without a staged,
   transactional compatibility plan.
8. Use foreign keys, CHECK constraints, NOT NULL constraints where valid, partial
   unique indexes, and server-owned versions to enforce invariants.
9. Database constraints must protect:
   - one current canonical binding per login identity under accepted policy;
   - one student access identity per learner where that is the accepted rule;
   - exactly one current proof generation per logical purpose/scope;
   - no simultaneous double activation;
   - no duplicate membership creation;
   - no duplicate guardian relationship activation;
   - no duplicate recovery-code use;
   - no disabling the last required privileged factor;
   - atomic active-learner capacity enforcement;
   - scoped outbox idempotency.
10. Do not rely on client validation, process-local mutexes, or pg-mem for
    concurrency safety.
11. Provide injectable clock and cryptographic-random interfaces for deterministic
    tests while production defaults remain CSPRNG-backed and fail closed.
12. Preserve hash/encryption algorithm identifiers and key versions needed for
    safe future rotation.
13. Cleanup must use bounded batches and be safe with multiple workers.
14. Preserve required audit history even after expiring or removing sensitive
    ciphertext.

INVITATION LIFECYCLE

Implement one transactional, auditable invitation system.

A. Required scope

Every invitation must bind server-side to:

- exact account;
- exact product;
- intended normalized login identity;
- invitation purpose;
- inviter;
- proposed membership or capability template;
- target identity type;
- current target version or generation where relevant;
- exact household or guardian relationship where relevant;
- exact learner/student-access identity where relevant;
- issue time;
- expiry;
- current invitation generation;
- revocation/supersession/acceptance metadata;
- safe delivery-intent reference;
- idempotency and optimistic-concurrency metadata.

Do not let clients submit arbitrary role strings, capability arrays, account IDs,
product IDs, household IDs, relationship IDs, learner IDs, or invitation purposes.
The server derives allowed targets from the authenticated actor and accepted
capability policy.

B. Separate lifecycle from delivery projection

Use exact accepted enum names where they exist. Otherwise implement equivalent
semantics with a documented mapping.

Invitation lifecycle must distinguish at least:

- pending;
- accepted;
- expired;
- revoked;
- superseded;
- failed or blocked where creation cannot complete.

Delivery projection must distinguish only states proven by the canonical outbox and
provider contract, such as:

- queued locally;
- processed in sink/test mode;
- provider accepted;
- delivered;
- bounced;
- failed;
- expired;
- unknown.

Never treat:

- invitation pending as sent;
- queued locally as provider accepted;
- sink processed as externally sent;
- provider accepted as human received;
- invitation accepted as proof that an email was delivered;
- a missing webhook as delivered.

C. Proof properties

Invitation and activation proofs must be:

- generated with an accepted CSPRNG;
- opaque and free of readable identity/scope claims;
- sufficiently high entropy for online and database-compromise threat models;
- purpose-bound;
- account/product-bound;
- recipient-bound;
- generation-bound;
- expiring;
- single-use;
- stored as a digest or accepted one-way verifier for redemption;
- compared using accepted safe primitives;
- invalid after acceptance, expiry, revocation, supersession, scope/version change,
  relevant membership change, relationship change, learner-access reset, or
  security change;
- absent from generic logs, audit metadata, database query logging, metrics,
  traces, errors, screenshots, browser storage, service-worker caches, support
  output, and evidence.

Do not use a readable JWT merely to avoid server state.

D. Atomic redemption

Redeem inside one transaction that:

1. locks or conditionally consumes the exact proof generation;
2. verifies purpose, digest, expiry, lifecycle state, account/product, intended
   identity, target version, relationship, learner binding, and invitation state;
3. rechecks the inviter’s still-valid authority where accepted policy requires;
4. rechecks target membership, suspension, relationship, and conflict state;
5. creates or safely binds the canonical user;
6. creates only the authorized membership or relationship;
7. writes the accepted credential or activation state;
8. marks the proof consumed and invitation accepted;
9. supersedes conflicting pending proofs;
10. emits sanitized audit events;
11. enqueues any required transactional outbox intents;
12. commits all or nothing.

A simultaneous redemption must produce one logical activation. Losing transactions
must make no partial user, credential, membership, relationship, session, audit, or
delivery write.

Double-click and provider-retry behavior may return a safe idempotent completion
state but must never create a second logical activation or another membership.

E. Issue, resend, revoke, and expiry

Invitation creation, resend, revoke, and expiry require exact capabilities.

Resend must:

- use durable account/product/identity/network abuse controls;
- enforce a durable cooldown;
- rotate to a new proof generation;
- atomically supersede the old proof;
- preserve one current valid logical invitation;
- reuse a stable logical invitation identity where appropriate;
- create an idempotent outbox intent;
- never leave unlimited valid links;
- not disclose whether an unrelated identity exists.

Revoke must immediately invalidate every current proof for that invitation and
prevent later acceptance.

Expiry must be enforced at redemption time, not only by cleanup.

Cleanup may project expired state and remove expired protected ciphertext in bounded
multi-worker-safe batches. Cleanup must not erase required audit history.

F. Conflict matrix

Implement and test explicit outcomes for:

- no existing user or contact;
- existing contact but no user;
- existing user with verified same identity and no target membership;
- existing user with another legitimate membership;
- existing target membership already active;
- existing membership suspended or revoked;
- existing user or contact with case-variant identity;
- duplicate contacts with the same unverified email;
- email attached to another person record;
- changed intended email after issuance;
- revoked guardian relationship;
- archived household;
- learner moved, archived, or suspended;
- student-access generation changed;
- target data changed between issue and acceptance;
- concurrent invitations for the same logical target;
- simultaneous resend and acceptance;
- simultaneous revoke and acceptance;
- stale optimistic-concurrency version.

Never automatically merge people, contacts, households, or learners based only on
email or phone equality.

ACTIVATION AND CREDENTIAL SETUP

1. Activation proves possession of the intended approved delivery channel and lets
   the recipient choose their own credential.
2. Never generate, email, display, or return a password.
3. Never place a password or identity scope in a URL.
4. Use the accepted password hashing implementation and preserve any accepted
   stronger policy.
5. Rebenchmark the accepted Argon2id configuration on representative runtime
   resources. Test configuration may inject a bounded fast verifier only through an
   explicit test seam; production configuration must not be weakened.
6. Unless accepted policy is stronger or a documented product decision differs:
   - password-only identities require at least the current NIST single-factor
     minimum;
   - identities for which password is always part of enforced MFA require at least
     the current NIST MFA minimum;
   - support at least 64 characters;
   - accept spaces and supported Unicode safely;
   - permit password managers, autofill, and paste;
   - reject common or compromised passwords through a privacy-safe blocklist;
   - do not impose arbitrary uppercase/lowercase/number/symbol composition;
   - do not require periodic password changes without compromise evidence;
   - do not use password hints or security questions.
7. Bound maximum input bytes to prevent denial of service while retaining
   passphrase support.
8. Preserve compatibility with existing accepted password normalization and hash
   verification. Do not silently normalize existing passwords differently.
9. Verify password confirmation in the ceremony without logging either value.
10. Activation must not accept a client-selected role, capability set, membership,
    account, product, household, learner, or relationship.
11. Successful activation rotates or establishes a fresh session only through the
    canonical session service.
12. Owner or administrator activation must complete the accepted real MFA policy
    before any privileged application session is issued.
13. Do not treat a historical mfa_capable flag as proof that a factor is enrolled
    or that an MFA challenge was completed.
14. If activation creates a pre-auth state for privileged MFA enrollment, bind it
    to the consumed invitation, user, membership, purpose, assurance state,
    generation, and short expiry.
15. Do not expose household or sibling data merely by validating an activation
    proof.

PARENT OR GUARDIAN INVITATION AND ACTIVATION

1. Bind a parent/guardian invitation to an approved persisted relationship or
   relationship proposal authorized by accepted policy.
2. Do not infer guardianship from matching contact data.
3. Do not expose household or learner details before activation and current
   relationship authorization.
4. Activation may create or bind the real parent user and activate only the exact
   relationship authorized by the invitation.
5. A parent role label alone never authorizes a household or learner.
6. Parent suspension, relationship removal, verified-identity change, or relevant
   security-version change must invalidate the correct sessions and protected
   client state.
7. Closing parent login access must not delete household, learner, enrollment,
   progress, attendance, content, or audit records.
8. Enforce the accepted active-learner limit atomically wherever learner creation is
   involved. Invitation issuance alone must not reserve unrelated learners or leak
   capacity details.
9. Parent actions involving student access require explicit capabilities and
   current relationship checks immediately before the write.
10. High-impact parent operations such as student access create/reset/suspend,
    verified-identity change, or relationship closure require the accepted recent
    reauthentication or step-up policy.

STUDENT ACCESS PROVISIONING

1. Learner-profile creation and student-access creation remain separate actions.
2. Student access can be created only for one existing learner visible through the
   authenticated parent’s active relationship or through explicit staff capability.
3. Bind the student access server-side to exactly one learner.
4. A student session must derive its learner from the canonical subject binding.
5. Student requests must not accept an authoritative learner ID, household ID,
   sibling selector, relationship ID, or access generation from a URL, body,
   hidden input, local storage, or browser-controlled header.
6. Do not implement public student registration.
7. Student login and help must not reveal whether a learner username or identity
   exists.
8. A parent may initiate setup, reset, suspend, restore, or device/session
   invalidation only for an authorized linked learner and only through explicit
   capabilities.
9. A parent cannot:
   - retrieve the learner’s current password;
   - retrieve the learner’s current setup/reset proof;
   - retrieve a reusable learner secret;
   - log in as the learner;
   - mint a learner session;
   - choose or switch to a sibling through the student identity;
   - provision an unrelated learner.
10. Student setup/reset proofs must bind to:
    - exact student-access identity;
    - exact learner;
    - current access generation;
    - exact purpose;
    - approved recipient/channel policy;
    - short expiry;
    - one-time consumption.
11. If the accepted recipient/channel policy is unresolved, leave that activation
    path blocked and truthful. Do not guess that an email, WhatsApp number, parent
    screen, or student device is approved.
12. Reset must:
    - increment or replace the learner-access generation;
    - invalidate old activation/reset proofs;
    - invalidate active student sessions;
    - preserve the learner profile and all learning history;
    - create one new purpose-bound setup/reset path;
    - audit the real parent/staff actor and learner subject;
    - never reveal the prior credential.
13. Suspension must immediately:
    - deny new student sessions;
    - invalidate existing student session families;
    - block protected class/content exchanges;
    - preserve learner and history;
    - remain reversible only through accepted capability policy.
14. Relationship removal or learner reassignment must invalidate affected access
    promptly and must not expose the former household or siblings.
15. Parent launch of learner-authorized content remains a parent-session action and
    must not use student credentials.

LOGIN, LOGOUT, AND SESSION LIFECYCLE

Reuse the accepted canonical product-scoped session implementation.

A. Login

- Preserve unknown-user dummy password verification.
- Preserve durable account/identity/network throttling.
- Return neutral errors for unknown identity, wrong password, suspended identity,
  wrong account, or unavailable membership.
- Do not reveal existence through status, body, headers, cache behavior, timing, or
  different rate-limit semantics.
- Resolve one explicit authorized product/account context server-side.
- For users with multiple legitimate memberships, use an accepted server-mediated
  context-selection flow that reveals only memberships already authorized for that
  user. Do not accept an arbitrary account ID.
- Owner/admin login must not complete until the accepted MFA challenge succeeds.
- Student login resolves exactly one learner and never shows a sibling selector.
- Validate return paths by same-origin allowlist and role namespace. Never accept a
  provider URL, protocol-relative URL, API route, activation proof, or foreign-role
  route as a return target.

B. Session creation and rotation

Rotate the session identifier at:

- successful authentication;
- activation;
- MFA completion;
- privilege or capability change;
- account/product context establishment;
- password change;
- password reset if a policy-authorized session survives;
- factor replacement or disablement;
- other accepted high-risk boundaries.

Destroy the prior identifier and prevent fixation.

C. Validation on protected requests

On every protected request, validate:

- session digest;
- expiry;
- idle timeout;
- absolute timeout;
- current user state;
- current credential/security version;
- current membership state and version;
- current account/product scope;
- current capabilities;
- current relationship where applicable;
- current learner binding/access generation where applicable;
- current MFA assurance where required.

Repeat authorization and version checks immediately before consequential writes.

D. Expiry and revocation

Use server-enforced idle and absolute expiry. If accepted source lacks an approved
idle value, do not silently invent one; identify the policy blocker while
implementing any safe supporting mechanism separately.

Invalidate the correct session families after:

- logout;
- password reset;
- accepted password-change policy;
- membership suspension or revocation;
- role/capability change;
- guardian relationship removal;
- student-access reset or suspension;
- learner-binding change;
- verified identity change;
- MFA factor replacement or disablement;
- recovery-code regeneration where accepted policy requires;
- security-version increment;
- account closure.

E. Browser state

- Session cookies remain Secure, HttpOnly, narrowly scoped, and SameSite according
  to the accepted flow.
- Do not persist credentials, proofs, session tokens, email addresses, account IDs,
  household IDs, learner IDs, or MFA material in localStorage, IndexedDB, URLs, or
  service-worker caches.
- Private responses use the accepted private no-store policy and Vary behavior.
- A 401 or 403 purges protected in-memory state and removes private content before
  navigation.
- Logout and principal changes prevent stale sibling, learner, audit, or membership
  data from flashing.
- Coordinate cross-tab session expiry without storing secret values.

PUBLIC RECOVERY AND PASSWORD RESET

A. Recovery initiation

Implement a public operation that always returns the same safe acknowledgement,
status class, cache policy, and public response shape for:

- eligible identity;
- ineligible identity;
- unknown identity;
- suspended identity;
- unsupported role;
- identity with no verified channel;
- rate-limited identity;
- duplicate request.

Do not disclose whether an outbox intent was created.

Use:

- accepted normalized identity handling;
- durable identity-hash plus network abuse controls;
- bounded request bodies;
- dummy or equivalent work to reduce observable timing differences;
- asynchronous provider-neutral outbox creation for eligible identities;
- no process-local-only production assurance;
- no third-party marketing scripts or provider widgets.

Measure timing statistically in controlled tests. Do not claim perfect constant
time from a few samples.

B. Reset proof

Reset proofs must be:

- CSPRNG-generated;
- opaque;
- purpose-bound;
- user/credential-generation-bound;
- account/product-bound where applicable;
- short-lived;
- one-time;
- digest-only for redemption;
- invalid after use, expiry, supersession, credential change, security-version
  change, membership invalidation, or relevant identity change.

Wrong, expired, malformed, replayed, superseded, cross-purpose, cross-user,
cross-product, and cross-account proofs must produce neutral outcomes and no partial
write.

C. Reset completion

Inside one transaction:

1. conditionally consume the exact proof;
2. recheck current user, login identity, credential generation, membership, and
   policy;
3. validate and hash the new password;
4. increment or rotate the accepted credential/security version;
5. invalidate all applicable session families;
6. invalidate every outstanding reset proof for that identity/credential;
7. emit sanitized audit events;
8. enqueue a minimum-disclosure security notification if the accepted delivery
   policy supports it;
9. commit all or nothing.

Do not automatically log the user in unless an accepted security policy explicitly
requires and justifies it. The default outcome is ordinary login through the
canonical flow.

Do not reveal the old password or compare it in user-facing errors.

D. Authenticated password change

Implement through the canonical current-user security surface.

Require:

- current password or accepted recent strong reauthentication;
- current MFA when required;
- CSRF protection;
- password policy and blocklist;
- security/session-version update according to accepted policy;
- session rotation;
- invalidation of other sessions where required;
- sanitized audit;
- no password in logs, analytics, errors, or evidence.

BROWSER TRANSPORT FOR ACTIVATION AND RESET PROOFS

Preferred pattern:

1. The delivered link targets a minimal same-origin ceremony page and places the
   opaque proof in the URL fragment.
2. The fragment contains no readable email, role, account, product, household,
   learner, or membership data.
3. The initial HTTP request contains no proof.
4. Minimal first-party client code extracts the proof.
5. It immediately calls history.replaceState to remove the fragment from the
   current history entry before analytics, error monitoring, performance marks,
   secondary rendering, or user interaction.
6. It retains the proof only in ephemeral memory.
7. It sends the proof once in a bounded HTTPS POST body to the canonical API.
8. It clears the in-memory value after completion or terminal failure.
9. The page sets strict no-store and no-referrer behavior.
10. It loads no third-party marketing, analytics, provider, social, CRM, content,
    billing, chat, or tag-manager script.
11. It has no service-worker caching and no prefetch/prerender of proof-bearing
    state.
12. It does not include external images, fonts, or resources that could observe
    navigation metadata before scrub.
13. Errors never echo the proof.
14. Browser screenshots and traces used as evidence must use synthetic redacted
    values and must not preserve the full proof.

If the accepted framework cannot safely use a fragment, another opaque-token
pattern is permitted only after a written leakage analysis proving equivalent
protection, including:

- strict referrer policy;
- trusted fixed origin construction;
- immediate address removal;
- access-log and route-metric redaction;
- no third-party resources;
- browser-history tests;
- no query-string persistence;
- no server redirect that logs the proof;
- equivalent negative tests.

Never place in a URL:

- password;
- MFA seed;
- QR payload;
- recovery code;
- session token;
- CSRF token;
- email address;
- account/product identifier;
- household or learner identifier;
- readable JWT identity/scope claims.

DELIVERY AND PROTECTED SECRET HANDOFF

1. Reuse the canonical provider-neutral outbox and worker.
2. Do not make invitation/recovery API requests wait on a provider.
3. Create the invitation/reset record and its outbox intent transactionally.
4. Generic outbox payloads must contain only safe opaque references and minimum
   routing metadata. They must not contain raw passwords, raw proofs, TOTP seeds,
   recovery codes, private message bodies, or unnecessary PII.
5. If asynchronous rendering requires the raw one-time proof after the request
   transaction:
   - reuse an accepted protected-envelope facility if present;
   - otherwise add one minimal restricted delivery-secret facility using accepted
     authenticated encryption and a versioned key held outside the database;
   - keep verifier state digest-only;
   - store only ciphertext, nonce, key version, purpose, expiry, and opaque
     references;
   - never expose ciphertext or decrypted material in generic DTOs or
     communications history;
   - decrypt only in worker memory immediately before approved rendering;
   - redact all logs and errors;
   - remove or cryptographically destroy delivery ciphertext after terminal
     handling according to accepted retry policy;
   - preserve non-secret audit history.
6. Do not create another delivery worker or direct provider client.
7. Use only an accepted verified identity-delivery channel.
8. Do not use Telegram for routine invitation, activation, or recovery.
9. Do not use WhatsApp for login/reset links unless an independently accepted
   policy and secure provider contract explicitly authorize it.
10. Ordinary local and CI verification remains fake/sink-only with zero external
    network.
11. Templates disclose only the minimum:
    - One Time identity;
    - neutral action description;
    - expiry/help guidance where approved;
    - no password;
    - no private role-sensitive data;
    - no household or sibling details;
    - no raw class/provider target.
12. Use a trusted configured application origin, not the request Host header, to
    construct links.
13. Suppression and verified-channel policy must be rechecked immediately before
    dispatch where the accepted model requires.
14. Provider outage may change delivery projection but must not corrupt the valid
    local invitation/reset intent.
15. Retry must never create a second invitation, proof generation, membership,
    relationship, or reset.
16. Communications history displays only safe, truthful lifecycle metadata.

MFA ENROLLMENT, CHALLENGE, RECOVERY, AND MANAGEMENT

Extend the accepted canonical MFA implementation. Do not create a second factor
store, challenge token type, recovery-code model, assurance flag, or session flow.

A. Privileged policy

- Owner and administrator access requires the accepted real MFA policy.
- A privileged user does not receive privileged application access until the
  current password and current factor challenge or enrollment ceremony are
  complete.
- Do not weaken privileged MFA to unblock tests.
- Do not silently impose a new MFA requirement on parents or students.
- Use the accepted parent/student decision.

B. TOTP enrollment

1. Create a server-side pending factor with:
   - exact user;
   - exact account/product context where required;
   - purpose;
   - pending state;
   - short expiry;
   - encrypted versioned seed;
   - attempt counters;
   - creation metadata.
2. Display the seed or locally generated QR payload exactly once in the protected
   authenticated ceremony.
3. Never return the seed through a list-factor endpoint.
4. Do not store the seed or QR payload in browser persistence.
5. Do not load a third-party QR service.
6. Activate the factor only after a correct confirmation code.
7. Atomically record the accepted timestep to prevent replay.
8. Expire and clean abandoned pending enrollments safely.
9. Do not include seed/QR values in screenshots, traces, logs, errors, analytics,
   or evidence.

C. Login challenge

- Bind the challenge to the pending authenticated transaction, user, credential
  version, membership/security version, intended account/product, purpose,
  assurance state, and short expiry.
- Prevent challenge swapping and role escalation between password and MFA steps.
- Enforce durable rate limits.
- Enforce accepted clock-skew policy.
- Atomically reject reused TOTP timesteps.
- Rotate into a fresh fully authenticated session only after successful challenge.

D. Recovery codes

- Generate with accepted CSPRNG.
- Display once.
- Store only accepted salted/hashed verifiers.
- Consume atomically.
- Reject concurrent reuse.
- Do not expose codes after the one-time ceremony.
- Regeneration requires strong recent password and MFA reauthentication.
- Regeneration invalidates every old unused code.
- Apply accepted session invalidation and audit policy.
- Never place codes in URLs, logs, screenshots, support output, or evidence.

E. Safe factor listing

Return only bounded metadata such as:

- opaque factor identifier;
- type;
- state;
- created time;
- safe last-used time if approved;
- display label if approved;
- whether it satisfies current policy.

Never return seed, encrypted seed, QR payload, recovery-code verifier, raw code,
challenge token, session ID, or internal key metadata.

F. Factor replacement

Implement as a high-risk ceremony:

1. require recent password plus existing MFA or the accepted equivalent;
2. create and verify a pending replacement factor;
3. recheck role and required-factor policy inside the transaction;
4. atomically activate the new factor and retire the intended old factor;
5. prevent a zero-factor privileged state;
6. invalidate appropriate sessions and outstanding challenges;
7. rotate the current session if policy allows it to survive;
8. notify through an accepted out-of-band channel;
9. emit sanitized audit.

Do not disable the old factor before the replacement is confirmed.

G. Factor disablement

- Require strong recent reauthentication.
- Recheck current membership and role.
- Deny disabling the last required privileged factor.
- Invalidate applicable sessions and challenges.
- Audit success and denial.
- Never let a client bypass policy through a factor ID belonging to another user.

H. MFA recovery gap

If a privileged user has lost all enrolled factors and recovery codes and accepted
source does not define a rigorous recovery policy, report a blocker. Do not add a
support override, database toggle, email-only bypass, reusable magic link, hidden
route, or shared administrator factor.

CAPABILITY AND AUTHORIZATION REQUIREMENTS

Do not authorize consequential operations from role strings alone when accepted
capabilities exist.

At minimum map and enforce separate capabilities for:

- invite owner;
- invite administrator;
- invite parent/guardian;
- view invitation state;
- resend invitation;
- revoke invitation;
- suspend membership;
- restore membership;
- view sanitized account-access audit;
- manage own password;
- list own sessions;
- revoke own sessions;
- revoke another subject’s sessions where explicitly authorized;
- enroll own MFA;
- list own factors;
- regenerate own recovery codes;
- replace own factor;
- disable own factor;
- parent create student access;
- parent reset student access;
- parent suspend student access;
- parent restore student access;
- staff manage student access;
- support inspect sanitized state.

Each operation must also enforce account/product scope, object relationship,
lifecycle state, optimistic version, and recent reauthentication where applicable.

Unauthorized or invisible objects normally produce a generic not-found or denial
consistent with accepted error policy. Do not reveal cross-account, cross-household,
or sibling existence.

API AND DTO CONTRACT

Derive exact route names from the accepted route registry and API namespace.
Extend canonical routers and registration hooks; do not create a parallel /auth2,
second session API, or duplicate portal namespace.

The final route inventory must provide real operations for the following semantic
actions, using accepted names:

Public or ceremony operations:

- login;
- MFA challenge completion;
- logout;
- recovery request;
- activation proof submission/inspection through protected POST semantics;
- activation completion;
- reset proof submission/inspection through protected POST semantics;
- reset completion;
- student access help without enumeration.

Authenticated current-user security operations:

- password change;
- list safe sessions;
- revoke one own session;
- revoke other own sessions;
- begin MFA enrollment;
- confirm MFA enrollment;
- list safe factors;
- begin factor replacement;
- confirm factor replacement;
- disable factor;
- regenerate recovery codes.

Owner/admin account-access operations:

- create invitation;
- list bounded invitation/membership state;
- view one safe record;
- resend invitation;
- revoke invitation;
- suspend membership/access;
- restore membership/access;
- list bounded sanitized audit history.

Parent learner-access operations:

- inspect safe access state for one linked learner;
- initiate setup where policy allows;
- reset access;
- suspend access;
- restore access;
- invalidate learner sessions through accepted semantics.

Contract rules:

1. Use bounded Zod or accepted validation schemas.
2. Reject unknown or oversized fields.
3. Never accept authoritative client scope.
4. Use the accepted standard error envelope.
5. Use stable machine-readable conflict and expiry codes without enumeration.
6. Apply CSRF to every authenticated cookie-based mutation.
7. Apply recent reauthentication tokens only through the canonical pre-auth or
   step-up mechanism.
8. Apply idempotency keys to retryable creation operations.
9. Apply If-Match, ETag, expected version, or the accepted optimistic-concurrency
   pattern to stale-state-sensitive mutations.
10. Private responses are no-store.
11. Public ceremony responses are no-store and no-referrer.
12. Paginate account-access and audit lists.
13. Never return:
    - password hashes;
    - credential verifier metadata unnecessary to UI;
    - invitation/reset proof digests;
    - raw proofs after the one-time ceremony;
    - session secrets;
    - CSRF secrets;
    - MFA seeds;
    - QR payloads;
    - recovery codes after one-time display;
    - encrypted secret blobs;
    - unrelated contacts;
    - unrelated memberships;
    - household or sibling data outside authorization;
    - provider credentials;
    - raw delivery payloads.
14. Every visible UI action must map to one real operation and explicit capability.
15. No dead buttons, placeholder toasts, fake success, or no-op handlers.

TRANSACTION, CONCURRENCY, AND IDEMPOTENCY REQUIREMENTS

Prove with real disposable PostgreSQL where applicable:

- two concurrent identical invitation creations yield one intended logical result;
- concurrent resend and redemption leave one valid outcome;
- concurrent revoke and redemption respect the locked winner and never partially
  activate;
- simultaneous proof redemption creates one membership/activation;
- simultaneous student reset produces one current access generation;
- simultaneous recovery-code use succeeds once;
- factor replacement and disablement cannot leave a privileged user with no
  required factor;
- concurrent membership suspension and protected write cannot commit an
  unauthorized change;
- concurrent relationship removal and parent/student access cannot leak data;
- concurrent fourth-learner attempts cannot exceed the accepted three-active-
  learner limit;
- outbox retries do not duplicate membership, proof, or reset state;
- cleanup workers do not race active redemption;
- transaction failure after any intermediate write rolls everything back.

Use database constraints, conditional updates, row locks, advisory locks where
appropriate, and stable idempotency. Do not serialize the entire application
unnecessarily.

RATE LIMITING AND ABUSE CONTROLS

Use durable production-capable controls consistent with accepted architecture.

Cover independently:

- password login;
- MFA challenge;
- recovery initiation;
- reset proof verification;
- activation proof verification;
- invitation creation;
- resend;
- recovery-code use;
- MFA enrollment confirmation;
- factor replacement/disablement reauthentication;
- student access setup/reset.

Requirements:

- account/product scope where appropriate;
- privacy-preserving normalized identity hash;
- network or network-prefix signal;
- bounded time windows and escalation;
- safe cleanup;
- consistent public responses;
- no raw email, phone, username, IP, or proof in ordinary audit metadata;
- no process-local-only production guarantee;
- successful authentication resets counters only according to accepted policy;
- avoid an attacker trivially locking out a victim through one unauthenticated
  dimension;
- test multiple application workers.

AUDIT AND OBSERVABILITY

Use the canonical sanitized account/product-scoped audit system.

Record structured events for at least:

- invitation issued;
- invitation delivery queued;
- invitation delivery status changed;
- resend;
- revoke;
- supersede;
- expiry;
- activation accepted;
- activation denied by category;
- proof replay;
- recovery requested without public identity disclosure;
- password reset completed;
- password changed;
- session issued;
- session rotated;
- session revoked;
- session expired;
- membership suspended/restored;
- relationship revoked;
- student access created/reset/suspended/restored;
- MFA enrollment begun/completed/expired;
- MFA challenge success/failure category;
- recovery code consumed/regenerated;
- factor replaced;
- factor disable denied/completed;
- security version changed;
- rate-limit/security anomaly;
- transactional failure category.

Audit must preserve:

- real actor;
- safe subject reference;
- account/product scope;
- operation;
- result category;
- correlation/idempotency reference where safe;
- timestamps;
- before/after lifecycle state where safe.

Audit must never preserve:

- passwords or hashes;
- raw tokens or proof digests that enable guessing correlation;
- session IDs or cookie values;
- CSRF values;
- MFA seeds or QR payloads;
- recovery codes or verifiers;
- provider credentials;
- raw private message bodies;
- unnecessary email, phone, household, or learner PII;
- raw IP addresses unless accepted policy explicitly requires protected storage.

Logs, metrics, traces, performance marks, error tracking, and route labels must use
stable templates and must not include proof-bearing URLs or identity values.

USER INTERFACES

Integrate with the exact accepted shells and components.

A. Owner/admin account-access area

Provide, subject to exact capabilities:

- bounded invitation and membership list;
- safe status filters;
- invite action;
- safe target/purpose summary;
- resend;
- revoke;
- suspend/restore;
- sanitized history;
- conflict and stale-version states;
- truthful delivery projection;
- no secret retrieval;
- no arbitrary role selector;
- no impersonation.

B. Activation ceremony

Provide:

- minimal isolated first-party bundle;
- product identity and safe intended role;
- neutral invalid/expired/revoked/superseded states;
- password creation;
- privileged MFA enrollment/challenge when required;
- no household/sibling disclosure;
- no third-party scripts;
- no marketing navigation that risks leakage;
- no proof after address scrub;
- keyboard and screen-reader complete behavior.

C. Login and recovery

Provide:

- canonical role-aware login entry without exposing internal roles;
- parent and student paths consistent with accepted shell;
- recovery entry;
- same safe acknowledgement regardless of identity existence;
- neutral errors;
- safe return path;
- no public student registration;
- no BNA or Operations controls.

D. Reset ceremony

Provide:

- minimal isolated bundle;
- fragment extraction and scrub;
- new-password and confirmation fields;
- password-manager and paste support;
- neutral proof errors;
- no automatic login unless accepted policy requires;
- ordinary login continuation;
- no third-party resources.

E. Current-user security settings

Provide:

- password change;
- bounded safe session list;
- revoke one or all other sessions;
- safe MFA factor list;
- TOTP enrollment;
- one-time recovery-code display/regeneration;
- factor replacement;
- factor disablement with last-required-factor denial;
- recent reauthentication states;
- confirmation and conflict handling;
- no secret retrieval after one-time display.

F. Parent learner-access controls

Provide only for linked authorized learners:

- safe current access state;
- setup action where policy permits;
- reset;
- suspend;
- restore;
- neutral success/error states;
- no current password or proof display;
- no login-as-student;
- no sibling leakage;
- no client-authoritative learner selection.

G. Student entry/help

Provide:

- age-appropriate labels;
- no public registration;
- no household search;
- no sibling selection;
- no identity enumeration;
- guidance to ask an authorized parent;
- general technical-help route that does not confirm an entered identity.

H. Interaction and visual requirements

Use the accepted One Time black/yellow system and canonical components.

Require:

- readable text and clear hierarchy;
- minimum 44 by 44 CSS-pixel interactive targets;
- visible focus;
- keyboard-complete dialogs;
- focus trapping and restoration where appropriate;
- accessible labels, descriptions, and validation;
- errors associated with fields;
- no color-only meaning;
- mobile-safe forms;
- virtual-keyboard-safe primary actions;
- RTL-safe layout;
- 200% zoom/reflow;
- reduced-motion support;
- extreme-content handling;
- calm neutral security copy;
- loading, success, conflict, denial, expiry, retry, and failure states;
- no hidden CTA behind the virtual keyboard;
- no dead or unmapped action.

CACHE, BUNDLE, AND PERFORMANCE REQUIREMENTS

1. Activation, reset, login, recovery, and MFA ceremony pages use minimal isolated
   bundles.
2. They must not load CRM, communications, content, billing, class, portal-admin,
   provider, or BNA bundles.
3. They must not load third-party marketing, provider, chat, analytics, or social
   scripts.
4. Public landing must not load authenticated identity bundles.
5. Account-access lists and audits are bounded and paginated.
6. Avoid N+1 membership, relationship, session, factor, or history queries.
7. Add only indexes justified by real PostgreSQL query plans and representative
   synthetic volume.
8. Do not claim PostgreSQL performance from pg-mem.
9. Recovery initiation must remain responsive under durable throttling and dummy
   work.
10. Password hashing work factor must balance current security guidance with
    measured server capacity; never lower it solely to improve benchmark numbers.
11. Provider outage must not roll back a valid local invitation/reset intent.
12. Cleanup and worker loops must be bounded, non-overlapping or lease-safe, and
    graceful on shutdown.
13. Record:
    - route request counts;
    - API request counts;
    - bundle bytes;
    - cold and warm navigation;
    - p50, p75, and p95 where accepted harness supports them;
    - layout shift;
    - graceful partial-error behavior;
    - synthetic volume and query plans.

MANDATORY TEST MATRIX

Add unit, integration, disposable PostgreSQL, browser, accessibility, security,
privacy, and performance coverage.

A. Positive identity journeys

Prove every policy-supported path:

- owner invitation and activation;
- administrator invitation and activation;
- parent/guardian invitation and activation;
- existing verified user accepting an authorized additional membership;
- parent creation of student access for one linked existing learner;
- student setup/reset path through the approved recipient/channel;
- ordinary login;
- privileged login with MFA;
- logout;
- recovery initiation;
- password reset;
- authenticated password change;
- session list and revocation;
- TOTP enrollment and confirmation;
- recovery-code use and regeneration;
- factor replacement;
- factor disablement when policy permits;
- invitation resend and revoke;
- membership/access suspend and restore.

Do not manufacture a positive test for a path whose product policy is unresolved.
Mark it blocked and prove it cannot activate.

B. Authorization negatives

Test:

- anonymous;
- wrong role;
- missing capability;
- wrong account;
- wrong product;
- inactive membership;
- suspended membership;
- revoked membership;
- archived household;
- removed guardian relationship;
- unrelated household;
- unrelated learner;
- sibling learner;
- stale learner-access generation;
- suspended student;
- cross-user factor ID;
- cross-user session ID;
- cross-purpose proof;
- cross-account proof;
- cross-product proof;
- client-supplied role/capability/scope;
- role escalation between password and MFA challenge;
- relationship removal immediately before write;
- membership suspension immediately before write.

C. Identity and conflict cases

Test:

- unknown email;
- Unicode and case normalization;
- supported international identity forms;
- case-variant duplicate;
- duplicate contacts;
- contact without user;
- user without target membership;
- user with another membership;
- active existing membership;
- suspended/revoked existing membership;
- email attached to another person record;
- unverified identity collision;
- invitation target changed after issuance;
- no automatic person/contact merge;
- no lead-to-user autoactivation.

D. Invitation/proof lifecycle

Test:

- valid;
- expired;
- revoked;
- superseded;
- already used;
- malformed;
- truncated;
- oversized;
- wrong purpose;
- wrong recipient;
- wrong account/product;
- changed target version;
- simultaneous redemption;
- double click;
- provider retry;
- concurrent create;
- concurrent resend;
- resend rotation;
- revoke race;
- stale ETag/version;
- transaction rollback halfway through activation;
- cleanup racing redemption;
- one logical activation only.

E. Recovery enumeration

Test that eligible, ineligible, unknown, suspended, unsupported, and rate-limited
identities have:

- same public status class;
- same response schema and copy;
- equivalent cache headers;
- no delivery-state disclosure;
- no identity in URL;
- controlled timing distribution;
- durable identity/network abuse controls;
- no process-local bypass across two app instances.

F. Browser proof leakage

Prove:

- fragment not included in the initial HTTP request;
- proof scrub occurs immediately;
- no proof in subsequent address/history;
- proof sent only in the intended POST body;
- no proof in Referer;
- no proof in analytics;
- no proof in error tracking;
- no proof in console;
- no proof in route metrics;
- no proof in performance marks;
- no proof in server access logs;
- no proof in application logs;
- no proof in browser localStorage;
- no proof in sessionStorage unless an accepted threat model explicitly permits
  ephemeral use, with default being no use;
- no proof in IndexedDB;
- no proof in Cache Storage;
- no proof in service-worker requests;
- no proof in screenshots, traces, videos, snapshots, or evidence;
- no third-party request before or after scrub;
- back/forward navigation does not restore the proof;
- refresh after scrub does not resubmit or expose it.

G. CSRF and session security

Test:

- missing CSRF;
- wrong CSRF;
- cross-session CSRF;
- CSRF after session rotation;
- state-changing GET denial;
- fixation attempt;
- rotation after login;
- rotation after activation;
- rotation after MFA;
- rotation after privilege change;
- logout invalidation;
- idle expiry;
- absolute expiry;
- renewal race if implemented;
- password-reset invalidation;
- password-change policy;
- membership suspension;
- role/capability change;
- guardian relationship removal;
- student reset/suspension;
- MFA factor change;
- security-version race;
- 401/403 protected-state purge;
- stale cached private data does not flash;
- safe return paths and open-redirect negatives.

H. MFA

Test:

- pending enrollment;
- one-time seed display;
- correct confirmation;
- wrong code;
- code outside accepted window;
- replayed timestep;
- concurrent same-timestep submissions;
- brute force;
- rate-limit persistence across workers;
- expired challenge;
- abandoned pending-factor cleanup;
- cross-user challenge;
- role escalation between challenge steps;
- recovery-code display once;
- recovery-code one-time use;
- concurrent recovery-code use;
- regeneration invalidates old codes;
- replacement requires existing factor;
- replacement confirms new factor before retiring old;
- disable requires strong reauthentication;
- disabling last required privileged factor denied;
- factor change invalidates sessions;
- no seed/QR/recovery/challenge leakage;
- lost-all-factors path remains blocked without an accepted recovery policy.

I. Parent/student isolation

Test:

- parent cannot access another household;
- parent cannot provision unrelated learner;
- parent cannot alter learner ID to target sibling;
- parent cannot exceed accepted active-learner limit, including concurrency;
- parent cannot retrieve current student password;
- parent cannot retrieve current setup/reset proof;
- parent cannot log in as student;
- parent content launch remains parent actor;
- student resolves to exactly one learner;
- student cannot enumerate siblings through counts, navigation, errors, cache keys,
  or timing;
- student cannot submit another learner ID;
- student cannot switch learner through browser state;
- reset preserves learner and history;
- suspension immediately blocks student portal and protected exchanges;
- relationship removal invalidates access;
- shared-device logout removes prior principal data.

J. Outbox and delivery

Test:

- invitation/reset record and intent atomicity;
- outbox rollback with transaction failure;
- deterministic idempotent intent;
- sink-only default;
- zero external network in normal tests;
- request does not wait for provider;
- protected secret ciphertext never appears in generic payload;
- decrypt only in worker memory;
- ciphertext expiry/removal;
- retry does not duplicate logical action;
- suppression and verified-channel recheck;
- provider outage changes delivery projection only;
- truthful queued/sink/provider/delivered/bounce/failure distinctions;
- provider callback idempotency if accepted support exists;
- communications read model excludes secret payloads;
- no real recipient or provider mutation.

K. Accessibility and responsive behavior

Test at minimum:

- 360 by 800;
- 390 by 844;
- 768 by 1024;
- accepted desktop viewport;
- virtual keyboard;
- keyboard-only;
- screen-reader semantics;
- focus order;
- focus trap and restoration;
- accessible field errors;
- axe or accepted automated checks;
- 200% zoom;
- reflow without horizontal overflow;
- RTL;
- reduced motion;
- extreme names and error content;
- slow loading;
- conflict and expiry states;
- neutral non-enumerating copy;
- primary CTA remains visible and reachable.

L. Static and privacy scans

Scan for:

- secrets;
- raw proofs;
- token-like fixture mistakes;
- password/hash output;
- MFA seeds;
- recovery codes;
- session IDs;
- PII in URLs;
- PII in logs;
- protected identifiers in analytics;
- BNA imports;
- Operations chrome;
- second auth/session/MFA runtime;
- direct provider clients;
- real network endpoints;
- dead buttons;
- unmapped actions;
- localStorage/IndexedDB use for private data;
- query-string activation/reset secrets;
- readable JWT invitation/reset claims;
- production recipient domains.

REAL POSTGRESQL ASSURANCE

Use a disposable approved non-production PostgreSQL instance. Never use production,
a shared staging customer database, Railway production, BNA, or another unapproved
remote database.

Prove:

1. fresh migration application;
2. accepted-base upgrade migration application;
3. migration checksums;
4. catalog constraints and indexes;
5. invitation uniqueness;
6. proof atomic consumption;
7. membership activation concurrency;
8. relationship and learner generation races;
9. active-learner limit concurrency;
10. recovery-code concurrency;
11. factor replacement/disablement concurrency;
12. session invalidation races;
13. outbox idempotency;
14. cleanup-worker safety;
15. rollback after injected transaction failures;
16. realistic synthetic account-access and audit volume;
17. sanitized EXPLAIN plans;
18. bounded query counts.

pg-mem may supplement fast tests but is not evidence for PostgreSQL locking,
partial indexes, query plans, advisory locks, or multi-worker behavior.

If a safe disposable PostgreSQL environment is unavailable:

- do not use production;
- preserve implementation and non-PostgreSQL proof;
- mark every real-PostgreSQL gate blocked;
- do not claim production readiness;
- report the exact unblock requirement.

IMPLEMENTATION QUALITY

1. Keep one canonical implementation for every domain concept.
2. Extend accepted packages and registration hooks.
3. Avoid broad shared-file edits.
4. No mass formatting.
5. No unrelated dependency upgrades.
6. Add a dependency only when necessary, current, audited, lockfile-consistent, and
   incapable of external activity by default.
7. Prefer accepted Node/standard-library crypto and repository utilities.
8. Do not implement custom cryptography beyond composing accepted primitives.
9. Use constant-time comparisons where relevant and supported.
10. Zeroize or drop in-memory secret buffers where practical; do not make false
    guarantees about JavaScript memory.
11. Keep internal errors rich enough for operations but public errors neutral and
    non-enumerating.
12. Use deterministic clocks/randomness through explicit test injection.
13. Keep production entropy and key access fail-closed.
14. Keep feature flags default-off only for genuinely blocked external delivery
    paths, not as a way to hide incomplete core authorization.
15. No visible action may claim readiness while its endpoint is absent or blocked.

SUGGESTED INTENTIONAL COMMIT SEQUENCE

Adapt to actual ownership, but keep commits small and reviewable:

1. OT-62 preflight evidence and implementation map;
2. additive identity/invitation/proof schema;
3. invitation and activation domain/repository services;
4. recovery/password/session invalidation;
5. MFA management completion;
6. parent/student access integration;
7. outbox protected-secret and template integration;
8. API and capability wiring;
9. ceremony and security-settings UI;
10. owner/admin and parent UI integration;
11. tests, PostgreSQL assurance, accessibility, performance, and evidence;
12. final documentation and handoff.

Do not commit generated secret-bearing browser traces or database dumps.

REQUIRED REPOSITORY EVIDENCE

Create a sanitized ops/evidence/ot-62 directory following accepted conventions.
Include at least:

- PREFLIGHT.md
- BASE-AND-WORKTREE.md
- ACCEPTED-FOUNDATION-AUDIT.md
- CURRENT-ROUTE-ACTION-INVENTORY.md
- IDENTITY-ENTITY-MAP.md
- IDENTITY-CONFLICT-MATRIX.md
- CAPABILITY-RELATIONSHIP-MATRIX.md
- INVITATION-STATE-MACHINE.md
- PROOF-PURPOSE-AND-LIFECYCLE.md
- ACTIVATION-STATE-MACHINE.md
- RECOVERY-RESET-STATE-MACHINE.md
- MFA-MANAGEMENT-STATE-MACHINE.md
- STUDENT-ACCESS-LIFECYCLE.md
- SESSION-INVALIDATION-MATRIX.md
- ENDPOINT-DTO-ERROR-CONTRACT.md
- TRANSACTION-CONCURRENCY-PLAN.md
- DELIVERY-AND-OUTBOX-TRUTH.md
- TOKEN-AND-PII-LEAKAGE-PROOF.md
- MIGRATION-LEDGER.md
- POSTGRESQL-ASSURANCE.md
- POSTGRESQL-ASSURANCE.json where accepted convention permits
- BROWSER-ACCESSIBILITY-PERFORMANCE.md
- SECURITY-GUIDANCE-RECHECK.md
- ROLE-NEGATIVE-RESULTS.md
- TEST-RESULTS.md
- CHANGED-FILES.txt
- INTEGRATION-MANIFEST.md
- FINAL-REPORT.md

Evidence must use synthetic identifiers and redacted values. Do not include:

- proof examples long enough to function as real credentials;
- TOTP seeds;
- QR payloads;
- recovery codes;
- password/hash samples from real or reusable accounts;
- session cookies or IDs;
- raw email/phone data;
- provider links or credentials;
- real database rows;
- screenshots containing secret ceremony values.

VERIFICATION COMMANDS

Run the exact accepted repository commands and focused OT-62 commands. At minimum,
where supported:

- lockfile-consistent install;
- touched-file formatting check;
- lint;
- typecheck;
- unit tests;
- integration tests;
- focused auth/invitation/recovery/MFA/portal/outbox tests;
- secret scan;
- static PII/token URL scan;
- disposable PostgreSQL fresh migration;
- disposable PostgreSQL accepted-base upgrade migration;
- PostgreSQL concurrency and query-plan suite;
- build;
- browser E2E;
- accessibility;
- performance;
- bundle inspection;
- request-count inspection;
- service-worker/cache scan;
- no-external-network proof;
- no-BNA/second-auth-runtime scan;
- git diff --check;
- exact final git status.

Do not claim a command passed if it was skipped, blocked, timed out, flaky, or run
only against a substitute environment. Record exact commands and outcomes.

PUBLICATION LIMITS

After all non-external gates pass:

1. confirm the isolated worktree is clean except intended committed work;
2. confirm no secret or private evidence is staged;
3. record exact commits;
4. push only codex/ot62-account-activation-credential-lifecycle;
5. open one draft PR against the exact accepted convergence base branch;
6. never merge;
7. never deploy;
8. never run a real invitation/reset;
9. never configure a live provider;
10. never create a real identity or membership.

If the exact base branch cannot be used as the draft PR base without changing the
diff or ancestry, report the blocker. Do not silently retarget to main or another
branch.

FINAL REPORT REQUIREMENTS

The final sanitized report and final response must state:

- repository;
- exact BASE_SHA;
- exact base ref;
- branch;
- worktree path;
- head SHA;
- commit list;
- draft PR URL if created;
- changed files;
- migrations and checksums;
- accepted migrations preserved unchanged;
- identity entity map;
- invitation, proof, activation, recovery, MFA, and student-access state machines;
- capability and relationship matrix;
- session-invalidation matrix;
- exact route/action inventory;
- exact visible actions and endpoint mapping;
- authorization-negative results;
- concurrency results;
- token/PII leakage scan;
- disposable PostgreSQL evidence;
- browser evidence;
- accessibility evidence;
- performance and bundle evidence;
- outbox truth and transport mode;
- test commands and results;
- blocked tests;
- unresolved product or security blockers;
- exact git status;
- remote push result;
- external mutation counts.

Distinguish explicitly:

- implemented;
- schema added locally;
- migrated in disposable test PostgreSQL;
- tested with fake/sink transport;
- provider configured;
- externally sent;
- deployed;
- production verified;
- blocked;
- untouched.

For OT-62, unless separately authorized later, the expected counts are:

- production database reads: 0;
- production database writes: 0;
- real users created or changed: 0;
- real memberships created or changed: 0;
- real learner/guardian records changed: 0;
- real invitations or resets sent: 0;
- live provider calls: 0;
- deployments: 0;
- Railway changes: 0;
- DNS changes: 0;
- BNA mutations: 0;
- merges: 0.

Conclude with exactly one categorical result:

- READY_FOR_INTEGRATION_REVIEW
- BLOCKED
- NOT_READY

A successful result routes to the later integration/release workflow. Do not ask
for a normal director rewrite or another GPT review.

STOP AND ADAPTATION RULE

You may adapt physical filenames, table names, API paths, component names, error
codes, and migration identifiers to the actual accepted BASE_SHA. You may not
weaken:

- real-user identity;
- account/product scope;
- explicit capabilities;
- guardian and learner relationship checks;
- student one-to-one learner binding;
- no impersonation;
- no BNA dependency;
- token secrecy;
- password security;
- privileged MFA;
- safe factor management;
- session rotation and invalidation;
- idle/absolute expiry requirements;
- durable abuse controls;
- atomic concurrency;
- truthful delivery;
- audit redaction;
- browser leakage prevention;
- accessibility;
- real PostgreSQL assurance;
- external-action limits.

Stop or implement only a clearly isolated safe foundation when an accepted
recipient policy, role authority, account-recovery policy, canonical auth owner,
canonical portal owner, migration reservation, or security-critical prerequisite
remains genuinely unresolved. Never guess, silently broaden authority, expose a
blocked path, or activate an unsafe fallback.
