# ONE TIME HIGHLEVEL BOT + CANONICAL SCHEMA CONVERGENCE

You are receiving this in the existing Codex window working on the One Time HighLevel integration and contact import.

Finish any atomic command currently running. Preserve all completed contact imports, field IDs, tag IDs, pipeline IDs, mappings, protected files, and current worktree state.

Do not create another HighLevel foundation.

## Repository and current lane

Repository:

webcraft-media/onetimev2

Current HighLevel branch:

codex/highlevel-business-foundation

Current stacked draft PR:

#93

Known pushed head when this instruction was prepared:

0ddd2b8d5ba769a7988b187347ebdc9c00eb1ab3

Fetch and use the actual current descendant head. The running session may be ahead of the pushed PR.

Canonical release branch:

codex/one-time-finish-now-20260719

Do not start from main.

## Mission

Create and enforce one canonical, versioned One Time HighLevel schema for:

- contact fields;
- tags;
- custom values;
- form mappings;
- bot actions;
- business workflows;
- contact imports;
- workflow prompts;
- Conversation AI prompts;
- knowledge bases;
- future prompts received from other GPT/Codex agents.

Then reconcile the bot specification named:

ghl-one-time-rabbi-scheller-bot-paste-pack(1).md

against that canonical schema.

Do not accept the incoming pack unchanged.

Correct it, version it, and store both the raw incoming version and the approved active version.

Continue or reconcile the current contact import. Do not import the same contacts twice.

Do not send messages, enroll contacts into workflows, publish a bot, charge a payment method, or mutate Stripe in this task.

## Binding decisions

1. There will be one public One Time enrollment/support bot:
   OT-A1 One Time Enrollment Assistant

2. Channels for the initial bot:
   - Website Live Chat
   - WhatsApp

3. Voice AI is deferred.

4. The bot itself performs public lead qualification and common support routing.

5. Do not create a separate WhatsApp lead-qualification bot or workflow.

6. No Human Handoff workflow.

7. No human task creation.

8. When the bot cannot answer an approved question, it says that the information is not confirmed and gives:
   info@onetimeonetime.com

9. Do not promise that a person will follow up automatically.

10. Do not expose or collect:
    - Student passwords;
    - Student usernames;
    - private Student data;
    - raw Zoom links;
    - raw Vimeo links;
    - activation/reset tokens;
    - payment-card data;
    - internal IDs;
    - secrets.

11. Do not proactively state a price.

12. Do not hardcode $67 in the bot, knowledge base, workflows, or migration emails.

13. Price may be shown only when:
    - One Time Pricing Display Status equals published; and
    - One Time Published Price Label contains the current approved value.

14. Existing-subscriber migration is a separate three-email workflow. It is not the public lead-capture bot.

15. HighLevel owns parent/lead CRM, marketing, WhatsApp conversations, business workflows and payment state.

16. One Time owns Parent/Student authentication, households, learners, portals, learning access, Vimeo, Zoom, progress and gamification.

17. Never create a Student contact or Student custom field in HighLevel.

## Canonical repository structure

Create or normalize:

integrations/highlevel/
  workflows.yaml
  README.md
  CHANGELOG.md
  registry/
    schema.yaml
    custom-fields.yaml
    custom-values.yaml
    tag-taxonomy.yaml
    form-field-map.yaml
    workflow-registry.yaml
    bot-action-registry.yaml
    prompt-registry.yaml
    knowledge-base-registry.yaml
    deprecations.yaml
    current.json
    AGENT-HANDOFF.md
  prompts/
    incoming/
    candidates/
    active/
    superseded/
  knowledge-bases/
    incoming/
    active/
    superseded/
  agent-mode/
    HIGHLEVEL-BOT-UI-SETUP.md
  imports/
    README.md

Create:

scripts/highlevel/validate-registry.ts
scripts/highlevel/export-current-registry.ts
scripts/highlevel/reconcile-assets.ts
scripts/highlevel/reconcile-contact-import.ts

Add package scripts:

