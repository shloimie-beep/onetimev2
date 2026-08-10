# One Time Mishnayos — Complete Production Product Specification

**Package:** `ONE-TIME-PRODUCTION-SPEC-v2.1`  
**Document:** `01-PRODUCT-SPEC-v2.1.md`  
**Specification ID:** `ONE-TIME-PRODUCTION-V2.1`  
**Version:** 2.1  
**Date:** 2026-07-28  
**Status:** Normative production product definition  
**Repository:** `shloimie-beep/onetimev2`  
**Reviewed head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Production application:** `https://app.onetimeonetime.com`  
**Public/transition funnel:** `https://join.onetimeonetime.com`

## PS-001. Purpose, authority, and package map

This specification defines the complete production One Time Mishnayos product. It is a product definition, not an implementation roadmap and not authority to send an unapproved campaign, create an unapproved charge, weaken child-data controls, or delete customer history.

The objective is a real application that Shloimie Dratler and Rabbi Eli Scheller can operate without a developer and that real Parents and Students can use immediately.

The normative package is:

1. `01-PRODUCT-SPEC-v2.1.md` — complete product behavior and release boundary;
2. `02-ACCEPTANCE-CONTRACT-v2.1.yaml` — executable acceptance requirements and evidence contract;
3. `03-DECISION-REGISTER-v2.1.md` — locked, inferred, deferred, and historical decisions;
4. `04-SUPERSESSION-AND-SYSTEM-DISPOSITION-v2.1.md` — superseded systems and retained/disposed surfaces;
5. `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md` — actors, roles, capabilities, navigation, and routes;
6. `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md` — entity model, invariants, and state transitions;
7. `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md` — ownership and provider integration contracts;
8. `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md` — screens, components, responsive rules, accessibility, and visual system;
9. `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md` — workflows, notifications, channels, and canonical copy;
10. `10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md` — consent, privacy, child data, retention, and data rights;
11. `11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml` — environments, approved fixtures, and bounded canaries;
12. `12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md` — migration, domain cutover, rollback, and legacy retirement;
13. `13-OPERATIONS-SLO-DR-INCIDENT-v2.1.md` — operations, service levels, backup/restore, and incident response;
14. `14-TRACEABILITY-CROSSWALK-v2.1.yaml` — decision-to-spec-to-acceptance traceability;
15. `PACKAGE-README.md` — package navigation and use;
16. `SHA256SUMS.txt` — package integrity manifest.

`03-DECISION-REGISTER-v2.1.md` resolves product ambiguity. Security, privacy, child-safety, financial-integrity, data-isolation, migration-integrity, and provider-idempotency safeguards in the package may not be silently weakened.

The v2.1 package supersedes the v2.0 draft, the old launch board, incompatible acceptance IDs, fictional/demo paths, preview/test product lanes, and historical control-plane semantics.

Real product-path work has priority. Historical cleanup, evidence reconciliation, or legacy-resource housekeeping may not block an Admin, Parent, Student, class, calendar, billing, content, support, or communication journey unless the unresolved item prevents safe production operation.

## PS-002. Definition of production ready

One Time is production ready only when all of the following are true:

1. The exact immutable release candidate is live at `app.onetimeonetime.com`.
2. The public/transition funnel at `join.onetimeonetime.com` gives the approved Family and School entry paths.
3. Shloimie and Rabbi Eli can sign in with email and password and exercise identical full Admin authority.
4. A Family adult can sign up without a card, activate one Parent/account-owner identity, and create up to three active Student seats.
5. An adult learner uses a separate Student seat and Student credentials; the Parent session never becomes a learner session.
6. One adult identity may switch safely among multiple independently billed households it owns.
7. A School inquiry creates a manual sales lead only; an approved School uses the same Parent/Student experience with manually configured allowance and commercial terms.
8. Every active Student is automatically enrolled in the canonical Sunday–Thursday class.
9. Each Student signs in separately, sees only self, and enters an embedded Zoom classroom with Student-specific short-lived authorization.
10. One concurrent live-class session per Student is enforced while same-session reconnect works.
11. Parent, Student, Admin, and Admin/teacher calendars are polished, timezone-safe, responsive, and accessible.
12. Attendance truth, reconnect merging, progress, fixed badges, and scoped leaderboard views work.
13. Students can submit private Torah/class questions and separate technical support requests; Parents cannot see private questions or answers.
14. An Admin can upload a recording directly or ingest it from Drive into one deduplicated pipeline.
15. Up to 5 GiB upload, processing, trim, transcript, captions, review material, knowledge-base draft, private Vimeo publication, approval, playback, resume, unpublish, and denial work.
16. Family free access, scheduled paid continuation, USD $67 monthly plan, seven-day grace, period-end cancellation, hosted billing, and effective access projection work.
17. GHL owns adult CRM, campaigns, conversations, consent/suppression, website bot, and operator-facing Stripe workflows; Resend owns token-bearing account/security email.
18. Required launch communication functions operate with email alone. Dormant WhatsApp intent never blocks or misrepresents email delivery.
19. Student devices have an in-app notification center and optional foreground audible cue.
20. Global Admin search returns only authorized real records.
21. No fictional/demo/test customer, preview mode, product test lab, Class Helper, Buffer integration, BNA navigation, or other deferred surface appears.
22. Public and authenticated UI meets WCAG 2.2 AA and the supported browser/device contract.
23. Production has backup, restore proof, rollback, monitoring, queue/provider health, redacted diagnostics, and incident readiness.
24. Migration and cutover preserve adult GHL identity without migrating old passwords, child profiles, sessions, inferred consent, or inferred access.
25. Final automated and real-device role journeys pass against the exact candidate.
26. The interactive-element inventory reports:
    - failed visible controls: `0`;
    - untested visible controls: `0`;
    - placeholder visible controls: `0`;
    - fake-data dependencies: `0`;
    - unauthorized visible controls: `0`.

Passing automated tests is necessary but is not sufficient. Passing manual browser paths without automated safety, concurrency, migration, accessibility, and provider evidence is also insufficient.

## PS-003. Product boundary and domains

### PS-003.1 Sole product repository

`shloimie-beep/onetimev2` is the sole current product repository. Older repositories, BNA-hosted One Time code, and historical funnels are evidence only and do not define current behavior.

One Time has its own:

- application and public funnel;
- database and migrations;
- sessions and cookies;
- provider configuration and credentials;
- worker/outbox;
- failure domain;
- backup/restore;
- release authority.

One Time does not depend on BNA runtime state.

### PS-003.2 Domain end state

- `onetimeonetime.com` and `www.onetimeonetime.com` — approved public marketing end state;
- `join.onetimeonetime.com` — current public/transition funnel until verified cutover;
- `app.onetimeonetime.com` — canonical authenticated application.

Old Join links remain safe during migration and transition. Redirect and retirement behavior is defined by `12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md`. The old app is not disconnected until the new product passes production acceptance and rollback is available.

### PS-003.3 Product-only runtime

Production contains no:

- preview/demo mode;
- fictional account or customer;
- test-lab navigation;
- experience demo;
- product test lane;
- Class Helper;
- Buffer/social publisher;
- engineering-only customer control;
- BNA workspace switcher;
- old Tisha B’Av active product route.

Safety verification uses isolated automated environments and bounded canaries defined by `11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml`, never a customer-facing test surface.

## PS-004. Roles, identity, households, and seats

### PS-004.1 Roles

Assignable human roles are exactly:

- `admin`;
- `parent`;
- `student`.

Shloimie and Rabbi Eli are both `admin` and have identical permissions. Rabbi Eli may have teacher profile data including public name, teaching attribution, sender identity, calendar context, and Live Console defaults. That profile is not a fourth role.

Support is a capability exercised by an Admin. School is a public classification and approved account context, not a role. The normative capability and route matrix is `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md`.

### PS-004.2 Adult identity and multiple households

One normalized email maps to one adult identity and exactly one adult HumanAccount/login. That account has a nonempty role-membership set containing `admin`, `parent`, or both. It never receives a second credential because it gains another adult role.

When the account has both memberships, the authenticated shell shows an explicit Admin/Parent context switcher. The current role and, for Parent context, current household are server-validated on every request and remain visible. Transfer of a household to an existing Admin adds `parent` membership to that same account; it does not create a duplicate adult.

One adult identity may own multiple separate household subscriptions.

Each household has:

