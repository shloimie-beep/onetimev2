# One Time Mishnayos — HighLevel Browser/UI Workflow Execution Prompt

Paste the complete block below into the same HighLevel AI/agent conversation that produced the Phase 2 report. This is the UI execution step. It does not authorize historical migration, publication, enrollment, sends, billing, or routing changes.

```text
ONE TIME MISHNAYOS — PHASE 2B: EXECUTE THE WORKFLOW BUILD IN THE HIGHLEVEL UI

Continue from the complete Phase 2 report immediately above in this same conversation.

Location ID:
pBSnOK2nkdxp6gf9Rg3o

IMPORTANT CORRECTION

Your prior run successfully updated custom values and created the welcome-video fields, but it did NOT create or update any workflow because the API skill exposed workflow GET only.

This run must use the actual HighLevel browser/UI workflow builder, not the read-only workflow API.

If you do not have browser/UI control in this session, stop immediately and say exactly:

BLOCKED — WORKFLOW UI CONTROL IS NOT AVAILABLE IN THIS SESSION

Do not return another theoretical specification and do not claim that any workflow was built.

AUTHORITATIVE INPUT

Use the exact workflow definitions, subjects, preheaders, body copy, waits, conditions, tags, stage IDs, custom values, sender identities, and safety rules from your immediately preceding Phase 2 complete report.

Do not rewrite or improve the approved email copy.

CURRENT VERIFIED CRM FOUNDATION

Pipeline A:
One Time | Audience & Reactivation
ID: p1du4HGmVf3DL1LaAMBR

Stages:
- Warm Lead — 21fcbe15-13f0-4459-9c19-956fa6e18fe0
- Old App — Active — 3501f1f5-d205-4ab6-a42e-bb19232c0575
- Old App — Inactive — 03fbd804-1f3d-4a4e-b868-702ebb81075d
- Prior Event / Prior Interest — be648b16-a479-4fca-afe0-7633fe8bd1eb
- Invitation Sent / Registration Opened — d3f2f5f1-69f0-425e-a29a-137e780cb21f
- Registered — Handoff Complete — f79b0826-15fa-4024-aa26-221ea26df41e
- Not Interested / Suppressed — ea271e39-432d-4b58-9bff-b7c113a0a52f

Pipeline B:
One Time | Family Lifecycle
ID: J07hIGecCCTi8xGD1p1I

Stages:
- Family Account Created — Parent Not Activated — 729fba78-795a-49b7-b6df-63f63ceb7fbd
- Parent Companion Activated — Student Setup Pending — 5c5efed3-78a4-4ebb-a6a4-7458d1f1c194
- Student Created — Not Yet Learning — 062991e7-70f5-4e51-b07c-87b92c51e9e0
- Activated Free Family — 5f752777-ceba-40c0-8518-8a59929a5549
- Engaged Free Family — 85579c03-30eb-4ac8-bcc3-23e72c922708
- Paid Active — 77462f7f-7c43-4a8c-a254-35c844805a84
- Grace / Payment Issue — 342236a7-d863-4414-80ed-19f061331011
- Canceled / Former — 0dfde414-7de0-4fcd-a4c6-7040d4fa5141

Existing populated pipeline that must remain untouched:
One Time Enrollment and Conversion
ID: RTTGVfbMv5aM92BQqklL
Existing opportunities: 1,377

CURRENT VERIFIED ROUTES

- OT Parent Companion URL:
  https://app.onetimeonetime.com/app/parent
- OT Add Student URL:
  https://app.onetimeonetime.com/app/parent/students/new
- OT Student Login URL:
  https://app.onetimeonetime.com/login
- OT Support URL:
  https://app.onetimeonetime.com/app/parent/support
- OT Parent Updates URL:
  https://app.onetimeonetime.com/app/parent/updates
- OT Continue URL remains unresolved:
  NEEDS_VERIFIED_GHL_CHECKOUT_ROUTE

CURRENT VERIFIED USERS

- Eli Scheller:
  u8P655S0QhE0KMowRVtA
- Solomon Dratler:
  uyhQVFp0ixFvGrKOKCrK

CURRENT VERIFIED SENDERS

Rabbi/program/lifecycle:
Rabbi Eli Scheller <rabbielischeller@onetimeonetime.com>
Reply-To: rabbielischeller@onetimeonetime.com

Operational/security/billing:
One Time Mishnayos <info@onetimeonetime.com>

Do not change Reply Address, forwarding, two-way sync, sending domain, DNS, or provider settings.

ABSOLUTE EFFECT LIMITS

- Workflow folders created: allowed.
- Draft workflows created/updated: allowed.
- Internal workflow assignments/tags/actions configured: allowed.
- Contacts enrolled: 0.
- Customer emails sent: 0.
- Workflows published: 0.
- Opportunities created: 0.
- Opportunities moved: 0.
- Historical opportunities migrated: 0.
- Billing effects: 0.
- WhatsApp sends: 0.
- Student contacts created: 0.
- Reply-routing/provider setting changes: 0.

Do not click Publish.
Do not use a real historical contact as a workflow test.
Do not use the phrase PHASE 3 BROAD RUN AUTHORIZED; no Phase 3 authorization exists.

────────────────────────────────────────
STEP 1 — CREATE WORKFLOW FOLDERS
────────────────────────────────────────

Create if missing:

1. 10 - Audience & Reactivation
2. 20 - Family Lifecycle
3. 30 - Reply Routing

Save and verify all three names.

────────────────────────────────────────
STEP 2 — UPDATE OT-01 IN PLACE
────────────────────────────────────────

Existing workflow:
OT-01 Family Account Confirmation
ID: 95a6f461-1a04-4260-b379-246fdcc45af7

Do not duplicate it.

Open the existing workflow in the UI.

Preserve its direct/API enrollment trigger unless the UI proves an already-configured, exact product-event trigger. Do not replace it with a public form trigger.

Move it to 20 - Family Lifecycle only if the UI confirms that moving a Draft workflow changes no trigger/action/dependency. Otherwise leave the folder unchanged and report the reason.

Set/read back:

- Status: Draft
- Allow Re-entry: OFF
- Stop on Response: ON
- Sender: Rabbi Eli Scheller <rabbielischeller@onetimeonetime.com>
- Reply-To: rabbielischeller@onetimeonetime.com

Allow Multiple Opportunities:

- Turn ON only if the direct/API enrollment is household-opportunity scoped and the exact opportunity context is available.
- If the workflow is contact-only and has no reliable household-opportunity context, preserve the current setting and report the limitation. Do not force an unsafe setting.

Replace the existing email action with the exact F1 copy from the preceding Phase 2 report:

Subject:
Your One Time access is ready

Preheader:
Watch the short welcome video, then add your son's Student login.

CTA:
OPEN ONE TIME

Destination:
{{ custom_values.ot_parent_companion_url }}

The body must tell the Parent:

- the Family account is ready;
- the Parent can go inside immediately;
- the short welcome video is at the top of the Parent account;
- the video is the fastest way to see what makes One Time different;
- the Parent may then add the son's separate Student login;
- the Family includes one Parent Companion plus up to three Students;
- no second signup or repeated login is required.

Use the exact approved body from the preceding report. Do not paraphrase.

Save, exit, reopen, and verify the complete action.

────────────────────────────────────────
STEP 3 — UPDATE OT-R01 IN PLACE
────────────────────────────────────────

Existing workflow:
OT-R01 Customer Replied - Internal Routing
ID: 15748c03-8ded-4ec3-b263-ffcc19c67982

Do not duplicate it.

Move to:
30 - Reply Routing

Set:

- Status: Draft
- Trigger: Customer Replied
- Channel: Email
- Allow Re-entry: ON
- Automatic customer response: none
- Conversation AI/AI auto-reply: OFF

Use a reliable assignment model.

Preferred implementation:

1. Every Rabbi/program workflow built below assigns the adult contact/conversation to Eli Scheller before its email action, adds `ot | conversation | rabbi`, and removes `ot | conversation | support` when that removal is safe.
2. Every operational/security/billing workflow assigns to Solomon Dratler before its email action, adds `ot | conversation | support`, and removes `ot | conversation | rabbi` when safe.
3. OT-R01 does not guess the originating workflow from unsupported metadata. On an email reply, it notifies the currently assigned user.
4. If both route tags exist or neither route tag exists, do not overwrite the current assignment. Create an internal task: `Reply triage required — message class unclear`.

If the HighLevel UI exposes a trustworthy `reply to workflow` or originating-workflow condition, you may use it, but return exact proof. Otherwise use the assignment/tag model above.

Never create a Student contact.
Never send an automatic customer reply.
Never change global reply routing.

Save, exit, reopen, and verify.

────────────────────────────────────────
STEP 4 — BUILD AUDIENCE WORKFLOWS A1–A5
────────────────────────────────────────

Build these exact workflows in folder 10 - Audience & Reactivation using the complete copy/action specifications in the preceding Phase 2 report:

A1. OT-AUD01 Warm Lead Invitation
A2. OT-AUD02 Old App Active Relaunch
A3. OT-AUD03 Old App Inactive Reactivation
A4. OT-AUD04 Prior Interest Invitation
A5. OT-AUD05 Registered Family Handoff

Global settings for A1–A4:

- Draft
- Adult contacts only
- Allow Re-entry OFF
- Allow Multiple Opportunities OFF
- Stop on Response ON
- Email DND false
- valid current marketing permission
- not suppressed
- OT Has Current Family Account is not Yes
- sender/reply-to: Rabbi Eli
- assign to Eli before sending
- add `ot | conversation | rabbi`
- add the correct cohort and campaign tags
- one main CTA per email

A1 trigger:
Pipeline A / Warm Lead
21fcbe15-13f0-4459-9c19-956fa6e18fe0

A2 trigger:
Pipeline A / Old App — Active
3501f1f5-d205-4ab6-a42e-bb19232c0575

A3 trigger:
Pipeline A / Old App — Inactive
03fbd804-1f3d-4a4e-b868-702ebb81075d

A4 trigger:
Pipeline A / Prior Event / Prior Interest
be648b16-a479-4fca-afe0-7633fe8bd1eb

For A1–A4:

- use the exact approved Email 1 and Email 2 copy/waits from the preceding report;
- after successful Email 1 action, configure movement of the same Audience opportunity to Invitation Sent / Registration Opened using full stage ID:
  d3f2f5f1-69f0-425e-a29a-137e780cb21f;
- keep the opportunity Open;
- never create a second opportunity;
- before follow-up email, recheck registration field, reply state, DND/suppression, and open opportunity state.

A5 trigger:
OT Has Current Family Account changes to Yes.

A5 contains no customer email.

A5 behavior:

- if exactly one open Audience opportunity exists for that adult, move that same opportunity to Registered — Handoff Complete and mark Won;
- if none exists, do nothing;
- if more than one exists, create an internal review task and make no stage choice;
- do not create the Family Lifecycle opportunity;
- do not rely on a contact-level trigger to guess among multiple household opportunities.

If the UI cannot safely implement the exact-one-opportunity branch, create A5 as a Draft shell with an internal limitation note and no mutating opportunity action. Do not build a broad unsafe update.

Save, exit, reopen, and verify every workflow.

────────────────────────────────────────
STEP 5 — BUILD FAMILY LIFECYCLE WORKFLOWS
────────────────────────────────────────

Build in folder 20 - Family Lifecycle using the exact copy and action sequences from the preceding Phase 2 report:

F2. OT-LC02 Parent Activated — Student Setup
F3. OT-LC03 Student Created — First Learning
F4. OT-LC04 Activated Free — Build the Habit
F5. OT-LC05 Engaged Free — Progress
F6. OT-LC06 Parent Activation Help
F7. OT-LC07 Student Activation Help
F9. OT-LC09 Paid Active Welcome
F11. OT-LC11 Canceled / Former Reactivation
F12. OT-LC12 Weekly Parent Progress

Global settings:

- Draft
- adult contacts only
- household opportunity context
- Allow Multiple Opportunities ON
- Allow Re-entry OFF except F12
- sender/reply-to: Rabbi Eli
- assign to Eli before email action
- add `ot | conversation | rabbi`
- no Student contact
- recheck current stage and authoritative opportunity fields immediately before every email
- no stage movement based on open/click

F2 trigger:
Parent Companion Activated — Student Setup Pending
5c5efed3-78a4-4ebb-a6a4-7458d1f1c194

F2 wait:
2 hours

F2 required pre-send checks:

- still in same stage;
- OT First Student Created At empty;
- OT Household ID nonempty;
- not DND/suppressed.

F3 trigger:
Student Created — Not Yet Learning
062991e7-70f5-4e51-b07c-87b92c51e9e0

F3:

- Email 1 immediately;
- wait 24 hours;
- send Email 2 only if same stage, First Student Learning Started At empty, no reply, and not DND/suppressed.

F4 trigger:
Activated Free Family
5f752777-ceba-40c0-8518-8a59929a5549

F5 trigger:
Engaged Free Family
85579c03-30eb-4ac8-bcc3-23e72c922708

F5 must use the generic approved copy. Do not insert potentially empty statistics unless the UI supports truthful conditional rendering and you prove it.

F6 trigger:
Family Account Created — Parent Not Activated
729fba78-795a-49b7-b6df-63f63ceb7fbd

F6:

- wait 24 hours;
- require same stage;
- Parent Companion Activated At empty;
- Parent Portal Opened At empty/not activated;
- add `ot | needs help | parent activation`;
- Stop on Response ON;
- email points to the Parent account and welcome video.

F7 trigger:
Student Created — Not Yet Learning
062991e7-70f5-4e51-b07c-87b92c51e9e0

F7:

- separate workflow from F3;
- wait 72 hours;
- require same stage and First Student Learning Started At empty;
- add `ot | needs help | student login`;
- Stop on Response ON.

F9 trigger:
Paid Active
77462f7f-7c43-4a8c-a254-35c844805a84

F11 trigger:
Canceled / Former
0dfde414-7de0-4fcd-a4c6-7040d4fa5141

F11 remains Draft and must include current marketing permission and suppression gates.

F12:

- recurring weekly Parent-progress workflow;
- Allow Re-entry ON;
- Allow Multiple Opportunities ON;
- Stop on Response OFF;
- eligibility: Engaged Free Family or Paid Active, OT Household ID nonempty, valid program/newsletter permission, not DND/suppressed;
- use OT Parent Updates URL;
- do not insert private Student questions or empty metrics.

Time-zone rule:

- if the schedule builder supports contact-timezone execution truthfully, use Thursday 12:00 in contact timezone;
- otherwise set Thursday 12:00 Asia/Jerusalem, state the limitation in the workflow description, and do not claim household-local scheduling.

Save, exit, reopen, and verify every workflow.

────────────────────────────────────────
STEP 6 — CREATE BLOCKED SHELLS ONLY
────────────────────────────────────────

Create these Draft workflow shells:

F8. OT-LC08 Free Access Deadline
F10. OT-LC10 Grace — Payment Issue

F8 planned context:
Family Lifecycle, not Paid Active, free-access end approaching.

F10 trigger:
Grace / Payment Issue
342236a7-d863-4414-80ed-19f061331011

Do not add any customer email action or placeholder URL.

Add a workflow description/note:

BLOCKED_ON_VERIFIED_GHL_CHECKOUT_OR_BILLING_REPAIR_ROUTE

OT Continue URL still equals:
NEEDS_VERIFIED_GHL_CHECKOUT_ROUTE

F10's future sender is:
One Time Mishnayos <info@onetimeonetime.com>

Assign no real contact and send nothing.

────────────────────────────────────────
STEP 7 — DO NOT MIGRATE HISTORICAL OPPORTUNITIES
────────────────────────────────────────

The previous migration preview contains exact source-stage totals but estimated DND/suppression/eligibility counts derived from location-wide rates.

Therefore:

- do not create a 5-contact real historical canary;
- do not create any Pipeline A opportunity for a historical contact;
- do not move or clone any of the 1,377 source opportunities;
- do not treat estimated counts as an execution manifest.

Create a zero-write migration-audit note only.

A future migration run requires:

1. exact full pagination of every source stage;
2. exact per-contact DND, suppression, email, permission, duplicate, current-family, and existing-target-opportunity results;
3. an exact deduplicated manifest;
4. workflow testing with operator-owned synthetic contacts first;
5. separate explicit operator authorization for any real historical opportunity creation.

No Phase 3 phrase is authorized in this run.

────────────────────────────────────────
STEP 8 — SAVE, REOPEN, AND PROVE
────────────────────────────────────────

For every workflow actually built or edited:

1. Save.
2. Exit to workflow list.
3. Reopen.
4. Read back:
   - exact workflow ID;
   - exact name;
   - folder;
   - Draft status;
   - trigger;
   - pipeline and full stage ID;
   - filters;
   - waits;
   - sender;
   - Reply-To;
   - CTA and destination merge tag;
   - Allow Re-entry;
   - Allow Multiple Opportunities;
   - Stop on Response;
   - assignment/tag actions;
   - email count;
   - blocked state where applicable.

Capture screenshots or equivalent UI evidence for:

- OT-01 action and sender;
- OT-R01 trigger/routing;
- A1 trigger and first email;
- F2 trigger/wait/check;
- F3 two-email branch;
- F6 welcome-video activation help;
- F12 schedule/timezone;
- F8/F10 blocked shell.

Do not test by sending an email yet.
Do not enroll a contact yet.

────────────────────────────────────────
RETURN ONE COMPLETE TERMINAL REPORT
────────────────────────────────────────

Return:

1. Whether browser/UI control was available.
2. Workflow folders created.
3. Every workflow ID, name, folder, and Draft state.
4. OT-01 in-place update proof.
5. OT-R01 in-place update proof.
6. Exact trigger/stage IDs.
7. Exact email counts and subjects.
8. Sender/Reply-To readback.
9. Re-entry, multiple-opportunity, Stop-on-Response settings.
10. Assignment and reply-routing logic.
11. Any workflow that could not be implemented exactly and why.
12. F8/F10 blocked-shell proof.
13. Historical migration effects: 0.
14. Contacts enrolled: 0.
15. Customer emails sent: 0.
16. Opportunities created/moved: 0.
17. Workflows published: 0.
18. Student contacts created: 0.
19. Routing/billing/provider changes: 0.
20. One exact next action required from Shloimie.

Do not return another proposed plan without attempting the actual UI build. If the UI is unavailable, report the explicit blocker and stop.
```