highlevel:registry:check
highlevel:registry:export
highlevel:assets:reconcile
highlevel:contacts:reconcile

## Canonical schema metadata

Use:

schema_id: one-time-highlevel
schema_version: 1.0.0
status: active

Every registered asset records:

- canonical name;
- normalized name;
- GHL ID;
- GHL key;
- object type;
- data type;
- category;
- purpose;
- source of truth;
- allowed values;
- workflows allowed to write it;
- One Time allowed to write it;
- whether humans may edit it;
- dependencies;
- aliases;
- deprecation state;
- created date;
- last verified date;
- last tested date.

Do not create an unregistered asset.

Do not invent a new spelling for an existing asset.

## Standard GHL fields

Use standard HighLevel fields when available:

- First Name
- Last Name
- Full Name
- Email
- Phone
- City
- Country
- Time Zone

Do not create duplicate One Time versions of these fields unless a real requirement exists.

## Canonical contact fields

Preserve all existing field IDs.

### Identity and linking

- One Time CRM Contact ID
- One Time Parent ID
- One Time Household ID

### Lifecycle and billing

- One Time Customer Status
- One Time Current Period End
- One Time Subscription ID
- One Time Grace Until
- One Time Complimentary Until
- One Time Early Access Status
- One Time Migration Status
- One Time Migration Sequence Version

Allowed One Time Customer Status:

- Lead
- Prelaunch
- Migration Invited
- Checkout Started
- Active
- Grace
- Canceled
- Former
- Complimentary
- Refunded
- Chargeback

Allowed One Time Early Access Status:

- Not Invited
- Invited
- Activated
- Declined
- Expired

Allowed One Time Migration Status:

- Not Started
- Sequence Active
- Sequence Complete
- Activated
- Opted Out

### Portal and access

- One Time Portal Status
- One Time Access Status

Allowed One Time Portal Status:

- Not Invited
- Invited
- Active
- Suspended
- Disabled

Allowed One Time Access Status:

- Inactive
- Active
- Grace
- Complimentary
- Suspended

A GHL field or tag is not authorization for One Time portal access.

### Consent and communication

- One Time Email Consent
- One Time WhatsApp Consent
- One Time Reminder Preference
- One Time Consent Policy Version
- One Time Consent Captured At
- One Time Suppression State
- One Time Suppression Reason
- One Time Newsletter Status

Allowed One Time Email Consent:

- opted_in
- service_only_current_subscriber
- unknown
- opted_out
- suppressed

Allowed One Time WhatsApp Consent:

- opted_in
- unknown
- opted_out
- suppressed

Allowed One Time Reminder Preference:

- Email
- WhatsApp
- Both
- None

Allowed One Time Suppression State:

- active
- email_suppressed
- whatsapp_suppressed
- all_marketing_suppressed

Allowed One Time Newsletter Status:

- Not Eligible
- Eligible
- Subscribed
- Unsubscribed
- Suppressed

### Attribution and import

- One Time Signup Source
- One Time Source Channel
- One Time Source Classification
- One Time Import Batch
- One Time Audience Type
- One Time Family or School Name
- One Time Last Sync

Allowed One Time Source Channel:

- Website
- Website Chat
- WhatsApp
- GHL Import
- One Time CRM
- Voice

Voice is reserved but not active.

Allowed One Time Audience Type:

- Family
- School

### Bot operation

- One Time Bot Request Type
- One Time Preferred Delivery
- One Time Signup Status

Allowed One Time Bot Request Type:

- General Question
- Signup
- Next Class Info
- Member Login
- Password Help
- Opt-Out
- Billing Question
- Unresolved

Allowed One Time Preferred Delivery:

- Email
- WhatsApp

Allowed One Time Signup Status:

- Collecting
- Submitted
- Confirmed
- Link Sent
- Failed

Do not create Human Review as a bot outcome.

### Classes and content

- One Time Next Class At
- One Time Class Time Zone

## Canonical tags

Preserve every existing verified ID.

### Lifecycle

