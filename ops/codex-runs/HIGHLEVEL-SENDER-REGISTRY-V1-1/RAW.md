# ONE TIME HIGHLEVEL — SENDER REGISTRY CONVERGENCE AND PINNED AGENT MODE HANDOFF

Execute the task. Do not return another audit or recommendation.

## Repository

Canonical repository:

shloimie-beep/onetimev2

Do not use:

webcraft-media/onetimev2

## Correct base

The current HighLevel API and Agent Mode queue is:

PR #99
branch: codex/highlevel-api-finalize-agent-queue
known head when this prompt was written:
1000e8f46210a85f720f83fce2678b24a44fa94d

Fetch PR #99 and use its actual current descendant head.

Do not base this work directly on PR #93. PR #99 already contains the latest API reconciliation, contact-import safeguards, and 14-job Agent Mode queue.

## Branch

Create one clean isolated worktree and branch:

codex/highlevel-sender-registry-v1-1

Open a draft PR against:

codex/highlevel-api-finalize-agent-queue

Do not start from main.

## Mission

Create the missing canonical HighLevel sender, message-class, pipeline, and event registries.

Then:

1. update every workflow prompt and checklist to use registered sender keys;
2. update the bot and knowledge-base dependencies;
3. use the HighLevel API for every supported safe asset;
4. regenerate the Agent Mode queue;
5. produce one complete Agent Mode execution prompt pinned to an immutable registry commit;
6. push everything;
7. do not send messages or publish workflows.

The blocked Agent Mode report was correct:

SENDER_VALUES: BLOCKED(push sender-registry PR and supply pinned SHA)
PIPELINES: BLOCKED(required pipeline registry missing)

This task removes that blocker.

## Safety

Do not:

- send email, WhatsApp or SMS;
- publish a workflow;
- activate the Conversation AI bot;
- enroll imported contacts;
- create Student contacts;
- change live payment state;
- alter production Railway;
- print PIT, contact data, private destinations or secrets;
- activate rabbi@ before it is tested;
- create Human Handoff;
- create human tasks for OT-A1.

API writes are authorized for:

- canonical HighLevel custom values;
- canonical contact fields and tags when missing;
- pipelines and stages when supported;
- registry reconciliation.

Use location:

pBSnOK2nkdxp6gf9Rg3o

## Registry version

Update the HighLevel schema from:

1.0.0

to:

1.1.0

Preserve all existing IDs and compatibility aliases.

Create:

integrations/highlevel/registry/sender-registry.yaml
integrations/highlevel/registry/message-class-registry.yaml
integrations/highlevel/registry/pipeline-registry.yaml
integrations/highlevel/registry/event-registry.yaml
integrations/highlevel/registry/communications-contract.json

Update:

integrations/highlevel/registry/current.json
integrations/highlevel/registry/schema.yaml
integrations/highlevel/registry/custom-values.yaml
integrations/highlevel/registry/workflow-registry.yaml
integrations/highlevel/registry/bot-action-registry.yaml
integrations/highlevel/registry/prompt-registry.yaml
integrations/highlevel/registry/knowledge-base-registry.yaml
integrations/highlevel/registry/AGENT-HANDOFF.md
integrations/highlevel/workflows.yaml
integrations/highlevel/CHANGELOG.md

## Canonical communications boundary

HighLevel is the One Time source of truth for:

- adult/parent contacts;
- customer conversations;
- campaigns;
- business workflows;
- replies;
- suppression;
- opportunities;
- customer-support and Torah-question processing state.

One Time is the source of truth for:

- authentication;
- passwords and secure tokens;
- households;
- learners;
- Parent and Student portals;
- entitlement;
- classes;
- Vimeo;
- Zoom;
- progress;
- gamification;
- original portal submissions.

Resend is limited to:

- activation/setup links;
- password reset;
- email verification;
- Administrator login challenge;
- security-token email.

