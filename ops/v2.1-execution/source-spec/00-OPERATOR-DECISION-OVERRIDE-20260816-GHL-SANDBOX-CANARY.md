# One Time Operator Decision Override — GHL Sandbox and Production Canary

**Decision ID:** `OT-CTRL-20260816-GHL-SANDBOX-CANARY`  
**Decision date:** 2026-08-16  
**Operator:** Shloimie Dratler  
**Status:** **LOCKED TEST STRATEGY — SOURCE OF TRUTH**  
**Integration authority:** PR #131 only

## Purpose

Prove the One Time account, Parent, Student, learning, pipeline, workflow, email, reply-routing, and billing-event sequence without exposing the live audience to untested automation.

## Decision

Use a two-level test strategy:

1. **Dedicated GHL sandbox/test sub-account** for structural and end-to-end automation testing with synthetic operator-owned data.
2. **One bounded production-location canary** after sandbox success to prove the real sender/domain, live application bridge, exact location IDs, reply routing, and production provider bindings.

A sandbox does not replace the final production canary. A production canary does not justify testing broad automation against real contacts.

## What “sandbox” means for this project

Preferred implementation:

- a separate One Time test sub-account/location under the same HighLevel agency, or an existing native HighLevel developer sandbox when already available and appropriate;
- no real audience import;
- no production campaigns;
- no live ads;
- no live billing charge;
- no real Student data;
- no broad email or WhatsApp send;
- operator-owned synthetic contacts only;
- separate location ID, tokens, pipeline IDs, stage IDs, workflow IDs, custom-field IDs, and custom values.

Do not assume that toggling a payment module to Test mode creates a complete workflow/CRM sandbox. Payment Test mode governs payment effects only.

## Asset replication

Use one of HighLevel’s governed replication methods:

- copy selected workflows to the sandbox sub-account; or
- create/load a selective Snapshot containing the two pipelines, required fields, tags, custom values, workflow folders, and Draft workflows.

Rules:

- copied workflows remain Draft until sandbox-specific checks are complete;
- rebind or verify every pipeline, stage, field, user, sender, custom value, webhook, and assignment after copying;
- provider/user/account references that do not copy cleanly must remain blocked rather than guessed;
- production and sandbox IDs must be stored separately and never mixed.

## Sandbox naming and data

Recommended location name:

> `One Time | Sandbox`

Recommended synthetic identities:

- `OT Sandbox Parent 001`
- `OT Sandbox Student 001`
- operator-controlled email aliases only;
- no real child name, phone, message, or provider credential.

Required sandbox tag:

> `ot | qa | sandbox`

Every sandbox workflow entry must require the sandbox location and/or this tag so a copied workflow cannot act on an unmarked contact.

## App-to-GHL environment separation

The One Time application bridge must support explicit environment/location binding.

Required configuration shape:

```text
production app/runtime
→ production GHL location pBSnOK2nkdxp6gf9Rg3o

staging/sandbox app/runtime
→ sandbox GHL location <SANDBOX_LOCATION_ID>
```

Never let a browser payload choose the location. The server derives the environment and location from protected configuration.

Required safeguards:

- separate location ID and private integration token;
- separate webhook signing secret where applicable;
- environment marker on every outbox/event record;
- idempotency key includes environment and household identity;
- sandbox events cannot mutate production GHL;
- production events cannot mutate sandbox GHL;
- no Student contact in either environment.

## Sandbox test sequence

Use one synthetic Family and prove:

```text
family.account_created
→ Family Account Created — Parent Not Activated
→ OT-01 exactly once

parent.portal_opened / meaningful Parent activation
→ Parent Companion Activated — Student Setup Pending
→ OT-LC02 eligibility

student.created
→ Student Created — Not Yet Learning
→ OT-LC03 exactly once

student.first_learning_started
→ Activated Free Family
→ OT-LC04 exactly once

family.engaged
→ Engaged Free Family
→ OT-LC05 exactly once

customer email reply
→ OT-R01 routes to Rabbi/support correctly
→ no automatic AI customer response
```

Also prove:

- wait/exit rules;
- no duplicate opportunity;
- no duplicate email;
- no stage movement from email opens/clicks;
- DND/suppression stops optional mail;
- reply routing remains on the adult contact;
- no Torah-question pipeline or question opportunity;
- Student and Parent Torah questions remain first-party One Time records;
- no Student GHL contact.

## Billing test boundary

`OT-LC08` and `OT-LC10` remain blocked until exact continuation and billing-repair routes exist.

When billing is tested:

- use a payment flow that explicitly supports Test mode or the provider’s test environment;
- use synthetic/operator payment data only;
- prove `billing.active`, `billing.grace`, and `billing.canceled` projections without a live customer charge;
- run a separate production payment canary only under explicit authorization.

## Production canary after sandbox success

Run one operator-owned real-location Family canary in the live One Time GHL location.

It must prove:

1. real sender/domain delivery;
2. reply appears in GHL Conversations;
3. exact production pipelines/stages/fields receive the expected household state;
4. Parent signup/login and app bridge work;
5. no duplicate contact/opportunity/email;
6. no Student contact;
7. no broad workflow enrollment;
8. rollback/cleanup of the operator QA records.

Do not publish the full workflow family at once. Recommended production publication order after proof:

1. `OT-R01` reply routing;
2. `OT-01` Family confirmation;
3. `OT-LC02` through `OT-LC07` in bounded sequence;
4. audience/reactivation workflows only after exact migration/permission canaries;
5. billing workflows only after verified routes and billing tests.

## External-effect boundaries

This decision authorizes planning, repository integration, sandbox asset preparation, synthetic testing, and one separately approved production canary.

It does not by itself authorize:

- creating a paid HighLevel location with unexpected billing;
- buying phone/email resources;
- publishing production workflows;
- broad contact enrollment;
- real customer sends;
- historical migration;
- live payment;
- WhatsApp broadcast;
- changing production provider routing.

## Acceptance

Before workflow publication, return:

- sandbox location and exact IDs;
- copied/created asset manifest;
- synthetic test ledger;
- event-to-stage proof;
- email/reply proof;
- suppression and duplicate-denial proof;
- production-canary result;
- rollback/cleanup result;
- exact workflows approved for publication;
- external-effect counts.