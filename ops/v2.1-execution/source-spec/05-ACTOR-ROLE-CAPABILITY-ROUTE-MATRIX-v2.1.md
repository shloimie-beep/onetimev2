# One Time Mishnayos — Actor, Role, Capability, and Route Matrix

**Package:** `ONE-TIME-PRODUCTION-SPEC-v2.1`  
**Document:** `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md`  
**Status:** Normative production specification  
**Version:** 2.1  
**Date:** 2026-07-28  
**Repository:** `shloimie-beep/onetimev2`  
**Reviewed head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`

## AR-001. Scope and authority

This document defines the production actors, assignable roles, account contexts, capabilities, navigation ownership, routes, and denial behavior for One Time Mishnayos.

It implements the locked and inferred decisions in `03-DECISION-REGISTER-v2.1.md`. Product behavior is further defined by:

- `01-PRODUCT-SPEC-v2.1.md`;
- `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`.

The assignable authorization roles are exactly:

- `admin`;
- `parent`;
- `student`.

An actor or persona is not automatically an authorization role. In particular:

- a public visitor has no authenticated role;
- a school lead has no authenticated role;
- Rabbi Eli is an `admin` with teacher-profile data, not a separate Rabbi role;
- support work is performed by an `admin`, not a separate support role;
- an approved school account manager uses the `parent` role;
- a worker or provider integration is a service principal, not a human role.

No route, permission, or navigation item may depend on an `owner`, `super_admin`, `rabbi`, `teacher`, `support`, `school`, `crm_agent`, `viewer`, `demo`, or `test` authorization role.

## AR-002. Normative notation

The matrices use:

- **A** — allowed directly by the signed-in actor;
- **S** — allowed only as a system/provider action following an authorized product event;
- **R** — read-only;
- **N** — not allowed and not shown;
- **P** — public action, no authenticated role;
- **M** — manual Admin-assisted action.

Hiding a control is not the authorization boundary. Every route and mutation is authorized on the server from the current identity, role, workspace, household, Student, and record state.

## AR-003. Actor and persona catalog

| Actor ID | Actor/persona | Authentication | Authorization role | Product purpose |
|---|---|---|---|---|
| `ACT-PUBLIC` | Public visitor | None | None | Understand the offer, sign in, start Family signup, or submit a School inquiry |
| `ACT-FAMILY-APPLICANT` | Family account applicant | None until setup | None, then `parent` | Create a free Family household and accept current policies |
| `ACT-SCHOOL-LEAD` | School representative | None | None | Submit a sales lead and receive acknowledgment only |
| `ACT-ADMIN-OPS` | Shloimie/operator persona | Email and password | `admin` | Operate product, accounts, access, billing readback, support, providers, and release health |
| `ACT-ADMIN-TEACHER` | Rabbi Eli/teacher persona | Email and password | `admin` | Use full Admin product plus teaching calendar, Live Console, questions, and content approval |
| `ACT-PARENT` | Household account owner | Email and password | `parent` | Manage household context, Student seats and credentials, schedule summaries, billing, reminders, and support |
| `ACT-ADULT-STUDENT` | Adult learner | Username and password separate from Parent login | `student` | Use one Student seat for learning without granting learning access to the Parent session |
| `ACT-DEPENDENT-STUDENT` | Dependent learner | Username and password | `student` | Use only that Student’s class, library, progress, questions, notices, and support |
| `ACT-WORKER` | One Time background worker | Service authentication | None | Execute authorized outbox, provider, content, notification, and reconciliation work |
| `ACT-PROVIDER` | GHL, Resend, Stripe, Zoom, Vimeo, Drive, Telegram webhook/callback | Signed provider authentication | None | Return provider truth to a bounded integration endpoint |

Shloimie and Rabbi Eli have identical server permissions. Teacher-profile data may change default dashboard emphasis and class attribution, but never grants or removes a capability.

## AR-004. Identity, account, and household context

### AR-004.1 Adult identity

One normalized email maps to one adult identity and one human login. That login has a role set containing `admin`, `parent`, or both. A dual-role adult chooses an explicit Admin or Parent context after login and may switch context from the account menu; the application never infers a context from the route or silently combines the two navigation systems. A repeated signup updates or links the verified existing adult identity and must not create a duplicate adult or login solely because the adult is starting another household.

An adult identity may own multiple independent household subscriptions. Each household has:

- a distinct household ID;
- one Parent/account-owner membership;
- an independent plan, billing reference, access state, class roster, Student-seat allowance, and audit history;
- up to three active Student seats by default;
- a higher contracted allowance only when an Admin explicitly records an approved school contract.

### AR-004.2 Household switcher

An adult with one household enters that household directly. An adult with more than one household sees a household switcher:

- after login when no valid household context is present;
- in the authenticated account menu;
- before a household-scoped mutation when the current context is missing or stale.

The switcher displays only safe household identity, plan/access status, and account-manager relationship. Selecting a household changes the active context through a server-authorized action and redirects to the equivalent safe Parent route when possible.

Household context is never accepted solely from a client-provided ID. Direct links to another household are denied even if the adult owns a different household.

### AR-004.3 One account owner

Exactly one Parent/account-owner login is active for a household. Co-guardian simultaneous access, Parent invitations, and self-service additional Parent accounts are absent at launch.

Ownership transfer is Admin-assisted:

1. Admin verifies the request through the governed adult channel.
2. Admin selects the exact household and replacement normalized email.
3. If the outgoing owner has an active `self` Student in that household, transfer is blocked until an Admin/outgoing owner archives it or moves it, preserving identity/history, to another household that adult owns with an available seat. It is never auto-converted or assigned to the replacement.
4. The replacement owner receives a seven-day, single-use setup/acceptance link and records current authority plus required recording consent for every dependent Student that will remain.
5. Transfer completes only after replacement acceptance and all Student preconditions pass atomically.
6. Prior Parent sessions for that household are revoked.
7. The former owner loses household access.
8. The transfer and actor identities are audited.

If the replacement adult already has an Admin login, acceptance adds `parent` to the existing role set; it never creates a second human login.

### AR-004.4 Adult learner

A Parent session never receives Student-class, recording, library, private-question, or Student-notice access. An adult who wants to learn creates a separate Student profile, consumes one Student seat, and signs in with that Student username and password.

### AR-004.5 School entry

A School submission is a public sales lead, not a product account. It receives acknowledgment only. After manual approval, the Admin creates or enables:

- one adult account manager using `parent`;
- one household-like school account context;
- the contracted seat allowance and commercial terms;
- separate `student` identities.

There is no school role, school portal, bulk roster, faculty role, classroom-management hierarchy, or organization-administration route at launch.

## AR-005. Top-level capability matrix

| Capability domain | Public | School lead | Admin | Parent | Student | Worker/provider |
|---|---:|---:|---:|---:|---:|---:|
| View public offer and legal pages | P | P | P | P | P | N |
| Submit Family signup | P | P | P | P | P | S |
| Submit School lead | P | P | P | P | P | S |
| Authenticate | P | N | A | A | A | S |
| Switch owned household | N | N | A | A | N | S |
| Manage adult CRM identity | N | N | A | Own profile, bounded | N | S |
| Create/transfer Parent owner | N | N | A | N | N | S |
| Create/manage Admin | N | N | A | N | N | S |
| Create/manage Student | N | N | A | Own household | N | S |
| Manage Student credentials | N | N | A | Own household | N | N |
| Access Student learning | N | N | A for governed support/operation | N | Self | S |
| Manage classes/occurrences | N | N | A | R summary | R self | S |
| Enroll canonical class | N | N | A/automatic policy | R | R self | S |
| Prepare/operate Zoom | N | N | A | N | Join self | S |
| View attendance | N | N | A | Own household summary | Self | S |
| Upload/process content | N | N | A | N | N | S |
| Approve/publish content | N | N | A | N | N | S |
| View protected content | N | N | A | N | Assigned self | S |
| Submit Torah/class question | N | N | N as Student only | N | A | S |
| Moderate/answer questions | N | N | A | N | N | S |
| Submit technical support | Public adult route | Lead follow-up only | A | A | A | S |
| Operate support tickets | N | N | A | Own request readback | Own request readback | S |
| View/manage billing | N | N | A/readback and governed action | Own household | N | S |
| Author/execute campaigns | N | N | Governed GHL launch/readback | N | N | S |
| Manage reminder preference | N | N | A | Own household | N | S |
| View audit/operations | N | N | A | N | N | S |

## AR-006. Detailed capability rules

### AR-006.1 Public and signup

`ACT-PUBLIC` may:

- view the public landing page and approved public content;
- view plan, free-period, schedule, teacher, cancellation/refund, privacy, and terms information;
- open the application login;
- submit a Family signup;
- submit a School inquiry;
- use the public adult support/contact route;
- use adult forgot-password without account enumeration.

Before `2026-09-13T19:24:00+03:00`, Family signup collects only adult first name, adult last name, email, password, editable IANA timezone, required Terms/privacy acceptance, and separate optional adult communication permissions. It creates immediate free Family access without a card. At or after that instant, the same public route creates the account and inactive household, then requires standard hosted checkout before Student creation or learning access. It never creates a rolling free trial.

School inquiry collects school name, contact first name, contact last name, and email; phone and a note are optional. Its only result is an acknowledgment and manual follow-up. It creates no household, Student, subscription, or authenticated access.

`ACT-PUBLIC` may not:

- access an authenticated route;
- create a Student directly;
- accept or manage legal/recording consent; the household account owner provides the required authority and recording consent for a dependent Student;
- receive a raw provider link;
- obtain household, Student, class, or billing existence through error wording.

### AR-006.2 Admin

Every `admin` may:

- use the complete Dashboard and global search;
- create, edit, archive, restore, and reconcile adult contacts;
- create and manage households and contracted school contexts;
- create, disable, reactivate, archive, and reset Admin/Parent accounts;
- initiate and complete verified household ownership transfer;
- create, edit, archive, restore, and credential Student accounts;
- grant a contracted school seat allowance;
- create and manage class series, occurrences, roster, Zoom, attendance, questions, progress, badges, announcements, and access;
- upload recordings and operate the full content pipeline;
- approve, publish, unpublish, and archive content;
- view billing/access projection and launch governed provider actions;
- operate communications readback and approved Start/Pause controls while GHL remains the authoring surface;
- operate tickets, integrations, operations, and audit;
- use the Live Console;
- correct attendance and badge state with an audited reason.

The canonical launch series is governed by automatic policy: every eligible active Student is enrolled transactionally when created, restored, or made eligible, and removed or disabled when no longer eligible. Neither Admin nor Parent has a manual opt-out or unenroll action for that series. Admin enrollment controls may reconcile policy drift and may unenroll only a future noncanonical series.

Admin read access to private Student information is limited to a legitimate product, teaching, support, safety, or correction purpose and is audited when material.

### AR-006.3 Parent

The `parent` role is always bound to an owned household context. A Parent may:

- view and switch among households owned by the same adult identity;
- create active Student seats up to the household allowance;
- archive and restore a Student within that allowance;
- choose whether the learner is `self` or `dependent`;
- edit actual name, display name, and username;
- set/reset a Student password and revoke Student sessions;
- see the canonical class schedule automatically;
- see Parent-appropriate attendance and progress summaries;
- manage billing/reactivation through the governed hosted provider surface;
- manage optional reminder preferences;
- view Parent notices, newsletter archive, and operational class changes;
- submit and follow an adult support request;
- update permitted own-account information and password.

No Student profile collects date of birth, age, age band, grade, or a Hebrew-specific name field. Actual and display names accept Unicode text. Student creation displays the exact relationship-specific explanation defined in `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`.

A Parent may not:

- enter the embedded classroom;
- play Student recordings or use the Student learning library;
- read a Student’s private question or Rabbi answer;
- view a Student’s member-only notification center;
- see another household;
- create a fourth active Student under the standard allowance;
- change roles, enrollment policy, attendance truth, badge rules, provider IDs, class structure, or financial history;
- view any current password.

### AR-006.4 Student

The `student` role is bound to exactly one Student identity. A Student may:

- view Today, own calendar, own notices, own attendance/progress, earned badges, and scoped leaderboard;
- enter the embedded classroom for an entitled open occurrence;
- play assigned and published content;
- search the entitled library;
- resume authorized playback;
- submit a private Torah/class question;
- view only that Student’s question state and private Rabbi answer;
- submit and follow a technical support request inside One Time;
- view username and Parent-managed credential guidance;
- log out.

A Student may not:

- access a Parent or Admin route;
- select a household context;
- view sibling data;
- use a Parent session as learning authorization;
- modify credentials;
- create or manage another Student;
- see billing, adult CRM, newsletters, provider IDs, raw provider URLs, or other Students’ private questions;
- use concurrent live-class sessions on two devices.

### AR-006.5 Worker and provider

Service actions are bounded to the event and workspace that authorized them. A worker/provider principal may not use human UI routes. Provider callbacks:

- verify signature and expected provider;
- validate workspace and record correlation;
- enforce replay/idempotency rules;
- record the minimum safe receipt/readback;
- never elevate a human role;
- never accept a browser bearer as provider authority.

## AR-007. Canonical public routes

Public routes live on `https://join.onetimeonetime.com` until the approved cutover. Authenticated account routes live on `https://app.onetimeonetime.com`.