- one Parent/account-owner login;
- an independent billing/access state;
- an independent plan/contract;
- an independent Student-seat allowance;
- independent class, support, and audit scope.

An adult with multiple households uses the authenticated household switcher. The system never duplicates the adult merely to create a second household.

### PS-004.3 Parent authority

A Parent may:

- create active Student profiles up to the household allowance;
- enter and edit actual/display name;
- choose `self` or `dependent` and complete the applicable authority/consent step;
- choose or change username;
- set/reset Student password;
- revoke Student sessions;
- archive and restore a Student within the allowance;
- see Parent-appropriate calendar, attendance/progress, badge, billing, notice, newsletter, reminder, and support information;
- use hosted billing/reactivation;
- manage permitted own-account information.

A Parent may not:

- enter the classroom;
- play Student library content;
- read a Student’s private question or Rabbi answer;
- create a fourth active Student under the standard Family allowance;
- change roles, class structure, attendance truth, badge rules, provider references, payment history, or another household;
- view an existing password.

### PS-004.4 Student identity

A Student:

- has no required email;
- is never a GHL contact;
- belongs to one household/account context;
- has actual/display name and an account-owner relationship of `self` or `dependent`;
- has no date of birth, age, age band, grade, or Hebrew-specific profile field;
- uses a globally unique, human-readable username and password;
- has lifecycle `active` or `archived`;
- consumes a seat only while active;
- sees only self.

Required dependent-Student name copy is:

> Please use the Student’s actual name so Rabbi Eli can identify them during class.

Required self-learner name copy is:

> Please use your actual name so Rabbi Eli can identify you during class.

### PS-004.5 Adult learner

Learner age is not restricted by product rules, and the product does not collect age or date of birth. An adult who wants to learn chooses `self`, uses one of the household’s Student seats, a separate Student username/password, and the Student portal. An account owner creating a learner for someone else chooses `dependent` and attests that they are authorized to manage that Student and provide the required consent. There is no Parent Learner Mode and no Parent-to-Student role toggle.

### PS-004.6 One owner and ownership transfer

There is one Parent/account owner per household. Co-guardian simultaneous access is absent at launch.

Ownership transfer is Admin-assisted, verified, accepted through a fresh seven-day setup link, policy-versioned, session-revoking, and audited. It cannot complete while the outgoing owner has an active `self` Student in the household: that Student must first be archived or moved, with identity/history preserved, to another household the outgoing adult owns with an available seat. A `self` Student is never silently converted to `dependent` or assigned to the replacement. The replacement records current authority and required recording consent for every remaining dependent Student before acceptance completes. Full rules are in `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md` and `10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`.

### PS-004.7 School context

Public signup classifies an inquiry as `family` or `school`.

A School inquiry:

- creates/updates an adult GHL lead;
- records school inquiry data;
- sends one acknowledgment;
- starts no nurture sequence;
- creates no automatic product access;
- routes to manual operator follow-up.

After approval, a School uses one `parent` account manager and separate `student` identities in the same application experience. School price, billing start, terms, and seat allowance are manually configured and audited. There is no school portal, school role, bulk roster, faculty role, or organization administration.

## PS-005. Standard Family plan, free period, and access

### PS-005.1 Plan

The standard Family product is:

**One Time Live + Library**

- USD $67 per month;
- one household subscription;
- normally up to three active Student seats;
- live canonical class;
- separate Student accounts;
- embedded Zoom classroom;
- calendar;
- recordings/library;
- review material;
- attendance/progress;
- questions, badges, leaderboard, and notices.

There is no library-only plan at launch.

### PS-005.2 Free access

- Family signup requires no card.
- Default free access ends at `2026-09-11T18:00:00+03:00`.
- The canonical timezone is `Asia/Jerusalem`.
- Public copy says **Free until Rosh Hashanah**.
- The timestamp is one configuration value used by access, UI, countdown, and communication.
- The countdown uses a server-synchronized current instant and displays days, hours, and minutes.
- At expiry the countdown disappears and the continuation/payment-required state begins.
- A Family signup submitted before the expiry receives `free` access only through that fixed expiry.
- A Family signup submitted at or after the expiry still creates the adult account and household without collecting a card in the signup form, but its product access begins `inactive` and the Parent continues to standard Checkout. No replacement trial or rolling free period is granted.

### PS-005.3 Early paid continuation

The paid offer may appear before free expiry. Standard early Checkout:

- collects payment authorization through the governed GHL/Stripe path;
- schedules paid access and the first charge for the configured free-period end;
- does not charge immediately;
- shows the exact first-charge date/time and USD price before confirmation.

An immediate-charge exception is allowed only when the Parent sees and explicitly accepts the immediate charge. It is not the standard path.

### PS-005.4 Access lifecycle

Effective household product access is exactly:

- `free`;
- `active`;
- `grace`;
- `inactive`.

Administrative suspension is a separate overriding denial in the domain contract.

Access precedence and transition mechanics are defined in `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md`.

- `free` and `active` grant Parent management and Student learning.
- `grace` grants full Parent and Student access while showing repair/deadline information to the Parent.
- `inactive` permits exactly the Parent overview/status, household switcher, billing/reactivation, support list/detail, account, privacy, and data-rights routes; every other Parent route and every Student route is denied before protected data renders.
- `inactive` blocks Student authentication and learning routes.
- Recovery restores access idempotently without recreating household, Student, or learning history.

### PS-005.5 Cancellation and refunds

- Cancellation stops future renewal.
- Paid access continues through the paid period end.
- No automatic prorated refund is created.
- Refunds are Admin-approved manual exceptions in the provider system.
- Cancellation and refund do not delete accounts, Students, attendance, progress, questions, or content history.

### PS-005.6 Failed-payment grace

- Grace lasts seven days from the effective failed-payment transition.
- GHL/Stripe owns retry and customer payment history.
- Student access remains during grace.
- Grace expiry without recovery produces `inactive`.
- Recovery before or after expiry is idempotent and restores the correct effective access.

## PS-006. Public site, Family signup, and School inquiry

### PS-006.1 Public landing requirements

The public surface includes:

- clear Mishnayos offer;
- live teaching from Eretz Yisrael;
- Rabbi Eli identity;
- canonical Sunday–Thursday schedule;
- standard Family plan and seat allowance;
- free-period status;
- embedded live-class and library explanation;
- adult-learner separate-seat explanation;
- device, camera, and recording expectation;
- Family CTA;
- School inquiry CTA;
- login;
- approved testimonials/publications only;
- privacy, terms, cancellation/refund, and support links.

Screen composition and responsive behavior are normative in `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`. Exact copy and communication variables are normative in `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`.

### PS-006.2 Family signup

Family signup collects adult/account-owner first name, last name, email, password, editable IANA timezone, required account Terms/Privacy acceptance, and separate optional adult communication choices defined by `10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`. It collects no Student information and no guardian/dependent-Student affirmation; that affirmation occurs only when the Parent later creates a `dependent` Student.

It:

1. validates the required adult account fields and policy acceptance without collecting age or date of birth;
2. matches a verified provider link, then normalized email; multiple or conflicting GHL matches quarantine only the CRM linkage for Admin reconciliation;
3. creates or updates the existing local adult without name/phone-only merge;
4. commits the local adult, one HumanAccount with `parent`, sole household-owner membership, household, time-dependent `free` or `inactive` access, and outbox atomically;
5. creates/updates the adult GHL record asynchronously only when the CRM match is unambiguous;
6. permits immediate login with the submitted email/password and sends the branch-appropriate GHL companion only after local readback;
7. creates no Student and collects no card;
8. never infers marketing consent;
9. never duplicates an account after provider retry.

Provider failure after local commit shows a durable accepted state and retries from the outbox.

A duplicate signup for an active account returns the safe **Sign in or reset your password** path. It neither creates another household unintentionally nor confirms whether an unrelated email address exists.

### PS-006.3 Account-to-first-class activation

Before free-period expiry, the Parent activation sequence is:

1. sign in with the email/password submitted at Family signup;
2. confirm household/timezone;
3. create a `self` or `dependent` Student with the exact name guidance;
4. set Student username/password and any relationship-specific consent;
5. read back automatic canonical-class enrollment;
6. see the next occurrence;
7. choose optional reminder intent.

The activation checklist is resumable and disappears when complete. A Parent never reaches an unexplained empty calendar after creating an active Student.

At or after free-period expiry, the submitted email/password creates the adult account and inactive household, then routes to standard Checkout. Student creation and learning activation begin only after verified paid or approved School access. The signup form itself never collects a card or represents inactive access as active/free.

