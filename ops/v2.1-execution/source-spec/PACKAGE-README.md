# One Time Mishnayos — Production Specification Package v2.1

This package is the complete normative product-definition set for the standalone One Time Mishnayos production application.

It is intentionally not an implementation roadmap. It is the source material from which an exact Codex roadmap must be generated.

## Authority

- Product: `shloimie-beep/onetimev2`
- Reviewed PR: `#130`
- Reviewed repository head: `73dda293079f602c83929d1bbccb8dd5b9d1a455`
- Reviewed migration count: `64`
- Production application: `https://app.onetimeonetime.com`
- Public/transition funnel: `https://join.onetimeonetime.com`
- Specification version: `2.1`
- Effective date: `2026-07-28`

This package supersedes the older One Time launch Board, old acceptance contract, fictional/demo acceptance paths, and incompatible product semantics. Historical evidence is reusable only when explicitly mapped to a v2.1 acceptance case and still proves the same behavior against the applicable candidate and environment.

## The 14 normative documents

1. `01-PRODUCT-SPEC-v2.1.md`  
   Primary end-state product behavior and production-ready definition.

2. `02-ACCEPTANCE-CONTRACT-v2.1.yaml`  
   Machine-readable release requirements, acceptance cases, evidence profiles, failure branches, and release invariants.

3. `03-DECISION-REGISTER-v2.1.md`  
   Every operator-locked or specification-inferred choice used by this package.

4. `04-SUPERSESSION-AND-SYSTEM-DISPOSITION-v2.1.md`  
   Disposition of old acceptance/control files, demos, previews, test lanes, Class Helper, Buffer, WhatsApp assistant, Tisha B’Av assets, and retired runtime surfaces.

5. `05-ACTOR-ROLE-CAPABILITY-ROUTE-MATRIX-v2.1.md`  
   Actor, role, permission, route, navigation, direct-link, and denial contract.

6. `06-DOMAIN-MODEL-AND-STATE-MACHINES-v2.1.md`  
   Canonical entities, uniqueness and concurrency invariants, lifecycle states, transitions, and audit effects.

7. `07-SOURCE-OF-TRUTH-AND-PROVIDER-CONTRACTS-v2.1.md`  
   One Time/GHL/Stripe/Resend/Zoom/Drive/Vimeo/Telegram ownership, API, saga, outbox, idempotency, timeout, and reconciliation rules.

8. `08-SCREEN-CATALOG-AND-DESIGN-SYSTEM-v2.1.md`  
   Complete public, Admin, Parent, Student, responsive, visual, state, accessibility, and browser contract.

9. `09-WORKFLOW-NOTIFICATION-COPY-CATALOG-v2.1.md`  
   Canonical GHL workflow identifiers, senders, triggers, cadences, channel rules, copy, dormant WhatsApp templates, approval, and stop conditions.

10. `10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`  
    Guardian/account-owner consent, Student recording, actual-name use, data minimization, retention, export, correction, deletion, and provider-cascade policy.

11. `11-ENVIRONMENT-FIXTURE-CANARY-MANIFEST-v2.1.yaml`  
    Candidate identity, environments, real operator fixtures, devices, provider assets, effect budgets, canary sequence, stop conditions, and cleanup.

12. `12-MIGRATION-CUTOVER-ROLLBACK-v2.1.md`  
    GHL deduplication, legacy re-signup, role conversion, domain transition, cutover, reconciliation, old-app retirement, and rollback boundary.

13. `13-OPERATIONS-SLO-DR-INCIDENT-v2.1.md`  
    Availability, latency, queue, capacity, monitoring, backups, 15-minute RPO, 30-minute RTO, restore, rollback, incident, and provider-outage contract.

14. `14-TRACEABILITY-CROSSWALK-v2.1.yaml`  
    Document-to-requirement, decision-to-requirement, case-to-requirement, legacy-disposition, and future roadmap-generation mapping.

## Locked product summary

- Exactly three assignable roles: `admin`, `parent`, `student`.
- Shloimie Dratler and Rabbi Eli Scheller have equal full One Time Admin authority.
- One Parent/account owner per household.
- Up to three active Student seats for the standard Family plan.
- Students never require email and never become GHL contacts.
- Parent accounts never enter Student class, library, recordings, or private questions.
- An adult learner consumes a separate Student seat and uses separate Student credentials.
- Student relationship is `self` or `dependent`; no date of birth, age, age band, grade, or Hebrew-specific profile field is collected.
- Before `2026-09-11T18:00:00+03:00`, Family signup receives immediate free access from the submitted email/password with no card; at or after that instant it creates an inactive account and continues to hosted checkout with no rolling trial.
- School public intake is a sales inquiry; approved schools use the same account experience with manually configured price and seat allowance.
- Standard Family price is USD $67 monthly.
- No card and no automatic charge during the free period.
- Canonical class is Sunday–Thursday at 7:00 p.m. `Asia/Jerusalem`.
- Every active Student is automatically enrolled in the canonical class.
- Classroom is embedded Zoom with per-Student authorization and one concurrent session per Student.
- Waiting room, participant rename, participant chat, participant screen sharing, and participant file transfer are disabled.
- Student audio/video may be recorded only after versioned consent from the relationship-authorized adult: the account owner for a dependent Student or the matching verified adult identity for a self-managed Student.
- Admin supports direct recording upload and monitored Drive ingestion into one deduplicated pipeline.
- Pipeline compresses the video and drafts English transcript, captions, worksheet/review material, knowledge artifact, and private Vimeo publication for human approval.
- HighLevel owns adult CRM, campaigns, website bot, conversations, and operator-facing Stripe workflow.
- One adult GHL contact may own multiple household-keyed records; each household has its own Stripe Customer and access/billing state.
- Resend owns reset/security delivery and the seven-day setup links reserved for legacy/Admin-created/ownership-transfer/passwordless-claim cases; fresh public Family signup sets its password directly.
- Email workflows work independently; WhatsApp actions stay dormant until separately configured and approved.
- No demo, preview, fictional, Class Helper, Buffer, WhatsApp assistant, or product test-lane runtime remains.

## Acceptance shape

The v2.1 acceptance contract contains 243 unique requirements and 265 acceptance cases. It retains all original 175 identifiers, corrects incompatible wording, and adds v2.1 coverage for newly locked behavior. It uses requirement-specific evidence profiles instead of one universal proof list.

Every release result must be stored separately and bound to:

- requirement and case IDs;
- exact candidate digest;
- environment;
- timestamp;
- actor or automation;
- evidence;
- external-effect counts;
- cleanup/reconciliation result.

Green CI or code existence alone is not production acceptance.

## Required reading order for roadmap generation

1. Read this file.
2. Read `03-DECISION-REGISTER-v2.1.md`.
3. Read `01-PRODUCT-SPEC-v2.1.md`.
4. Read documents 04–13 in numeric order.
5. Parse `02-ACCEPTANCE-CONTRACT-v2.1.yaml`.
6. Parse `14-TRACEABILITY-CROSSWALK-v2.1.yaml`.
7. Verify `SHA256SUMS.txt`.
8. Generate the roadmap only under the roadmap-generation contract in document 14.

## Roadmap task rule

Every future Codex roadmap task must name:

- exact requirement IDs;
- exact acceptance case IDs;
- dependencies;
- owner/writer slot;
- exact write scope;
- preserved invariants;
- environment;
- external-effect authority;
- stop condition;
- required evidence;
- rollback/recovery;
- definition of done.

A task is complete only when its candidate-bound acceptance cases pass.