| Route ID | Canonical route | Screen | Actor | Result |
|---|---|---|---|---|
| `RT-PUB-001` | `/` | Public landing | Public | Offer, schedule, plan, teacher, free period, Family/School entry, login |
| `RT-PUB-002` | `/signup` | Family signup | Public adult | Durable Family account creation and time-bound access/checkout result |
| `RT-PUB-003` | `/signup/received` | Signup received | Family applicant | Safe durable acknowledgment and next step |
| `RT-PUB-004` | `/school` | School inquiry | School lead | Sales-lead submission only |
| `RT-PUB-005` | `/school/received` | School acknowledgment | School lead | Manual-follow-up expectation; no product access |
| `RT-PUB-006` | `/privacy` | Privacy notice | Public | Current versioned policy |
| `RT-PUB-007` | `/terms` | Terms | Public | Current versioned terms |
| `RT-PUB-008` | `/cancellation-refund` | Cancellation/refund policy | Public | Current commercial policy |
| `RT-PUB-009` | `/support` | Public adult support/contact | Public adult | Safe contact request |
| `RT-PUB-010` | `/login` | Login handoff | Public | Redirect to canonical application login |

Retired Tisha B’Av and historical funnel URLs redirect only to an approved current public route or an archived informational page. They never execute an active historical workflow.