### PS-006.4 School inquiry

School inquiry behavior is defined in PS-004.7 and its screen in `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`. It is never treated as Family free signup and never enters automated lead nurture.

## PS-007. Source-of-truth and provider ownership

Detailed provider contracts, identifiers, retries, webhook truth, and reconciliation are defined by `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`.

### PS-007.1 One Time owns

- workspace and product scope;
- authentication, roles, sessions, and account state;
- adult-to-household linkage;
- Parent and Student identities;
- household seat allowance and current access projection;
- classes, occurrences, canonical enrollment, and calendar;
- Zoom occurrence/Student registration references and embedded launch authorization;
- attendance projection and manual correction;
- content source, lifecycle, approval, assignment, and protected route;
- Student progress, goals, badges, leaderboard, questions, and notifications;
- support-ticket records and safe external references;
- announcements and audit.

### PS-007.2 HighLevel owns

- adult lead/customer CRM record;
- adult identity dedupe/provider linkage;
- one household-keyed opportunity/account record per One Time household;
- lifecycle and source tags;
- adult conversations;
- communication consent/suppression projection;
- campaigns and email workflows;
- website lead-capture bot;
- sender identity;
- operator-facing Stripe workflow and payment-operation history;
- saved segments, workflow execution, and delivery metrics.

One GHL contact represents one adult identity even when that adult owns multiple households. Adult communication consent, suppression, complaint, and contactability remain contact-scoped. Plan, access lifecycle, service-reminder preference, School terms, seat allowance, and Stripe correlation remain household-record-scoped and may not overwrite another household’s fields. One Time may show sanitized workflow configuration, audience, suppression, readiness, and delivery readback and may submit governed Start/Pause requests, but it is not a second campaign authoring editor. Provider canary execution stays in the release-verification harness and is never an ordinary production-navigation action.

### PS-007.3 Stripe owns

- payment-method/card storage;
- products/prices;
- Checkout/payment authorization;
- one Customer per One Time household and that household’s subscriptions;
- invoices, retries, refunds, and chargebacks;
- hosted customer billing portal;
- signed financial events.

The household-scoped Customer prevents one billing portal from exposing another household owned by the same adult. One Time stores only minimum billing references, verified event receipt/idempotency data, reconciliation state, and current access projection. It never stores card data, creates or mutates a financial object, or fabricates a financial ledger.

### PS-007.4 Resend owns

- Admin setup;
- Admin-created/passwordless Parent setup and ownership-transfer acceptance;
- adult password reset;
- account-security notices;
- token-bearing account lifecycle email.

GHL never receives account setup/reset tokens or passwords.

### PS-007.5 Zoom owns

- embedded live meeting service;
- provider meeting/registrant state;
- media/participant controls;
- attendance source events.

One Time owns occurrence entitlement, Student launch authorization, concurrent-session policy, and the user-facing embedded route.

### PS-007.6 Vimeo, Drive, and direct upload

Vimeo owns the private processed video asset and provider playback. Drive owns private incoming source handoff. Direct upload uses the private One Time AWS S3 staging contract. Both sources enter one deduplicated One Time content-source model.

Drive is not a Student playback provider. Raw Vimeo destinations are not exposed.

### PS-007.7 Telegram

Telegram is internal Admin notification/action transport only:

- Shloimie route: billing, access, support, provider/system, and operational exceptions, namespaced `OT`;
- Rabbi route: private Student learning/question readiness and answer actions.

One Time remains source of truth. Telegram payloads contain minimal safe context and governed deep links, not secrets or unnecessary child data.

## PS-008. Domain model and states

The complete field-level domain model, constraints, invariants, transition tables, audit effects, and concurrency rules are normative in `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md`.

The required core records are:

- adult identity/contact;
- human account;
- household/account context;
- Student;
- class series;
- class occurrence;
- enrollment;
- access projection;
- provider registration/launch session;
- attendance;
- content source and content item;
- progress event and review completion;
- badge award;
- leaderboard projection;
- Student question;
- announcement/notification;
- support ticket;
- provider receipt/outbox job;
- audit event.

Required lifecycle vocabularies are:

- human account: `invited`, `active`, `disabled`, `archived`;
- Student: `active`, `archived`;
- access: `free`, `active`, `grace`, `inactive`;
- occurrence: `scheduled`, `preparing`, `ready`, `live`, `completed`, `canceled`;
- content: `received`, `validating`, `processing`, `needs_review`, `approved`, `publishing`, `published`, `failed`, `archived`;
- question: `submitted`, `answered_private`, `approved_for_class`, `published`, `closed`, `declined`;
- support: `open`, `in_progress`, `waiting_on_requester`, `resolved`, `closed`.

Alternative state words do not appear in production UI or API contracts unless mapped explicitly in `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md`.

## PS-009. Application shell, routes, and global behavior

The canonical route inventory and role behavior are defined by `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md`.

All authenticated roles use a coherent One Time shell:

- One Time logo;
- role-appropriate navigation;
- current page title and nested breadcrumbs where needed;
- account menu and logout;
- Parent household switcher where eligible;
- Admin global search;
- Student notification entry;
- persistent priority notices;
- mobile/tablet drawer;
- responsive workspace.

Global behavior:

- direct internal links work after login;
- safe return-to is role- and scope-revalidated;
- refresh preserves route/entity;
- back/forward works;
- URL-backed filters survive navigation;
- unauthorized routes return a useful neutral state;
- cross-household/sibling records do not leak existence;
- no preview/engineering navigation appears;
- every visible control has label, loading, validation, success, failure, safe retry, persistent readback, authorization, and material audit where applicable;
- disabled controls have a current state reason; deferred controls are absent.

## PS-010. Authentication and account lifecycle

### PS-010.1 Universal login

Route `/login` has:

- one identifier field;
- adult email or Student username;
- password;
- show/hide password;
- adult forgot-password;
- Student credential-help copy;
- no routine code challenge;
- no MFA at launch.

Production contains no MFA enrollment, authenticator setup, recovery-code, SMS challenge, email challenge, optional-MFA preference, or MFA challenge screen.

Password policy is:

| Credential | Length | Rules |
|---|---:|---|
| Admin/Parent | 12–128 characters | No composition rule; reject compromised/common values and values equivalent to email, username, or actual/display name |
| Student | 8–64 characters | No composition rule; allow memorable passphrases; reject compromised/common values and values equivalent to username or actual/display name |

Passwords are stored only as a versioned Argon2id hash. Unicode passwords are compared exactly as entered after transport decoding; the UI does not silently trim or transform them.

Successful routing:

- dual Admin/Parent with no valid role context → `/select-role`;
- Admin context → `/app/dashboard`;
- Parent with one household → `/app/parent`;
- Parent with multiple households and no valid context → `/select-household`;
- Student → `/app/student`.

### PS-010.2 Admin and Parent setup

An existing Admin may create another Admin or Parent, enter actual adult name/email, send setup, see delivery state, resend, invalidate prior setup, disable/reactivate, archive, revoke sessions, and initiate reset.

Setup links:

- are sent by Resend;
- are single-use;
- expire after seven days;
- are invalidated when a newer setup link is issued;
- require current policy acceptance;
- never expose the token to Admin.

### PS-010.3 Student credentials

Parent/Admin:

1. enters actual Student name;
2. receives a human-readable username suggestion;
3. adjusts it if available;
4. enters/confirm password;
5. activates the Student.

The new password may be copied/printed only in the immediate credential-handoff success state. It is never redisplayed later and is never emailed.

Username/password changes:

- increment credential/session version;
- revoke affected sessions;
- write an audit event;
- never reveal the old password.

### PS-010.4 Adult reset and authenticated password change

Forgot-password accepts adult email and always gives a generic public response. Reset links:

- are Resend-only;
- are single-use;
- expire in 60 minutes;
- revoke prior sessions after successful reset;
- return the user to login.

An active adult may change password from Account after confirming current password or completing a fresh secure reset. The Admin never sees a password or token.

### PS-010.5 Account states and sessions

- `invited` may complete setup but cannot use ordinary authenticated product routes.
- `active` may authenticate subject to role and household access.
- `disabled` is reversible and blocks login.
- `archived` retains history and blocks login.

Sessions use secure HttpOnly cookies, appropriate SameSite, CSRF, rotation at login, idle and absolute expiry, generic invalid-credential response, rate limiting, and revoke-all behavior.