Telegram is Rabbi Eli Scheller’s private interface for assigned Torah questions and Rabbi-authored content.

Telegram is not a separate customer transcript.

## Human ownership

Default customer-communication owner:

Shloimie

Rabbi Eli Scheller receives only:

- substantive Torah questions;
- Mishnah questions;
- halachic questions requiring Rabbi authorship;
- Rabbi-authored Torah newsletters;
- Rabbi-authored warm enrollment content.

Do not route these to Rabbi:

- login;
- password help;
- billing;
- cancellation;
- refund;
- technical support;
- scheduling;
- class-link problems;
- parent administration;
- ordinary enrollment logistics;
- complaints;
- unknown messages;
- generic replies.

## Sender registry

Create these exact sender keys.

### rabbi_campaign

Purpose:

- warm enrollment campaigns;
- Torah newsletters;
- Rabbi-authored teaching emails;
- Rabbi-authored event invitations.

Phase 1:

display_name:
Rabbi Eli Scheller | One Time Mishnayos

from_email:
info@onetimeonetime.com

reply_to:
info@onetimeonetime.com

status:
active_phase_1

Phase 2:

display_name:
Rabbi Eli Scheller | One Time Mishnayos

from_email:
rabbi@onetimeonetime.com

reply_to:
info@onetimeonetime.com

status:
pending_mailbox_and_reply_acceptance

Do not activate phase 2 until:

1. rabbi@ mailbox or routing exists;
2. HighLevel accepts the From address;
3. a seed delivers;
4. a reply reaches GHL Conversations;
5. the result is recorded.

### rabbi_personal

display_name:
Rabbi Eli Scheller

from_email:
rabbi@onetimeonetime.com

reply_to:
info@onetimeonetime.com

owner:
Rabbi authors through Telegram; Shloimie retains visibility

status:
pending_mailbox_and_reply_acceptance

### office

display_name:
Shloimie from One Time Mishnayos

from_email:
info@onetimeonetime.com

reply_to:
info@onetimeonetime.com

status:
active

### brand

display_name:
One Time Mishnayos

from_email:
info@onetimeonetime.com

reply_to:
info@onetimeonetime.com

status:
active

### account_security

display_name:
One Time Mishnayos Account

preferred_from_email:
account@onetimeonetime.com

current_fallback_from_email:
info@onetimeonetime.com

provider:
Resend

status:
preferred_address_pending_domain_acceptance

Do not claim account@ is live until verified.

## Message-class registry

Register every customer email class.

### Rabbi campaign / GHL

- warm_enrollment_campaign
- existing_subscriber_migration
- prelaunch_nurture
- torah_newsletter
- rabbi_teaching_email
- rabbi_event_invitation

### Rabbi personal / GHL

- torah_answer
- torah_follow_up

### Office / GHL

- support_reply
- access_help
- billing_help
- payment_failed_support
- cancellation_help
- refund_help
- complaint_reply
- parent_administration_reply

### Brand / GHL

- signup_confirmation
- event_registration_confirmation
- event_reminder
- class_reminder
- schedule_change
- recording_available
- new_video_available
- worksheet_available
- portal_welcome
- portal_activated
- payment_receipt
- cancellation_confirmation
- support_acknowledgement

### Account security / Resend

- activation_token
- password_setup
- password_reset
- email_verification
- login_challenge
- security_notice

Every canonical workflow must reference one message class and one sender key.

No workflow may contain an unregistered sender identity.

## Pipeline registry

Create or reconcile:

### One Time Enrollment and Conversion

Stages:

- Warm Lead
- Contacted
- Engaged
- Signup Started
- Signed Up
- Active Member
- Not Now
- Unqualified

### One Time Member Support

Stages:

- New
- Triaged
- In Progress
- Waiting on Member
- Waiting on External Fix
- Resolved
- Closed

### One Time Torah Questions

Stages:

- New
- Shloimie Review
- Assigned to Rabbi
- Rabbi Reviewing
- Answer Sent
- Waiting on Follow-Up
- Closed

The existing:

One Time Business

pipeline remains a compatibility alias until existing opportunities are mapped.

Do not delete or silently migrate existing opportunities in this lane.

Use the HighLevel API to create/reconcile the three pipelines and stages when the current API supports it.

When API rate limiting occurs:

- retry with bounded exponential backoff;
- respect Retry-After;
- do not treat failed reads as missing assets;
- do not create duplicates;
- record a safe API result.

When an operation remains UI-only, create an Agent Mode job.

## Event registry

Register:

event_code:
tisha-bav-2026

Canonical workflow:

OT-E01 Tisha B'Av 2026 Registration and Reminders

Canonical campaign:

OT-C01 Tisha B'Av 2026 Warm Invitation

Event invitation sender:

rabbi_campaign

Registration/reminder sender:

brand or rabbi_campaign according to the approved prompt version.

Preserve event tags and values from the Tisha B'Av lane when already present.

Do not duplicate them.

## Workflow sender mapping

Update all canonical workflow prompt files and checklists.

### rabbi_campaign

- OT-02A Existing Subscriber Migration 2026 v1
- OT-02B New Lead Nurture v1
- OT-C01 Tisha B'Av 2026 Warm Invitation
- future Torah newsletters

### brand

- OT-04 Payment Active confirmation
- OT-07 Parent Portal companion/welcome
- OT-08 Parent Portal Activated
- OT-09 Parent Class Reminder
- OT-10 New Recording Available
- OT-E01 event registration/reminders unless explicitly Rabbi-authored
- signup confirmations
- schedule notices
- content notices

### office

- OT-05 Payment Failed / Grace
- OT-06 Subscription Canceled when support context is needed
- OT-13 Refund / Chargeback
- customer-support replies

### account_security / Resend

- secure activation/setup
- password reset
- email verification
- Administrator challenge

Split OT-07 explicitly:

1. GHL sends the companion/welcome email.
2. One Time/Resend sends the secure activation token.

GHL must never store or send the activation/reset token.

## OT-A1 bot

Preserve one canonical bot:

OT-A1 One Time Enrollment Assistant

Channels:

- Website Live Chat
- WhatsApp

Voice remains deferred.

Default operational owner:

Shloimie

Only explicit substantive Torah questions route to:

One Time Torah Questions

Do not create:

- Human Handoff;
- human tasks;
- separate WhatsApp qualification bot;
- duplicate lead workflows;
- automatic promise that a person will reply.

Fallback remains:

I do not have that information confirmed. Please email info@onetimeonetime.com.

## Telegram contract

Create:

integrations/highlevel/registry/rabbi-telegram-contract.yaml

Register:

one_time_rabbi_torah_console

Allowed:

- list assigned Torah questions;
- open question;
- accept Rabbi text or voice response;
- produce a preview;
- save draft;
- send confirmed reply through the same GHL conversation;
- return question to Shloimie;
- close question;
- draft Torah newsletter;
- draft warm enrollment email;
- show campaign audience and suppression results;
- trigger an approved campaign only after explicit confirmation.

Forbidden:

- general support queue;
- technical issues;
- billing;
- parent administration;
- independent AI Torah answers;
- independent bulk audience selection;
- separate Telegram transcript;
- vague bulk-send command.

## Custom values

Create/reconcile registered sender custom values.

Suggested folder:

One Time - Senders

Values:

- One Time Rabbi Campaign Sender Name
- One Time Rabbi Campaign Phase 1 From
- One Time Rabbi Campaign Phase 2 From
- One Time Rabbi Personal Sender Name
- One Time Rabbi Personal From
- One Time Office Sender Name
- One Time Office From
- One Time Brand Sender Name
- One Time Brand From
- One Time Account Sender Name
- One Time Account Preferred From
- One Time Default Reply-To

Do not delete the existing generic sender values.