## AR-008. Canonical account and authentication routes

| Route ID | Canonical route | Allowed actor | Purpose |
|---|---|---|---|
| `RT-AUTH-001` | `/login` | Public | Universal email/username plus password login |
| `RT-AUTH-002` | `/forgot-password` | Public adult | Generic adult reset request |
| `RT-AUTH-003` | `/setup/:token` | Invited adult | Seven-day, single-use setup |
| `RT-AUTH-004` | `/reset-password/:token` | Reset recipient | 60-minute, single-use reset |
| `RT-AUTH-005` | `/select-household` | Parent with multiple households | Select authorized household context |
| `RT-AUTH-006` | `/access-denied` | Authenticated | Useful role/scope denial without data leakage |
| `RT-AUTH-007` | `/session-ended` | Authenticated-expired | Session-expiry explanation and safe login return |
| `RT-AUTH-008` | `/select-role` | Adult with both Admin and Parent membership | Select explicit authorized role context |

Setup and reset tokens are accepted only in the token route, removed from browser history after exchange, and never placed in analytics or ordinary logs.

## AR-009. Canonical Admin routes and navigation ownership

### AR-009.1 Primary navigation

| Route ID | Route | Primary navigation | Screen |
|---|---|---|---|
| `RT-ADM-001` | `/app/dashboard` | Dashboard | Operating dashboard |
| `RT-ADM-002` | `/app/search` | Global search | Cross-domain Admin search |
| `RT-ADM-010` | `/app/contacts` | Contacts | Adult people list |
| `RT-ADM-011` | `/app/contacts/:contactId` | Contacts | Adult detail/timeline |
| `RT-ADM-012` | `/app/households` | Contacts | Household list |
| `RT-ADM-013` | `/app/households/:householdId` | Contacts | Household detail |
| `RT-ADM-014` | `/app/users` | Contacts | Admin/Parent account list |
| `RT-ADM-015` | `/app/users/:userId` | Contacts | Human account detail |
| `RT-ADM-016` | `/app/students` | Contacts | Student list |
| `RT-ADM-017` | `/app/students/:studentId` | Contacts | Student detail |
| `RT-ADM-020` | `/app/content` | Content | Content pipeline queue |
| `RT-ADM-021` | `/app/content/upload` | Content | Direct recording upload |
| `RT-ADM-022` | `/app/content/:contentId` | Content | Content detail/status |
| `RT-ADM-023` | `/app/content/:contentId/review` | Content | Trim/transcript/material review |
| `RT-ADM-024` | `/app/library` | Content | Published/approved Admin library |
| `RT-ADM-030` | `/app/classroom` | Classroom | Classroom overview |
| `RT-ADM-031` | `/app/classroom/calendar` | Classroom | Admin calendar |
| `RT-ADM-032` | `/app/classroom/classes` | Classroom | Class series list |
| `RT-ADM-033` | `/app/classroom/classes/:classId` | Classroom | Class series detail |
| `RT-ADM-034` | `/app/classroom/occurrences` | Classroom | Occurrence list |
| `RT-ADM-035` | `/app/classroom/occurrences/:occurrenceId` | Classroom | Occurrence workspace |
| `RT-ADM-036` | `/app/classroom/enrollments` | Classroom | Enrollment/readback |
| `RT-ADM-037` | `/app/classroom/zoom` | Classroom | Zoom readiness/status |
| `RT-ADM-038` | `/app/classroom/attendance` | Classroom | Attendance |
| `RT-ADM-039` | `/app/classroom/recordings` | Classroom | Recording-to-occurrence view |
| `RT-ADM-040` | `/app/classroom/questions` | Classroom | Question moderation |
| `RT-ADM-041` | `/app/classroom/progress` | Classroom | Progress and badges |
| `RT-ADM-042` | `/app/classroom/leaderboard` | Classroom | Scoped leaderboards |
| `RT-ADM-043` | `/app/classroom/access` | Classroom | Household access projection |
| `RT-ADM-050` | `/app/live` | Live Console | Current/next occurrence selection |
| `RT-ADM-051` | `/app/live/:occurrenceId` | Live Console | Live classroom operations |