| Actor/session | Idle expiry | Absolute expiry |
|---|---:|---:|
| Admin | 30 minutes | 12 hours |
| Parent | 24 hours | 30 days |
| Student | 7 days | 30 days |

Authentication throttles are exact:

- login: five failed attempts per account-and-IP pair in 15 minutes and 50 attempts per IP in 15 minutes;
- adult reset: five requests per account per hour and 20 per IP per hour;
- setup resend: three requests per account per hour;
- generic responses prevent account discovery;
- there is no permanent password lock; bounded backoff expires automatically.

Exact grant, webhook, and worker controls are specified in `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md` and `10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`.

## PS-011. Admin information architecture and Dashboard

Admin primary navigation is:

1. Dashboard;
2. Contacts;
3. Content;
4. Classroom;
5. Live Console.

Utility navigation is:

- Communications;
- Tickets;
- Billing & Access;
- Integrations;
- Operations;
- Audit;
- Support;
- Account.

The exact nesting and route IDs are normative in `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md`.

The Dashboard is an operating dashboard, not a setup wizard. It prioritizes:

1. current/next class and Live Console;
2. exceptions needing action;
3. content pipeline;
4. people/learning summaries;
5. recent communications/audit;
6. provider health.

Quick actions:

- Add adult;
- Add household;
- Add Student;
- Create Admin;
- Create/schedule class;
- Open next occurrence;
- Prepare class;
- Upload recording;
- Create announcement;
- Open tickets.

All quick actions open real forms and persist.

## PS-012. Contacts, adult CRM, and audience classification

### PS-012.1 Admin people experience

Admin people and household surfaces support search, sort, filter, pagination, active/archived visibility, GHL link, household, account status, source/provenance, lifecycle summary, and suppression summary.

Admin may create, edit, archive, restore, link/unlink through governed action, open GHL, view timeline, and view communication status.

### PS-012.2 Adult matching

Adult matching order:

1. verified provider link;
2. exact normalized email;
3. manual quarantine.

Phone and name alone never silently merge adults. Existing GHL leads who sign up are updated/tagged rather than duplicated.

### PS-012.3 Canonical adult segments

Adult CRM classification remains:

- active legacy member;
- former/canceled member;
- interested opted-in lead;
- current Parent/customer;
- Parent newsletter subscriber;
- suppressed/denied;
- unknown/review;
- School lead.

Consent and lifecycle are separate. Active status does not imply general marketing permission. Suppressed/denied adults are excluded from marketing.

Legacy export counts are evidence, not permanent acceptance totals. Children are not imported into GHL.

## PS-013. Households and Students

### PS-013.1 Household administration

Admin household list/detail shows:

- display name;
- account owner;
- owned Student seats and allowance;
- plan/contract;
- billing/access;
- canonical class enrollment;
- setup state;
- reminders/updates;
- tickets;
- audit.

Admin may create, edit, archive, restore, transfer ownership, configure approved School allowance/terms, and reconcile exact adult linkage.

### PS-013.2 Seat allowance

Standard Family allowance is three active Students. Creation and restore are transactional and concurrency-safe:

- the fourth active standard seat is rejected clearly;
- no partial Student/account/enrollment/access write survives;
- archiving frees a seat;
- restoring requires an available seat;
- concurrent requests cannot bypass the allowance.

An approved School allowance is an explicit audited contract value and never inferred from inquiry size.

### PS-013.3 Canonical-class enrollment

Every newly active Student is immediately enrolled in the canonical class. Enrollment is idempotent and visible on Parent, Student, and Admin calendars.

Archiving a Student revokes active classroom/content authorization and stops seat consumption while retaining history. Restoring reevaluates household access and recreates/reuses canonical enrollment safely.

Additional noncanonical class enrollment remains Admin-controlled.

## PS-014. Calendar, class series, and occurrences

### PS-014.1 Canonical schedule

The launch catalog has exactly one active, published canonical recurring class:

- Sunday through Thursday;
- 7:00 p.m.;
- 60-minute scheduled duration;
- `Asia/Jerusalem`;
- first occurrence anchored at `2026-08-16T19:00:00+03:00`;
- Gregorian/English dates;
- no Friday or Saturday occurrence.

The recurrence stays at 7:00 p.m. Jerusalem through DST. Occurrences exist on a rolling 90-day horizon. Preparation runs automatically 24 hours before start and may be triggered manually earlier; the Parent reminder is scheduled 30 minutes before start; Student join opens 10 minutes before start. Unless an Admin closes or extends it, the occurrence auto-closes 15 minutes after scheduled end. Viewer-local display and timezone rules are defined in `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`.

For the immediate launch UI, Parent and Student use Next Class with join timing and recent recording access. Month-grid completion is later and must not block the one-class journey.

### PS-014.2 Calendar views

Admin:

- Month;
- Week;
- Day;
- Agenda/List;
- filters by class, teacher/Admin, occurrence state, Zoom state, recording state, enrollment issue, and date range.

Parent:

- Month;
- Week;
- List;
- combined owned-household view;
- Student filter;
- local time with zone;
- canceled/rescheduled and attendance/recording-availability summaries;
- no Join or playback.

Student:

- Today;
- Week;
- simple agenda;
- next class/countdown;
- embedded Join state;
- canceled/completed;
- approved recording availability.

No Google Calendar integration or Hebrew date is present.

### PS-014.3 Class series administration

Admin may create, edit, explicitly activate/publish, pause, resume, archive, and restore class series; set title, description, teacher/Admin, timezone, default time, duration, recurrence, reminder policy, access requirement, and enrollment policy. Creation and restoration produce `draft`; restoration never republishes automatically. Every transition shows consequences and uses the state contract in document 06.

An additional series is future-expansion capability, not a second launch offering. It is created `draft`, has no enrollment, produces no Parent/Student calendar occurrence, creates no Zoom resource, and sends no communication until an Admin explicitly activates/publishes it. The production launch dataset contains only the canonical class as active/published.

Launch supports:

- canonical Sunday–Thursday recurrence;
- one-time occurrence;
- selected permitted weekdays;
- weekly recurrence;
- start/end dates;
- skip dates and vacation exceptions;
- single-occurrence versus future-series edit;
- timezone-safe DST.

Friday and Saturday occurrence starts are rejected at launch. Additional permitted classes do not automatically enroll every Student unless the Admin explicitly selects that policy.

### PS-014.4 Occurrence lifecycle

Occurrence lifecycle is:

`scheduled` → `preparing` → `ready` → `live` → `completed`

`scheduled`, `preparing`, or `ready` may become `canceled` according to the transition contract. A canceled future occurrence may be restored only through the explicit governed transition.

Admin may create, edit, reschedule, cancel, restore when allowed, mark/open live, complete/close, view roster/Zoom/attendance/content, and send an update.

Reschedule/cancel after access distribution:

- invalidates stale launch authorization;
- updates Parent/Student calendar immediately;
- queues the correct adult and in-app notice;
- preserves audit and previous timestamp;
- does not duplicate unaffected messages on retry.

Detailed transitions are normative in `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md`.

## PS-015. Class preparation and embedded Zoom classroom

### PS-015.1 Prepare Class & Send Access

The occurrence workspace primary action is **Prepare Class & Send Access**. The automated preparation job invokes the same idempotent operation 24 hours before start; Admin may invoke it earlier.

It:

1. validates occurrence lifecycle, time, and canonical class ownership;
2. validates current active entitled roster;
3. provisions or reuses exactly one app-owned Zoom meeting for the occurrence;
4. provisions or reconciles one separate Zoom registrant per Student;
5. creates Student-bound, short-lived, bearer-free embedded launch authorization;
6. updates each Student portal;
7. prepares one Parent/account-owner notification per household with each Student labeled;
8. shows exact recipient/suppression/failure readback before confirmation;
9. sends only after Admin confirmation;
10. records result per Student and household;
11. retries only failed items and does not duplicate success.

The Parent notification contains protected One Time buttons, not Zoom URLs. A button returns to the intended occurrence after the matching Student signs in; a Parent or sibling session cannot enter.

### PS-015.2 Meeting and participant defaults

Canonical-class Zoom settings are:

- embedded authenticated experience;
- waiting room disabled;
- participants muted on entry;
- participant video enabled;
- camera expected and explained before entry;
- participant renaming disabled;
- participant screen sharing disabled;
- participant file transfer disabled;
- participant chat disabled;
- Zoom cloud recording disabled;
- one Student-specific registrant per Student;
- no shared family registrant;
- no manual raw-link paste.

