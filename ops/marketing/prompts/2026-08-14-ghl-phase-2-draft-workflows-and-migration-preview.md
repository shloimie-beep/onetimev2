# One Time Mishnayos — GHL Phase 2 Prompt

Paste the complete block below into the same HighLevel AI conversation that completed the CRM-foundation audit/build.

```text
ONE TIME MISHNAYOS — PHASE 2: DRAFT WORKFLOWS, REPLY ROUTING, WELCOME-VIDEO FIELDS, AND ZERO-WRITE MIGRATION PREVIEW

Continue from the Phase 1 result you just completed in this same One Time HighLevel location.

Location ID:
pBSnOK2nkdxp6gf9Rg3o

PHASE 1 IS ACCEPTED AS CURRENT STATE

You already created:

Pipeline A:
One Time | Audience & Reactivation
Pipeline ID: p1du4HGmVf3DL1LaAMBR

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
Pipeline ID: J07hIGecCCTi8xGD1p1I

Stages:
- Family Account Created — Parent Not Activated — 729fba78-795a-49b7-b6df-63f63ceb7fbd
- Parent Companion Activated — Student Setup Pending — 5c5efed3-78a4-4ebb-a6a4-7458d1f1c194
- Student Created — Not Yet Learning — 062991e7-70f5-4e51-b07c-87b92c51e9e0
- Activated Free Family — 5f752777-ceba-40c0-8518-8a59929a5549
- Engaged Free Family — 85579c03-30eb-4ac8-bcc3-23e72c922708
- Paid Active — 77462f7f-7c43-4a8c-a254-35c844805a84
- Grace / Payment Issue — 342236a7-d863-4414-80ed-19f061331011
- Canceled / Former — 0dfde414-7de0-4fcd-a4c6-7040d4fa5141

The old populated pipeline remains untouched:
One Time Enrollment and Conversion
Pipeline ID: RTTGVfbMv5aM92BQqklL
Total existing opportunities: 1,377

DO NOT CREATE OR CLONE THE 1,377 OPPORTUNITIES IN THIS PHASE.
DO NOT MOVE ANY EXISTING OPPORTUNITY.

HARD SAFETY RULES

- All newly created or edited workflows remain Draft.
- Customer emails sent: 0.
- Contacts enrolled: 0.
- Opportunities moved or created: 0.
- Existing populated pipeline stages renamed/deleted: 0.
- Workflows published: 0.
- WhatsApp sends: 0.
- Billing changes: 0.
- Reply Address/forwarding/two-way-sync changes: 0.
- Student contacts created: 0.
- Do not create a duplicate OT-01.
- Do not create a duplicate OT-R01.
- Do not infer product use from email opens or clicks.
- One Time application/Stripe truth will move Family Lifecycle stages later.

EMAIL IDENTITIES

Program, invitation, activation, progress, continuation, and reactivation:

From Name:
Rabbi Eli Scheller

From Email:
rabbielischeller@onetimeonetime.com

Reply-To:
rabbielischeller@onetimeonetime.com

Operational security, PIN-reset, payment-failure, and technical service:

From Name:
One Time Mishnayos

From Email:
info@onetimeonetime.com

Preserve the currently verified Rabbi sender and Reply-To. Do not recreate or reroute it.

Rabbi Eli HighLevel user:
- Name: Eli Scheller
- User ID: u8P655S0QhE0KMowRVtA
- Role: admin

HighLevel Conversations remains the canonical customer-reply inbox.

────────────────────────────────────────
PHASE 2A — COMPLETE ROUTE VALUES AND WELCOME-VIDEO PROJECTION FIELDS
────────────────────────────────────────

Update these existing custom values by exact ID:

1. OT Parent Companion URL
ID: EZGWSWS2eRpPSMz0Qqkb
New value:
https://app.onetimeonetime.com/app/parent

2. OT Add Student URL
ID: ULoFBb6GDSvl7AHoYXlA
New value:
https://app.onetimeonetime.com/app/parent/students/new

3. OT Student Login URL
ID: KN3keqybgaRqrjqnBwJK
New value:
https://app.onetimeonetime.com/login

4. OT Support URL
ID: K1xXxhQ7RnGvgrrz9F4F
New value:
https://app.onetimeonetime.com/app/parent/support

Do not change OT Continue URL.
It must remain unresolved until the exact approved GHL checkout route exists:
NEEDS_VERIFIED_GHL_CHECKOUT_ROUTE

Create this additional custom value if missing:

Name:
OT Parent Updates URL

Value:
https://app.onetimeonetime.com/app/parent/updates

Create these four missing Opportunity custom fields as DATE fields:

- OT Parent Portal Opened At
- OT Welcome Video Started At
- OT Welcome Video Completed At
- OT Add Student Clicked At

Do not create 25%, 50%, or 75% video fields in GHL. Those detailed milestones remain in One Time analytics unless a later workflow proves they are needed.

Save and reopen every updated/created value and field. Return exact IDs and fieldKeys.

────────────────────────────────────────
PHASE 2B — WORKFLOW FOLDERS AND GLOBAL SETTINGS
────────────────────────────────────────

Create these workflow folders if missing:

- 10 - Audience & Reactivation
- 20 - Family Lifecycle
- 30 - Reply Routing

For every audience workflow:

- status Draft;
- adult contacts only;
- Allow Re-entry OFF;
- Allow Multiple Opportunities OFF;
- Stop on Response ON;
- email DND/suppression check before every optional email;
- current marketing permission required;
- no Student contact or Student fields;
- one main CTA per email.

For every Family Lifecycle workflow:

- status Draft;
- adult contacts only;
- Allow Re-entry OFF unless explicitly stated;
- Allow Multiple Opportunities ON because one adult may own more than one household opportunity;
- household opportunity is the execution context;
- recheck current opportunity stage and product fields immediately before every email;
- no Student contact;
- one main CTA.

Do not build stage-movement logic from email opens/clicks.
The application will project verified household events into the Family Lifecycle pipeline.

────────────────────────────────────────
PHASE 2C — AUDIENCE & REACTIVATION WORKFLOWS
────────────────────────────────────────

WORKFLOW A1

Exact name:
OT-AUD01 Warm Lead Invitation

Folder:
10 - Audience & Reactivation

Trigger:
Opportunity enters Pipeline p1du4HGmVf3DL1LaAMBR, stage 21fcbe15-13f0-4459-9c19-956fa6e18fe0.

Entry filters:

- OT Has Current Family Account is not Yes.
- Email is valid.
- Email DND is false.
- Current marketing permission is valid.
- Contact is not suppressed.

Actions before Email 1:

- Add tag: ot | cohort | warm lead
- Add tag: ot | campaign | 2026 free access
- Preserve existing source/cohort tags; do not remove them.

Email 1

Subject:
I want your son to experience One Time

Preheader:
Free access is open. No card is required.

Body:

Hi {{contact.first_name}},

I want your son to experience what Mishnayos can feel like when the learning is clear, visual, and alive.

One Time is a live Mishnayos class from Eretz Yisrael. We learn one complete perek each class day, with stories, a full teaching screen, and recordings for review.

Free access is open through September 11. No card is required.

[GET FREE ACCESS]
{{ custom_values.ot_landing_url }}

The goal is not to cover Mishnayos. The goal is to make a kinyan.

Rabbi Eli Scheller
One Time Mishnayos
Mishnayos Made Memorable

After the email action succeeds:

- update the same Audience opportunity to stage d3f2f5f1-69f0-425e-a29a-137e780cb21f;
- keep status Open;
- do not create another opportunity.

Wait 48 hours.

Before Email 2, require:

- OT Has Current Family Account is still not Yes;
- contact has not replied since enrollment;
- contact is not DND/suppressed;
- audience opportunity is still open and not Lost/Won.

Email 2

Subject:
Come see one class

Preheader:
You do not have to decide anything yet.

Body:

Hi {{contact.first_name}},

You do not have to decide anything yet.

Open the free access and let your son see one class: one full perek, taught clearly, visually, and with a real Rebbe.

He can join live or use a recording when he needs to catch up.

[SEE ONE CLASS]
{{ custom_values.ot_landing_url }}

Rabbi Eli Scheller

End workflow.

WORKFLOW A2

Exact name:
OT-AUD02 Old App Active Relaunch

Folder:
10 - Audience & Reactivation

Trigger:
Opportunity enters Pipeline p1du4HGmVf3DL1LaAMBR, stage 3501f1f5-d205-4ab6-a42e-bb19232c0575.

Entry filters:
Same suppression, permission, email, and current-Family checks as A1.

Actions:

- Add tag: ot | cohort | old app active
- Add tag: ot | campaign | 2026 free access

Email 1

Subject:
One Time is back—on a completely different level

Preheader:
Live Mishnayos, visual teaching, Parent access, and separate Student logins.

Body:

Hi {{contact.first_name}},

You already know One Time and Rabbi Scheller.

But this is not simply the old app brought back.

One Time is now a live Sunday–Thursday Mishnayos program, with one complete perek each class day, a full visual teaching screen, recordings for review, Parent access, and separate protected Student logins.

Go inside free and see what it has become.

[GET FREE ACCESS]
{{ custom_values.ot_landing_url }}

A real Rebbe. A steady schedule. Real progress.

Rabbi Eli Scheller

Move the same opportunity to Invitation Sent / Registration Opened, keep Open, and wait 48 hours.

If still not registered and no reply:

Email 2

Subject:
You already know the Rebbe. Come see the new class.

Body:

Hi {{contact.first_name}},

You already know the teaching.

Now come see the new One Time experience: live, visual, structured, and built to help a boy make a real kinyan in Mishnayos.

Free access is open now.

[OPEN ONE TIME]
{{ custom_values.ot_landing_url }}

Rabbi Eli Scheller

WORKFLOW A3

Exact name:
OT-AUD03 Old App Inactive Reactivation

Folder:
10 - Audience & Reactivation

Trigger:
Opportunity enters Pipeline p1du4HGmVf3DL1LaAMBR, stage 03fbd804-1f3d-4a4e-b868-702ebb81075d.

Entry filters:
Same suppression, permission, email, and current-Family checks as A1.

Actions:

- Add tag: ot | cohort | old app inactive
- Add tag: ot | campaign | 2026 free access

Email 1

Subject:
Come see what One Time has become

Preheader:
The new program is live, visual, and free to try.

Body:

Hi {{contact.first_name}},

It has been a while since you used One Time.

The program has changed completely.

Rabbi Scheller now teaches a full perek live each class day from Eretz Yisrael, with visual material, stories, a protected Student experience, and recordings for review.

There is no pressure and no card required. Just go inside and see one class.

[GET FREE ACCESS]
{{ custom_values.ot_landing_url }}

Rabbi Eli Scheller

Move the same opportunity to Invitation Sent / Registration Opened, keep Open, and wait 72 hours.

If still not registered and no reply:

Email 2

Subject:
No pressure. Just see one class.

Body:

Hi {{contact.first_name}},

The easiest way to understand One Time is to see it.

Open the free access, let your son watch one class, and decide from the actual learning.

[SEE ONE CLASS]
{{ custom_values.ot_landing_url }}

Rabbi Eli Scheller

WORKFLOW A4

Exact name:
OT-AUD04 Prior Interest Invitation

Folder:
10 - Audience & Reactivation

Trigger:
Opportunity enters Pipeline p1du4HGmVf3DL1LaAMBR, stage be648b16-a479-4fca-afe0-7633fe8bd1eb.

Entry filters:

- valid current marketing permission;
- no suppression/DND;
- OT Has Current Family Account is not Yes.

Actions:

- Add tag ot | campaign | 2026 free access.
- Preserve existing event/prior-interest tags.

Email

Subject:
I want you to see One Time

Preheader:
A completely new daily Mishnayos experience.

Body:

Hi {{contact.first_name}},

You asked to hear from One Time before, and I want you to see what we have built.

It is a real daily Mishnayos class: one complete perek, taught live with clear visual material, stories, and on-demand review.

Free access is open through September 11.

[GET FREE ACCESS]
{{ custom_values.ot_landing_url }}

Mishnayos should not disappear when class ends.

Rabbi Eli Scheller

Move the same opportunity to Invitation Sent / Registration Opened and keep it Open.

WORKFLOW A5 — REGISTRATION HANDOFF

Exact name:
OT-AUD05 Registered Family Handoff

Folder:
10 - Audience & Reactivation

Trigger:
Contact field OT Has Current Family Account changes to Yes.

Allow Re-entry:
ON only when the platform can dedupe by the exact audience opportunity and current field transition. Otherwise OFF and report the limitation.

Actions:

- Find an existing open opportunity for this contact in Pipeline p1du4HGmVf3DL1LaAMBR.
- If exactly one exists, move that same opportunity to stage f79b0826-15fa-4024-aa26-221ea26df41e and mark Won.
- If none exists, do nothing.
- If more than one open Audience opportunity exists, do not choose silently; create an internal review task or report an ambiguity.
- Do not create the Family Lifecycle opportunity. The One Time application will create/update the household-scoped opportunity with OT Household ID.
- Send no email.

────────────────────────────────────────
PHASE 2D — FAMILY LIFECYCLE WORKFLOWS
────────────────────────────────────────

WORKFLOW F1 — UPDATE EXISTING OT-01 IN PLACE

Existing workflow:
OT-01 Family Account Confirmation

Existing workflow ID:
95a6f461-1a04-4260-b379-246fdcc45af7

Do not create a duplicate.

Folder:
Keep its current approved folder unless moving a Draft causes no dependency break. If safely movable, place in 20 - Family Lifecycle. Report what you did.

Trigger:
Preserve the current direct/API enrollment shape unless an exact existing product event trigger is already configured. Do not invent a public form trigger.

Settings:

- Draft
- Allow Re-entry OFF
- Allow Multiple Opportunities ON when enrollment is household-opportunity scoped; if direct/API enrollment cannot bind the opportunity, preserve current setting and report the exact limitation.
- From Rabbi Eli
- Reply-To Rabbi Eli

Subject:
Your One Time access is ready

Preheader:
Watch the short welcome video, then add your son’s Student login.

Body:

Hi {{contact.first_name}},

Your One Time Family account is ready—and you can already go inside and see how the learning works.

Start with the short welcome video at the top of your Parent account. It is the fastest way to see what makes One Time different.

Then add your son’s separate Student login when you are ready.

[OPEN ONE TIME]
{{ custom_values.ot_parent_companion_url }}

Your Family membership includes your Parent Companion account plus up to three Students.

Rabbi Eli Scheller
One Time Mishnayos
Mishnayos Made Memorable

Do not tell the Parent to create another account or sign in again.

WORKFLOW F2

Exact name:
OT-LC02 Parent Activated — Student Setup

Folder:
20 - Family Lifecycle

Trigger:
Opportunity enters Pipeline J07hIGecCCTi8xGD1p1I, stage 5c5efed3-78a4-4ebb-a6a4-7458d1f1c194.

Wait:
2 hours.

Before send require:

- opportunity is still in this stage;
- OT First Student Created At is empty;
- email is not suppressed/DND;
- the household opportunity has a nonempty OT Household ID.

Subject:
Now set up your son’s One Time login

Preheader:
You have seen One Time. His separate login takes one clear step.

Body:

Hi {{contact.first_name}},

You have already opened One Time and seen how the learning works.

Now create your son’s separate Student login. He will use his own username and six-digit PIN for class and recordings, while you manage resets and technical help from your Parent account.

[ADD YOUR FIRST STUDENT]
{{ custom_values.ot_add_student_url }}

Your Parent Companion account does not use one of the three Student places.

Rabbi Eli Scheller

WORKFLOW F3

Exact name:
OT-LC03 Student Created — First Learning

Folder:
20 - Family Lifecycle

Trigger:
Opportunity enters Pipeline J07hIGecCCTi8xGD1p1I, stage 062991e7-70f5-4e51-b07c-87b92c51e9e0.

Email 1 immediately.

Subject:
His login is ready—start with one class

Preheader:
Join live or begin with one recording.

Body:

Hi {{contact.first_name}},

Your son’s Student login is ready.

He does not have to start perfectly. Let him join part of the next live class or begin with one approved recording.

The first goal is simple: experience one complete perek taught clearly.

[OPEN THE STUDENT LOGIN]
{{ custom_values.ot_student_login_url }}

Rabbi Eli Scheller

Wait 24 hours.

Before Email 2 require:

- opportunity remains in Student Created — Not Yet Learning;
- OT First Student Learning Started At is empty;
- contact has not replied;
- not suppressed/DND.

Email 2

Subject:
One class is enough to begin

Body:

Hi {{contact.first_name}},

His account is ready. Now let him use it once.

Live or recorded. A full class or part of one. The important thing is to begin with the actual learning.

[START ONE CLASS]
{{ custom_values.ot_student_login_url }}

Rabbi Eli Scheller

WORKFLOW F4

Exact name:
OT-LC04 Activated Free — Build the Habit

Folder:
20 - Family Lifecycle

Trigger:
Opportunity enters Pipeline J07hIGecCCTi8xGD1p1I, stage 5f752777-ceba-40c0-8518-8a59929a5549.

Subject:
The next class is where the habit begins

Preheader:
He started. Now let him come back once more.

Body:

Hi {{contact.first_name}},

Your son has started learning in One Time.

That first class matters. Now the next class is where the rhythm begins.

We are not trying to create pressure. We are building a steady kinyan: one perek, clear and memorable, one class day at a time.

[SEE THE NEXT CLASS]
{{ custom_values.ot_parent_companion_url }}

You can reply directly if you want to discuss how to help him build the habit.

Rabbi Eli Scheller

WORKFLOW F5

Exact name:
OT-LC05 Engaged Free — Progress

Folder:
20 - Family Lifecycle

Trigger:
Opportunity enters Pipeline J07hIGecCCTi8xGD1p1I, stage 85579c03-30eb-4ac8-bcc3-23e72c922708.

Subject:
He is building something real

Preheader:
This is becoming a learning rhythm.

Body:

Hi {{contact.first_name}},

Your son has come back to One Time more than once.

That matters.

This is no longer just an account that someone opened. He is beginning to make a real kinyan—one perek, one class, and one clear accomplishment at a time.

[SEE HIS PROGRESS]
{{ custom_values.ot_parent_companion_url }}

Take part in building the biggest Mishnayos class in the world.

Rabbi Eli Scheller

Do not insert classes, days, perek count, streak, or badge merge values into this email unless HighLevel can truthfully suppress the sentence when that specific field is empty. If conditional rendering is unavailable, keep the generic approved copy above.

WORKFLOW F6

Exact name:
OT-LC06 Parent Activation Help

Folder:
20 - Family Lifecycle

Trigger:
Opportunity enters Pipeline J07hIGecCCTi8xGD1p1I, stage 729fba78-795a-49b7-b6df-63f63ceb7fbd.

Wait:
24 hours.

Before send require:

- opportunity remains in Family Account Created — Parent Not Activated;
- OT Parent Companion Activated At is empty;
- OT Parent Portal Opened At is empty or does not satisfy activation;
- not suppressed/DND.

Actions:

- Add tag: ot | needs help | parent activation.

Subject:
Let’s get your One Time access working

Preheader:
Reply directly if anything is unclear.

Body:

Hi {{contact.first_name}},

Your One Time account is open, but it looks like you have not gone inside yet.

Open your Parent account and watch the short welcome video at the top. It will show you exactly how One Time works.

If something is not working, reply directly to this email and tell us where you got stuck.

[OPEN ONE TIME]
{{ custom_values.ot_parent_companion_url }}

Rabbi Eli Scheller

Stop on Response:
ON

WORKFLOW F7

Exact name:
OT-LC07 Student Activation Help

Folder:
20 - Family Lifecycle

Trigger:
Opportunity enters Pipeline J07hIGecCCTi8xGD1p1I, stage 062991e7-70f5-4e51-b07c-87b92c51e9e0.

Wait:
72 hours.

Before send require:

- opportunity remains in Student Created — Not Yet Learning;
- OT First Student Learning Started At is empty;
- not suppressed/DND.

Actions:

- Add tag: ot | needs help | student login.

Subject:
Let’s get his One Time access working

Preheader:
Reply if the login or class access is giving you trouble.

Body:

Hi {{contact.first_name}},

Your son’s Student account exists, but it looks like he has not joined a class or started a recording yet.

Use the button below for the next step. If the login, PIN, or class access is not working, reply to this email and tell us exactly what is happening.

[CONTINUE SETUP]
{{ custom_values.ot_student_login_url }}

Rabbi Eli Scheller

Stop on Response:
ON

WORKFLOW F8 — BLOCKED UNTIL CHECKOUT URL

Exact planned name:
OT-LC08 Free Access Deadline

Do not create or edit this workflow’s email actions yet while OT Continue URL equals NEEDS_VERIFIED_GHL_CHECKOUT_ROUTE.

Return it as:
BLOCKED_ON_VERIFIED_CHECKOUT_ROUTE

Do not substitute the landing page or a guessed payment URL.

WORKFLOW F9

Exact name:
OT-LC09 Paid Active Welcome

Folder:
20 - Family Lifecycle

Trigger:
Opportunity enters Pipeline J07hIGecCCTi8xGD1p1I, stage 77462f7f-7c43-4a8c-a254-35c844805a84.

Subject:
Your One Time Family access is active

Preheader:
The learning continues.

Body:

Hi {{contact.first_name}},

Your One Time Family access is active.

The live class, recording library, Parent account, and your Student logins will continue without interruption.

The goal remains the same: one perek, clear and memorable, with a steady relationship to the learning and the Rebbe.

[SEE ONE TIME]
{{ custom_values.ot_parent_companion_url }}

Thank you for building this with us.

Rabbi Eli Scheller

WORKFLOW F10

Exact name:
OT-LC10 Grace — Payment Issue

Folder:
20 - Family Lifecycle

Trigger:
Opportunity enters Pipeline J07hIGecCCTi8xGD1p1I, stage 342236a7-d863-4414-80ed-19f061331011.

Because the secure repair/checkout URL is not yet verified, create the workflow shell in Draft but do not add a customer email action that contains a placeholder link.

Required sender when unblocked:
One Time Mishnayos <info@onetimeonetime.com>

Return:
BLOCKED_ON_VERIFIED_BILLING_REPAIR_ROUTE

WORKFLOW F11

Exact name:
OT-LC11 Canceled / Former Reactivation

Folder:
20 - Family Lifecycle

Trigger:
Opportunity enters Pipeline J07hIGecCCTi8xGD1p1I, stage 0dfde414-7de0-4fcd-a4c6-7040d4fa5141.

Status:
Draft only.

Do not enroll anyone until current marketing permission and suppression are verified.

Subject:
The door is open when you’re ready

Body:

Hi {{contact.first_name}},

Your One Time access has ended.

When the timing is right, the door remains open. Rabbi Scheller is continuing the daily Mishnayos rhythm—one perek, clear, visual, and available for review.

[RETURN TO ONE TIME]
{{ custom_values.ot_landing_url }}

Rabbi Eli Scheller

WORKFLOW F12 — WEEKLY PARENT PROGRESS DRAFT

Exact name:
OT-LC12 Weekly Parent Progress

Folder:
20 - Family Lifecycle

Status:
Draft

Schedule trigger:
Thursday at 12:00 in the contact/household timezone, only if the platform can truthfully use the contact timezone. If it cannot, do not guess; return the scheduling limitation.

Eligibility:

- a current Family Lifecycle opportunity exists in Engaged Free Family or Paid Active;
- email is not suppressed/DND;
- current newsletter/program permission is valid;
- household opportunity has a nonempty OT Household ID.

Allow Re-entry:
ON for the weekly schedule.

Allow Multiple Opportunities:
ON.

Stop on Response:
OFF. Replies are handled by OT-R01.

Subject:
This week in One Time

Preheader:
What was learned, what is next, and what your son is building.

Body:

Hi {{contact.first_name}},

This week in One Time, the boys continued building Mishnayos one clear perek at a time.

Open your Parent account to see the latest schedule, progress, updates, and Family-visible accomplishments.

[SEE THIS WEEK IN ONE TIME]
{{ custom_values.ot_parent_updates_url }}

A real Rebbe. A steady schedule. Real progress.

Rabbi Eli Scheller
One Time Mishnayos

Do not insert private Student questions, another household’s information, or empty statistics.

────────────────────────────────────────
PHASE 2E — REPLY ROUTING
────────────────────────────────────────

Update the existing workflow in place:

Current exact name:
OT-R01 Customer Replied - Internal Routing

Do not create a duplicate.

Place it in:
30 - Reply Routing

Status:
Draft

Trigger:
Customer Replied
Channel: Email

Allow Re-entry:
ON, because the same adult may reply more than once.

Actions:

1. Do not send an automatic customer response.
2. Keep the thread in HighLevel Conversations.
3. If the reply is associated with an invitation, Rabbi program, Parent activation, Student activation, progress, continuation, or reactivation workflow:
   - add tag `ot | conversation | rabbi`;
   - assign to Eli Scheller, user ID u8P655S0QhE0KMowRVtA;
   - send one internal notification to Eli Scheller.
4. If the reply is associated with security, PIN reset, login failure, technical incident, payment failure, or account-service workflow:
   - add tag `ot | conversation | support`;
   - identify the existing Solomon/Shloimie sub-account user ID;
   - assign to that existing user;
   - send one internal notification.
5. If the message class cannot be determined safely:
   - leave the existing assignment unchanged;
   - add no speculative category;
   - create an internal review task or leave it Unassigned for manual triage.
6. Never create a Student contact.
7. Do not activate Conversation AI or an automatic AI response.
8. Do not change Reply Address, forwarding, or two-way sync.

Return the exact Solomon/Shloimie user ID used or report that it could not be verified.

────────────────────────────────────────
PHASE 2F — ZERO-WRITE HISTORICAL MIGRATION PREVIEW
────────────────────────────────────────

Do not create, clone, move, or update any opportunity in this phase.

Build a sanitized migration preview for the 1,377 opportunities currently in Pipeline RTTGVfbMv5aM92BQqklL.

Proposed mapping for preview only:

- Warm Leads, stage d4a0adcc-627d-4557-b963-da0950050748, observed 1,257
  → Audience & Reactivation / Warm Lead

- Free Event / Tisha B'Av Signups, stage 3081e713-e3ec-4d9f-81a2-868a1d5ff056, observed 38
  → Audience & Reactivation / Prior Event / Prior Interest
  → preserve/add tag `ot | cohort | prior event`

- Old App — Active, stage 05900897-e5b0-472a-b89d-70978f29f825, observed 27
  → Audience & Reactivation / Old App — Active

- Old App — Inactive, stage a262b166-c2f3-4b2a-9306-a7b79d8555e1, observed 53
  → Audience & Reactivation / Old App — Inactive

- New Funnel / Pre-Registered, stage d5324bf9-2bf4-4094-8609-9e9179830193, observed 0
  → no action

- Active Member, stage b87ce5c3-d877-4009-99bd-6012da7e455d, observed 2
  → DO NOT INFER PAID ACTIVE
  → require One Time/Stripe/current-access reconciliation
  → report as manual/product-truth review

- Canceled / Lost, stage bb4af305-fedd-42e4-8307-98767b0945b5, observed 0
  → no action

For each source group, return counts only for:

- total source opportunities;
- unique adult contact IDs;
- duplicate source opportunities for the same contact;
- contacts already having an opportunity in Pipeline A;
- contacts already having a household opportunity in Pipeline B;
- OT Has Current Family Account = Yes;
- email DND/suppressed;
- missing/invalid email;
- valid current marketing permission;
- ambiguous/conflicting contact records;
- eligible for future Audience opportunity creation;
- excluded and exact reason.

Do not include customer names, emails, phones, or message content in the report.

Produce an exact proposed Phase 3 plan showing:

- idempotency/dedupe key;
- whether the future action would create a new opportunity or reuse an existing one;
- cohort/source field mapping;
- tags to preserve/add;
- rollback method;
- batch size;
- stop conditions;
- operator-owned canary plan;
- broad-run authorization phrase that would still be required.

Do not execute Phase 3.

────────────────────────────────────────
FINAL SAVE/REOPEN READBACK
────────────────────────────────────────

After building Phase 2:

- save every field/custom-value change;
- save every workflow;
- reopen every workflow;
- verify exact trigger, pipeline/stage ID, filters, waits, sender, Reply-To, CTA, Stop on Response, Allow Re-entry, Allow Multiple Opportunities, and Draft status;
- verify no unresolved placeholder appears in any active email action;
- verify OT-LC08 and OT-LC10 are blocked rather than containing guessed URLs;
- verify OT-01 and OT-R01 were updated in place, not duplicated;
- verify no customer was enrolled;
- verify no email was sent;
- verify no opportunity was created/moved;
- verify no workflow was published;
- verify no routing or billing setting changed.

RETURN ONE COMPLETE REPORT

1. Updated custom-value IDs and final values.
2. New welcome-video field IDs and fieldKeys.
3. Every workflow name and exact ID.
4. Folder and Draft status.
5. Exact trigger and pipeline/stage IDs.
6. Exact email count per workflow.
7. Exact subjects and CTA merge tags.
8. Sender and Reply-To readback.
9. Re-entry, multiple-opportunity, and Stop-on-Response settings.
10. OT-01 in-place update proof.
11. OT-R01 in-place update proof.
12. Rabbi assignment and support-user assignment IDs.
13. Blocked workflow list and blocker.
14. Sanitized 1,377-opportunity migration preview.
15. Proposed Phase 3 canary and rollback.
16. Contacts enrolled: 0.
17. Customer emails sent: 0.
18. Opportunities created/moved: 0.
19. Workflows published: 0.
20. Student contacts created: 0.
21. One exact next action required from Shloimie.
```