### AR-009.2 Utility navigation

| Route ID | Route | Utility item | Screen |
|---|---|---|---|
| `RT-ADM-060` | `/app/communications` | Communications | GHL workflow/campaign readback and governed actions |
| `RT-ADM-061` | `/app/communications/:workflowId` | Communications | Workflow configuration and delivery readback |
| `RT-ADM-062` | `/app/tickets` | Tickets | Support queue |
| `RT-ADM-063` | `/app/tickets/:ticketId` | Tickets | Ticket detail |
| `RT-ADM-064` | `/app/billing-access` | Billing & Access | Billing/access exceptions |
| `RT-ADM-065` | `/app/integrations` | Integrations | Provider configuration/readiness |
| `RT-ADM-066` | `/app/operations` | Operations | Release, queue, backup, and provider health |
| `RT-ADM-067` | `/app/audit` | Audit | Audited product actions |
| `RT-ADM-068` | `/app/support` | Support | Operator help/escalation information |
| `RT-ADM-069` | `/app/account` | Account | Own profile, password, sessions, logout |

`Support` is help for the signed-in Admin. `Tickets` is the customer/Student request queue. They are not duplicates and do not create another role.

## AR-010. Canonical Parent routes

| Route ID | Canonical route | Navigation | Capability |
|---|---|---|---|
| `RT-PAR-001` | `/app/parent` | Overview | Household activation/status and next schedule |
| `RT-PAR-002` | `/app/parent/students` | Students | Active/archived seats |
| `RT-PAR-003` | `/app/parent/students/new` | Students | Create Student within allowance |
| `RT-PAR-004` | `/app/parent/students/:studentId` | Students | Edit owned Student and credentials |
| `RT-PAR-010` | `/app/parent/calendar` | Calendar & Classes | Family schedule and Student filters |
| `RT-PAR-011` | `/app/parent/classes/:occurrenceId` | Calendar & Classes | Parent-safe occurrence detail |
| `RT-PAR-020` | `/app/parent/progress` | Progress & Badges | Parent summaries only |
| `RT-PAR-021` | `/app/parent/progress/:studentId` | Progress & Badges | Owned Student summary |
| `RT-PAR-030` | `/app/parent/billing` | Billing | Plan, access, hosted billing/reactivation |
| `RT-PAR-040` | `/app/parent/updates` | Updates | Household and class notices |
| `RT-PAR-041` | `/app/parent/newsletter` | Updates | Parent newsletter archive |
| `RT-PAR-050` | `/app/parent/preferences` | Reminders | Email/WhatsApp/both/none intent |
| `RT-PAR-060` | `/app/parent/support` | Support | Adult request list/new request |
| `RT-PAR-061` | `/app/parent/support/:ticketId` | Support | Owned adult request status |
| `RT-PAR-070` | `/app/parent/account` | Account | Adult profile, households, password, sessions |
| `RT-PAR-071` | `/app/parent/privacy` | Account | Consents, policy history, and consequence preview |
| `RT-PAR-072` | `/app/parent/data-rights` | Account | Request/export/closure/erasure status |