The UI asks the Student to enable the camera but does not falsely claim it can override browser/device permission. Camera denial does not silently masquerade as camera readiness.

Student voice and video may be recorded only after current versioned account-owner consent under `10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`.

### PS-015.3 Join eligibility

Join becomes available when:

- the occurrence is `ready` and within 10 minutes of scheduled start; or
- the occurrence is `live`;
- the Student is active;
- household access is `free`, `active`, or `grace`;
- enrollment is active;
- provider registration is ready;
- no revocation/cancellation applies.

There is no product-level too-late denial while the occurrence remains `live`. The occurrence auto-closes 15 minutes after its scheduled end unless an Admin explicitly extends or closes it. Join stops when the occurrence is canceled, completed/closed, provider meeting ends, enrollment/access is revoked, or the active live-session policy denies the device.

### PS-015.4 One concurrent Student classroom

One concurrent live-classroom session is allowed per Student.

- Reconnect from the same authenticated session/device is permitted.
- The active device lease heartbeats every 30 seconds and expires after 90 seconds without heartbeat.
- A second device/session is denied with a clear message.
- The denial does not reveal the active device.
- Admin may revoke/reset the active live launch session.
- Revocation is audited and requires a fresh Student launch.

### PS-015.5 Admin Zoom and Live Console

Per occurrence, Admin sees:

- provider connected/degraded;
- meeting not provisioned/preparing/ready/live/completed/canceled/error;
- Student registrations total/ready/failed;
- active Student session/join state;
- muted and video-readiness projection;
- attendance/reconnect;
- last provider readback and stale state;
- safe retry/reset/end actions.

Admin actions include:

- Check Zoom;
- Prepare/Retry;
- Register missing Students;
- Review and send Parent access;
- Open Live Console;
- reset a Student live session;
- request provider-supported audio/video actions;
- close/end occurrence;
- delete only an explicitly approved app-owned test/canary resource in its bounded environment.

Normal classroom operation never depends on historical disposable-canary cleanup.

### PS-015.6 Real-device classroom acceptance

Production acceptance uses:

- one Admin device;
- one Parent device;
- three separate real Student tablet/browser profiles;
- one operator-owned occurrence;
- three distinct Student registrations;
- three embedded launches;
- one same-session reconnect;
- second-device denial;
- sibling/cross-household denial;
- join after scheduled start while live;
- muted entry;
- camera/recording guidance;
- attendance readback;
- Admin session reset.

## PS-016. Attendance, progress, goals, badges, and leaderboard

### PS-016.1 Attendance truth

Attendance stores:

- Student and occurrence;
- first join and last leave;
- total validated minutes;
- reconnect count and merged intervals;
- occurrence duration and attendance percentage;
- late indicator for information only;
- provider reconciliation state;
- manually corrected value and reason;
- audit actor/timestamp.

The product does not label a Student “present” from an arbitrary percentage threshold. It shows minutes and percentage truthfully.

For the fixed attendance-count and streak badge/leaderboard rules, a scheduled completed occurrence counts as attended when it contains at least one validated attendance minute or an Admin correction marks attendance. A canceled occurrence does not break a streak. A completed scheduled occurrence with zero validated minutes breaks the current streak. Manual correction recalculates affected projections and is audited.

### PS-016.2 Progress

Student progress includes:

- attendance count, minutes, percentage, and current streak;
- recordings started/completed;
- review events completed;
- questions answered or approved for class;
- fixed badge progress;
- rolling-30-day leaderboard category position.

Parent sees Parent-safe summaries for owned Students but not private question text or Rabbi answer. Admin sees governed details and correction history.

At launch, a review event is not a quiz score. It is recorded once per Student per Admin-published review item when the authenticated Student opens that review and submits or marks it complete. Answer correctness and percentage do not affect credit; reopening or resubmitting the same review does not create another event. An Admin may correct the event only with an audited reason.

Basic recording completion is reached at 90% of playable duration or an explicit completed-review action, whichever the assigned learning item defines. Resume position and completion are Student-scoped and idempotent.

### PS-016.3 System-defined goals

Launch goals are exactly:

- attend class consistently;
- ask meaningful questions;
- attend/complete the review.

Parent-created goals and arbitrary Admin goal builders are absent.

### PS-016.4 Fixed badges

Launch badges are:

- Consistency — one verified-attendance threshold;
- Curious Learner — one Rabbi-featured or Rabbi-approved question/response threshold;
- Review Ready — one Rabbi-accepted worksheet threshold.

Badges:

- are computed from auditable source events;
- are awarded idempotently;
- show progress to next level;
- may be corrected/revoked by Admin only with reason;
- have fixed rules at launch;
- have no currency, catalog, or redemption behavior.

### PS-016.5 Leaderboard (later)

The authenticated class-only leaderboard has separate rolling-30-day categories:

This historical design is deferred from the immediate launch. No public or class leaderboard, points economy, reward catalog, parent goal, editable badge rule, or additional badge level may block the three-badge launch contract.

- attendance count;
- current attendance streak;
- questions approved/published.

It:

- never creates a combined score;
- keeps every eligible Student ranked regardless of optional recognition consent;
- with recognition consent, uses first name plus last initial for member-visible names;
- without or after withdrawal of recognition consent, shows **You** to that Student and a stable class-scoped nonidentifying alias such as **Anonymous Student • A7** to peers;
- uses full names only in authorized Admin/live-class context;
- uses competition ranking for ties;
- shows a Student only the canonical class board and own position;
- exposes no private question text or unrelated household data;
- recalculates after an audited correction.

## PS-017. Recording ingestion, processing, and library

### PS-017.0 Launch recording acquisition

OBS is the sole launch recording source; Zoom cloud recording is disabled. Before recording, the Admin:

1. verifies that every joinable Student has the current recording-participation consent;
2. confirms the in-product recording indicator and gives a clear verbal recording notice;
3. starts OBS on the controlled, encrypted operator device and records the occurrence identifier;
4. stops OBS at class end and verifies that the file is readable;
5. sends the file to direct upload or the dedicated Drive incoming folder within 24 hours;
6. deletes the operator-device copy only after durable source size/checksum readback.

The preferred filename is `YYYY-MM-DD_HHMM_<occurrence-id>_Class-Name.ext`; filename assists correlation but Admin confirms the occurrence. An OBS failure is shown truthfully as recording unavailable and creates an Admin operations item. It does not silently enable Zoom cloud recording or fabricate a recording.

### PS-017.1 Ingestion sources

Two launch ingestion paths enter one content pipeline:

1. Admin direct drag/drop or file picker in One Time;
2. monitored private Google Drive incoming folder.

Supported recording containers are MP4, MOV, and MKV up to 5 GiB. Direct uploads use multipart transfer to a private, versioned, public-access-blocked, SSE-KMS AWS S3 bucket in `eu-central-1`; they never load the complete file into process memory and are resumable or safely restartable. A confirmed upload has a provider version identifier, size, checksum, and readback before it may process.

Both paths:

- detect stable/complete input;
- compute a checksum/fingerprint;
- deduplicate across app and Drive;
- preserve the original;
- attempt occurrence matching;
- place uncertain matches in Admin review;
- record provenance.

Recommended Drive folders remain:

- `One Time/Recordings/Incoming`;
- `One Time/Recordings/Matched`;
- `One Time/Recordings/Needs Review`;
- `One Time/Recordings/Processed`.

A recommended filename is `YYYY-MM-DD_HHMM_Class-Name.ext`, but ingest does not depend on exact filename.

### PS-017.2 Pipeline lifecycle

Content lifecycle is:

1. `received`;
2. `validating`;
3. `processing`;
4. `needs_review`;
5. `approved`;
6. `publishing`;
7. `published`;
8. `failed` or `archived` through governed transitions.

Processing prepares:

- compressed/resized derivative;
- English transcript;
- captions/VTT;
- title/date/class/topic metadata;
- structured Mishnah references when available;
- summary;
- review material/worksheet draft;
- future knowledge-base artifact draft;
- private Vimeo asset candidate.

The launch derivative uses versioned profile `OT-VIDEO-1`: MP4 container with web fast-start; H.264 video in `yuv420p`, source aspect ratio preserved, no upscaling, maximum 1920×1080 and 30 fps, CRF 23 with medium preset; and AAC-LC audio at 48 kHz, stereo, 128 kbps. Orientation is normalized and unnecessary source metadata is removed. The job records the profile version, source and derivative byte counts, duration, stream properties, and checksum. A missing audio or video stream, invalid duration, or unreadable output fails to review/quarantine rather than publishing.