Mark them as compatibility aliases and map them to the appropriate canonical sender.

Use the HighLevel API to create the custom values when supported.

Do not activate unresolved addresses.

## Prompt updates

Update every workflow AI prompt and checklist under:

integrations/highlevel/ai-workflow-prompts/
integrations/highlevel/workflow-checklists/

Also update:

integrations/highlevel/prompts/active/
integrations/highlevel/agent-prompts/
integrations/highlevel/knowledge-bases/active/

Each workflow prompt must contain:

- message_class;
- sender_key;
- exact workflow;
- exact folder;
- exact trigger;
- no-send/no-publish default;
- dependency on the registry;
- exact custom values selected from the picker;
- prohibition on guessed sender text.

## Agent Mode queue regeneration

Update:

integrations/highlevel/agent-mode/GHL-AGENT-MODE-QUEUE.json
integrations/highlevel/agent-mode/GHL-AGENT-MODE-EXPORT.json

Add ordered jobs:

- create sender custom-value folder;
- reconcile sender values;
- create/reconcile pipelines;
- update workflow sender identities;
- update OT-A1;
- verify sending domain;
- phase-1 seed;
- office seed;
- brand seed;
- capture workflow IDs;
- capture pipeline IDs;
- save/readback;
- phase-2 rabbi@ acceptance, blocked until prerequisites pass.

Every job must instruct Agent Mode to:

1. use the pinned registry commit;
2. perform only registered actions;
3. click Save;
4. reopen and verify;
5. capture safe IDs;
6. return to Agent Action drop-off;
7. save the result;
8. verify readback;
9. never finish with a chat-only completion claim.

## Immutable Agent Mode handoff

Use a two-commit process.

### Commit A — canonical registry

Commit all sender, message-class, pipeline, workflow and prompt changes.

Record Commit A SHA.

This SHA is the immutable registry SHA.

### Commit B — Agent Mode handoff

Generate:

integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md
integrations/highlevel/agent-mode/GHL-SENDER-UI-JOB.private.template.json

The executor prompt must embed:

- repository;
- PR;
- branch;
- Commit A immutable SHA;
- exact registry paths;
- exact GHL location;
- exact job order;
- save/readback behavior.

Commit only the prompt/template in Commit B.

Push both commits.

The Agent Mode source-of-truth SHA is Commit A.

Do not require the operator to edit or paste a SHA manually.

## Validation

Run:

- canonical registry validation;
- duplicate sender detection;
- duplicate pipeline detection;
- message-class coverage validation;
- workflow sender dependency validation;
- Agent Mode queue validation;
- prompt dependency validation;
- bounded HighLevel API reconciliation;
- typecheck;
- lint;
- secret scan;
- git diff --check.

Do not run the full product browser suite.

## Final response

Begin exactly:

HIGHLEVEL_SCHEMA_VERSION: 1.1.0
SENDER_REGISTRY: COMPLETE | BLOCKED(<one exact action>)
MESSAGE_CLASS_REGISTRY: COMPLETE | BLOCKED(<reason>)
PIPELINE_REGISTRY: COMPLETE | BLOCKED(<reason>)
SENDER_CUSTOM_VALUES_API: COMPLETE | PARTIAL | BLOCKED(<reason>)
PIPELINES_API: COMPLETE | PARTIAL | BLOCKED(<reason>)
WORKFLOW_PROMPTS_UPDATED: <count>/<total>
AGENT_MODE_EXECUTOR: READY | BLOCKED(<reason>)
MESSAGES_SENT: 0

Then include exactly:

- branch;
- PR;
- Commit A immutable registry SHA;
- Commit B final branch head;
- sender registry path;
- pipeline registry path;
- pinned Agent Mode executor path;
- GHL API asset IDs created;
- one exact unresolved action.

Also paste the complete contents of:

integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md

into the final response so the operator can copy it once into Agent Mode.

Do not end with another recommendation.