There is no Parent Materials or Parent Library route. Parent views recording availability as a status in class/progress summaries but cannot play Student learning content. Any legacy Parent materials route is removed or returns `RT-AUTH-006`.

## AR-011. Canonical Student routes

| Route ID | Canonical route | Navigation | Capability |
|---|---|---|---|
| `RT-STU-001` | `/app/student` | Today | Next class, join state, current lesson, notices, question state |
| `RT-STU-010` | `/app/student/calendar` | Calendar | Own Today/Week/agenda |
| `RT-STU-011` | `/app/student/classes/:occurrenceId` | Calendar | Own occurrence detail |
| `RT-STU-012` | `/app/student/class/:occurrenceId` | Join Class | Embedded authorized Zoom classroom |
| `RT-STU-020` | `/app/student/library` | Library | Assigned published content and search |
| `RT-STU-021` | `/app/student/library/:contentId` | Library | Protected Vimeo-backed playback, transcript, review |
| `RT-STU-030` | `/app/student/progress` | Progress | Attendance, goals, badges, leaderboard |
| `RT-STU-040` | `/app/student/questions` | Questions | Own private questions |
| `RT-STU-041` | `/app/student/questions/new` | Questions | Submit Torah/class question |
| `RT-STU-042` | `/app/student/questions/:questionId` | Questions | Own question status/private answer |
| `RT-STU-050` | `/app/student/updates` | Updates | Own class/content/Admin notices |
| `RT-STU-051` | `/app/student/notifications` | Notifications | Notification center and unread state |
| `RT-STU-060` | `/app/student/support` | Support | Own technical support requests |
| `RT-STU-061` | `/app/student/support/:ticketId` | Support | Own request status |
| `RT-STU-070` | `/app/student/account` | Account | Name/username readback, credential help, logout |
| `RT-STU-071` | `/app/student/privacy` | Account | Self-managed adult Student consent and policy history only |
| `RT-STU-072` | `/app/student/data-rights` | Account | Self-managed adult Student request/export/closure status only |