English transcription uses the OpenAI Audio Transcriptions API with `gpt-4o-transcribe`, explicit language `en`, and a versioned Mishnayos/Torah glossary-context prompt. Worksheet, review, summary, structured Mishnah-reference, and future knowledge-base drafts use the OpenAI Responses API with `gpt-4.1-mini` Structured Outputs. Every `ContentVersion` records exact model, prompt, glossary, schema, and processor versions; provider output is never authoritative without Admin review.

No generated output becomes authoritative or Student-visible before Admin approval.

### PS-017.3 Admin review

Admin may:

- match/change occurrence;
- preview video;
- set beginning/end trim by controls or exact time;
- reset trim;
- preview processed derivative;
- edit title/description/topic and Mishnah references;
- correct transcript/captions;
- edit worksheet/review material;
- inspect knowledge-base artifact draft;
- approve;
- publish;
- unpublish;
- archive.

Only beginning/end video trim is a launch editing capability. Advanced timeline editing is absent.

### PS-017.4 Publication and access

Publishing:

- requires `approved`;
- confirms private Vimeo provider readback;
- assigns entitled Students;
- updates Student library;
- creates configured in-app and adult recording notice;
- uses only protected One Time routes.

Playback requires correct workspace, Student, enrollment/assignment, access, and published state. Parent, sibling, cross-household, archived, inactive, revoked, unpublished, and raw-provider access are denied.

Unpublish immediately blocks new playback authorization and terminates/rejects subsequent playback refresh without deleting source/history.

### PS-017.5 Library

Launch content types are:

- recording/video;
- lesson;
- worksheet;
- review sheet;
- English transcript;
- captions;
- quiz/review questions;
- announcement resource.

Student library:

- contains only entitled published items;
- searches title, English transcript, date, class/topic, and structured Mishnah references when available;
- filters/sorts by date, content type, and class/topic;
- supports basic resume playback;
- shows approved transcript and review material;
- never shows sibling or provider data.

Favorites are absent. Parent has no Student-library playback route.

## PS-018. Questions, announcements, and Student support

### PS-018.1 Student Torah/class questions

A Student may submit a private Torah/class question with occurrence/class context. The lifecycle is:

- `submitted`;
- `answered_private`;
- `approved_for_class`;
- `published`;
- `closed`;
- `declined`.

Admin/Rabbi may:

- view the private queue;
- answer privately;
- approve for class;
- ask/record readiness;
- publish a moderated question/answer;
- close or decline with appropriate Student-facing state.

Parents cannot view question text, state, Rabbi answer, selection, or publication linkage. There is no open Student-to-Student chat.

Rabbi Telegram may notify and support a governed action, but One Time remains source of truth and no child GHL contact/conversation is created.

### PS-018.2 Student technical support

A Student may separately submit technical support inside One Time. Student support:

- is not a Torah-question record;
- never creates a child GHL contact or conversation;
- uses minimal Student/account/technical context;
- follows `open`, `in_progress`, `waiting_on_requester`, `resolved`, `closed`;
- is visible only to the Student and authorized Admin;
- routes safe internal notification to Shloimie’s `OT` operations channel.

### PS-018.3 Announcements

Admin may create:

- all-program;
- class-specific;
- Parent-only;
- Student-facing;
- scheduled;
- pinned;
- expiring;
- archived announcements.

Recipient scope and count are previewed before publication/send. Student announcements are in-app. Adult email follows the workflow/consent classification in `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`.

## PS-019. Billing and effective access

### PS-019.1 Governed billing surface

GHL is the operator-facing billing workflow surface using its Stripe integration. Stripe is the financial processor and financial truth. Parent actions open an approved, household-bound GHL-hosted billing page; GHL orchestrates Checkout, scheduled continuation, portal/payment-method update, cancellation, refund, and repair, while Stripe creates and owns the financial objects. Stripe sends signed events directly to both GHL and One Time. One Time validates and projects access but never creates or mutates the financial objects. Stripe Dashboard is an audited break-glass path only when GHL lacks the required supported operation.

Parent billing/reactivation shows:

- household context;
- standard or contracted plan;
- current access state;
- free end, grace end, next charge, or paid period end as applicable;
- scheduled continuation state;
- **Continue with One Time**;
- **Update billing information**;
- **Manage subscription**;
- cancellation state;
- support.

Hosted provider pages collect card/payment details. One Time never renders card fields.

Each launch is bound to exactly one household Stripe Customer. A portal/session link is short-lived and created only after current Parent and household authorization; it cannot display or mutate another household. On verified ownership transfer, the same household Customer and financial history remain, its contact metadata and GHL household-record association move to the new owner, and every prior billing-portal session is invalidated.

### PS-019.2 Required lifecycle events

Provider contracts handle:

- checkout/continuation started;
- scheduled paid continuation authorized;
- paid activation;
- payment failure;
- grace start;
- payment recovery;
- cancel at period end;
- subscription end;
- refund;
- chargeback;
- complimentary access grant/revoke;
- administrative suspension apply/clear.

Only verified, signed, idempotent, reconciled events update effective access. A GHL tag alone never grants or revokes access.

### PS-019.3 Billing state presentation

- `free` shows exact expiry and scheduled continuation offer.
- `active` shows current plan and period-end/next-charge readback.
- `grace` shows exact deadline, full access, repair action, and support.
- `inactive` shows exactly Parent overview/status, household switcher, billing/reactivation, support list/detail, account, privacy, and data rights; all other Parent routes and every Student route remain unavailable.
- period-end cancellation shows remaining access and no future renewal.
- complimentary source and administrative suspension remain independent.

No unavailable financial fact is fabricated or shown as zero.

### PS-019.4 Billing acceptance

Candidate-bound verification evidence covers:

- scheduled no-charge-before-expiry continuation;
- explicit immediate-charge exception;
- duplicate prevention;
- active subscription;
- failed invoice;
- retry and seven-day grace;
- recovery;
- hosted payment-method update;
- cancellation and period end;
- refund and chargeback;
- complimentary access;
- suspension precedence;
- replay/out-of-order events.

One operator-owned bounded live financial canary follows the manifest in `11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml`.

## PS-020. HighLevel, campaigns, email, website bot, and WhatsApp

### PS-020.1 Sender identity

Rabbi/program email:

- sender name: `Rabbi Eli Scheller | One Time Mishnayos`;
- From: `rabbi@onetimeonetime.com`;
- Reply-To: `info@onetimeonetime.com`;
- use: migration, reactivation, opted-in nurture, newsletter, teaching/program email.

Office/operational email:

- From: `info@onetimeonetime.com`;
- use: support, billing, access, schedule, recording operations, cancellation/refund support.

Account-security email is Resend-only.

### PS-020.2 Required semantic workflow functions

Launch includes governed, tested functions for:

- new Family lead/signup intake;
- active legacy adult migration invitation;
- interested opted-in lead nurture;
- checkout/continuation abandonment;
- payment active;
- payment failure and grace;
- subscription cancellation;
- Parent invitation/ownership-transfer companion;
- Parent activation;
- Parent class reminder;
- recording available;
- Parent newsletter;
- former-member reactivation;
- refund/chargeback.

Exact canonical workflow IDs, registry migration, triggers, filters, sender, actions, waits, exits, suppression, rollback, and copy are defined in `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md` and `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`.

Historical OT-11/OT-12 identifier collisions are reconciled through an explicit registry migration. No identifier is silently reused for a different semantic workflow.

### PS-020.3 Campaign governance

GHL is the campaign authoring and execution surface. One Time Communications shows:

- semantic workflow and canonical ID;
- current segment;
- eligible count;
- excluded/suppressed count;
- sender/Reply-To;
- subject and rendered-copy readback;
- cadence/waits;
- readiness;
- governed Start/Pause;
- delivery/readback;
- safe GHL conversation/workflow links.

No campaign sends before the exact copy, target, and suppression readback are visible and approved by an Admin. The product exposes no test-send action or campaign editor; bounded operator-only provider canaries run through the release-verification harness.

Active migration and former-member reactivation may start immediately after approval. Interested-lead nurture is fully configured but remains paused until Admin Start.

### PS-020.4 Email writing standard

Rabbi emails:

