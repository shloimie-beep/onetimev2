# One Time — GHL Sandbox and Legacy Free-Site Controller Handoff

Paste the following prompt into the existing PR #131 Work/Codex controller. It is a current-state ingestion, ownership, and bounded execution prompt. Do not create duplicate workers.

```text
ONE TIME PR #131 — BUILD THE SAFE GHL SANDBOX TEST PATH AND RECORD THE LEGACY FREE-CONTENT FUNNEL

Repository:
shloimie-beep/onetimev2

Sole product integration/deployment authority:
PR #131
codex/one-time-complete-production-launch-20260805

Decision/control source:
PR #183
chatgpt/one-checkbox-and-launch-marketing-v2-20260813

FIRST RE-FETCH CURRENT STATE

Read:

1. current PR #131 AGENTS.md, STATUS, EXECPLAN, deployed source, active workers, and open integration candidates;
2. current PR #183;
3. from PR #183:
   ops/v2.1-execution/source-spec/00-OPERATOR-DECISION-OVERRIDE-20260816-GHL-SANDBOX-CANARY.md
4. from PR #183:
   ops/v2.1-execution/source-spec/00-OPERATOR-DECISION-OVERRIDE-20260816-LEGACY-FREE-CONTENT-FUNNEL.md
5. from PR #183:
   ops/v2.1-execution/source-spec/00-OPERATOR-DECISION-OVERRIDE-20260816-TORAH-QUESTIONS-DIRECT-RABBI.md
6. from PR #183:
   integrations/highlevel/agent-mode/results/GHL-TORAH-QUESTIONS-PIPELINE-DELETION-VERIFIED-20260816.result.md
7. current production GHL foundation/workflow result files under:
   integrations/highlevel/agent-mode/results/
8. current HighLevel desired-state registry:
   integrations/highlevel/registry/workflow-registry.yaml
9. current One Time → GHL contacts/opportunity/outbox/event bridge;
10. current staging/Railway environments, protected config names, and account boundaries;
11. current landing/signup/Parent Companion/Student/lifecycle event implementation;
12. the exact legacy website/domain/repository evidence currently available.

DO NOT RESTART THE REPOSITORY-WIDE AUDIT

Inspect current workers before assigning work.

- Do not duplicate the active product-launch controller.
- Do not duplicate Parent Companion, Zoom, Vimeo/content, Telegram, marketing-media, or Contacts workers.
- Do not let a GHL sandbox worker edit product code already owned by another current worker.
- PR #131 remains the only integration/deployment path.

LOCKED LEGACY WEBSITE DECISION

The old/legacy One Time website becomes the public free-content hub.

It may contain approved jokes, short Torah content, stories, clips, samples, public Rabbi Eli material, and other shareable/SEO content.

Its conversion role is:

legacy free-content site
→ join.onetimeonetime.com
→ Family signup
→ app.onetimeonetime.com

It must not become a second member portal, second account system, second checkout, or second protected library.

Do not expose raw Zoom, Vimeo, Drive, Student, Parent, or provider resources.

Every CTA uses stable attribution, including:

utm_source=legacy_site
utm_medium=organic_content
utm_campaign=ot_launch_2026_free_access
utm_content=<stable-content-id>

First identify and return:

- exact legacy domain;
- current hosting/deployment;
- repository/source owner;
- current public content inventory;
- current CTA destinations;
- DNS/hosting overlap risk;
- whether the legacy site is inside this repo or a separate repo.

Do not change DNS, hosting, or public content until ownership and rollback are explicit.

LOCKED GHL SANDBOX STRATEGY

Use two levels:

A. Dedicated GHL sandbox/test sub-account with synthetic data.
B. One final operator-owned canary in the real production GHL location.

Do not treat a payment Test-mode toggle as a complete CRM/workflow sandbox.

PRODUCTION GHL LOCATION

pBSnOK2nkdxp6gf9Rg3o

Existing production pipelines include:

- One Time | Audience & Reactivation
  ID: p1du4HGmVf3DL1LaAMBR

- One Time | Family Lifecycle
  ID: J07hIGecCCTi8xGD1p1I

The deleted Torah-question pipeline must remain absent:

wabcK1pPBuqj1T4cjpI7

No Student GHL contacts.
No Torah-question opportunities.

STEP 1 — AUDIT SANDBOX AVAILABILITY

Read the agency safely and determine:

- whether a native HighLevel Sandbox or Trial account already exists;
- whether a separate unused test sub-account already exists;
- whether the agency plan permits a new sub-account without an unexpected charge;
- whether a developer sandbox is available and appropriate;
- whether creating a new test location would purchase or provision any phone, email, domain, payment, or SaaS resource.

Preferred test location name:

One Time | Sandbox

If no safe sandbox exists and creation would have an external cost or account-side consequence, do not create it silently. Return the exact one operator action required.

If a safe unused test sub-account already exists, designate it only after verifying it contains no real customer data.

STEP 2 — CREATE A SELECTIVE ASSET PACKAGE

Use HighLevel copy-to-sub-account or a selective Snapshot.

Include only:

- Pipeline A and Pipeline B;
- required stages;
- OT cohort/campaign/conversation/needs-help/QA tags;
- required contact custom fields;
- required opportunity custom fields;
- required custom values;
- workflow folders;
- the 18 current Draft workflows;
- the reply-routing workflow;
- no historical contacts or opportunities;
- no customer conversations;
- no billing records;
- no phone number;
- no WhatsApp account;
- no live ad or social asset.

Required sandbox tag:

ot | qa | sandbox

Every sandbox workflow must require the sandbox location and/or this tag.

Copied workflows remain Draft until sandbox-specific references are rebound and verified.

After copy/load, save → reopen → read back:

- sandbox pipeline IDs;
- stage IDs;
- workflow IDs;
- field IDs/fieldKeys;
- custom-value IDs/values;
- user assignments;
- sender behavior;
- webhook/API references;
- any asset/reference cleared during copy.

Never reuse production IDs as sandbox IDs.

STEP 3 — BIND A STAGING APP TO THE SANDBOX LOCATION

Audit whether a real staging/test One Time runtime already exists.

Required protected configuration model:

production runtime
→ production GHL location pBSnOK2nkdxp6gf9Rg3o

staging/sandbox runtime
→ sandbox GHL location <SANDBOX_LOCATION_ID>

The server derives the location/environment. A browser payload cannot choose it.

Required safeguards:

- separate location ID;
- separate private integration token;
- separate webhook/signing secret when used;
- environment marker on every outbox/event;
- idempotency key includes environment and household;
- sandbox cannot write production GHL;
- production cannot write sandbox GHL;
- no Student GHL contact;
- no real customer data.

If no staging runtime exists, return the smallest exact staging/runtime delta and assign it to the existing current owner. Do not create a conflicting deployment lane.

STEP 4 — IMPLEMENT/VERIFY THE EVENT BRIDGE

Required authoritative One Time events:

family.account_created
parent.portal_opened
parent.welcome_video_started
parent.welcome_video_completed
parent.add_student_clicked
parent.companion_activated
student.created
student.first_learning_started
family.engaged
billing.active
billing.grace
billing.canceled

Required Family Lifecycle projection:

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

billing.active
→ Paid Active

billing.grace
→ Grace / Payment Issue

billing.canceled
→ Canceled / Former

Rules:

- One Time/Stripe truth wins over stale GHL state.
- Stage movement is household-scoped and idempotent.
- Email opens/clicks do not count as product activation.
- One adult may own more than one household opportunity.
- No duplicate contact/opportunity/email.
- No Student GHL contact.
- No Torah-question GHL pipeline, opportunity, or workflow.

STEP 5 — RUN THE SYNTHETIC SANDBOX JOURNEY

Use only:

- OT Sandbox Parent 001
- OT Sandbox Student 001
- operator-owned email aliases
- synthetic household and product data

Test:

1. Family account/signup event.
2. Exactly one adult contact.
3. Exactly one household opportunity.
4. Correct initial stage.
5. OT-01 exactly once.
6. Parent portal/meaningful activation stage.
7. OT-LC02 eligibility and exit when Student exists.
8. Student creation stage.
9. OT-LC03 exactly once.
10. Student first learning stage.
11. OT-LC04 exactly once.
12. Repeat learning and Engaged stage.
13. OT-LC05 exactly once.
14. DND/suppression prevents optional mail.
15. Reply routes through OT-R01 to Rabbi/support correctly.
16. No automatic AI customer reply.
17. Student and Parent Torah questions appear directly in One Time for Rabbi Eli.
18. Rabbi answer returns to the correct first-party submitter.
19. Zero GHL question opportunities.
20. Zero Student GHL contacts.

Also prove exact replay/idempotency behavior and rollback/cleanup.

STEP 6 — BILLING SANDBOX

Keep OT-LC08 and OT-LC10 blocked until exact continuation and repair routes exist.

When routes exist:

- use an explicit payment Test mode or provider test environment;
- make no live charge;
- use operator/synthetic payment data;
- prove active, grace, and canceled event projection;
- prove no live billing effect.

STEP 7 — PRODUCTION CANARY

After sandbox passes, prepare but do not broad-publish one operator-owned production-location canary.

Prove:

- live sender/domain delivery;
- reply in GHL Conversations;
- production app → production GHL stage movement;
- exact production contact/opportunity/field IDs;
- Parent signup/login;
- Student creation and first learning;
- no duplicate email;
- no Student contact;
- cleanup/rollback.

Recommended production publication order after canary approval:

1. OT-R01
2. OT-01
3. OT-LC02 through OT-LC07, one bounded set at a time
4. Audience workflows only after exact migration/permission canaries
5. Billing workflows only after route/payment proof

Do not publish all production workflows at once.

TORAH-QUESTION DELETION VERIFICATION

The live API readback confirms:

- deleted pipeline absent;
- former pipeline opportunities: 0;
- migration required: no;
- no form/workflow-name dependency found;
- full workflow-body/webhook/report/dashboard inspection remains an API-surface limitation.

Preserve that result and remove/prevent any desired-state registry reference that would recreate the pipeline.

EXTERNAL-EFFECT LIMITS

Without a separate explicit operator authorization:

- production workflows published: 0
- real contacts enrolled: 0
- real customer emails: 0
- historical opportunities migrated: 0
- live charges: 0
- WhatsApp sends: 0
- phone/email resource purchases: 0
- DNS changes: 0
- legacy-site deploys: 0
- Student contacts: 0

RETURN

1. confirmation every required PR #183 decision was read;
2. current active-worker ownership map;
3. exact legacy-site domain/repo/hosting truth;
4. sandbox availability and cost/effect truth;
5. existing or proposed sandbox location;
6. snapshot/copy asset manifest;
7. staging/runtime bridge status;
8. exact missing application events;
9. synthetic sandbox test plan/result;
10. Torah-pipeline drift result;
11. blocked billing items;
12. production-canary plan;
13. workflows currently safe to publish: none until canary, or exact exceptions with proof;
14. all external-effect counts;
15. one exact next action required from Shloimie.
```