- OT | Lead
- OT | Prelaunch
- OT | Existing Subscriber
- OT | Migration 2026
- OT | Early Access Invited
- OT | Early Access Activated
- OT | Checkout Started
- OT | Active
- OT | Grace
- OT | Canceled
- OT | Former
- OT | Complimentary

### Migration sequence

- OT | Migration Email 1 Sent
- OT | Migration Email 2 Sent
- OT | Migration Email 3 Sent
- OT | Migration Sequence Complete

### Portal

- OT | Portal Invited
- OT | Portal Active

### Consent and communication

- OT | Email Opt-In
- OT | WhatsApp Opt-In
- OT | Consent Unknown
- OT | Marketing Suppressed
- OT | Weekly Newsletter

### Source

- OT | Signup Website
- OT | Signup WhatsApp
- OT | Source | Rabbi Followers
- OT | Source | Subscribed Audience
- OT | Source | Cleaned Audience
- OT | Source | Legacy Subscriber
- OT | Source | Existing One Time CRM

### Billing

- OT | Payment Failed
- OT | Refunded
- OT | Chargeback

### Classes and content

- OT | Class Reminder Pending
- OT | Recording Available

### Data quality

- OT | Duplicate Merged
- OT | Identity Conflict

Do not create:

- OT | Human Follow-Up
- one-time-human-handoff
- Student tags
- free-form AI-generated tags
- tags that duplicate a canonical field state without a workflow need.

## Deprecate the incoming lowercase tag family

Inventory contacts and workflows using these older tags:

- one-time
- one-time-bot
- one-time-signup-request
- one-time-signup-submitted
- one-time-signup-confirmed
- one-time-class-link-request
- one-time-password-reset
- one-time-human-handoff
- one-time-opt-out

Map them:

one-time:
- no canonical replacement required;
- preserve only when needed for historical reporting;
- mark deprecated.

one-time-bot:
- replace with One Time Source Channel;
- mark deprecated.

one-time-signup-request:
- replace with One Time Signup Status = Collecting or Submitted.

one-time-signup-submitted:
- replace with One Time Signup Status = Submitted.

one-time-signup-confirmed:
- replace with One Time Signup Status = Confirmed.

one-time-class-link-request:
- replace with One Time Bot Request Type = Next Class Info.

one-time-password-reset:
- replace with One Time Bot Request Type = Password Help.

one-time-human-handoff:
- no replacement;
- disable and remove from active workflows.

one-time-opt-out:
- replace with:
  - OT | Marketing Suppressed;
  - channel DND;
  - consent field update;
  - suppression field update.

Do not delete historical tags until contact migration is reconciled.

## Canonical custom values

Use these folders:

One Time — Brand
One Time — URLs
One Time — Offer
One Time — Class
One Time — Support
One Time — Bot

### One Time — Brand

One Time Brand Name:
One Time Mishnayos

One Time Rabbi Name:
Rabbi Eli Scheller

One Time Sender Name:
One Time Mishnayos

One Time Sender Email:
info@onetimeonetime.com

One Time Reply-To Email:
info@onetimeonetime.com

One Time Program Short Description:
A live hybrid Mishnayos experience from Eretz Yisrael designed to build consistency, accountability, understanding, and excitement in Torah learning.

### One Time — URLs

One Time Home URL:
https://join.onetimeonetime.com/

One Time Signup URL:
https://join.onetimeonetime.com/signup

One Time Member Login URL:
https://join.onetimeonetime.com/login

One Time Password Help URL:
https://join.onetimeonetime.com/forgot-password

One Time Parent Portal URL:
https://join.onetimeonetime.com/app/parent

One Time Student Portal URL:
https://join.onetimeonetime.com/app/student

One Time Early Access URL:
Use the current accepted signup or early-access route. Do not guess.

One Time Checkout URL:
Use the verified HighLevel checkout URL when created. Leave pending until real.

One Time Recording Portal URL:
Inspect the accepted protected portal route. Do not use a raw Vimeo URL.