- open `Hi {{contact.first_name}},`;
- are personal, brief, confident, Torah-centered, and plain;
- contain one clear CTA;
- avoid corporate jargon and repeated defensive language;
- close:

`Hatzlacha,`  
`Rabbi Eli Scheller`  
`One Time Mishnayos`

Operational email is direct, gives the exact next step and support route, and avoids unnecessary marketing.

Canonical full copy and approval evidence are in `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`.

### PS-020.5 Website lead-capture bot

The GHL lead-capture bot:

- appears on the public website;
- captures adult Family or School inquiry context;
- identifies itself accurately;
- follows approved knowledge/copy boundaries;
- does not create Student contacts;
- does not promise access, price exception, schedule exception, or support resolution it cannot authorize;
- is not a WhatsApp qualification bot.

### PS-020.6 WhatsApp launch boundary

Launch email works independently.

Parent reminder preference supports:

- `email`;
- `whatsapp`;
- `both`;
- `none` for optional reminders.

Until WhatsApp has provider, approved templates, consent, sender, webhook, registry, and production canary:

- no WhatsApp send occurs;
- UI explains WhatsApp is unavailable;
- intent may be stored;
- email is neither delayed nor suppressed because WhatsApp is unavailable;
- no WhatsApp lead assistant exists;
- no UI or metric claims delivery.

## PS-021. Notifications and Parent newsletter

### PS-021.1 Channel matrix

The normative event/audience/channel/consent/dedupe matrix is `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`.

Launch channels:

- Resend — setup, reset, security;
- GHL email — adult operational and approved marketing/newsletter;
- in-app — Student and Parent product notices;
- Telegram — internal Admin transport;
- WhatsApp — dormant reminder intent only until full activation.

Service, security, marketing, newsletter, and optional reminder classifications remain separate.

### PS-021.2 Student notification center

Student notification center includes:

- unread badge;
- unread/read filters;
- mark one/all read;
- safe internal deep links;
- class, content, question, access, and Admin notice types;
- optional audible cue while portal is open.

The audible cue is off until enabled and has a visual equivalent. Background mobile/PWA push is absent.

### PS-021.3 Parent newsletter

Audience:

- current adult Parent/account owner;
- explicit newsletter permission;
- not suppressed/DND/unsubscribed/complained/hard-bounced;
- never a Student contact.

Content may include class recap, upcoming schedule, approved/anonymized questions, new recordings, review suggestions, announcements, and Rabbi teaching note. It contains no private Student information.

Campaign authoring and execution occur in GHL. One Time shows approved archive/readback. One bounded operator-only provider canary through the release-verification harness and Admin/Rabbi approval precede the first broad weekly send; no canary/test action appears in ordinary product navigation.

## PS-022. Support, tickets, and Telegram routing

### PS-022.1 Adult support

Public and Parent adult support can create/continue one governed GHL adult conversation. One Time stores:

- safe ticket ID;
- category/severity;
- household/adult safe reference;
- assigned Admin;
- GHL conversation reference;
- Telegram delivery reference;
- state;
- audit.

Categories include billing, payment failure, access, login, technical, content, class/Zoom, cancellation/refund, privacy, general support, and provider/system failure.

### PS-022.2 Student support separation

Student technical support remains inside One Time and never creates a child GHL identity/conversation. Student Torah/class questions remain a separate private learning channel.

### PS-022.3 Admin ticket UI

Admin can list, search, filter, assign, open, reply through the governed channel, mark waiting/resolved/closed, open adult GHL conversation, see safe Telegram state, and audit.

Routing:

- billing/access/login/technical/cancellation/provider/general → Shloimie `OT` operations;
- Torah/class question/readiness/Rabbi answer → Rabbi communications;
- Student technical support → Shloimie `OT` operations without GHL child contact.

## PS-023. Screen, visual, responsive, and accessibility system

The normative screen catalog and design system is `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`.

Required visual identity:

- black/dark foundation;
- white text/reading surfaces;
- bright yellow primary actions with black text;
- restrained cyan focus/information accents;
- approved One Time logo;
- no BNA leakage.

Required UX:

- desktop/tablet stable Admin navigation;
- mobile role drawer and Student-first navigation;
- full Admin mutations on desktop/tablet;
- bounded urgent/simple Admin mobile experience;
- Parent/Student full responsive experience from 360px;
- no viewport overflow;
- accessible agenda alternative to calendar;
- persistent labels and state explanations;
- exact design tokens/components;
- English-only UI with Unicode names and local RTL rendering for Hebrew-name values.

WCAG 2.2 AA, keyboard, screen-reader, contrast, 200% text, 400%/320px reflow, reduced motion, accessible media, and touch-target acceptance are release gates.

## PS-024. Security, privacy, consent, and data rights

Detailed controls are normative in:

- `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`;
- `10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`.

Required invariants include:

- server-derived role/workspace/household/Student scope;
- parameterized queries;
- secure password hashing;
- secure HttpOnly cookies;
- CSRF, rate limit, rotation, and session revocation;
- generic public authentication/recovery responses;
- signed webhooks;
- idempotency/replay protection;
- no raw Zoom/Vimeo destination in browser URL, email, GHL, logs, or ordinary UI;
- no Student GHL contact;
- cross-household and sibling denial;
- one live Student classroom session;
- versioned authority and recording consent for each dependent Student, plus verified self-consent for each self-managed adult Student;
- versioned terms/privacy acceptance;
- minimization, retention, export/correction/deletion handling;
- audit;
- secret/PII/provider-link scanning.

There is no MFA at launch and no MFA enrollment, challenge, recovery-code, SMS/email challenge, or optional-MFA UI.

Security protects normal Admin work without custom one-off authorization strings for ordinary product actions.

## PS-025. Production infrastructure and operations

### PS-025.1 Runtime

The production architecture preserves:

- Node.js 24;
- TypeScript;
- Express;
- React/Vite;
- PostgreSQL;
- forward-only checksummed migrations;
- transactional outbox/worker;
- exact same immutable source for web and worker.

### PS-025.2 Deployment and cutover

Before launch:

- immutable candidate;
- complete automated test evidence;
- environment/provider readiness;
- migration inventory;
- production backup;
- restore proof;
- rollback target;
- exact web/worker agreement;
- domain/cookie/origin readiness;
- zero unexpected send/charge.

After deployment:

- health/readiness;
- migration readback;
- role login;
- search;
- calendar/class;
- embedded Zoom;
- upload/Drive/content/Vimeo;
- billing/access;
- communications;
- support;
- worker heartbeat/queues;
- provider health;
- no secret/PII/provider-link leakage.

Exact cutover and rollback are in `12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md`.

### PS-025.3 Admin Operations

Operations shows:

- release/source;
- web/worker agreement;
- database/migrations;
- queue depth/oldest age/dead letter;
- Resend;
- GHL/Stripe;
- Zoom;
- Vimeo;
- Drive and direct-upload staging;
- Telegram;
- backup age;
- last restore proof;
- recent redacted failures.

SLO, DR, incident, and alert behavior are defined in `13-OPERATIONS-SLO-DR-INCIDENT-v2.1.md`.

## PS-026. Migration, historical data, and cutover

### PS-026.1 Adult GHL continuity

Existing adult GHL contacts remain adult CRM records and are deduplicated/updated when they sign up.

Legacy audiences may be classified for approved migration/reactivation/nurture according to lifecycle and consent, but the product does not migrate:

- old passwords;
- Parent/Student accounts;
- sessions;
- child profiles;
- inferred consent;
- inferred access;
- inferred payment state.

Existing people sign up through the new flow.

### PS-026.2 Runtime cleanup

Before production acceptance:

- remove fictional Cohen family and other fake customer rows from runtime UI;
- remove preview Admin/Parent/Student users;
- remove Live Demo/Student records and sessions;
- remove engineering controls/customer test cards;
- preserve only named, approved operator-owned canary data according to `11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml`.

Historical evidence is retained outside customer runtime and current acceptance state.

### PS-026.3 Historical Tisha B’Av assets

Tisha B’Av funnel/campaign artifacts are archived as historical reusable template material. They are not launch product routes or active general workflows.

System disposition and cutover behavior are detailed in `04-SUPERSESSION-AND-SYSTEM-DISPOSITION-v2.1.md` and `12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md`.

## PS-027. Real production acceptance journeys

### PS-027.1 Shloimie Admin journey

Shloimie:

