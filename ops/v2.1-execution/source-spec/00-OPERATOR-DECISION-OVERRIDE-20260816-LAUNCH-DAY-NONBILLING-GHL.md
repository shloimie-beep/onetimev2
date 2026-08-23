# One Time Operator Decision Override — Launch-Day Email and Nonbilling GHL Scope

**Decision ID:** `OT-CTRL-20260816-LAUNCH-DAY-NONBILLING-GHL`  
**Decision date:** 2026-08-16  
**Operator:** Shloimie Dratler  
**Status:** **LOCKED OPERATOR PRIORITY — SOURCE OF TRUTH**  
**Integration authority:** PR #131 only

## Decision

One Time will not begin charging Families during the current launch-day work. The immediate objective is to send the approved free-access email, create real Parent accounts, measure the acquisition and activation funnel, and prove the nonbilling GHL lifecycle.

Billing, Stripe test-mode expansion, checkout completion, grace, cancellation, and payment-repair automation are deferred and must not block today's launch.

## Today’s required outcome

```text
Approved launch email
→ tracked landing-page click
→ Family signup
→ Parent remains signed in
→ Parent Companion opens
→ Student created
→ first class or recording started
→ correct GHL adult contact and household opportunity
→ correct nonbilling pipeline stage
→ correct nonbilling email/reply behavior
```

## Production campaign

Current one-time campaign:

- Name: `OT-C02 Sunday Launch — Classes Start Today — 2026-08-16`
- Campaign ID: `6a8159a63762571813a261df`
- Audience Smart List: `OT | Sunday Launch Eligible | 2026-08-16`
- Smart List ID: `Gr4bIiGGGf0eBadxINbx`
- Current audience readback: 1,335 contacts
- Current status: Draft, unscheduled, unsent

The campaign remains separate from all lifecycle workflows. Sending OT-C02 does not authorize historical opportunity migration or workflow publication.

## Tracking required today

Preserve and prove:

- GHL campaign delivery, open, and click reporting;
- exact tracked CTA URL and UTM values;
- first and latest attribution through signup;
- stable campaign/creative ID;
- Family account creation timestamp;
- Parent portal open/meaningful activation;
- Student creation;
- Student first learning;
- Family engagement;
- reply routing in GHL Conversations.

A landing-page click is an analytics/attribution event, not a Family Lifecycle stage.

## Nonbilling Family Lifecycle scope

Today’s active lifecycle ends at:

1. `Family Account Created — Parent Not Activated`
2. `Parent Companion Activated — Student Setup Pending`
3. `Student Created — Not Yet Learning`
4. `Activated Free Family`
5. `Engaged Free Family`

Required events:

```text
family.account_created
parent.portal_opened
parent.companion_activated
parent.welcome_video_started
parent.welcome_video_completed
parent.add_student_clicked
student.created
student.first_learning_started
family.engaged
```

One Time is authoritative. GHL receives a household-scoped, idempotent projection. Email opens and clicks do not create product-stage movement.

## Billing work deferred

Do not spend launch-day time on:

- Stripe sandbox expansion;
- live or test checkout implementation;
- billing-active canaries;
- grace/payment-failure canaries;
- cancellation canaries;
- payment-repair URLs;
- checkout-abandonment automation;
- pricing or charge collection.

The following may remain present as future schema/stages but must remain inactive:

- `Paid Active`
- `Grace / Payment Issue`
- `Canceled / Former`
- `OT-LC08 Free Access Deadline`
- `OT-LC09 Paid Active Welcome`
- `OT-LC10 Grace — Payment Issue`
- `OT-LC11 Canceled / Former Reactivation`

`OT-LC08` and `OT-LC10` remain blocked with no customer email action while the continuation/repair URL is unresolved. Do not guess a URL.

## Testing strategy for today

Do not create a new GHL sub-account or full billing sandbox as a launch blocker.

Use one operator-owned production-location canary for the nonbilling flow because today’s campaign, sender, URLs, location IDs, and app bridge must work in the real location.

The canary must use only operator-owned data and prove:

1. one adult contact;
2. one household opportunity;
3. exact initial Family stage;
4. OT-01 exactly once;
5. Parent activation stage;
6. Student-created stage;
7. first-learning stage;
8. engaged stage when repeat-use criteria are met;
9. reply appears in GHL Conversations;
10. no duplicate contact/opportunity/email;
11. no Student GHL contact;
12. no billing effect;
13. no Torah-question opportunity.

A separate dedicated GHL sandbox may be built later for broader regression testing, but it is not required before today's free-access email if the bounded production canary passes.

## Audience pipeline and historical migration

Do not delay today’s one-time email by migrating all 1,377 historical opportunities into the new Audience & Reactivation pipeline.

The Smart List already defines today’s approved recipient audience.

Historical Pipeline A opportunity creation and category-specific evergreen sequences remain a separate later operation requiring exact dedupe, suppression, permission, canary, and rollback proof.

When a recipient signs up today, the application must create/update the adult contact and one household-scoped Family Lifecycle opportunity.

## Recommended publication order after the canary

1. `OT-R01 Customer Replied - Internal Routing`
2. `OT-01 Family Account Confirmation`
3. `OT-LC02 Parent Activated — Student Setup`
4. `OT-LC03 Student Created — First Learning`
5. `OT-LC04 Activated Free — Build the Habit`
6. `OT-LC05 Engaged Free — Progress`
7. `OT-LC06 Parent Activation Help`
8. `OT-LC07 Student Activation Help`

Publish only the workflows whose prerequisites are proven. Do not publish all 18 merely because their Draft canvases exist.

Audience workflows remain Draft until category-specific copy, historical mapping, permission, and canaries are approved.

## Launch authorization boundary

Before the broad OT-C02 send, Shloimie must manually prove:

- test email rendering;
- CTA and UTM link;
- landing page;
- signup;
- Parent auto-login;
- Parent Companion destination;
- Student setup/login;
- reply routing;
- one nonbilling Family lifecycle canary.

The separate campaign authorization applies only to OT-C02 and does not authorize workflow publication, historical migration, billing, WhatsApp, or Student contacts.

## Acceptance

Today’s launch scope is accepted when:

1. OT-C02 test email passes;
2. one operator Family completes the real flow;
3. app and GHL attribution agree;
4. the correct adult contact and household opportunity exist once;
5. nonbilling stages move from verified product events;
6. OT-01 sends once;
7. reply routing works;
8. no Student contact is created;
9. no billing or Stripe effect occurs;
10. the final recipient count and suppression state are read back immediately before send.

## Integration boundary

PR #183 records this decision only. PR #131 must ingest it, prioritize the nonbilling bridge and canary, and leave billing work deferred. No PR #183 worker may deploy, publish, send broadly, migrate historical opportunities, or mutate billing.