One Time WhatsApp Entry URL:
Use the verified QR-linked WhatsApp entry URL when configured.

### One Time — Offer

One Time Complimentary Access Label:
A complimentary month of early access

One Time Promotion Status:
Use active or inactive based on the accepted current offer.

One Time Promotion End Date Label:
Use only an accepted current date. Do not copy an old date automatically.

One Time Pricing Display Status:
hidden

One Time Published Price Label:
Leave blank until Pricing Display Status is published.

### One Time — Class

One Time Default Time Zone:
Asia/Jerusalem

One Time Class Time Israel:
7:00 p.m. Israel time

One Time Schedule Notice:
Leave blank unless an approved schedule notice exists.

### One Time — Support

One Time Support Email:
info@onetimeonetime.com

### One Time — Bot

One Time Public Bot Name:
OT-A1 One Time Enrollment Assistant

One Time Public Bot Version:
1.0.0

One Time Knowledge Base Version:
1.0.0

Record actual GHL custom-value IDs and generated keys.

## Canonical workflow registry

### Keep as business workflows

- OT-01 New Lead Intake
- OT-02A Existing Subscriber Migration 2026 v1
- OT-02B New Lead Nurture v1
- OT-03 Checkout Started / Abandoned
- OT-04 Payment Active
- OT-05 Payment Failed / Grace
- OT-06 Subscription Canceled
- OT-07 Parent Portal Invitation
- OT-08 Parent Portal Activated
- OT-09 Parent Class Reminder
- OT-10 New Recording Available
- OT-13 Refund / Chargeback

### Create as bot-action workflows

- OT-B01 Complete Signup
- OT-B02 Send Next Confirmed Class Info
- OT-B03 Send Member Login
- OT-B04 Send Password Help
- OT-B05 Apply Opt-Out

### Deprecate or disable

- OT-11 WhatsApp Lead Qualification
- OT-12 Support Intake / Technical Escalation when it creates tasks
- OT - Human Handoff
- duplicate Complete Signup workflows
- duplicate lead-capture workflows
- older One Time Enrollment Concierge bots
- older One Time Enrollment Assistant bots
- any workflow that asks the same lead questions already handled by OT-A1
- any workflow that independently creates a second contact or opportunity after OT-B01

Do not delete workflows with execution history.

For each duplicate:

1. disable or unpublish;
2. rename with prefix:
   [DEPRECATED]
3. record workflow ID;
4. record superseded_by;
5. record last execution date;
6. confirm no active bot still references it.

## Bot-action workflow contracts

### OT-B01 Complete Signup

Triggered only by OT-A1 after the adult contact details are complete.

Required:

- adult name;
- Family or School;
- location;
- email;
- reminder preference;
- phone when WhatsApp or Both;
- explicit channel consent when applicable.

Do not collect Student details.

Use a protected typed HighLevel-to-One-Time adapter when available.

The adapter maps GHL values to the current One Time lead contract and calls the current One Time signup service idempotently.

Do not preserve the old oversized BNA payload.

The canonical One Time fields are:

- contact_name
- family_or_school
- audience_type
- location
- timezone
- browser_timezone
- email
- phone
- reminder_preference
- reminder_consent
- consent_context
- idempotency_key
- attribution

If no protected adapter exists, implement one under the HighLevel integration router rather than putting complex consent logic into the bot prompt.

The adapter must:

- authenticate the GHL request;
- derive the One Time account/product server-side;
- validate location ID;
- map enum values;
- map explicit consent;
- apply rate limits and idempotency;
- call the same canonical lead service;
- return no private contact data;
- never create a Student contact.

After success:

- One Time Signup Status = Confirmed;
- OT | Lead;
- source tag;
- consent tags only when explicit;
- OT-01 New Lead Intake may be triggered once.

Do not send a duplicate confirmation if One Time already queues one.

### OT-B02 Send Next Confirmed Class Info

Do not store a permanent Zoom link in GHL.

Use a protected One Time adapter that returns or sends only safe current class information.