1. signs in with email/password and no code or MFA;
2. uses Dashboard and global search;
3. creates/edits/archives/restores an adult;
4. creates a Family household and Parent;
5. creates three Students and sees fourth-seat rejection;
6. changes Student username/password and verifies session revoke;
7. sees automatic canonical enrollment/calendar;
8. schedules/edits a permitted class occurrence;
9. prepares class and previews/sends access;
10. operates Live Console;
11. resets a Student’s second-device conflict;
12. uploads a real recording directly;
13. verifies Drive duplicate/deduplication path;
14. trims, reviews, corrects, approves, and publishes;
15. verifies Student playback/resume and unpublish denial;
16. reviews attendance/progress/badges/leaderboard;
17. handles adult and Student technical tickets;
18. opens billing/access, communications, integrations, operations, and audit;
19. logs out/in and verifies persistence.

### PS-027.2 Rabbi Eli Admin/teacher journey

Rabbi Eli proves identical Admin authority and:

1. uses teaching calendar and roster;
2. uses Live Console;
3. receives private-question notification;
4. answers privately;
5. approves for class and publishes moderated result;
6. reviews/approves content;
7. creates announcement and newsletter draft/readback;
8. verifies his actual Admin identity in audit.

### PS-027.3 Family Parent journey

A real Parent:

1. signs up without a card;
2. receives and uses seven-day setup;
3. confirms timezone/policies;
4. creates three actual Students;
5. sees automatic canonical enrollment and next class;
6. sees fourth-seat rejection;
7. copies initial credential handoff;
8. resets one Student password;
9. uses household switcher when owning multiple households;
10. sees calendar and Parent-safe progress/badges;
11. cannot enter class/library/private questions;
12. chooses reminder intent with truthful WhatsApp availability;
13. uses billing/reactivation provider path;
14. views newsletter/updates;
15. submits support;
16. logs out/in.

### PS-027.4 Approved School journey

1. Public representative submits School inquiry.
2. No product access or nurture is created.
3. Admin follows up and approves manually.
4. Admin configures account manager, allowance, price, billing start, and terms.
5. Account manager uses the Parent experience.
6. Separate Student accounts use the normal Student experience.
7. No school role, portal, or bulk administration appears.

### PS-027.5 Student journey on three tablets

For each Student:

1. sign in with own username/password;
2. see own actual/display name;
3. see own Today/calendar;
4. enter embedded class;
5. verify unique registration and muted entry;
6. verify recording/camera guidance;
7. join after start while occurrence remains live;
8. reconnect same session;
9. deny second device;
10. deny sibling/cross-household data;
11. play/resume approved recording;
12. see progress/fixed badges/leaderboard;
13. submit private Torah question;
14. submit separate technical support;
15. use notification center/audible preference;
16. log out/in.

### PS-027.6 Commercial journey

1. free Family signup without card;
2. free access;
3. early continuation schedules first charge at expiry;
4. active access at verified event;
5. hosted billing update;
6. failed payment;
7. seven-day grace with Student access;
8. recovery;
9. period-end cancellation;
10. inactive Parent restricted access and Student denial;
11. reactivation;
12. Admin-approved refund;
13. replay/out-of-order safety.

### PS-027.7 Communications journey

1. GHL segment and suppression readback;
2. exact rendered-copy/sender/cadence readback;
3. one bounded operator-only provider canary through the release-verification harness, outside ordinary product navigation;
4. Admin approval;
5. governed Start/Pause;
6. active migration and former reactivation;
7. nurture ready/paused until Start;
8. school acknowledgment only;
9. email works with WhatsApp dormant;
10. replies reach correct adult GHL conversation;
11. no Student GHL contact.

## PS-028. Interactive-element and route certification

A machine-readable inventory covers every production-visible:

- route;
- navigation item;
- button/link;
- field/select/checkbox;
- filter/sort/pagination;
- dialog/drawer/tab action;
- calendar action;
- provider action;
- upload/media control;
- send/billing/destructive action.

Each inventory row records:

- acceptance ID;
- decision/spec/screen source;
- actor/role;
- route/screen;
- label/message ID;
- preconditions;
- expected effect;
- persistent readback;
- authorization-negative result;
- cross-household/sibling result where relevant;
- supported viewport/browser;
- keyboard/screen-reader result where relevant;
- evidence artifact;
- final `PASSED` or `REMOVED`.

Release gates:

- `FAILED = 0`;
- `UNTESTED = 0`;
- `PLACEHOLDER = 0`;
- `FAKE_DATA_DEPENDENCY = 0`;
- `UNAUTHORIZED_VISIBLE = 0`.

The executable contract is `02-ACCEPTANCE-CONTRACT-v2.1.yaml`; traceability is `14-TRACEABILITY-CROSSWALK-v2.1.yaml`.

## PS-029. Explicit launch absences

The following are absent at launch and may not appear as placeholders:

- cross-workspace super-admin UI;
- BNA merge/navigation/runtime dependency;
- roles other than `admin`, `parent`, `student`;
- Parent Learner Mode;
- simultaneous co-guardian access;
- school role/portal/bulk roster/organization administration;
- public Student registration;
- Class Helper;
- Buffer/social publishing;
- demos/preview/product test lanes;
- Google Calendar sync;
- Hebrew calendar;
- Hebrew/multilingual interface or content processing;
- multiple standard Family plans;
- library-only plan;
- MFA of any kind, enrollment, challenge, recovery code, or settings;
- voice bot;
- WhatsApp lead assistant/qualification bot;
- active WhatsApp sends before complete activation;
- open Student chat;
- Parent-created goals;
- editable badge rules;
- reward currency/catalog/redemption;
- combined leaderboard score;
- favorites;
- PWA/background push;
- advanced video editing beyond beginning/end trim;
- automatic publication;
- old disposable Zoom cleanup as a normal product dependency;
- unrelated BNA features.

## PS-030. Final release checklist

### PS-030.1 Application and identity

- [ ] `app.onetimeonetime.com` live on exact candidate
- [ ] `join.onetimeonetime.com` approved Family/School funnel
- [ ] two equal Admin accounts
- [ ] Parent setup and multi-household switcher
- [ ] one-owner transfer
- [ ] three Student accounts
- [ ] adult learner through separate Student seat
- [ ] no code or MFA UI
- [ ] no fictional/deferred surface
- [ ] global search
- [ ] every route/control certified

### PS-030.2 Classroom

- [ ] canonical Sunday–Thursday 7:00 p.m. Jerusalem schedule
- [ ] automatic active-Student enrollment
- [ ] calendars for all roles
- [ ] Prepare Class & Send Access
- [ ] embedded Zoom
- [ ] three unique registrations/tablets
- [ ] one-concurrent-session enforcement/reconnect
- [ ] late-live join
- [ ] attendance/reconciliation/correction
- [ ] Live Console

### PS-030.3 Content and learning

- [ ] direct 5 GiB upload
- [ ] Drive ingest and cross-source dedupe
- [ ] compression/resize
- [ ] trim
- [ ] English transcript/captions
- [ ] worksheet/review/knowledge-base drafts
- [ ] private Vimeo
- [ ] Admin review/approval
- [ ] Student search/playback/resume
- [ ] unpublish/revoke
- [ ] fixed goals/badges
- [ ] category leaderboards
- [ ] private questions
- [ ] Student technical support

### PS-030.4 Commercial and communications

- [ ] free signup without card
- [ ] canonical countdown/expiry
- [ ] scheduled no-charge-before-expiry continuation
- [ ] USD $67 standard plan
- [ ] hosted billing
- [ ] grace/cancellation/refund/access projection
- [ ] GHL workflow registry collision resolved
- [ ] email-only launch works
- [ ] WhatsApp dormant truthfully
- [ ] website lead bot
- [ ] Parent newsletter
- [ ] Student notification center
- [ ] Telegram separation

### PS-030.5 Security, privacy, UX, and operations

- [ ] versioned account-owner/recording consent
- [ ] no Student GHL identity
- [ ] no raw provider destination
- [ ] cross-household/sibling denial
- [ ] WCAG 2.2 AA
- [ ] supported browser/device matrix
- [ ] desktop/tablet full Admin and mobile urgent subset
- [ ] immutable web/worker agreement
- [ ] migrations/backup/restore/rollback
- [ ] queue/provider health
- [ ] SLO/incident readiness
- [ ] migration without old credentials/children/inferred consent/access
- [ ] zero unexpected send/charge
- [ ] final automated and operator acceptance
