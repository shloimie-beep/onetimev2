# One Time — Launch-Day Nonbilling GHL Controller Prompt

Paste the complete block below into the existing PR #131 Work/Codex controller.

```text
ONE TIME PR #131 — PRIORITIZE TODAY’S FREE-ACCESS EMAIL, SIGNUP TRACKING, AND NONBILLING GHL LIFECYCLE

Repository:
shloimie-beep/onetimev2

Sole integration/deployment authority:
PR #131
codex/one-time-complete-production-launch-20260805

Decision/control source:
PR #183
chatgpt/one-checkbox-and-launch-marketing-v2-20260813

FIRST RE-FETCH CURRENT STATE

Read:

1. current PR #131 AGENTS.md, STATUS, EXECPLAN, deployed source, active workers, and current integration candidates;
2. current PR #183;
3. from PR #183:
   ops/v2.1-execution/source-spec/00-OPERATOR-DECISION-OVERRIDE-20260816-LAUNCH-DAY-NONBILLING-GHL.md
4. from PR #183:
   ops/v2.1-execution/source-spec/00-OPERATOR-DECISION-OVERRIDE-20260813-PARENT-COMPANION.md
5. from PR #183:
   ops/v2.1-execution/source-spec/00-OPERATOR-DECISION-OVERRIDE-20260814-PARENT-WELCOME-VIDEO.md
6. from PR #183:
   ops/v2.1-execution/source-spec/00-OPERATOR-DECISION-OVERRIDE-20260816-TORAH-QUESTIONS-DIRECT-RABBI.md
7. current GHL result records and exact production IDs;
8. current app-to-GHL event/outbox/provider bridge;
9. current landing/signup/Parent/Student/login implementation;
10. current OT-C02 and Smart List readback supplied by the operator.

DO NOT RESTART THE GENERAL AUDIT

Inspect existing workers first. Append this priority to the current app-GHL bridge, login, Parent Companion, or controller owner. Do not open overlapping workers.

LOCKED PRIORITY

One Time is free during the current launch period. Charging begins later.

Today’s goal is:

launch email
→ tracked click
→ Family signup
→ Parent auto-login
→ Parent Companion
→ Student creation
→ first learning
→ correct GHL adult contact/household opportunity/stage/email

Billing and Stripe sandbox work are deferred and must not block today.

CURRENT CAMPAIGN

Name:
OT-C02 Sunday Launch — Classes Start Today — 2026-08-16

Campaign ID:
6a8159a63762571813a261df

Smart List:
OT | Sunday Launch Eligible | 2026-08-16

Smart List ID:
Gr4bIiGGGf0eBadxINbx

Current readback:
- 1,335 contacts;
- Draft;
- unscheduled;
- unsent;
- tracked CTA points to join.onetimeonetime.com with campaign UTM values.

Do not send or schedule from this controller. Shloimie owns final GHL campaign authorization after manual proof.

TODAY’S NONBILLING LIFECYCLE

Required stages only:

1. Family Account Created — Parent Not Activated
2. Parent Companion Activated — Student Setup Pending
3. Student Created — Not Yet Learning
4. Activated Free Family
5. Engaged Free Family

Required authoritative events:

family.account_created
parent.portal_opened
parent.companion_activated
parent.welcome_video_started
parent.welcome_video_completed
parent.add_student_clicked
student.created
student.first_learning_started
family.engaged

Required projection:

family.account_created
→ Family Account Created — Parent Not Activated

parent.companion_activated
→ Parent Companion Activated — Student Setup Pending

student.created
→ Student Created — Not Yet Learning

student.first_learning_started
→ Activated Free Family

family.engaged
→ Engaged Free Family

Rules:

- One Time product truth is authoritative.
- Projection is adult/household scoped and idempotent.
- One adult may own more than one household opportunity.
- Email opens/clicks do not move Family Lifecycle stages.
- Never create Student GHL contacts.
- Never create a Torah-question GHL opportunity.
- Preserve first/latest attribution and stable campaign/creative ID through signup.

BILLING DEFERRED

Do not spend today on:

- Stripe sandbox expansion;
- checkout creation;
- charging;
- payment-active tests;
- grace/failure tests;
- cancellation tests;
- payment-repair routes;
- checkout-abandonment automation.

Keep inactive/Draft:

- OT-LC08 Free Access Deadline
- OT-LC09 Paid Active Welcome
- OT-LC10 Grace — Payment Issue
- OT-LC11 Canceled / Former Reactivation

OT-LC08 and OT-LC10 remain actionless/blocked while OT Continue URL is unresolved. Do not guess a route.

Do not remove future billing stages/fields merely because they are deferred; leave them inert and documented.

NO FULL GHL SANDBOX AS TODAY’S BLOCKER

Do not require a new GHL sub-account, selective Snapshot, or Stripe test environment before today’s email.

Use one operator-owned canary in the existing production GHL location for the nonbilling flow because the real sender, campaign, production IDs, URLs, and app bridge must work there.

A separate dedicated GHL sandbox may be built later for regression/billing work.

CURRENT GHL PRODUCTION IDS

Production location:
pBSnOK2nkdxp6gf9Rg3o

Family Lifecycle pipeline:
J07hIGecCCTi8xGD1p1I

Stages:
- Family Account Created — Parent Not Activated:
  729fba78-795a-49b7-b6df-63f63ceb7fbd
- Parent Companion Activated — Student Setup Pending:
  5c5efed3-78a4-4ebb-a6a4-7458d1f1c194
- Student Created — Not Yet Learning:
  062991e7-70f5-4e51-b07c-87b92c51e9e0
- Activated Free Family:
  5f752777-ceba-40c0-8518-8a59929a5549
- Engaged Free Family:
  85579c03-30eb-4ac8-bcc3-23e72c922708

Required opportunity field:
- OT Household ID:
  opportunity.ot_household_id

Required contact field:
- OT Has Current Family Account:
  contact.ot_has_current_family_account

Use exact current field IDs from the current GHL result records. Do not guess or recreate fields.

CANARY TO PREPARE

Use one fresh operator-owned Family and operator email alias.

Prove:

1. landing CTA preserves UTM/source/campaign/content;
2. Family signup commits once;
3. Parent remains signed in;
4. Parent Companion opens;
5. exactly one adult GHL contact exists;
6. exactly one household opportunity exists;
7. OT Household ID matches the application household;
8. initial stage is Family Account Created — Parent Not Activated;
9. OT Has Current Family Account becomes Yes;
10. OT-01 sends exactly once when authorized/tested;
11. Parent meaningful activation moves the opportunity once;
12. Student creation moves the opportunity once;
13. Student first learning moves the opportunity once;
14. repeat-use criteria can move it to Engaged Free Family;
15. reply reaches the correct GHL Conversation;
16. no duplicate contact/opportunity/email;
17. no Student contact;
18. no billing effect;
19. no Torah-question pipeline/opportunity.

Do not broad-publish workflows from this task.

WORKFLOW READINESS ORDER

After the canary proves prerequisites, return exact publication readiness for:

1. OT-R01 Customer Replied - Internal Routing
2. OT-01 Family Account Confirmation
3. OT-LC02 Parent Activated — Student Setup
4. OT-LC03 Student Created — First Learning
5. OT-LC04 Activated Free — Build the Habit
6. OT-LC05 Engaged Free — Progress
7. OT-LC06 Parent Activation Help
8. OT-LC07 Student Activation Help

Do not mark a workflow safe merely because its canvas exists.

Audience workflows remain Draft today. Historical Pipeline A migration is not required to send OT-C02 and must not delay launch.

TRACKING ACCEPTANCE

Return proof that today’s funnel can report:

- delivered;
- opened;
- clicked;
- CTA UTM/campaign/creative ID;
- landing-page visit where available;
- Family signup;
- Parent portal open;
- Parent activation;
- Student created;
- Student first learning;
- Family engaged.

Clearly distinguish GHL email tracking from first-party application events.

FORM/LOGIN HOLD

The operator is waiting for the form/login correction.

Before telling Shloimie to send OT-C02, state explicitly whether he may run the end-to-end test now.

If not, return one blocker only.

If yes, return the exact test URL and expected stage/email readback.

EXTERNAL EFFECT LIMITS

- broad campaign send: 0
- production workflow publication: 0
- historical migration: 0
- real billing/charge: 0
- Stripe sandbox expansion: 0
- WhatsApp send: 0
- Student GHL contacts: 0
- DNS/provider changes: 0

RETURN

1. confirmation this launch-day override was read;
2. current owner for app-GHL bridge and login/form;
3. exact deployed/merged truth;
4. exact missing nonbilling events or mappings;
5. whether the operator can test now;
6. one-blocker answer if not;
7. exact operator canary checklist;
8. GHL tracking/reporting readiness;
9. workflow publication readiness matrix for R01, OT-01, and LC02–LC07;
10. confirmation billing work is deferred;
11. external-effect counts;
12. one exact action for Shloimie.
```
