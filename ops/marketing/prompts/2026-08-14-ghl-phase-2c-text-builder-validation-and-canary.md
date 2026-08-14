# One Time Mishnayos — GHL Phase 2C Text-Builder Validation and Canary Prompt

Paste the complete block below into the same HighLevel AI/browser conversation that built the 18 Draft workflows.

```text
ONE TIME MISHNAYOS — PHASE 2C: TEXT-BUILDER NORMALIZATION, TERMINAL READBACK, REPLY CANARY, AND EXACT MIGRATION PREVIEW

Continue from the Phase 2B UI build you just completed in this same One Time HighLevel location.

Location ID:
pBSnOK2nkdxp6gf9Rg3o

CURRENT REPORTED STATE

- All 18 planned workflows exist and remain Draft.
- Contacts enrolled: 0.
- Customer emails sent: 0.
- Opportunities created or moved: 0.
- Workflows published: 0.
- OT-LC08 and OT-LC10 are blocked shells with no customer email actions.
- OT Continue URL remains NEEDS_VERIFIED_GHL_CHECKOUT_ROUTE.

DO NOT REBUILD THE WORKFLOWS.
DO NOT NARRATE EVERY CLICK.
USE HIGHLEVEL'S TEXT/AI BUILDER TO REPLACE OR CORRECT EMAIL CONTENT QUICKLY, THEN VERIFY THE ACTUAL SAVED RESULT.

HARD LIMITS

- Broad publication: 0.
- Historical-contact enrollment: 0.
- Historical-opportunity migration: 0.
- Customer sends: only the explicitly authorized operator-owned canary below.
- Student contacts: 0.
- Billing/provider/routing changes: 0.
- No guessed checkout or billing-repair URL.
- No Conversation AI customer response.
- One Time product/Stripe state remains authoritative for Family Lifecycle stage movement.

────────────────────────────────────────
STEP 1 — NORMALIZE EVERY EMAIL WITH THE TEXT BUILDER
────────────────────────────────────────

For every email action in the 18-workflow package, compare the saved email against the exact approved Phase 2 specification already present earlier in this conversation.

When an email is not exact, use the HighLevel text/AI builder instead of manually assembling text blocks.

Use this exact builder instruction, replacing <WORKFLOW NAME> and <EMAIL NUMBER>:

"Replace the entire email with the exact approved <WORKFLOW NAME> / <EMAIL NUMBER> copy from the earlier One Time Phase 2 specification in this conversation. Preserve the exact subject, preheader, body, CTA label, CTA destination merge tag, spelling, punctuation, Rabbi signature, and message order. Do not paraphrase. Do not add emojis, stock language, testimonials, images, countdowns, extra buttons, legal copy, unsubscribe commentary, or a second CTA. Use a clean plain-text-style email with one clear button. Preserve all HighLevel merge tags exactly."

After the builder inserts the copy:

- verify the subject separately;
- verify the preheader separately;
- verify the From Name, From Email, and Reply-To;
- verify the CTA merge tag was not changed or converted to plain text;
- verify apostrophes and em dashes did not corrupt the text;
- remove any AI-added heading, greeting, footer, emoji, image, or second button;
- save, exit, reopen, and read back the action.

AUTHORITATIVE SUBJECT MAP

Audience:

- OT-AUD01 Email 1: I want your son to experience One Time
- OT-AUD01 Email 2: Come see one class
- OT-AUD02 Email 1: One Time is back—on a completely different level
- OT-AUD02 Email 2: You already know the Rebbe. Come see the new class.
- OT-AUD03 Email 1: Come see what One Time has become
- OT-AUD03 Email 2: No pressure. Just see one class.
- OT-AUD04: I want you to see One Time
- OT-AUD05: no customer email

Family Lifecycle:

- OT-01: Your One Time access is ready
- OT-LC02: Now set up your son's One Time login
- OT-LC03 Email 1: His login is ready—start with one class
- OT-LC03 Email 2: One class is enough to begin
- OT-LC04: The next class is where the habit begins
- OT-LC05: He is building something real
- OT-LC06: Let's get your One Time access working
- OT-LC07: Let's get his One Time access working
- OT-LC08: no customer email; blocked shell
- OT-LC09: Your One Time Family access is active
- OT-LC10: no customer email; blocked shell
- OT-LC11: The door is open when you're ready
- OT-LC12: This week in One Time
- OT-R01: no customer email

AUTHORITATIVE CTA DESTINATIONS

- Audience invitations: {{ custom_values.ot_landing_url }}
- OT-01 / Parent activation / Parent progress: {{ custom_values.ot_parent_companion_url }}
- Add Student: {{ custom_values.ot_add_student_url }}
- Student login/activation: {{ custom_values.ot_student_login_url }}
- Weekly Parent updates: {{ custom_values.ot_parent_updates_url }}
- Support: {{ custom_values.ot_support_url }}
- Continue/billing: BLOCKED until OT Continue URL is verified

Do not alter the approved copy to insert metrics that may be empty. Keep the generic approved OT-LC05 and OT-LC12 language unless truthful conditional rendering is proven.

────────────────────────────────────────
STEP 2 — HARDEN THE TWO BLOCKED SHELLS
────────────────────────────────────────

OT-LC08 Free Access Deadline:

- Keep Draft.
- Keep zero customer email actions.
- Add workflow description:
  BLOCKED_ON_VERIFIED_GHL_CHECKOUT_ROUTE — DO NOT PUBLISH
- Its current broad Pipeline B placeholder trigger is acceptable only while Draft and actionless.
- Do not add a guessed date trigger, landing-page URL, or payment URL.

OT-LC10 Grace — Payment Issue:

- Keep Draft.
- Keep zero customer email actions.
- Add workflow description:
  BLOCKED_ON_VERIFIED_BILLING_REPAIR_ROUTE — DO NOT PUBLISH
- Preserve the exact Grace / Payment Issue stage trigger.
- Do not add a guessed repair link.

────────────────────────────────────────
STEP 3 — RETURN THE TERMINAL WORKFLOW MANIFEST
────────────────────────────────────────

For all 18 workflows, save, exit, reopen, and return one compact table containing:

- exact workflow ID;
- exact name;
- folder;
- Draft status;
- trigger;
- exact pipeline ID and full stage ID when applicable;
- filter conditions;
- wait durations;
- email count;
- exact subject(s);
- exact CTA merge tag(s);
- From Name;
- From Email;
- Reply-To;
- Allow Re-entry;
- Allow Multiple Opportunities;
- Stop on Response;
- assignment action;
- conversation tag action;
- blocked description when applicable.

Explicitly prove:

- OT-01 was updated in place and not duplicated;
- OT-R01 was updated in place and not duplicated;
- all Audience workflows assign to Eli Scheller and apply `ot | conversation | rabbi` before sending;
- technical/support workflows assign to Solomon Dratler and apply `ot | conversation | support` when applicable;
- no automatic customer reply exists in OT-R01;
- no workflow is Published.

────────────────────────────────────────
STEP 4 — OPERATOR-OWNED SYNTHETIC CANARY ONLY
────────────────────────────────────────

After the terminal manifest is complete, run one bounded canary using only an operator-owned synthetic contact/inbox.

Do not use any of the 1,377 historical contacts.

Use a clearly labeled operator-owned contact such as:

OT Phase 2C Operator Canary

Create only the minimum synthetic opportunity records required for the canary and label them as operator QA.

CANARY A — RABBI SEND AND REPLY ROUTING

1. Use the workflow Test function or action-level test on OT-01.
2. Send exactly one email to the operator-owned inbox.
3. Verify visible From:
   Rabbi Eli Scheller <rabbielischeller@onetimeonetime.com>
4. Verify the exact OT-01 subject/body/CTA.
5. Reply from the operator-owned inbox.
6. Verify the reply appears in HighLevel Conversations on the same adult contact.
7. Verify assignment to Eli Scheller.
8. Verify tag `ot | conversation | rabbi`.
9. Verify no automatic customer response.

CANARY B — SUPPORT ROUTING

1. Use the operator-owned contact only.
2. Exercise the support classification path without sending a customer email when possible; otherwise use one explicitly operator-owned action-level test.
3. Verify assignment to Solomon Dratler.
4. Verify tag `ot | conversation | support`.
5. Verify no AI auto-response and no Student contact.

CANARY C — STAGE-DRIVEN WORKFLOW SHAPE

Using one synthetic Family Lifecycle opportunity only:

- place it in Parent Companion Activated — Student Setup Pending;
- use the workflow Test function for OT-LC02;
- verify the correct two-hour wait and pre-send conditions are present;
- do not wait two real hours or publish the workflow merely to prove configuration;
- repeat readback-only/test-mode verification for OT-LC03 and OT-LC06;
- send no additional customer email unless the operator-owned test function requires it and the exact total is reported.

CANARY EFFECT CAP

- Operator-owned external email deliveries: maximum 2 total in this phase.
- Historical contacts touched: 0.
- Historical opportunities touched: 0.
- Workflows published: 0.
- Student contacts created: 0.
- Billing effects: 0.

After proof, archive or clearly mark the synthetic QA opportunity/contact according to the existing operator-QA convention. Do not delete evidence needed for readback.

────────────────────────────────────────
STEP 5 — EXACT ZERO-WRITE MIGRATION MANIFEST
────────────────────────────────────────

Do not authorize or execute the 1,377-opportunity migration.

The previous eligibility figures were estimates based on location-wide rates. Replace them with an exact, fully paginated, deduplicated, sanitized manifest.

For each source stage in `One Time Enrollment and Conversion`, compute exact counts for:

- source opportunities;
- unique adult contacts;
- duplicate source opportunities per contact;
- email present/valid;
- email DND;
- marketing suppression;
- current marketing permission;
- OT Has Current Family Account = Yes;
- existing target opportunity in Pipeline A;
- existing household opportunity in Pipeline B;
- ambiguous contact or opportunity mapping;
- exact eligible count;
- exact excluded count by reason.

Do not return names, emails, phones, or message content.

Do not create or move any opportunity.

Return a proposed canary manifest with no more than one real candidate from each eligible historical cohort, but do not execute it. Shloimie must separately approve the exact candidate count and run.

Do not request or accept a broad-run phrase yet.

────────────────────────────────────────
STEP 6 — CODEX / APP-BRIDGE HANDOFF
────────────────────────────────────────

At the end, produce one copy/paste handoff block for Codex containing:

- Pipeline A ID and all stage IDs;
- Pipeline B ID and all stage IDs;
- all relevant contact-field IDs/fieldKeys;
- all relevant opportunity-field IDs/fieldKeys;
- custom-value IDs and final values;
- exact workflow IDs;
- exact product events expected from One Time:
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
- exact event-to-stage projection;
- requirement that updates are household-scoped and idempotent;
- zero Student GHL contacts;
- product/Stripe truth wins over stale GHL state.

Do not mutate the One Time application from HighLevel.

────────────────────────────────────────
RETURN
────────────────────────────────────────

Return one final report with:

1. Text-builder normalization completed and any corrections made.
2. Full 18-workflow terminal manifest.
3. OT-01 and OT-R01 in-place proof.
4. Blocked-shell proof.
5. Operator-owned canary results and exact effect counts.
6. Reply-routing proof.
7. Exact zero-write migration manifest.
8. Proposed historical canary only; not executed.
9. Codex/app-bridge handoff block.
10. Contacts enrolled.
11. Customer emails sent.
12. Opportunities created/moved.
13. Workflows published.
14. Student contacts created.
15. Billing/provider/routing changes.
16. One exact next action required from Shloimie.
```