The embedded classroom route is never a raw Zoom destination. An occurrence-specific Parent email button may return to `RT-STU-012`, but it does not authenticate the Student. Only the matching signed-in Student may continue.

`RT-STU-071` and `RT-STU-072` exist only for a Student whose relationship is `self` and whose verified adult identity owns that Student profile. A dependent Student has no self-service privacy or data-rights route; the account owner uses the governed dependent-rights request from `RT-PAR-072`.

## AR-012. Route-state and authorization behavior

### AR-012.1 Logged-out safe return

When a logged-out user opens an authenticated safe route:

1. the application stores only the internal relative route and non-sensitive state;
2. the user is sent to `RT-AUTH-001`;
3. after authentication, the server re-authorizes the destination;
4. the user returns to the exact route only when role, household, Student, and record scope match;
5. otherwise the user lands on the role home with a neutral explanation.

External URLs, provider URLs, setup/reset tokens, and arbitrary origins are never accepted as return targets.

### AR-012.2 Wrong role

A valid session using a route belonging to another role receives `RT-AUTH-006` or a not-found result according to leakage risk. It is never silently redirected into a different entity with a similar identifier.

### AR-012.3 Wrong household or Student

Cross-household, sibling, and unowned-record access:

- returns no protected content;
- does not reveal whether the target exists;
- writes a security/audit signal when appropriate;
- preserves the actor’s valid session;
- offers a safe return to the actor’s own home.

### AR-012.4 Inactive access

When product access is `inactive`:

- Parent routes are limited exactly to `RT-PAR-001`, `RT-PAR-030`, `RT-PAR-060`, `RT-PAR-061`, `RT-PAR-070`, `RT-PAR-071`, `RT-PAR-072`, and `RT-AUTH-005`;
- Student login and every stale Student session or deep link are blocked with: “This household’s access is inactive. Ask your account owner to restore access.”;
- Student learning routes cannot be reached through a stale session or deep link;
- Admin retains governed operational access.

Student management, calendar/class detail, progress, updates, newsletter, reminder preferences, classroom, library, questions, and Student notifications are outside the inactive Parent allowlist. A direct link to any excluded route returns the inactive-access screen and does not render protected page data first.

During `grace`, Parent and Student capabilities remain active and the UI shows the exact grace deadline and repair action to the Parent.

### AR-012.5 Archived and disabled identity

- `disabled` human accounts cannot authenticate until an Admin reactivates them;
- `archived` human accounts retain history and cannot authenticate;
- archived Students do not consume a seat;
- restoring a Student requires available allowance and fresh access evaluation;
- no state reveals or restores an old password.

### AR-012.6 Session and concurrency

Credential changes, account disable/archive, ownership transfer, and explicit session revocation invalidate affected sessions.

One concurrent live classroom session is permitted per Student. Same-session reconnect is allowed. A second device receives a clear denial without exposing the active device. An Admin may reset the active classroom session from the occurrence or Student detail.

## AR-013. Navigation behavior

All authenticated shells provide:

- One Time logo linked to the role home;
- role-appropriate navigation only;
- current page title;
- visible active navigation state;
- breadcrumbs for nested Admin records and Parent/Student detail;
- global account menu and logout;
- household switcher for an eligible Parent;
- persistent high-priority notice area;
- notification entry for Student;
- mobile/tablet drawer behavior defined in `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`.

Admin global search is always reachable by keyboard and from the Admin header. Search results are server-authorized before display and again before navigation.

Browser refresh, back, and forward preserve the safe URL, active entity, and URL-backed filter state. A missing, archived, or newly unauthorized entity produces a useful state rather than an unrelated redirect.

## AR-014. Explicitly absent capabilities

The following capabilities are absent at launch and have no production route, role, navigation item, placeholder, or disabled “coming soon” control:

- Parent Learner Mode;
- simultaneous co-guardian access;
- school-specific role or portal;
- school bulk roster or organization administration;
- Class Helper;
- Buffer/social publishing;
- demos, preview routes, product test lanes, and fictional users;
- Parent-created goals;
- editable badge rules;
- favorites;
- PWA/background push;
- MFA enrollment, MFA challenge, recovery-code, or optional-MFA settings;
- WhatsApp lead assistant;
- WhatsApp qualification bot;
- public Student registration;
- Student-to-Student chat;
- Hebrew interface;
- Google Calendar integration.

WhatsApp reminder intent is the sole visible dormant-provider exception: the Parent may store `whatsapp` or `both`, but the UI must say WhatsApp delivery is unavailable until activated and must never claim a WhatsApp send occurred.

## AR-015. Capability and route release invariants

Production acceptance proves:

1. assignable human roles are exactly `admin`, `parent`, and `student`;
2. Shloimie and Rabbi Eli can perform the same Admin actions;
3. a Parent session cannot enter any Student learning surface;
4. an adult learner can learn only through a separate Student seat/session;
5. a one-household Parent bypasses the switcher and a multi-household Parent can switch only among owned households;
6. one household has one active Parent owner;
7. Family signup and School inquiry produce different outcomes;
8. an approved School uses the Parent/Student model without a school role;
9. every listed production route has an allowed-role test and a wrong-role test;
10. every entity route has cross-household or sibling denial where applicable;
11. inactive Parent access is restricted and inactive Student access is blocked;
12. direct links and refresh preserve safe state;
13. no explicitly absent route or control appears;
14. raw Zoom/Vimeo/provider destinations never appear in route parameters, browser history, email, logs, or ordinary UI;
15. all visible controls pass the interactive-element certification defined by `01-PRODUCT-SPEC-v2.1.md`;
16. repository route, component, API, feature-flag, configuration, and copy inventories contain no reachable MFA surface;
17. self-managed adult Students receive only their own privacy/data-rights surfaces and dependent Students receive none;
18. canonical-series eligibility and enrollment commit atomically, with reconciliation repairing drift but no manual opt-out.