Preferred output:

- next confirmed class time;
- timezone;
- One Time portal URL;
- whether the Join Class button is currently available.

Never return:

- host URL;
- raw permanent Zoom link;
- ZAK;
- Meeting SDK secret;
- reusable passcode.

When current class information is unavailable, the bot says:

“I don’t have a confirmed class update available right now. Please check the One Time portal or email info@onetimeonetime.com.”

Do not create a human task.

### OT-B03 Send Member Login

Send:

https://join.onetimeonetime.com/login

Use the normal channel selected by the contact.

Do not claim that the account is active.

### OT-B04 Send Password Help

Send:

https://join.onetimeonetime.com/forgot-password

Do not call the obsolete:

/api/one-time/parent-password/request

Do not ask for or expose a password, token, or code.

Use the privacy-safe message:

“If that email is registered for One Time, the password-help page can send a secure reset link.”

### OT-B05 Apply Opt-Out

When the contact says STOP, unsubscribe, remove me, do not contact me, wrong number, or equivalent:

- set the relevant channel DND;
- update the relevant consent field to opted_out;
- update suppression fields;
- remove the related opt-in tag;
- add OT | Marketing Suppressed when appropriate;
- remove the contact from marketing/nurture workflows;
- stop bot auto-follow-up.

Send one confirmation only.

## Canonical bot

Bot ID:

OT-A1

Bot name:

One Time Enrollment Assistant

Bot type:

Prompt-Based Conversation AI

Initial channels:

- Website Live Chat
- WhatsApp

Voice:

Deferred

No Human Handover action.

No task-creation action.

No support-escalation workflow.

Fallback:

“I don’t have that information confirmed. Please email info@onetimeonetime.com.”

## Canonical bot behavior

The bot helps an adult:

- understand One Time;
- join early access;
- complete signup;
- choose email/WhatsApp reminders;
- find the Member Login;
- find Password Help;
- see the next confirmed class information;
- find the latest recording through the protected portal;
- find the current checkout link when published;
- opt out.

It does not:

- provide Torah rulings;
- pretend to be Rabbi Scheller;
- invent class information;
- invent price;
- collect child-sensitive details;
- reset a password itself;
- expose private provider links;
- promise a human follow-up;
- mix BNA Academy data with One Time.

## Canonical public knowledge base

Create:

One Time Mishnayos — Public Program and Support

Create active version:

1.0.0

Base it on the incoming bot paste pack, with these corrections:

- use the standalone One Time URLs;
- no hardcoded price;
- no outdated BNA workspace routing;
- no Human Handoff;
- no old lowercase tag names;
- no old password-reset API;
- no raw class link;
- no Student data collection;
- no Voice AI launch requirement;
- complimentary access described through current custom values;
- schedule and promotion details read from current custom values.

Required public facts:

- One Time Mishnayos is taught live by Rabbi Eli Scheller from Eretz Yisrael.
- The experience is designed to build consistency, accountability, understanding and excitement in Torah learning.
- Students can interact live with Rabbi Scheller.
- The system includes separate Parent and Student experiences.
- Class recordings, progress, rewards and review may be available through the One Time portal.
- The normal class time is read from the approved class custom value.
- The next confirmed class state comes from One Time, not static bot knowledge.
- The public signup is for an adult parent, guardian, family or school contact.
- The bot never collects a Student password or detailed child information.
- The bot never provides halachic advice.
- Member Login uses the canonical login custom value.
- Password Help uses the canonical password-help custom value.
- Current price is not proactively stated.
- Billing information comes from the verified checkout/payment system.
- One Time and BNA Academy records remain separate.

## Store the incoming and corrected prompts

Preserve the raw incoming file as:

integrations/highlevel/prompts/incoming/ghl-one-time-rabbi-scheller-bot-paste-pack-2026-07-20.md

Record its SHA-256.

Create the corrected candidate:

integrations/highlevel/prompts/candidates/OT-A1-v1.0.0.md

Create the approved active prompt only after registry validation:

integrations/highlevel/prompts/active/OT-A1-v1.0.0.md

Create the active knowledge base:

integrations/highlevel/knowledge-bases/active/one-time-public-kb-v1.0.0.md

Create a structured correction report:

integrations/highlevel/registry/bot-pack-corrections.yaml

It must list:

- retained sections;
- modified sections;
- removed sections;
- route corrections;
- tag/field mappings;
- workflow deprecations;
- pricing corrections;
- password-help correction;
- human-task removal.

## Prompt version registry

Every workflow, bot and knowledge-base prompt records:

- prompt_id;
- semantic version;
- status:
  - incoming
  - candidate
  - approved
  - active
  - superseded
- title;
- SHA-256;
- source;
- created date;
- approved date;
- GHL asset ID;
- required fields;
- required tags;
- required custom values;
- required workflows;
- test contact reference;
- last-tested date;
- supersedes;
- superseded_by.

Never overwrite the active version when another GPT or Codex agent returns a new prompt.

Store it under incoming and generate a structured diff.

## Contact import reconciliation

Another task in this same lane may be actively importing contacts.

Do not restart the import.

Before any write:

1. inspect current live GHL contact count;
2. inspect protected import manifest;
3. inspect One Time-to-GHL contact map;
4. inspect completed batch IDs;
5. identify whether import is:
   - not started;
   - in progress;
   - completed;
   - partially failed.

Dedupe order:

1. existing recorded GHL contact ID;
2. normalized email;
3. normalized phone;
4. never name alone.

Preserve unrelated existing tags.

Do not enroll imported contacts into workflows.

Do not send messages.

Do not create Student contacts.

Record only sanitized counts and fingerprints.

## Agent handoff

Create:

integrations/highlevel/registry/AGENT-HANDOFF.md

It must begin:

“Before creating or changing a One Time HighLevel field, tag, custom value, workflow, form mapping, bot prompt, knowledge base or contact import, read the canonical registry under integrations/highlevel/registry/. Do not create an unregistered asset.”

Include the canonical bot/workflow boundaries.

## Product decision record

Store this user direction under:

ops/product-decisions/2026-07-20-ghl-public-bot/

Create:

ORIGINAL-DIRECTION.md
DECISIONS.json
SUMMARY.md

Record:

- one public bot;
- Website Live Chat and WhatsApp;
- no Voice launch;
- no Human Handoff workflow;
- no human tasks;
- no duplicate lead-qualification workflow;
- no price proactively stated;
- canonical schema required before workflow creation;
- imported contacts must not be reimported;
- Student data excluded from GHL;
- future agent prompts are versioned and diffed.

## Validation

Run:

- duplicate normalized field-name check;
- duplicate tag check;
- duplicate custom-value check;
- workflow semantic-overlap check;
- stale bot reference check;
- prompt dependency check;
- public URL check;
- old route/reference scan;
- old lowercase tag scan;
- import reconciliation;
- registry schema validation;
- typecheck;
- lint;
- secret scan;
- focused tests;
- git diff check.

## Completion

Commit and push the current HighLevel branch.

Keep PR #93 draft.

Final response must begin:

HIGHLEVEL_SCHEMA_VERSION: 1.0.0
CANONICAL_BOT: OT-A1 One Time Enrollment Assistant
BOT_PROMPT_STATUS: ACTIVE | CANDIDATE | BLOCKED(<one action>)
CONTACT_IMPORT_STATUS: NOT_STARTED | IN_PROGRESS | COMPLETE | PARTIAL
CONTACTS_CREATED: <count>
CONTACTS_UPDATED: <count>
CONTACT_CONFLICTS: <count>
DUPLICATE_WORKFLOWS_DISABLED: <count>
HUMAN_TASK_WORKFLOWS_ACTIVE: 0
MESSAGES_SENT: 0

Then include:

- branch/head/PR;
- registry paths;
- field/tag/custom-value counts;
- bot-action workflow status;
- protected import paths without contents;
- one exact unresolved action;
- no broad report.
