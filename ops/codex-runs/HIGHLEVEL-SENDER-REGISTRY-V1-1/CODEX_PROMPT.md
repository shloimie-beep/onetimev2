# CODEX PROMPT - SPEC-20260721-001

Spec fingerprint: f9ae235ee4556b9e9cc633e3ffe7b1181c0639e4869645bfdf2d2fefedc44877
Raw source: ops/codex-runs/HIGHLEVEL-SENDER-REGISTRY-V1-1/RAW.md
Raw SHA-256: 4d21cf954d5ed121d3d184387c2a1ce68bd08c9bd93c0b99db3d9f7146ccfdc3
Workspace/project: one_time / highlevel_sender_registry_v1_1
Routes: integrations/highlevel/registry, integrations/highlevel/ai-workflow-prompts, integrations/highlevel/workflow-checklists, integrations/highlevel/prompts/active, integrations/highlevel/agent-prompts, integrations/highlevel/knowledge-bases/active, integrations/highlevel/agent-mode, scripts/highlevel

## Operating Order

VERBATIM RAW -> ATOMIC SPEC -> CHANGE RECEIPT -> AMBIGUITY RESOLUTION -> PQC -> GENERATED CODEX PACKET -> IMPLEMENTATION -> ASSERTIONS/EVIDENCE

Report implementation status and evidence per change ID. Do not implement changes outside these IDs.

## Scoped Files / Routes

- ops/action-registry.json
- ops/route-registry.json

## Included Changes

### CHG-20260721-001
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > # ONE TIME HIGHLEVEL — SENDER REGISTRY CONVERGENCE AND PINNED AGENT MODE HANDOFF > # ONE TIME HIGHLEVEL — SENDER REGISTRY CONVERGENCE AND PINNED AGENT MODE HANDOFF
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: # ONE TIME HIGHLEVEL — SENDER REGISTRY CONVERGENCE AND PINNED AGENT MODE HANDOFF
- Exact payload: {"verbatim_requirement":"# ONE TIME HIGHLEVEL — SENDER REGISTRY CONVERGENCE AND PINNED AGENT MODE HANDOFF"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: # ONE TIME HIGHLEVEL — SENDER REGISTRY CONVERGENCE AND PINNED AGENT MODE HANDOFF
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S01 [0, 80]: "# ONE TIME HIGHLEVEL — SENDER REGISTRY CONVERGENCE AND PINNED AGENT MODE HANDOFF"
- Positive assertions:
  - CHG-20260721-001-POS-001: The implementation and evidence satisfy this exact source atom: # ONE TIME HIGHLEVEL — SENDER REGISTRY CONVERGENCE AND PINNED AGENT MODE HANDOFF
  - CHG-20260721-001-POS-FULL-RAW: Full raw authority preserved verbatim for hard-signal coverage:
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
- Negative assertions:
  - CHG-20260721-001-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: # ONE TIME HIGHLEVEL — SENDER REGISTRY CONVERGENCE AND PINNED AGENT MODE HANDOFF

### CHG-20260721-002
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Execute the task. > Execute the task.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Execute the task.
- Exact payload: {"verbatim_requirement":"Execute the task."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Execute the task.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S02 [84, 101]: "Execute the task."
- Positive assertions:
  - CHG-20260721-002-POS-001: The implementation and evidence satisfy this exact source atom: Execute the task.
- Negative assertions:
  - CHG-20260721-002-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Execute the task.

### CHG-20260721-003
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Do not return another audit or recommendation. > Do not return another audit or recommendation.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Do not return another audit or recommendation.
- Exact payload: {"verbatim_requirement":"Do not return another audit or recommendation."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Do not return another audit or recommendation.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S03 [102, 148]: "Do not return another audit or recommendation."
- Positive assertions:
  - CHG-20260721-003-POS-001: The implementation and evidence satisfy this exact source atom: Do not return another audit or recommendation.
- Negative assertions:
  - CHG-20260721-003-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Do not return another audit or recommendation.

### CHG-20260721-004
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ## Repository > ## Repository
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ## Repository
- Exact payload: {"verbatim_requirement":"## Repository"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ## Repository
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S04 [152, 165]: "## Repository"
- Positive assertions:
  - CHG-20260721-004-POS-001: The implementation and evidence satisfy this exact source atom: ## Repository
- Negative assertions:
  - CHG-20260721-004-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ## Repository

### CHG-20260721-005
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Canonical repository: > Canonical repository:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Canonical repository:
- Exact payload: {"verbatim_requirement":"Canonical repository:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Canonical repository:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S05 [169, 190]: "Canonical repository:"
- Positive assertions:
  - CHG-20260721-005-POS-001: The implementation and evidence satisfy this exact source atom: Canonical repository:
- Negative assertions:
  - CHG-20260721-005-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Canonical repository:

### CHG-20260721-006
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > shloimie-beep/onetimev2 > shloimie-beep/onetimev2
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: shloimie-beep/onetimev2
- Exact payload: {"verbatim_requirement":"shloimie-beep/onetimev2"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: shloimie-beep/onetimev2
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S06 [194, 217]: "shloimie-beep/onetimev2"
- Positive assertions:
  - CHG-20260721-006-POS-001: The implementation and evidence satisfy this exact source atom: shloimie-beep/onetimev2
- Negative assertions:
  - CHG-20260721-006-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: shloimie-beep/onetimev2

### CHG-20260721-007
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Do not use: > Do not use:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Do not use:
- Exact payload: {"verbatim_requirement":"Do not use:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Do not use:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S07 [221, 232]: "Do not use:"
- Positive assertions:
  - CHG-20260721-007-POS-001: The implementation and evidence satisfy this exact source atom: Do not use:
- Negative assertions:
  - CHG-20260721-007-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Do not use:

### CHG-20260721-008
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > webcraft-media/onetimev2 > webcraft-media/onetimev2
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: webcraft-media/onetimev2
- Exact payload: {"verbatim_requirement":"webcraft-media/onetimev2"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: webcraft-media/onetimev2
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S08 [236, 260]: "webcraft-media/onetimev2"
- Positive assertions:
  - CHG-20260721-008-POS-001: The implementation and evidence satisfy this exact source atom: webcraft-media/onetimev2
- Negative assertions:
  - CHG-20260721-008-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: webcraft-media/onetimev2

### CHG-20260721-009
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ## Correct base > ## Correct base
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ## Correct base
- Exact payload: {"verbatim_requirement":"## Correct base"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ## Correct base
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S09 [264, 279]: "## Correct base"
- Positive assertions:
  - CHG-20260721-009-POS-001: The implementation and evidence satisfy this exact source atom: ## Correct base
- Negative assertions:
  - CHG-20260721-009-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ## Correct base

### CHG-20260721-010
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > The current HighLevel API and Agent Mode queue is: > The current HighLevel API and Agent Mode queue is:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: The current HighLevel API and Agent Mode queue is:
- Exact payload: {"verbatim_requirement":"The current HighLevel API and Agent Mode queue is:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: The current HighLevel API and Agent Mode queue is:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S10 [283, 333]: "The current HighLevel API and Agent Mode queue is:"
- Positive assertions:
  - CHG-20260721-010-POS-001: The implementation and evidence satisfy this exact source atom: The current HighLevel API and Agent Mode queue is:
- Negative assertions:
  - CHG-20260721-010-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: The current HighLevel API and Agent Mode queue is:

### CHG-20260721-011
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > PR #99 > PR #99
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: PR #99
- Exact payload: {"verbatim_requirement":"PR #99"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: PR #99
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S11 [337, 343]: "PR #99"
- Positive assertions:
  - CHG-20260721-011-POS-001: The implementation and evidence satisfy this exact source atom: PR #99
- Negative assertions:
  - CHG-20260721-011-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: PR #99

### CHG-20260721-012
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > branch: codex/highlevel-api-finalize-agent-queue > branch: codex/highlevel-api-finalize-agent-queue
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: branch: codex/highlevel-api-finalize-agent-queue
- Exact payload: {"verbatim_requirement":"branch: codex/highlevel-api-finalize-agent-queue"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: branch: codex/highlevel-api-finalize-agent-queue
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S12 [345, 393]: "branch: codex/highlevel-api-finalize-agent-queue"
- Positive assertions:
  - CHG-20260721-012-POS-001: The implementation and evidence satisfy this exact source atom: branch: codex/highlevel-api-finalize-agent-queue
- Negative assertions:
  - CHG-20260721-012-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: branch: codex/highlevel-api-finalize-agent-queue

### CHG-20260721-013
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > known head when this prompt was written: > known head when this prompt was written:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: known head when this prompt was written:
- Exact payload: {"verbatim_requirement":"known head when this prompt was written:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: known head when this prompt was written:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S13 [395, 435]: "known head when this prompt was written:"
- Positive assertions:
  - CHG-20260721-013-POS-001: The implementation and evidence satisfy this exact source atom: known head when this prompt was written:
- Negative assertions:
  - CHG-20260721-013-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: known head when this prompt was written:

### CHG-20260721-014
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > 1000e8f46210a85f720f83fce2678b24a44fa94d > 1000e8f46210a85f720f83fce2678b24a44fa94d
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: 1000e8f46210a85f720f83fce2678b24a44fa94d
- Exact payload: {"verbatim_requirement":"1000e8f46210a85f720f83fce2678b24a44fa94d"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: 1000e8f46210a85f720f83fce2678b24a44fa94d
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S14 [437, 477]: "1000e8f46210a85f720f83fce2678b24a44fa94d"
- Positive assertions:
  - CHG-20260721-014-POS-001: The implementation and evidence satisfy this exact source atom: 1000e8f46210a85f720f83fce2678b24a44fa94d
- Negative assertions:
  - CHG-20260721-014-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: 1000e8f46210a85f720f83fce2678b24a44fa94d

### CHG-20260721-015
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Fetch PR #99 and use its actual current descendant head. > Fetch PR #99 and use its actual current descendant head.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Fetch PR #99 and use its actual current descendant head.
- Exact payload: {"verbatim_requirement":"Fetch PR #99 and use its actual current descendant head."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Fetch PR #99 and use its actual current descendant head.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S15 [481, 537]: "Fetch PR #99 and use its actual current descendant head."
- Positive assertions:
  - CHG-20260721-015-POS-001: The implementation and evidence satisfy this exact source atom: Fetch PR #99 and use its actual current descendant head.
- Negative assertions:
  - CHG-20260721-015-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Fetch PR #99 and use its actual current descendant head.

### CHG-20260721-016
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Do not base this work directly on PR #93. > Do not base this work directly on PR #93.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Do not base this work directly on PR #93.
- Exact payload: {"verbatim_requirement":"Do not base this work directly on PR #93."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Do not base this work directly on PR #93.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S16 [541, 582]: "Do not base this work directly on PR #93."
- Positive assertions:
  - CHG-20260721-016-POS-001: The implementation and evidence satisfy this exact source atom: Do not base this work directly on PR #93.
- Negative assertions:
  - CHG-20260721-016-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Do not base this work directly on PR #93.

### CHG-20260721-017
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > PR #99 already contains the latest API reconciliation, contact-import safeguards, and 14-job Agent Mode queue. > PR #99 already contains the latest API reconciliation, contact-import safeguards, and 14-job Agent Mode queue.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: PR #99 already contains the latest API reconciliation, contact-import safeguards, and 14-job Agent Mode queue.
- Exact payload: {"verbatim_requirement":"PR #99 already contains the latest API reconciliation, contact-import safeguards, and 14-job Agent Mode queue."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: PR #99 already contains the latest API reconciliation, contact-import safeguards, and 14-job Agent Mode queue.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S17 [583, 693]: "PR #99 already contains the latest API reconciliation, contact-import safeguards, and 14-job Agent Mode queue."
- Positive assertions:
  - CHG-20260721-017-POS-001: The implementation and evidence satisfy this exact source atom: PR #99 already contains the latest API reconciliation, contact-import safeguards, and 14-job Agent Mode queue.
- Negative assertions:
  - CHG-20260721-017-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: PR #99 already contains the latest API reconciliation, contact-import safeguards, and 14-job Agent Mode queue.

### CHG-20260721-018
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ## Branch > ## Branch
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ## Branch
- Exact payload: {"verbatim_requirement":"## Branch"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ## Branch
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S18 [697, 706]: "## Branch"
- Positive assertions:
  - CHG-20260721-018-POS-001: The implementation and evidence satisfy this exact source atom: ## Branch
- Negative assertions:
  - CHG-20260721-018-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ## Branch

### CHG-20260721-019
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Create one clean isolated worktree and branch: > Create one clean isolated worktree and branch:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Create one clean isolated worktree and branch:
- Exact payload: {"verbatim_requirement":"Create one clean isolated worktree and branch:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Create one clean isolated worktree and branch:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S19 [710, 756]: "Create one clean isolated worktree and branch:"
- Positive assertions:
  - CHG-20260721-019-POS-001: The implementation and evidence satisfy this exact source atom: Create one clean isolated worktree and branch:
- Negative assertions:
  - CHG-20260721-019-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Create one clean isolated worktree and branch:

### CHG-20260721-020
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > codex/highlevel-sender-registry-v1-1 > codex/highlevel-sender-registry-v1-1
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: codex/highlevel-sender-registry-v1-1
- Exact payload: {"verbatim_requirement":"codex/highlevel-sender-registry-v1-1"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: codex/highlevel-sender-registry-v1-1
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S20 [760, 796]: "codex/highlevel-sender-registry-v1-1"
- Positive assertions:
  - CHG-20260721-020-POS-001: The implementation and evidence satisfy this exact source atom: codex/highlevel-sender-registry-v1-1
- Negative assertions:
  - CHG-20260721-020-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: codex/highlevel-sender-registry-v1-1

### CHG-20260721-021
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Open a draft PR against: > Open a draft PR against:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Open a draft PR against:
- Exact payload: {"verbatim_requirement":"Open a draft PR against:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Open a draft PR against:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S21 [800, 824]: "Open a draft PR against:"
- Positive assertions:
  - CHG-20260721-021-POS-001: The implementation and evidence satisfy this exact source atom: Open a draft PR against:
- Negative assertions:
  - CHG-20260721-021-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Open a draft PR against:

### CHG-20260721-022
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > codex/highlevel-api-finalize-agent-queue > codex/highlevel-api-finalize-agent-queue
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: codex/highlevel-api-finalize-agent-queue
- Exact payload: {"verbatim_requirement":"codex/highlevel-api-finalize-agent-queue"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: codex/highlevel-api-finalize-agent-queue
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S22 [828, 868]: "codex/highlevel-api-finalize-agent-queue"
- Positive assertions:
  - CHG-20260721-022-POS-001: The implementation and evidence satisfy this exact source atom: codex/highlevel-api-finalize-agent-queue
- Negative assertions:
  - CHG-20260721-022-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: codex/highlevel-api-finalize-agent-queue

### CHG-20260721-023
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Do not start from main. > Do not start from main.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Do not start from main.
- Exact payload: {"verbatim_requirement":"Do not start from main."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Do not start from main.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S23 [872, 895]: "Do not start from main."
- Positive assertions:
  - CHG-20260721-023-POS-001: The implementation and evidence satisfy this exact source atom: Do not start from main.
- Negative assertions:
  - CHG-20260721-023-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Do not start from main.

### CHG-20260721-024
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ## Mission > ## Mission
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ## Mission
- Exact payload: {"verbatim_requirement":"## Mission"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ## Mission
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S24 [899, 909]: "## Mission"
- Positive assertions:
  - CHG-20260721-024-POS-001: The implementation and evidence satisfy this exact source atom: ## Mission
- Negative assertions:
  - CHG-20260721-024-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ## Mission

### CHG-20260721-025
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Create the missing canonical HighLevel sender, message-class, pipeline, and event registries. > Create the missing canonical HighLevel sender, message-class, pipeline, and event registries.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Create the missing canonical HighLevel sender, message-class, pipeline, and event registries.
- Exact payload: {"verbatim_requirement":"Create the missing canonical HighLevel sender, message-class, pipeline, and event registries."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Create the missing canonical HighLevel sender, message-class, pipeline, and event registries.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S25 [913, 1006]: "Create the missing canonical HighLevel sender, message-class, pipeline, and event registries."
- Positive assertions:
  - CHG-20260721-025-POS-001: The implementation and evidence satisfy this exact source atom: Create the missing canonical HighLevel sender, message-class, pipeline, and event registries.
- Negative assertions:
  - CHG-20260721-025-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Create the missing canonical HighLevel sender, message-class, pipeline, and event registries.

### CHG-20260721-026
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Then: > Then:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Then:
- Exact payload: {"verbatim_requirement":"Then:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Then:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S26 [1010, 1015]: "Then:"
- Positive assertions:
  - CHG-20260721-026-POS-001: The implementation and evidence satisfy this exact source atom: Then:
- Negative assertions:
  - CHG-20260721-026-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Then:

### CHG-20260721-027
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > update every workflow prompt and checklist to use registered sender keys > update every workflow prompt and checklist to use registered sender keys
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: update every workflow prompt and checklist to use registered sender keys
- Exact payload: {"verbatim_requirement":"update every workflow prompt and checklist to use registered sender keys"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: update every workflow prompt and checklist to use registered sender keys
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S27 [1022, 1094]: "update every workflow prompt and checklist to use registered sender keys"
- Positive assertions:
  - CHG-20260721-027-POS-001: The implementation and evidence satisfy this exact source atom: update every workflow prompt and checklist to use registered sender keys
- Negative assertions:
  - CHG-20260721-027-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: update every workflow prompt and checklist to use registered sender keys

### CHG-20260721-028
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > update the bot and knowledge-base dependencies > update the bot and knowledge-base dependencies
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: update the bot and knowledge-base dependencies
- Exact payload: {"verbatim_requirement":"update the bot and knowledge-base dependencies"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: update the bot and knowledge-base dependencies
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S28 [1100, 1146]: "update the bot and knowledge-base dependencies"
- Positive assertions:
  - CHG-20260721-028-POS-001: The implementation and evidence satisfy this exact source atom: update the bot and knowledge-base dependencies
- Negative assertions:
  - CHG-20260721-028-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: update the bot and knowledge-base dependencies

### CHG-20260721-029
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > use the HighLevel API for every supported safe asset > use the HighLevel API for every supported safe asset
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: use the HighLevel API for every supported safe asset
- Exact payload: {"verbatim_requirement":"use the HighLevel API for every supported safe asset"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: use the HighLevel API for every supported safe asset
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S29 [1152, 1204]: "use the HighLevel API for every supported safe asset"
- Positive assertions:
  - CHG-20260721-029-POS-001: The implementation and evidence satisfy this exact source atom: use the HighLevel API for every supported safe asset
- Negative assertions:
  - CHG-20260721-029-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: use the HighLevel API for every supported safe asset

### CHG-20260721-030
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > regenerate the Agent Mode queue > regenerate the Agent Mode queue
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: regenerate the Agent Mode queue
- Exact payload: {"verbatim_requirement":"regenerate the Agent Mode queue"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: regenerate the Agent Mode queue
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S30 [1210, 1241]: "regenerate the Agent Mode queue"
- Positive assertions:
  - CHG-20260721-030-POS-001: The implementation and evidence satisfy this exact source atom: regenerate the Agent Mode queue
- Negative assertions:
  - CHG-20260721-030-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: regenerate the Agent Mode queue

### CHG-20260721-031
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > produce one complete Agent Mode execution prompt pinned to an immutable registry commit > produce one complete Agent Mode execution prompt pinned to an immutable registry commit
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: produce one complete Agent Mode execution prompt pinned to an immutable registry commit
- Exact payload: {"verbatim_requirement":"produce one complete Agent Mode execution prompt pinned to an immutable registry commit"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: produce one complete Agent Mode execution prompt pinned to an immutable registry commit
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S31 [1247, 1334]: "produce one complete Agent Mode execution prompt pinned to an immutable registry commit"
- Positive assertions:
  - CHG-20260721-031-POS-001: The implementation and evidence satisfy this exact source atom: produce one complete Agent Mode execution prompt pinned to an immutable registry commit
- Negative assertions:
  - CHG-20260721-031-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: produce one complete Agent Mode execution prompt pinned to an immutable registry commit

### CHG-20260721-032
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > push everything > push everything
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: push everything
- Exact payload: {"verbatim_requirement":"push everything"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: push everything
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S32 [1340, 1355]: "push everything"
- Positive assertions:
  - CHG-20260721-032-POS-001: The implementation and evidence satisfy this exact source atom: push everything
- Negative assertions:
  - CHG-20260721-032-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: push everything

### CHG-20260721-033
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > do not send messages or publish workflows. > do not send messages or publish workflows.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: do not send messages or publish workflows.
- Exact payload: {"verbatim_requirement":"do not send messages or publish workflows."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: do not send messages or publish workflows.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S33 [1361, 1403]: "do not send messages or publish workflows."
- Positive assertions:
  - CHG-20260721-033-POS-001: The implementation and evidence satisfy this exact source atom: do not send messages or publish workflows.
- Negative assertions:
  - CHG-20260721-033-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: do not send messages or publish workflows.

### CHG-20260721-034
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > The blocked Agent Mode report was correct: > The blocked Agent Mode report was correct:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: The blocked Agent Mode report was correct:
- Exact payload: {"verbatim_requirement":"The blocked Agent Mode report was correct:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: The blocked Agent Mode report was correct:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S34 [1407, 1449]: "The blocked Agent Mode report was correct:"
- Positive assertions:
  - CHG-20260721-034-POS-001: The implementation and evidence satisfy this exact source atom: The blocked Agent Mode report was correct:
- Negative assertions:
  - CHG-20260721-034-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: The blocked Agent Mode report was correct:

### CHG-20260721-035
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > SENDER_VALUES: BLOCKED(push sender-registry PR and supply pinned SHA) > SENDER_VALUES: BLOCKED(push sender-registry PR and supply pinned SHA)
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: SENDER_VALUES: BLOCKED(push sender-registry PR and supply pinned SHA)
- Exact payload: {"verbatim_requirement":"SENDER_VALUES: BLOCKED(push sender-registry PR and supply pinned SHA)"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: SENDER_VALUES: BLOCKED(push sender-registry PR and supply pinned SHA)
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S35 [1453, 1522]: "SENDER_VALUES: BLOCKED(push sender-registry PR and supply pinned SHA)"
- Positive assertions:
  - CHG-20260721-035-POS-001: The implementation and evidence satisfy this exact source atom: SENDER_VALUES: BLOCKED(push sender-registry PR and supply pinned SHA)
- Negative assertions:
  - CHG-20260721-035-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: SENDER_VALUES: BLOCKED(push sender-registry PR and supply pinned SHA)

### CHG-20260721-036
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > PIPELINES: BLOCKED(required pipeline registry missing) > PIPELINES: BLOCKED(required pipeline registry missing)
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: PIPELINES: BLOCKED(required pipeline registry missing)
- Exact payload: {"verbatim_requirement":"PIPELINES: BLOCKED(required pipeline registry missing)"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: PIPELINES: BLOCKED(required pipeline registry missing)
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S36 [1524, 1578]: "PIPELINES: BLOCKED(required pipeline registry missing)"
- Positive assertions:
  - CHG-20260721-036-POS-001: The implementation and evidence satisfy this exact source atom: PIPELINES: BLOCKED(required pipeline registry missing)
- Negative assertions:
  - CHG-20260721-036-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: PIPELINES: BLOCKED(required pipeline registry missing)

### CHG-20260721-037
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > This task removes that blocker. > This task removes that blocker.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: This task removes that blocker.
- Exact payload: {"verbatim_requirement":"This task removes that blocker."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: This task removes that blocker.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S37 [1582, 1613]: "This task removes that blocker."
- Positive assertions:
  - CHG-20260721-037-POS-001: The implementation and evidence satisfy this exact source atom: This task removes that blocker.
- Negative assertions:
  - CHG-20260721-037-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: This task removes that blocker.

### CHG-20260721-038
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ## Safety > ## Safety
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ## Safety
- Exact payload: {"verbatim_requirement":"## Safety"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ## Safety
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S38 [1617, 1626]: "## Safety"
- Positive assertions:
  - CHG-20260721-038-POS-001: The implementation and evidence satisfy this exact source atom: ## Safety
- Negative assertions:
  - CHG-20260721-038-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ## Safety

### CHG-20260721-039
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Do not: > Do not:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Do not:
- Exact payload: {"verbatim_requirement":"Do not:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Do not:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S39 [1630, 1637]: "Do not:"
- Positive assertions:
  - CHG-20260721-039-POS-001: The implementation and evidence satisfy this exact source atom: Do not:
- Negative assertions:
  - CHG-20260721-039-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Do not:

### CHG-20260721-040
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - send email, WhatsApp or SMS > - send email, WhatsApp or SMS
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - send email, WhatsApp or SMS
- Exact payload: {"verbatim_requirement":"- send email, WhatsApp or SMS"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - send email, WhatsApp or SMS
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S40 [1641, 1670]: "- send email, WhatsApp or SMS"
- Positive assertions:
  - CHG-20260721-040-POS-001: The implementation and evidence satisfy this exact source atom: - send email, WhatsApp or SMS
- Negative assertions:
  - CHG-20260721-040-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - send email, WhatsApp or SMS

### CHG-20260721-041
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - publish a workflow > - publish a workflow
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - publish a workflow
- Exact payload: {"verbatim_requirement":"- publish a workflow"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - publish a workflow
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S41 [1673, 1693]: "- publish a workflow"
- Positive assertions:
  - CHG-20260721-041-POS-001: The implementation and evidence satisfy this exact source atom: - publish a workflow
- Negative assertions:
  - CHG-20260721-041-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - publish a workflow

### CHG-20260721-042
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - activate the Conversation AI bot > - activate the Conversation AI bot
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - activate the Conversation AI bot
- Exact payload: {"verbatim_requirement":"- activate the Conversation AI bot"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - activate the Conversation AI bot
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S42 [1696, 1730]: "- activate the Conversation AI bot"
- Positive assertions:
  - CHG-20260721-042-POS-001: The implementation and evidence satisfy this exact source atom: - activate the Conversation AI bot
- Negative assertions:
  - CHG-20260721-042-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - activate the Conversation AI bot

### CHG-20260721-043
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - enroll imported contacts > - enroll imported contacts
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - enroll imported contacts
- Exact payload: {"verbatim_requirement":"- enroll imported contacts"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - enroll imported contacts
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S43 [1733, 1759]: "- enroll imported contacts"
- Positive assertions:
  - CHG-20260721-043-POS-001: The implementation and evidence satisfy this exact source atom: - enroll imported contacts
- Negative assertions:
  - CHG-20260721-043-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - enroll imported contacts

### CHG-20260721-044
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - create Student contacts > - create Student contacts
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - create Student contacts
- Exact payload: {"verbatim_requirement":"- create Student contacts"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - create Student contacts
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S44 [1762, 1787]: "- create Student contacts"
- Positive assertions:
  - CHG-20260721-044-POS-001: The implementation and evidence satisfy this exact source atom: - create Student contacts
- Negative assertions:
  - CHG-20260721-044-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - create Student contacts

### CHG-20260721-045
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - change live payment state > - change live payment state
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - change live payment state
- Exact payload: {"verbatim_requirement":"- change live payment state"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - change live payment state
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S45 [1790, 1817]: "- change live payment state"
- Positive assertions:
  - CHG-20260721-045-POS-001: The implementation and evidence satisfy this exact source atom: - change live payment state
- Negative assertions:
  - CHG-20260721-045-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - change live payment state

### CHG-20260721-046
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - alter production Railway > - alter production Railway
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - alter production Railway
- Exact payload: {"verbatim_requirement":"- alter production Railway"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - alter production Railway
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S46 [1820, 1846]: "- alter production Railway"
- Positive assertions:
  - CHG-20260721-046-POS-001: The implementation and evidence satisfy this exact source atom: - alter production Railway
- Negative assertions:
  - CHG-20260721-046-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - alter production Railway

### CHG-20260721-047
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - print PIT, contact data, private destinations or secrets > - print PIT, contact data, private destinations or secrets
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - print PIT, contact data, private destinations or secrets
- Exact payload: {"verbatim_requirement":"- print PIT, contact data, private destinations or secrets"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - print PIT, contact data, private destinations or secrets
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S47 [1849, 1907]: "- print PIT, contact data, private destinations or secrets"
- Positive assertions:
  - CHG-20260721-047-POS-001: The implementation and evidence satisfy this exact source atom: - print PIT, contact data, private destinations or secrets
- Negative assertions:
  - CHG-20260721-047-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - print PIT, contact data, private destinations or secrets

### CHG-20260721-048
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - activate rabbi@ before it is tested > - activate rabbi@ before it is tested
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - activate rabbi@ before it is tested
- Exact payload: {"verbatim_requirement":"- activate rabbi@ before it is tested"}
- Placement: parent=The exact registry, workflow, queue, commit, or response section named in the source atom.; before=; after=; order=Preserve the exact positional or ordering relationship stated in the source atom.
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - activate rabbi@ before it is tested
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S48 [1910, 1947]: "- activate rabbi@ before it is tested"
- Positive assertions:
  - CHG-20260721-048-POS-001: The implementation and evidence satisfy this exact source atom: - activate rabbi@ before it is tested
- Negative assertions:
  - CHG-20260721-048-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - activate rabbi@ before it is tested

### CHG-20260721-049
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - create Human Handoff > - create Human Handoff
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - create Human Handoff
- Exact payload: {"verbatim_requirement":"- create Human Handoff"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - create Human Handoff
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S49 [1950, 1972]: "- create Human Handoff"
- Positive assertions:
  - CHG-20260721-049-POS-001: The implementation and evidence satisfy this exact source atom: - create Human Handoff
- Negative assertions:
  - CHG-20260721-049-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - create Human Handoff

### CHG-20260721-050
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - create human tasks for OT-A1. > - create human tasks for OT-A1.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - create human tasks for OT-A1.
- Exact payload: {"verbatim_requirement":"- create human tasks for OT-A1."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - create human tasks for OT-A1.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S50 [1975, 2006]: "- create human tasks for OT-A1."
- Positive assertions:
  - CHG-20260721-050-POS-001: The implementation and evidence satisfy this exact source atom: - create human tasks for OT-A1.
- Negative assertions:
  - CHG-20260721-050-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - create human tasks for OT-A1.

### CHG-20260721-051
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > API writes are authorized for: > API writes are authorized for:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: API writes are authorized for:
- Exact payload: {"verbatim_requirement":"API writes are authorized for:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: API writes are authorized for:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S51 [2010, 2040]: "API writes are authorized for:"
- Positive assertions:
  - CHG-20260721-051-POS-001: The implementation and evidence satisfy this exact source atom: API writes are authorized for:
- Negative assertions:
  - CHG-20260721-051-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: API writes are authorized for:

### CHG-20260721-052
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - canonical HighLevel custom values > - canonical HighLevel custom values
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - canonical HighLevel custom values
- Exact payload: {"verbatim_requirement":"- canonical HighLevel custom values"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - canonical HighLevel custom values
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S52 [2044, 2079]: "- canonical HighLevel custom values"
- Positive assertions:
  - CHG-20260721-052-POS-001: The implementation and evidence satisfy this exact source atom: - canonical HighLevel custom values
- Negative assertions:
  - CHG-20260721-052-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - canonical HighLevel custom values

### CHG-20260721-053
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - canonical contact fields and tags when missing > - canonical contact fields and tags when missing
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - canonical contact fields and tags when missing
- Exact payload: {"verbatim_requirement":"- canonical contact fields and tags when missing"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - canonical contact fields and tags when missing
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S53 [2082, 2130]: "- canonical contact fields and tags when missing"
- Positive assertions:
  - CHG-20260721-053-POS-001: The implementation and evidence satisfy this exact source atom: - canonical contact fields and tags when missing
- Negative assertions:
  - CHG-20260721-053-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - canonical contact fields and tags when missing

### CHG-20260721-054
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - pipelines and stages when supported > - pipelines and stages when supported
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - pipelines and stages when supported
- Exact payload: {"verbatim_requirement":"- pipelines and stages when supported"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - pipelines and stages when supported
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S54 [2133, 2170]: "- pipelines and stages when supported"
- Positive assertions:
  - CHG-20260721-054-POS-001: The implementation and evidence satisfy this exact source atom: - pipelines and stages when supported
- Negative assertions:
  - CHG-20260721-054-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - pipelines and stages when supported

### CHG-20260721-055
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - registry reconciliation. > - registry reconciliation.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - registry reconciliation.
- Exact payload: {"verbatim_requirement":"- registry reconciliation."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - registry reconciliation.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S55 [2173, 2199]: "- registry reconciliation."
- Positive assertions:
  - CHG-20260721-055-POS-001: The implementation and evidence satisfy this exact source atom: - registry reconciliation.
- Negative assertions:
  - CHG-20260721-055-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - registry reconciliation.

### CHG-20260721-056
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Use location: > Use location:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Use location:
- Exact payload: {"verbatim_requirement":"Use location:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Use location:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S56 [2203, 2216]: "Use location:"
- Positive assertions:
  - CHG-20260721-056-POS-001: The implementation and evidence satisfy this exact source atom: Use location:
- Negative assertions:
  - CHG-20260721-056-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Use location:

### CHG-20260721-057
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > pBSnOK2nkdxp6gf9Rg3o > pBSnOK2nkdxp6gf9Rg3o
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: pBSnOK2nkdxp6gf9Rg3o
- Exact payload: {"verbatim_requirement":"pBSnOK2nkdxp6gf9Rg3o"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: pBSnOK2nkdxp6gf9Rg3o
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S57 [2220, 2240]: "pBSnOK2nkdxp6gf9Rg3o"
- Positive assertions:
  - CHG-20260721-057-POS-001: The implementation and evidence satisfy this exact source atom: pBSnOK2nkdxp6gf9Rg3o
- Negative assertions:
  - CHG-20260721-057-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: pBSnOK2nkdxp6gf9Rg3o

### CHG-20260721-058
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ## Registry version > ## Registry version
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ## Registry version
- Exact payload: {"verbatim_requirement":"## Registry version"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ## Registry version
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S58 [2244, 2263]: "## Registry version"
- Positive assertions:
  - CHG-20260721-058-POS-001: The implementation and evidence satisfy this exact source atom: ## Registry version
- Negative assertions:
  - CHG-20260721-058-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ## Registry version

### CHG-20260721-059
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Update the HighLevel schema from: > Update the HighLevel schema from:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Update the HighLevel schema from:
- Exact payload: {"verbatim_requirement":"Update the HighLevel schema from:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Update the HighLevel schema from:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S59 [2267, 2300]: "Update the HighLevel schema from:"
- Positive assertions:
  - CHG-20260721-059-POS-001: The implementation and evidence satisfy this exact source atom: Update the HighLevel schema from:
- Negative assertions:
  - CHG-20260721-059-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Update the HighLevel schema from:

### CHG-20260721-060
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > 1.0.0 > 1.0.0
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: 1.0.0
- Exact payload: {"verbatim_requirement":"1.0.0"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: 1.0.0
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S60 [2304, 2309]: "1.0.0"
- Positive assertions:
  - CHG-20260721-060-POS-001: The implementation and evidence satisfy this exact source atom: 1.0.0
- Negative assertions:
  - CHG-20260721-060-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: 1.0.0

### CHG-20260721-061
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > 1.1.0 > 1.1.0
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: 1.1.0
- Exact payload: {"verbatim_requirement":"1.1.0"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: 1.1.0
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S61 [2320, 2325]: "1.1.0"
- Positive assertions:
  - CHG-20260721-061-POS-001: The implementation and evidence satisfy this exact source atom: 1.1.0
- Negative assertions:
  - CHG-20260721-061-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: 1.1.0

### CHG-20260721-062
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Preserve all existing IDs and compatibility aliases. > Preserve all existing IDs and compatibility aliases.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Preserve all existing IDs and compatibility aliases.
- Exact payload: {"verbatim_requirement":"Preserve all existing IDs and compatibility aliases."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Preserve all existing IDs and compatibility aliases.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S62 [2329, 2381]: "Preserve all existing IDs and compatibility aliases."
- Positive assertions:
  - CHG-20260721-062-POS-001: The implementation and evidence satisfy this exact source atom: Preserve all existing IDs and compatibility aliases.
- Negative assertions:
  - CHG-20260721-062-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Preserve all existing IDs and compatibility aliases.

### CHG-20260721-063
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Create: > Create:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Create:
- Exact payload: {"verbatim_requirement":"Create:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Create:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S63 [2385, 2392]: "Create:"
- Positive assertions:
  - CHG-20260721-063-POS-001: The implementation and evidence satisfy this exact source atom: Create:
- Negative assertions:
  - CHG-20260721-063-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Create:

### CHG-20260721-064
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/registry/sender-registry.yaml > integrations/highlevel/registry/sender-registry.yaml
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/registry/sender-registry.yaml
- Exact payload: {"verbatim_requirement":"integrations/highlevel/registry/sender-registry.yaml"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/registry/sender-registry.yaml
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S64 [2396, 2448]: "integrations/highlevel/registry/sender-registry.yaml"
- Positive assertions:
  - CHG-20260721-064-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/registry/sender-registry.yaml
- Negative assertions:
  - CHG-20260721-064-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/registry/sender-registry.yaml

### CHG-20260721-065
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/registry/message-class-registry.yaml > integrations/highlevel/registry/message-class-registry.yaml
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/registry/message-class-registry.yaml
- Exact payload: {"verbatim_requirement":"integrations/highlevel/registry/message-class-registry.yaml"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/registry/message-class-registry.yaml
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S65 [2450, 2509]: "integrations/highlevel/registry/message-class-registry.yaml"
- Positive assertions:
  - CHG-20260721-065-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/registry/message-class-registry.yaml
- Negative assertions:
  - CHG-20260721-065-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/registry/message-class-registry.yaml

### CHG-20260721-066
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/registry/pipeline-registry.yaml > integrations/highlevel/registry/pipeline-registry.yaml
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/registry/pipeline-registry.yaml
- Exact payload: {"verbatim_requirement":"integrations/highlevel/registry/pipeline-registry.yaml"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/registry/pipeline-registry.yaml
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S66 [2511, 2565]: "integrations/highlevel/registry/pipeline-registry.yaml"
- Positive assertions:
  - CHG-20260721-066-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/registry/pipeline-registry.yaml
- Negative assertions:
  - CHG-20260721-066-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/registry/pipeline-registry.yaml

### CHG-20260721-067
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/registry/event-registry.yaml > integrations/highlevel/registry/event-registry.yaml
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/registry/event-registry.yaml
- Exact payload: {"verbatim_requirement":"integrations/highlevel/registry/event-registry.yaml"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/registry/event-registry.yaml
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S67 [2567, 2618]: "integrations/highlevel/registry/event-registry.yaml"
- Positive assertions:
  - CHG-20260721-067-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/registry/event-registry.yaml
- Negative assertions:
  - CHG-20260721-067-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/registry/event-registry.yaml

### CHG-20260721-068
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/registry/communications-contract.json > integrations/highlevel/registry/communications-contract.json
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/registry/communications-contract.json
- Exact payload: {"verbatim_requirement":"integrations/highlevel/registry/communications-contract.json"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/registry/communications-contract.json
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S68 [2620, 2680]: "integrations/highlevel/registry/communications-contract.json"
- Positive assertions:
  - CHG-20260721-068-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/registry/communications-contract.json
- Negative assertions:
  - CHG-20260721-068-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/registry/communications-contract.json

### CHG-20260721-069
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Update: > Update:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Update:
- Exact payload: {"verbatim_requirement":"Update:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Update:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S69 [2684, 2691]: "Update:"
- Positive assertions:
  - CHG-20260721-069-POS-001: The implementation and evidence satisfy this exact source atom: Update:
- Negative assertions:
  - CHG-20260721-069-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Update:

### CHG-20260721-070
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/registry/current.json > integrations/highlevel/registry/current.json
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/registry/current.json
- Exact payload: {"verbatim_requirement":"integrations/highlevel/registry/current.json"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/registry/current.json
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S70 [2695, 2739]: "integrations/highlevel/registry/current.json"
- Positive assertions:
  - CHG-20260721-070-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/registry/current.json
- Negative assertions:
  - CHG-20260721-070-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/registry/current.json

### CHG-20260721-071
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/registry/schema.yaml > integrations/highlevel/registry/schema.yaml
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/registry/schema.yaml
- Exact payload: {"verbatim_requirement":"integrations/highlevel/registry/schema.yaml"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/registry/schema.yaml
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S71 [2741, 2784]: "integrations/highlevel/registry/schema.yaml"
- Positive assertions:
  - CHG-20260721-071-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/registry/schema.yaml
- Negative assertions:
  - CHG-20260721-071-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/registry/schema.yaml

### CHG-20260721-072
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/registry/custom-values.yaml > integrations/highlevel/registry/custom-values.yaml
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/registry/custom-values.yaml
- Exact payload: {"verbatim_requirement":"integrations/highlevel/registry/custom-values.yaml"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/registry/custom-values.yaml
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S72 [2786, 2836]: "integrations/highlevel/registry/custom-values.yaml"
- Positive assertions:
  - CHG-20260721-072-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/registry/custom-values.yaml
- Negative assertions:
  - CHG-20260721-072-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/registry/custom-values.yaml

### CHG-20260721-073
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/registry/workflow-registry.yaml > integrations/highlevel/registry/workflow-registry.yaml
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/registry/workflow-registry.yaml
- Exact payload: {"verbatim_requirement":"integrations/highlevel/registry/workflow-registry.yaml"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/registry/workflow-registry.yaml
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S73 [2838, 2892]: "integrations/highlevel/registry/workflow-registry.yaml"
- Positive assertions:
  - CHG-20260721-073-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/registry/workflow-registry.yaml
- Negative assertions:
  - CHG-20260721-073-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/registry/workflow-registry.yaml

### CHG-20260721-074
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/registry/bot-action-registry.yaml > integrations/highlevel/registry/bot-action-registry.yaml
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/registry/bot-action-registry.yaml
- Exact payload: {"verbatim_requirement":"integrations/highlevel/registry/bot-action-registry.yaml"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/registry/bot-action-registry.yaml
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S74 [2894, 2950]: "integrations/highlevel/registry/bot-action-registry.yaml"
- Positive assertions:
  - CHG-20260721-074-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/registry/bot-action-registry.yaml
- Negative assertions:
  - CHG-20260721-074-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/registry/bot-action-registry.yaml

### CHG-20260721-075
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/registry/prompt-registry.yaml > integrations/highlevel/registry/prompt-registry.yaml
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/registry/prompt-registry.yaml
- Exact payload: {"verbatim_requirement":"integrations/highlevel/registry/prompt-registry.yaml"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/registry/prompt-registry.yaml
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S75 [2952, 3004]: "integrations/highlevel/registry/prompt-registry.yaml"
- Positive assertions:
  - CHG-20260721-075-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/registry/prompt-registry.yaml
- Negative assertions:
  - CHG-20260721-075-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/registry/prompt-registry.yaml

### CHG-20260721-076
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/registry/knowledge-base-registry.yaml > integrations/highlevel/registry/knowledge-base-registry.yaml
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/registry/knowledge-base-registry.yaml
- Exact payload: {"verbatim_requirement":"integrations/highlevel/registry/knowledge-base-registry.yaml"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/registry/knowledge-base-registry.yaml
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S76 [3006, 3066]: "integrations/highlevel/registry/knowledge-base-registry.yaml"
- Positive assertions:
  - CHG-20260721-076-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/registry/knowledge-base-registry.yaml
- Negative assertions:
  - CHG-20260721-076-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/registry/knowledge-base-registry.yaml

### CHG-20260721-077
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/registry/AGENT-HANDOFF.md > integrations/highlevel/registry/AGENT-HANDOFF.md
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/registry/AGENT-HANDOFF.md
- Exact payload: {"verbatim_requirement":"integrations/highlevel/registry/AGENT-HANDOFF.md"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/registry/AGENT-HANDOFF.md
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S77 [3068, 3116]: "integrations/highlevel/registry/AGENT-HANDOFF.md"
- Positive assertions:
  - CHG-20260721-077-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/registry/AGENT-HANDOFF.md
- Negative assertions:
  - CHG-20260721-077-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/registry/AGENT-HANDOFF.md

### CHG-20260721-078
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/workflows.yaml > integrations/highlevel/workflows.yaml
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/workflows.yaml
- Exact payload: {"verbatim_requirement":"integrations/highlevel/workflows.yaml"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/workflows.yaml
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S78 [3118, 3155]: "integrations/highlevel/workflows.yaml"
- Positive assertions:
  - CHG-20260721-078-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/workflows.yaml
- Negative assertions:
  - CHG-20260721-078-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/workflows.yaml

### CHG-20260721-079
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/CHANGELOG.md > integrations/highlevel/CHANGELOG.md
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/CHANGELOG.md
- Exact payload: {"verbatim_requirement":"integrations/highlevel/CHANGELOG.md"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/CHANGELOG.md
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S79 [3157, 3192]: "integrations/highlevel/CHANGELOG.md"
- Positive assertions:
  - CHG-20260721-079-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/CHANGELOG.md
- Negative assertions:
  - CHG-20260721-079-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/CHANGELOG.md

### CHG-20260721-080
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ## Canonical communications boundary > ## Canonical communications boundary
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ## Canonical communications boundary
- Exact payload: {"verbatim_requirement":"## Canonical communications boundary"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ## Canonical communications boundary
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S80 [3196, 3232]: "## Canonical communications boundary"
- Positive assertions:
  - CHG-20260721-080-POS-001: The implementation and evidence satisfy this exact source atom: ## Canonical communications boundary
- Negative assertions:
  - CHG-20260721-080-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ## Canonical communications boundary

### CHG-20260721-081
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > HighLevel is the One Time source of truth for: > HighLevel is the One Time source of truth for:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: HighLevel is the One Time source of truth for:
- Exact payload: {"verbatim_requirement":"HighLevel is the One Time source of truth for:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: HighLevel is the One Time source of truth for:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S81 [3236, 3282]: "HighLevel is the One Time source of truth for:"
- Positive assertions:
  - CHG-20260721-081-POS-001: The implementation and evidence satisfy this exact source atom: HighLevel is the One Time source of truth for:
- Negative assertions:
  - CHG-20260721-081-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: HighLevel is the One Time source of truth for:

### CHG-20260721-082
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - adult/parent contacts > - adult/parent contacts
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - adult/parent contacts
- Exact payload: {"verbatim_requirement":"- adult/parent contacts"}
- Placement: parent=The exact registry, workflow, queue, commit, or response section named in the source atom.; before=; after=; order=Preserve the exact positional or ordering relationship stated in the source atom.
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - adult/parent contacts
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S82 [3286, 3309]: "- adult/parent contacts"
- Positive assertions:
  - CHG-20260721-082-POS-001: The implementation and evidence satisfy this exact source atom: - adult/parent contacts
- Negative assertions:
  - CHG-20260721-082-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - adult/parent contacts

### CHG-20260721-083
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - customer conversations > - customer conversations
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - customer conversations
- Exact payload: {"verbatim_requirement":"- customer conversations"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - customer conversations
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S83 [3312, 3336]: "- customer conversations"
- Positive assertions:
  - CHG-20260721-083-POS-001: The implementation and evidence satisfy this exact source atom: - customer conversations
- Negative assertions:
  - CHG-20260721-083-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - customer conversations

### CHG-20260721-084
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - campaigns > - campaigns
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - campaigns
- Exact payload: {"verbatim_requirement":"- campaigns"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - campaigns
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S84 [3339, 3350]: "- campaigns"
- Positive assertions:
  - CHG-20260721-084-POS-001: The implementation and evidence satisfy this exact source atom: - campaigns
- Negative assertions:
  - CHG-20260721-084-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - campaigns

### CHG-20260721-085
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - business workflows > - business workflows
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - business workflows
- Exact payload: {"verbatim_requirement":"- business workflows"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - business workflows
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S85 [3353, 3373]: "- business workflows"
- Positive assertions:
  - CHG-20260721-085-POS-001: The implementation and evidence satisfy this exact source atom: - business workflows
- Negative assertions:
  - CHG-20260721-085-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - business workflows

### CHG-20260721-086
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - replies > - replies
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - replies
- Exact payload: {"verbatim_requirement":"- replies"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - replies
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S86 [3376, 3385]: "- replies"
- Positive assertions:
  - CHG-20260721-086-POS-001: The implementation and evidence satisfy this exact source atom: - replies
- Negative assertions:
  - CHG-20260721-086-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - replies

### CHG-20260721-087
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - suppression > - suppression
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - suppression
- Exact payload: {"verbatim_requirement":"- suppression"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - suppression
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S87 [3388, 3401]: "- suppression"
- Positive assertions:
  - CHG-20260721-087-POS-001: The implementation and evidence satisfy this exact source atom: - suppression
- Negative assertions:
  - CHG-20260721-087-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - suppression

### CHG-20260721-088
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - opportunities > - opportunities
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - opportunities
- Exact payload: {"verbatim_requirement":"- opportunities"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - opportunities
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S88 [3404, 3419]: "- opportunities"
- Positive assertions:
  - CHG-20260721-088-POS-001: The implementation and evidence satisfy this exact source atom: - opportunities
- Negative assertions:
  - CHG-20260721-088-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - opportunities

### CHG-20260721-089
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - customer-support and Torah-question processing state. > - customer-support and Torah-question processing state.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - customer-support and Torah-question processing state.
- Exact payload: {"verbatim_requirement":"- customer-support and Torah-question processing state."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - customer-support and Torah-question processing state.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S89 [3422, 3477]: "- customer-support and Torah-question processing state."
- Positive assertions:
  - CHG-20260721-089-POS-001: The implementation and evidence satisfy this exact source atom: - customer-support and Torah-question processing state.
- Negative assertions:
  - CHG-20260721-089-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - customer-support and Torah-question processing state.

### CHG-20260721-090
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > One Time is the source of truth for: > One Time is the source of truth for:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: One Time is the source of truth for:
- Exact payload: {"verbatim_requirement":"One Time is the source of truth for:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: One Time is the source of truth for:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S90 [3481, 3517]: "One Time is the source of truth for:"
- Positive assertions:
  - CHG-20260721-090-POS-001: The implementation and evidence satisfy this exact source atom: One Time is the source of truth for:
- Negative assertions:
  - CHG-20260721-090-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: One Time is the source of truth for:

### CHG-20260721-091
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - authentication > - authentication
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - authentication
- Exact payload: {"verbatim_requirement":"- authentication"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - authentication
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S91 [3521, 3537]: "- authentication"
- Positive assertions:
  - CHG-20260721-091-POS-001: The implementation and evidence satisfy this exact source atom: - authentication
- Negative assertions:
  - CHG-20260721-091-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - authentication

### CHG-20260721-092
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - passwords and secure tokens > - passwords and secure tokens
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - passwords and secure tokens
- Exact payload: {"verbatim_requirement":"- passwords and secure tokens"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - passwords and secure tokens
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S92 [3540, 3569]: "- passwords and secure tokens"
- Positive assertions:
  - CHG-20260721-092-POS-001: The implementation and evidence satisfy this exact source atom: - passwords and secure tokens
- Negative assertions:
  - CHG-20260721-092-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - passwords and secure tokens

### CHG-20260721-093
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - households > - households
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - households
- Exact payload: {"verbatim_requirement":"- households"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - households
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S93 [3572, 3584]: "- households"
- Positive assertions:
  - CHG-20260721-093-POS-001: The implementation and evidence satisfy this exact source atom: - households
- Negative assertions:
  - CHG-20260721-093-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - households

### CHG-20260721-094
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - learners > - learners
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - learners
- Exact payload: {"verbatim_requirement":"- learners"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - learners
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S94 [3587, 3597]: "- learners"
- Positive assertions:
  - CHG-20260721-094-POS-001: The implementation and evidence satisfy this exact source atom: - learners
- Negative assertions:
  - CHG-20260721-094-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - learners

### CHG-20260721-095
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Parent and Student portals > - Parent and Student portals
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Parent and Student portals
- Exact payload: {"verbatim_requirement":"- Parent and Student portals"}
- Placement: parent=The exact registry, workflow, queue, commit, or response section named in the source atom.; before=; after=; order=Preserve the exact positional or ordering relationship stated in the source atom.
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Parent and Student portals
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S95 [3600, 3628]: "- Parent and Student portals"
- Positive assertions:
  - CHG-20260721-095-POS-001: The implementation and evidence satisfy this exact source atom: - Parent and Student portals
- Negative assertions:
  - CHG-20260721-095-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Parent and Student portals

### CHG-20260721-096
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - entitlement > - entitlement
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - entitlement
- Exact payload: {"verbatim_requirement":"- entitlement"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - entitlement
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S96 [3631, 3644]: "- entitlement"
- Positive assertions:
  - CHG-20260721-096-POS-001: The implementation and evidence satisfy this exact source atom: - entitlement
- Negative assertions:
  - CHG-20260721-096-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - entitlement

### CHG-20260721-097
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - classes > - classes
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - classes
- Exact payload: {"verbatim_requirement":"- classes"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - classes
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S97 [3647, 3656]: "- classes"
- Positive assertions:
  - CHG-20260721-097-POS-001: The implementation and evidence satisfy this exact source atom: - classes
- Negative assertions:
  - CHG-20260721-097-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - classes

### CHG-20260721-098
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Vimeo > - Vimeo
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Vimeo
- Exact payload: {"verbatim_requirement":"- Vimeo"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Vimeo
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S98 [3659, 3666]: "- Vimeo"
- Positive assertions:
  - CHG-20260721-098-POS-001: The implementation and evidence satisfy this exact source atom: - Vimeo
- Negative assertions:
  - CHG-20260721-098-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Vimeo

### CHG-20260721-099
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Zoom > - Zoom
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Zoom
- Exact payload: {"verbatim_requirement":"- Zoom"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Zoom
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S99 [3669, 3675]: "- Zoom"
- Positive assertions:
  - CHG-20260721-099-POS-001: The implementation and evidence satisfy this exact source atom: - Zoom
- Negative assertions:
  - CHG-20260721-099-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Zoom

### CHG-20260721-100
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - progress > - progress
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - progress
- Exact payload: {"verbatim_requirement":"- progress"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - progress
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S100 [3678, 3688]: "- progress"
- Positive assertions:
  - CHG-20260721-100-POS-001: The implementation and evidence satisfy this exact source atom: - progress
- Negative assertions:
  - CHG-20260721-100-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - progress

### CHG-20260721-101
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - gamification > - gamification
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - gamification
- Exact payload: {"verbatim_requirement":"- gamification"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - gamification
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S101 [3691, 3705]: "- gamification"
- Positive assertions:
  - CHG-20260721-101-POS-001: The implementation and evidence satisfy this exact source atom: - gamification
- Negative assertions:
  - CHG-20260721-101-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - gamification

### CHG-20260721-102
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - original portal submissions. > - original portal submissions.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - original portal submissions.
- Exact payload: {"verbatim_requirement":"- original portal submissions."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - original portal submissions.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S102 [3708, 3738]: "- original portal submissions."
- Positive assertions:
  - CHG-20260721-102-POS-001: The implementation and evidence satisfy this exact source atom: - original portal submissions.
- Negative assertions:
  - CHG-20260721-102-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - original portal submissions.

### CHG-20260721-103
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Resend is limited to: > Resend is limited to:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Resend is limited to:
- Exact payload: {"verbatim_requirement":"Resend is limited to:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Resend is limited to:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S103 [3742, 3763]: "Resend is limited to:"
- Positive assertions:
  - CHG-20260721-103-POS-001: The implementation and evidence satisfy this exact source atom: Resend is limited to:
- Negative assertions:
  - CHG-20260721-103-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Resend is limited to:

### CHG-20260721-104
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - activation/setup links > - activation/setup links
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - activation/setup links
- Exact payload: {"verbatim_requirement":"- activation/setup links"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - activation/setup links
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S104 [3767, 3791]: "- activation/setup links"
- Positive assertions:
  - CHG-20260721-104-POS-001: The implementation and evidence satisfy this exact source atom: - activation/setup links
- Negative assertions:
  - CHG-20260721-104-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - activation/setup links

### CHG-20260721-105
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - password reset > - password reset
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - password reset
- Exact payload: {"verbatim_requirement":"- password reset"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - password reset
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S105 [3794, 3810]: "- password reset"
- Positive assertions:
  - CHG-20260721-105-POS-001: The implementation and evidence satisfy this exact source atom: - password reset
- Negative assertions:
  - CHG-20260721-105-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - password reset

### CHG-20260721-106
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - email verification > - email verification
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - email verification
- Exact payload: {"verbatim_requirement":"- email verification"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - email verification
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S106 [3813, 3833]: "- email verification"
- Positive assertions:
  - CHG-20260721-106-POS-001: The implementation and evidence satisfy this exact source atom: - email verification
- Negative assertions:
  - CHG-20260721-106-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - email verification

### CHG-20260721-107
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Administrator login challenge > - Administrator login challenge
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Administrator login challenge
- Exact payload: {"verbatim_requirement":"- Administrator login challenge"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Administrator login challenge
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S107 [3836, 3867]: "- Administrator login challenge"
- Positive assertions:
  - CHG-20260721-107-POS-001: The implementation and evidence satisfy this exact source atom: - Administrator login challenge
- Negative assertions:
  - CHG-20260721-107-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Administrator login challenge

### CHG-20260721-108
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - security-token email. > - security-token email.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - security-token email.
- Exact payload: {"verbatim_requirement":"- security-token email."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - security-token email.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S108 [3870, 3893]: "- security-token email."
- Positive assertions:
  - CHG-20260721-108-POS-001: The implementation and evidence satisfy this exact source atom: - security-token email.
- Negative assertions:
  - CHG-20260721-108-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - security-token email.

### CHG-20260721-109
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Telegram is Rabbi Eli Scheller’s private interface for assigned Torah questions and Rabbi-authored content. > Telegram is Rabbi Eli Scheller’s private interface for assigned Torah questions and Rabbi-authored content.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Telegram is Rabbi Eli Scheller’s private interface for assigned Torah questions and Rabbi-authored content.
- Exact payload: {"verbatim_requirement":"Telegram is Rabbi Eli Scheller’s private interface for assigned Torah questions and Rabbi-authored content."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Telegram is Rabbi Eli Scheller’s private interface for assigned Torah questions and Rabbi-authored content.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S109 [3897, 4004]: "Telegram is Rabbi Eli Scheller’s private interface for assigned Torah questions and Rabbi-authored content."
- Positive assertions:
  - CHG-20260721-109-POS-001: The implementation and evidence satisfy this exact source atom: Telegram is Rabbi Eli Scheller’s private interface for assigned Torah questions and Rabbi-authored content.
- Negative assertions:
  - CHG-20260721-109-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Telegram is Rabbi Eli Scheller’s private interface for assigned Torah questions and Rabbi-authored content.

### CHG-20260721-110
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Telegram is not a separate customer transcript. > Telegram is not a separate customer transcript.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Telegram is not a separate customer transcript.
- Exact payload: {"verbatim_requirement":"Telegram is not a separate customer transcript."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Telegram is not a separate customer transcript.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S110 [4008, 4055]: "Telegram is not a separate customer transcript."
- Positive assertions:
  - CHG-20260721-110-POS-001: The implementation and evidence satisfy this exact source atom: Telegram is not a separate customer transcript.
- Negative assertions:
  - CHG-20260721-110-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Telegram is not a separate customer transcript.

### CHG-20260721-111
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ## Human ownership > ## Human ownership
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ## Human ownership
- Exact payload: {"verbatim_requirement":"## Human ownership"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ## Human ownership
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S111 [4059, 4077]: "## Human ownership"
- Positive assertions:
  - CHG-20260721-111-POS-001: The implementation and evidence satisfy this exact source atom: ## Human ownership
- Negative assertions:
  - CHG-20260721-111-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ## Human ownership

### CHG-20260721-112
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Default customer-communication owner: > Default customer-communication owner:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Default customer-communication owner:
- Exact payload: {"verbatim_requirement":"Default customer-communication owner:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Default customer-communication owner:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S112 [4081, 4118]: "Default customer-communication owner:"
- Positive assertions:
  - CHG-20260721-112-POS-001: The implementation and evidence satisfy this exact source atom: Default customer-communication owner:
- Negative assertions:
  - CHG-20260721-112-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Default customer-communication owner:

### CHG-20260721-113
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Shloimie > Shloimie
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Shloimie
- Exact payload: {"verbatim_requirement":"Shloimie"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Shloimie
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S113 [4122, 4130]: "Shloimie"
- Positive assertions:
  - CHG-20260721-113-POS-001: The implementation and evidence satisfy this exact source atom: Shloimie
- Negative assertions:
  - CHG-20260721-113-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Shloimie

### CHG-20260721-114
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Rabbi Eli Scheller receives only: > Rabbi Eli Scheller receives only:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Rabbi Eli Scheller receives only:
- Exact payload: {"verbatim_requirement":"Rabbi Eli Scheller receives only:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Rabbi Eli Scheller receives only:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S114 [4134, 4167]: "Rabbi Eli Scheller receives only:"
- Positive assertions:
  - CHG-20260721-114-POS-001: The implementation and evidence satisfy this exact source atom: Rabbi Eli Scheller receives only:
- Negative assertions:
  - CHG-20260721-114-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Rabbi Eli Scheller receives only:

### CHG-20260721-115
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - substantive Torah questions > - substantive Torah questions
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - substantive Torah questions
- Exact payload: {"verbatim_requirement":"- substantive Torah questions"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - substantive Torah questions
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S115 [4171, 4200]: "- substantive Torah questions"
- Positive assertions:
  - CHG-20260721-115-POS-001: The implementation and evidence satisfy this exact source atom: - substantive Torah questions
- Negative assertions:
  - CHG-20260721-115-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - substantive Torah questions

### CHG-20260721-116
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Mishnah questions > - Mishnah questions
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Mishnah questions
- Exact payload: {"verbatim_requirement":"- Mishnah questions"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Mishnah questions
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S116 [4203, 4222]: "- Mishnah questions"
- Positive assertions:
  - CHG-20260721-116-POS-001: The implementation and evidence satisfy this exact source atom: - Mishnah questions
- Negative assertions:
  - CHG-20260721-116-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Mishnah questions

### CHG-20260721-117
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - halachic questions requiring Rabbi authorship > - halachic questions requiring Rabbi authorship
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - halachic questions requiring Rabbi authorship
- Exact payload: {"verbatim_requirement":"- halachic questions requiring Rabbi authorship"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - halachic questions requiring Rabbi authorship
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S117 [4225, 4272]: "- halachic questions requiring Rabbi authorship"
- Positive assertions:
  - CHG-20260721-117-POS-001: The implementation and evidence satisfy this exact source atom: - halachic questions requiring Rabbi authorship
- Negative assertions:
  - CHG-20260721-117-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - halachic questions requiring Rabbi authorship

### CHG-20260721-118
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Rabbi-authored Torah newsletters > - Rabbi-authored Torah newsletters
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Rabbi-authored Torah newsletters
- Exact payload: {"verbatim_requirement":"- Rabbi-authored Torah newsletters"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Rabbi-authored Torah newsletters
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S118 [4275, 4309]: "- Rabbi-authored Torah newsletters"
- Positive assertions:
  - CHG-20260721-118-POS-001: The implementation and evidence satisfy this exact source atom: - Rabbi-authored Torah newsletters
- Negative assertions:
  - CHG-20260721-118-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Rabbi-authored Torah newsletters

### CHG-20260721-119
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Rabbi-authored warm enrollment content. > - Rabbi-authored warm enrollment content.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Rabbi-authored warm enrollment content.
- Exact payload: {"verbatim_requirement":"- Rabbi-authored warm enrollment content."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Rabbi-authored warm enrollment content.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S119 [4312, 4353]: "- Rabbi-authored warm enrollment content."
- Positive assertions:
  - CHG-20260721-119-POS-001: The implementation and evidence satisfy this exact source atom: - Rabbi-authored warm enrollment content.
- Negative assertions:
  - CHG-20260721-119-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Rabbi-authored warm enrollment content.

### CHG-20260721-120
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Do not route these to Rabbi: > Do not route these to Rabbi:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Do not route these to Rabbi:
- Exact payload: {"verbatim_requirement":"Do not route these to Rabbi:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Do not route these to Rabbi:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S120 [4357, 4385]: "Do not route these to Rabbi:"
- Positive assertions:
  - CHG-20260721-120-POS-001: The implementation and evidence satisfy this exact source atom: Do not route these to Rabbi:
- Negative assertions:
  - CHG-20260721-120-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Do not route these to Rabbi:

### CHG-20260721-121
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - login > - login
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - login
- Exact payload: {"verbatim_requirement":"- login"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - login
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S121 [4389, 4396]: "- login"
- Positive assertions:
  - CHG-20260721-121-POS-001: The implementation and evidence satisfy this exact source atom: - login
- Negative assertions:
  - CHG-20260721-121-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - login

### CHG-20260721-122
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - password help > - password help
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - password help
- Exact payload: {"verbatim_requirement":"- password help"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - password help
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S122 [4399, 4414]: "- password help"
- Positive assertions:
  - CHG-20260721-122-POS-001: The implementation and evidence satisfy this exact source atom: - password help
- Negative assertions:
  - CHG-20260721-122-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - password help

### CHG-20260721-123
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - billing > - billing
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - billing
- Exact payload: {"verbatim_requirement":"- billing"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - billing
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S123 [4417, 4426]: "- billing"
- Positive assertions:
  - CHG-20260721-123-POS-001: The implementation and evidence satisfy this exact source atom: - billing
- Negative assertions:
  - CHG-20260721-123-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - billing

### CHG-20260721-124
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - cancellation > - cancellation
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - cancellation
- Exact payload: {"verbatim_requirement":"- cancellation"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - cancellation
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S124 [4429, 4443]: "- cancellation"
- Positive assertions:
  - CHG-20260721-124-POS-001: The implementation and evidence satisfy this exact source atom: - cancellation
- Negative assertions:
  - CHG-20260721-124-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - cancellation

### CHG-20260721-125
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - refund > - refund
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - refund
- Exact payload: {"verbatim_requirement":"- refund"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - refund
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S125 [4446, 4454]: "- refund"
- Positive assertions:
  - CHG-20260721-125-POS-001: The implementation and evidence satisfy this exact source atom: - refund
- Negative assertions:
  - CHG-20260721-125-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - refund

### CHG-20260721-126
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - technical support > - technical support
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - technical support
- Exact payload: {"verbatim_requirement":"- technical support"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - technical support
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S126 [4457, 4476]: "- technical support"
- Positive assertions:
  - CHG-20260721-126-POS-001: The implementation and evidence satisfy this exact source atom: - technical support
- Negative assertions:
  - CHG-20260721-126-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - technical support

### CHG-20260721-127
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - scheduling > - scheduling
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - scheduling
- Exact payload: {"verbatim_requirement":"- scheduling"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - scheduling
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S127 [4479, 4491]: "- scheduling"
- Positive assertions:
  - CHG-20260721-127-POS-001: The implementation and evidence satisfy this exact source atom: - scheduling
- Negative assertions:
  - CHG-20260721-127-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - scheduling

### CHG-20260721-128
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - class-link problems > - class-link problems
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - class-link problems
- Exact payload: {"verbatim_requirement":"- class-link problems"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - class-link problems
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S128 [4494, 4515]: "- class-link problems"
- Positive assertions:
  - CHG-20260721-128-POS-001: The implementation and evidence satisfy this exact source atom: - class-link problems
- Negative assertions:
  - CHG-20260721-128-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - class-link problems

### CHG-20260721-129
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - parent administration > - parent administration
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - parent administration
- Exact payload: {"verbatim_requirement":"- parent administration"}
- Placement: parent=The exact registry, workflow, queue, commit, or response section named in the source atom.; before=; after=; order=Preserve the exact positional or ordering relationship stated in the source atom.
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - parent administration
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S129 [4518, 4541]: "- parent administration"
- Positive assertions:
  - CHG-20260721-129-POS-001: The implementation and evidence satisfy this exact source atom: - parent administration
- Negative assertions:
  - CHG-20260721-129-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - parent administration

### CHG-20260721-130
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - ordinary enrollment logistics > - ordinary enrollment logistics
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - ordinary enrollment logistics
- Exact payload: {"verbatim_requirement":"- ordinary enrollment logistics"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - ordinary enrollment logistics
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S130 [4544, 4575]: "- ordinary enrollment logistics"
- Positive assertions:
  - CHG-20260721-130-POS-001: The implementation and evidence satisfy this exact source atom: - ordinary enrollment logistics
- Negative assertions:
  - CHG-20260721-130-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - ordinary enrollment logistics

### CHG-20260721-131
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - complaints > - complaints
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - complaints
- Exact payload: {"verbatim_requirement":"- complaints"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - complaints
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S131 [4578, 4590]: "- complaints"
- Positive assertions:
  - CHG-20260721-131-POS-001: The implementation and evidence satisfy this exact source atom: - complaints
- Negative assertions:
  - CHG-20260721-131-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - complaints

### CHG-20260721-132
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - unknown messages > - unknown messages
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - unknown messages
- Exact payload: {"verbatim_requirement":"- unknown messages"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - unknown messages
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S132 [4593, 4611]: "- unknown messages"
- Positive assertions:
  - CHG-20260721-132-POS-001: The implementation and evidence satisfy this exact source atom: - unknown messages
- Negative assertions:
  - CHG-20260721-132-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - unknown messages

### CHG-20260721-133
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - generic replies. > - generic replies.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - generic replies.
- Exact payload: {"verbatim_requirement":"- generic replies."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - generic replies.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S133 [4614, 4632]: "- generic replies."
- Positive assertions:
  - CHG-20260721-133-POS-001: The implementation and evidence satisfy this exact source atom: - generic replies.
- Negative assertions:
  - CHG-20260721-133-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - generic replies.

### CHG-20260721-134
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ## Sender registry > ## Sender registry
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ## Sender registry
- Exact payload: {"verbatim_requirement":"## Sender registry"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ## Sender registry
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S134 [4636, 4654]: "## Sender registry"
- Positive assertions:
  - CHG-20260721-134-POS-001: The implementation and evidence satisfy this exact source atom: ## Sender registry
- Negative assertions:
  - CHG-20260721-134-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ## Sender registry

### CHG-20260721-135
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Create these exact sender keys. > Create these exact sender keys.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Create these exact sender keys.
- Exact payload: {"verbatim_requirement":"Create these exact sender keys."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Create these exact sender keys.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S135 [4658, 4689]: "Create these exact sender keys."
- Positive assertions:
  - CHG-20260721-135-POS-001: The implementation and evidence satisfy this exact source atom: Create these exact sender keys.
- Negative assertions:
  - CHG-20260721-135-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Create these exact sender keys.

### CHG-20260721-136
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ### rabbi_campaign > ### rabbi_campaign
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ### rabbi_campaign
- Exact payload: {"verbatim_requirement":"### rabbi_campaign"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ### rabbi_campaign
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S136 [4693, 4711]: "### rabbi_campaign"
- Positive assertions:
  - CHG-20260721-136-POS-001: The implementation and evidence satisfy this exact source atom: ### rabbi_campaign
- Negative assertions:
  - CHG-20260721-136-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ### rabbi_campaign

### CHG-20260721-137
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Purpose: > Purpose:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Purpose:
- Exact payload: {"verbatim_requirement":"Purpose:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Purpose:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S137 [4715, 4723]: "Purpose:"
- Positive assertions:
  - CHG-20260721-137-POS-001: The implementation and evidence satisfy this exact source atom: Purpose:
- Negative assertions:
  - CHG-20260721-137-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Purpose:

### CHG-20260721-138
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - warm enrollment campaigns > - warm enrollment campaigns
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - warm enrollment campaigns
- Exact payload: {"verbatim_requirement":"- warm enrollment campaigns"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - warm enrollment campaigns
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S138 [4727, 4754]: "- warm enrollment campaigns"
- Positive assertions:
  - CHG-20260721-138-POS-001: The implementation and evidence satisfy this exact source atom: - warm enrollment campaigns
- Negative assertions:
  - CHG-20260721-138-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - warm enrollment campaigns

### CHG-20260721-139
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Torah newsletters > - Torah newsletters
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Torah newsletters
- Exact payload: {"verbatim_requirement":"- Torah newsletters"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Torah newsletters
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S139 [4757, 4776]: "- Torah newsletters"
- Positive assertions:
  - CHG-20260721-139-POS-001: The implementation and evidence satisfy this exact source atom: - Torah newsletters
- Negative assertions:
  - CHG-20260721-139-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Torah newsletters

### CHG-20260721-140
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Rabbi-authored teaching emails > - Rabbi-authored teaching emails
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Rabbi-authored teaching emails
- Exact payload: {"verbatim_requirement":"- Rabbi-authored teaching emails"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Rabbi-authored teaching emails
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S140 [4779, 4811]: "- Rabbi-authored teaching emails"
- Positive assertions:
  - CHG-20260721-140-POS-001: The implementation and evidence satisfy this exact source atom: - Rabbi-authored teaching emails
- Negative assertions:
  - CHG-20260721-140-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Rabbi-authored teaching emails

### CHG-20260721-141
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Rabbi-authored event invitations. > - Rabbi-authored event invitations.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Rabbi-authored event invitations.
- Exact payload: {"verbatim_requirement":"- Rabbi-authored event invitations."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Rabbi-authored event invitations.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S141 [4814, 4849]: "- Rabbi-authored event invitations."
- Positive assertions:
  - CHG-20260721-141-POS-001: The implementation and evidence satisfy this exact source atom: - Rabbi-authored event invitations.
- Negative assertions:
  - CHG-20260721-141-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Rabbi-authored event invitations.

### CHG-20260721-142
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Phase 1: > Phase 1:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Phase 1:
- Exact payload: {"verbatim_requirement":"Phase 1:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Phase 1:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S142 [4853, 4861]: "Phase 1:"
- Positive assertions:
  - CHG-20260721-142-POS-001: The implementation and evidence satisfy this exact source atom: Phase 1:
- Negative assertions:
  - CHG-20260721-142-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Phase 1:

### CHG-20260721-143
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > display_name: > display_name:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: display_name:
- Exact payload: {"verbatim_requirement":"display_name:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: display_name:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S143 [4865, 4878]: "display_name:"
- Positive assertions:
  - CHG-20260721-143-POS-001: The implementation and evidence satisfy this exact source atom: display_name:
- Negative assertions:
  - CHG-20260721-143-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: display_name:

### CHG-20260721-144
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Rabbi Eli Scheller | One Time Mishnayos > Rabbi Eli Scheller | One Time Mishnayos
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Rabbi Eli Scheller | One Time Mishnayos
- Exact payload: {"verbatim_requirement":"Rabbi Eli Scheller | One Time Mishnayos"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Rabbi Eli Scheller | One Time Mishnayos
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S144 [4880, 4919]: "Rabbi Eli Scheller | One Time Mishnayos"
- Positive assertions:
  - CHG-20260721-144-POS-001: The implementation and evidence satisfy this exact source atom: Rabbi Eli Scheller | One Time Mishnayos
- Negative assertions:
  - CHG-20260721-144-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Rabbi Eli Scheller | One Time Mishnayos

### CHG-20260721-145
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > from_email: > from_email:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: from_email:
- Exact payload: {"verbatim_requirement":"from_email:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: from_email:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S145 [4923, 4934]: "from_email:"
- Positive assertions:
  - CHG-20260721-145-POS-001: The implementation and evidence satisfy this exact source atom: from_email:
- Negative assertions:
  - CHG-20260721-145-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: from_email:

### CHG-20260721-146
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > info@onetimeonetime.com > info@onetimeonetime.com
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: info@onetimeonetime.com
- Exact payload: {"verbatim_requirement":"info@onetimeonetime.com"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: info@onetimeonetime.com
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S146 [4936, 4959]: "info@onetimeonetime.com"
- Positive assertions:
  - CHG-20260721-146-POS-001: The implementation and evidence satisfy this exact source atom: info@onetimeonetime.com
- Negative assertions:
  - CHG-20260721-146-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: info@onetimeonetime.com

### CHG-20260721-147
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > reply_to: > reply_to:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: reply_to:
- Exact payload: {"verbatim_requirement":"reply_to:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: reply_to:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S147 [4963, 4972]: "reply_to:"
- Positive assertions:
  - CHG-20260721-147-POS-001: The implementation and evidence satisfy this exact source atom: reply_to:
- Negative assertions:
  - CHG-20260721-147-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: reply_to:

### CHG-20260721-148
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > info@onetimeonetime.com > info@onetimeonetime.com
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: info@onetimeonetime.com
- Exact payload: {"verbatim_requirement":"info@onetimeonetime.com"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: info@onetimeonetime.com
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S148 [4974, 4997]: "info@onetimeonetime.com"
- Positive assertions:
  - CHG-20260721-148-POS-001: The implementation and evidence satisfy this exact source atom: info@onetimeonetime.com
- Negative assertions:
  - CHG-20260721-148-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: info@onetimeonetime.com

### CHG-20260721-149
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > status: > status:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: status:
- Exact payload: {"verbatim_requirement":"status:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: status:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S149 [5001, 5008]: "status:"
- Positive assertions:
  - CHG-20260721-149-POS-001: The implementation and evidence satisfy this exact source atom: status:
- Negative assertions:
  - CHG-20260721-149-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: status:

### CHG-20260721-150
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > active_phase_1 > active_phase_1
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: active_phase_1
- Exact payload: {"verbatim_requirement":"active_phase_1"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: active_phase_1
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S150 [5010, 5024]: "active_phase_1"
- Positive assertions:
  - CHG-20260721-150-POS-001: The implementation and evidence satisfy this exact source atom: active_phase_1
- Negative assertions:
  - CHG-20260721-150-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: active_phase_1

### CHG-20260721-151
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Phase 2: > Phase 2:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Phase 2:
- Exact payload: {"verbatim_requirement":"Phase 2:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Phase 2:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S151 [5028, 5036]: "Phase 2:"
- Positive assertions:
  - CHG-20260721-151-POS-001: The implementation and evidence satisfy this exact source atom: Phase 2:
- Negative assertions:
  - CHG-20260721-151-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Phase 2:

### CHG-20260721-152
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > display_name: > display_name:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: display_name:
- Exact payload: {"verbatim_requirement":"display_name:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: display_name:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S152 [5040, 5053]: "display_name:"
- Positive assertions:
  - CHG-20260721-152-POS-001: The implementation and evidence satisfy this exact source atom: display_name:
- Negative assertions:
  - CHG-20260721-152-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: display_name:

### CHG-20260721-153
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Rabbi Eli Scheller | One Time Mishnayos > Rabbi Eli Scheller | One Time Mishnayos
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Rabbi Eli Scheller | One Time Mishnayos
- Exact payload: {"verbatim_requirement":"Rabbi Eli Scheller | One Time Mishnayos"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Rabbi Eli Scheller | One Time Mishnayos
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S153 [5055, 5094]: "Rabbi Eli Scheller | One Time Mishnayos"
- Positive assertions:
  - CHG-20260721-153-POS-001: The implementation and evidence satisfy this exact source atom: Rabbi Eli Scheller | One Time Mishnayos
- Negative assertions:
  - CHG-20260721-153-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Rabbi Eli Scheller | One Time Mishnayos

### CHG-20260721-154
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > from_email: > from_email:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: from_email:
- Exact payload: {"verbatim_requirement":"from_email:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: from_email:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S154 [5098, 5109]: "from_email:"
- Positive assertions:
  - CHG-20260721-154-POS-001: The implementation and evidence satisfy this exact source atom: from_email:
- Negative assertions:
  - CHG-20260721-154-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: from_email:

### CHG-20260721-155
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > rabbi@onetimeonetime.com > rabbi@onetimeonetime.com
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: rabbi@onetimeonetime.com
- Exact payload: {"verbatim_requirement":"rabbi@onetimeonetime.com"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: rabbi@onetimeonetime.com
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S155 [5111, 5135]: "rabbi@onetimeonetime.com"
- Positive assertions:
  - CHG-20260721-155-POS-001: The implementation and evidence satisfy this exact source atom: rabbi@onetimeonetime.com
- Negative assertions:
  - CHG-20260721-155-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: rabbi@onetimeonetime.com

### CHG-20260721-156
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > reply_to: > reply_to:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: reply_to:
- Exact payload: {"verbatim_requirement":"reply_to:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: reply_to:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S156 [5139, 5148]: "reply_to:"
- Positive assertions:
  - CHG-20260721-156-POS-001: The implementation and evidence satisfy this exact source atom: reply_to:
- Negative assertions:
  - CHG-20260721-156-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: reply_to:

### CHG-20260721-157
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > info@onetimeonetime.com > info@onetimeonetime.com
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: info@onetimeonetime.com
- Exact payload: {"verbatim_requirement":"info@onetimeonetime.com"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: info@onetimeonetime.com
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S157 [5150, 5173]: "info@onetimeonetime.com"
- Positive assertions:
  - CHG-20260721-157-POS-001: The implementation and evidence satisfy this exact source atom: info@onetimeonetime.com
- Negative assertions:
  - CHG-20260721-157-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: info@onetimeonetime.com

### CHG-20260721-158
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > status: > status:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: status:
- Exact payload: {"verbatim_requirement":"status:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: status:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S158 [5177, 5184]: "status:"
- Positive assertions:
  - CHG-20260721-158-POS-001: The implementation and evidence satisfy this exact source atom: status:
- Negative assertions:
  - CHG-20260721-158-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: status:

### CHG-20260721-159
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > pending_mailbox_and_reply_acceptance > pending_mailbox_and_reply_acceptance
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: pending_mailbox_and_reply_acceptance
- Exact payload: {"verbatim_requirement":"pending_mailbox_and_reply_acceptance"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: pending_mailbox_and_reply_acceptance
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S159 [5186, 5222]: "pending_mailbox_and_reply_acceptance"
- Positive assertions:
  - CHG-20260721-159-POS-001: The implementation and evidence satisfy this exact source atom: pending_mailbox_and_reply_acceptance
- Negative assertions:
  - CHG-20260721-159-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: pending_mailbox_and_reply_acceptance

### CHG-20260721-160
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Do not activate phase 2 until: > Do not activate phase 2 until:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Do not activate phase 2 until:
- Exact payload: {"verbatim_requirement":"Do not activate phase 2 until:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Do not activate phase 2 until:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S160 [5226, 5256]: "Do not activate phase 2 until:"
- Positive assertions:
  - CHG-20260721-160-POS-001: The implementation and evidence satisfy this exact source atom: Do not activate phase 2 until:
- Negative assertions:
  - CHG-20260721-160-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Do not activate phase 2 until:

### CHG-20260721-161
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > rabbi@ mailbox or routing exists > rabbi@ mailbox or routing exists
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: rabbi@ mailbox or routing exists
- Exact payload: {"verbatim_requirement":"rabbi@ mailbox or routing exists"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: rabbi@ mailbox or routing exists
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S161 [5263, 5295]: "rabbi@ mailbox or routing exists"
- Positive assertions:
  - CHG-20260721-161-POS-001: The implementation and evidence satisfy this exact source atom: rabbi@ mailbox or routing exists
- Negative assertions:
  - CHG-20260721-161-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: rabbi@ mailbox or routing exists

### CHG-20260721-162
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > HighLevel accepts the From address > HighLevel accepts the From address
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: HighLevel accepts the From address
- Exact payload: {"verbatim_requirement":"HighLevel accepts the From address"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: HighLevel accepts the From address
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S162 [5301, 5335]: "HighLevel accepts the From address"
- Positive assertions:
  - CHG-20260721-162-POS-001: The implementation and evidence satisfy this exact source atom: HighLevel accepts the From address
- Negative assertions:
  - CHG-20260721-162-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: HighLevel accepts the From address

### CHG-20260721-163
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > a seed delivers > a seed delivers
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: a seed delivers
- Exact payload: {"verbatim_requirement":"a seed delivers"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: a seed delivers
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S163 [5341, 5356]: "a seed delivers"
- Positive assertions:
  - CHG-20260721-163-POS-001: The implementation and evidence satisfy this exact source atom: a seed delivers
- Negative assertions:
  - CHG-20260721-163-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: a seed delivers

### CHG-20260721-164
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > a reply reaches GHL Conversations > a reply reaches GHL Conversations
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: a reply reaches GHL Conversations
- Exact payload: {"verbatim_requirement":"a reply reaches GHL Conversations"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: a reply reaches GHL Conversations
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S164 [5362, 5395]: "a reply reaches GHL Conversations"
- Positive assertions:
  - CHG-20260721-164-POS-001: The implementation and evidence satisfy this exact source atom: a reply reaches GHL Conversations
- Negative assertions:
  - CHG-20260721-164-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: a reply reaches GHL Conversations

### CHG-20260721-165
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > the result is recorded. > the result is recorded.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: the result is recorded.
- Exact payload: {"verbatim_requirement":"the result is recorded."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: the result is recorded.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S165 [5401, 5424]: "the result is recorded."
- Positive assertions:
  - CHG-20260721-165-POS-001: The implementation and evidence satisfy this exact source atom: the result is recorded.
- Negative assertions:
  - CHG-20260721-165-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: the result is recorded.

### CHG-20260721-166
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ### rabbi_personal > ### rabbi_personal
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ### rabbi_personal
- Exact payload: {"verbatim_requirement":"### rabbi_personal"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ### rabbi_personal
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S166 [5428, 5446]: "### rabbi_personal"
- Positive assertions:
  - CHG-20260721-166-POS-001: The implementation and evidence satisfy this exact source atom: ### rabbi_personal
- Negative assertions:
  - CHG-20260721-166-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ### rabbi_personal

### CHG-20260721-167
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > display_name: > display_name:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: display_name:
- Exact payload: {"verbatim_requirement":"display_name:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: display_name:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S167 [5450, 5463]: "display_name:"
- Positive assertions:
  - CHG-20260721-167-POS-001: The implementation and evidence satisfy this exact source atom: display_name:
- Negative assertions:
  - CHG-20260721-167-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: display_name:

### CHG-20260721-168
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Rabbi Eli Scheller > Rabbi Eli Scheller
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Rabbi Eli Scheller
- Exact payload: {"verbatim_requirement":"Rabbi Eli Scheller"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Rabbi Eli Scheller
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S168 [5465, 5483]: "Rabbi Eli Scheller"
- Positive assertions:
  - CHG-20260721-168-POS-001: The implementation and evidence satisfy this exact source atom: Rabbi Eli Scheller
- Negative assertions:
  - CHG-20260721-168-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Rabbi Eli Scheller

### CHG-20260721-169
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > from_email: > from_email:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: from_email:
- Exact payload: {"verbatim_requirement":"from_email:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: from_email:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S169 [5487, 5498]: "from_email:"
- Positive assertions:
  - CHG-20260721-169-POS-001: The implementation and evidence satisfy this exact source atom: from_email:
- Negative assertions:
  - CHG-20260721-169-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: from_email:

### CHG-20260721-170
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > rabbi@onetimeonetime.com > rabbi@onetimeonetime.com
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: rabbi@onetimeonetime.com
- Exact payload: {"verbatim_requirement":"rabbi@onetimeonetime.com"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: rabbi@onetimeonetime.com
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S170 [5500, 5524]: "rabbi@onetimeonetime.com"
- Positive assertions:
  - CHG-20260721-170-POS-001: The implementation and evidence satisfy this exact source atom: rabbi@onetimeonetime.com
- Negative assertions:
  - CHG-20260721-170-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: rabbi@onetimeonetime.com

### CHG-20260721-171
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > reply_to: > reply_to:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: reply_to:
- Exact payload: {"verbatim_requirement":"reply_to:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: reply_to:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S171 [5528, 5537]: "reply_to:"
- Positive assertions:
  - CHG-20260721-171-POS-001: The implementation and evidence satisfy this exact source atom: reply_to:
- Negative assertions:
  - CHG-20260721-171-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: reply_to:

### CHG-20260721-172
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > info@onetimeonetime.com > info@onetimeonetime.com
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: info@onetimeonetime.com
- Exact payload: {"verbatim_requirement":"info@onetimeonetime.com"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: info@onetimeonetime.com
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S172 [5539, 5562]: "info@onetimeonetime.com"
- Positive assertions:
  - CHG-20260721-172-POS-001: The implementation and evidence satisfy this exact source atom: info@onetimeonetime.com
- Negative assertions:
  - CHG-20260721-172-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: info@onetimeonetime.com

### CHG-20260721-173
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > owner: > owner:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: owner:
- Exact payload: {"verbatim_requirement":"owner:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: owner:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S173 [5566, 5572]: "owner:"
- Positive assertions:
  - CHG-20260721-173-POS-001: The implementation and evidence satisfy this exact source atom: owner:
- Negative assertions:
  - CHG-20260721-173-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: owner:

### CHG-20260721-174
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Rabbi authors through Telegram > Rabbi authors through Telegram
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Rabbi authors through Telegram
- Exact payload: {"verbatim_requirement":"Rabbi authors through Telegram"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Rabbi authors through Telegram
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S174 [5574, 5604]: "Rabbi authors through Telegram"
- Positive assertions:
  - CHG-20260721-174-POS-001: The implementation and evidence satisfy this exact source atom: Rabbi authors through Telegram
- Negative assertions:
  - CHG-20260721-174-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Rabbi authors through Telegram

### CHG-20260721-175
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Shloimie retains visibility > Shloimie retains visibility
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Shloimie retains visibility
- Exact payload: {"verbatim_requirement":"Shloimie retains visibility"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Shloimie retains visibility
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S175 [5606, 5633]: "Shloimie retains visibility"
- Positive assertions:
  - CHG-20260721-175-POS-001: The implementation and evidence satisfy this exact source atom: Shloimie retains visibility
- Negative assertions:
  - CHG-20260721-175-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Shloimie retains visibility

### CHG-20260721-176
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > status: > status:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: status:
- Exact payload: {"verbatim_requirement":"status:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: status:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S176 [5637, 5644]: "status:"
- Positive assertions:
  - CHG-20260721-176-POS-001: The implementation and evidence satisfy this exact source atom: status:
- Negative assertions:
  - CHG-20260721-176-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: status:

### CHG-20260721-177
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > pending_mailbox_and_reply_acceptance > pending_mailbox_and_reply_acceptance
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: pending_mailbox_and_reply_acceptance
- Exact payload: {"verbatim_requirement":"pending_mailbox_and_reply_acceptance"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: pending_mailbox_and_reply_acceptance
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S177 [5646, 5682]: "pending_mailbox_and_reply_acceptance"
- Positive assertions:
  - CHG-20260721-177-POS-001: The implementation and evidence satisfy this exact source atom: pending_mailbox_and_reply_acceptance
- Negative assertions:
  - CHG-20260721-177-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: pending_mailbox_and_reply_acceptance

### CHG-20260721-178
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ### office > ### office
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ### office
- Exact payload: {"verbatim_requirement":"### office"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ### office
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S178 [5686, 5696]: "### office"
- Positive assertions:
  - CHG-20260721-178-POS-001: The implementation and evidence satisfy this exact source atom: ### office
- Negative assertions:
  - CHG-20260721-178-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ### office

### CHG-20260721-179
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > display_name: > display_name:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: display_name:
- Exact payload: {"verbatim_requirement":"display_name:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: display_name:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S179 [5700, 5713]: "display_name:"
- Positive assertions:
  - CHG-20260721-179-POS-001: The implementation and evidence satisfy this exact source atom: display_name:
- Negative assertions:
  - CHG-20260721-179-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: display_name:

### CHG-20260721-180
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Shloimie from One Time Mishnayos > Shloimie from One Time Mishnayos
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Shloimie from One Time Mishnayos
- Exact payload: {"verbatim_requirement":"Shloimie from One Time Mishnayos"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Shloimie from One Time Mishnayos
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S180 [5715, 5747]: "Shloimie from One Time Mishnayos"
- Positive assertions:
  - CHG-20260721-180-POS-001: The implementation and evidence satisfy this exact source atom: Shloimie from One Time Mishnayos
- Negative assertions:
  - CHG-20260721-180-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Shloimie from One Time Mishnayos

### CHG-20260721-181
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > from_email: > from_email:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: from_email:
- Exact payload: {"verbatim_requirement":"from_email:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: from_email:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S181 [5751, 5762]: "from_email:"
- Positive assertions:
  - CHG-20260721-181-POS-001: The implementation and evidence satisfy this exact source atom: from_email:
- Negative assertions:
  - CHG-20260721-181-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: from_email:

### CHG-20260721-182
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > info@onetimeonetime.com > info@onetimeonetime.com
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: info@onetimeonetime.com
- Exact payload: {"verbatim_requirement":"info@onetimeonetime.com"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: info@onetimeonetime.com
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S182 [5764, 5787]: "info@onetimeonetime.com"
- Positive assertions:
  - CHG-20260721-182-POS-001: The implementation and evidence satisfy this exact source atom: info@onetimeonetime.com
- Negative assertions:
  - CHG-20260721-182-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: info@onetimeonetime.com

### CHG-20260721-183
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > reply_to: > reply_to:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: reply_to:
- Exact payload: {"verbatim_requirement":"reply_to:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: reply_to:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S183 [5791, 5800]: "reply_to:"
- Positive assertions:
  - CHG-20260721-183-POS-001: The implementation and evidence satisfy this exact source atom: reply_to:
- Negative assertions:
  - CHG-20260721-183-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: reply_to:

### CHG-20260721-184
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > info@onetimeonetime.com > info@onetimeonetime.com
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: info@onetimeonetime.com
- Exact payload: {"verbatim_requirement":"info@onetimeonetime.com"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: info@onetimeonetime.com
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S184 [5802, 5825]: "info@onetimeonetime.com"
- Positive assertions:
  - CHG-20260721-184-POS-001: The implementation and evidence satisfy this exact source atom: info@onetimeonetime.com
- Negative assertions:
  - CHG-20260721-184-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: info@onetimeonetime.com

### CHG-20260721-185
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > status: > status:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: status:
- Exact payload: {"verbatim_requirement":"status:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: status:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S185 [5829, 5836]: "status:"
- Positive assertions:
  - CHG-20260721-185-POS-001: The implementation and evidence satisfy this exact source atom: status:
- Negative assertions:
  - CHG-20260721-185-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: status:

### CHG-20260721-186
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > active > active
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: active
- Exact payload: {"verbatim_requirement":"active"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: active
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S186 [5838, 5844]: "active"
- Positive assertions:
  - CHG-20260721-186-POS-001: The implementation and evidence satisfy this exact source atom: active
- Negative assertions:
  - CHG-20260721-186-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: active

### CHG-20260721-187
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ### brand > ### brand
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ### brand
- Exact payload: {"verbatim_requirement":"### brand"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ### brand
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S187 [5848, 5857]: "### brand"
- Positive assertions:
  - CHG-20260721-187-POS-001: The implementation and evidence satisfy this exact source atom: ### brand
- Negative assertions:
  - CHG-20260721-187-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ### brand

### CHG-20260721-188
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > display_name: > display_name:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: display_name:
- Exact payload: {"verbatim_requirement":"display_name:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: display_name:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S188 [5861, 5874]: "display_name:"
- Positive assertions:
  - CHG-20260721-188-POS-001: The implementation and evidence satisfy this exact source atom: display_name:
- Negative assertions:
  - CHG-20260721-188-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: display_name:

### CHG-20260721-189
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > One Time Mishnayos > One Time Mishnayos
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: One Time Mishnayos
- Exact payload: {"verbatim_requirement":"One Time Mishnayos"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: One Time Mishnayos
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S189 [5876, 5894]: "One Time Mishnayos"
- Positive assertions:
  - CHG-20260721-189-POS-001: The implementation and evidence satisfy this exact source atom: One Time Mishnayos
- Negative assertions:
  - CHG-20260721-189-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: One Time Mishnayos

### CHG-20260721-190
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > from_email: > from_email:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: from_email:
- Exact payload: {"verbatim_requirement":"from_email:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: from_email:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S190 [5898, 5909]: "from_email:"
- Positive assertions:
  - CHG-20260721-190-POS-001: The implementation and evidence satisfy this exact source atom: from_email:
- Negative assertions:
  - CHG-20260721-190-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: from_email:

### CHG-20260721-191
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > info@onetimeonetime.com > info@onetimeonetime.com
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: info@onetimeonetime.com
- Exact payload: {"verbatim_requirement":"info@onetimeonetime.com"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: info@onetimeonetime.com
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S191 [5911, 5934]: "info@onetimeonetime.com"
- Positive assertions:
  - CHG-20260721-191-POS-001: The implementation and evidence satisfy this exact source atom: info@onetimeonetime.com
- Negative assertions:
  - CHG-20260721-191-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: info@onetimeonetime.com

### CHG-20260721-192
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > reply_to: > reply_to:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: reply_to:
- Exact payload: {"verbatim_requirement":"reply_to:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: reply_to:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S192 [5938, 5947]: "reply_to:"
- Positive assertions:
  - CHG-20260721-192-POS-001: The implementation and evidence satisfy this exact source atom: reply_to:
- Negative assertions:
  - CHG-20260721-192-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: reply_to:

### CHG-20260721-193
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > info@onetimeonetime.com > info@onetimeonetime.com
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: info@onetimeonetime.com
- Exact payload: {"verbatim_requirement":"info@onetimeonetime.com"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: info@onetimeonetime.com
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S193 [5949, 5972]: "info@onetimeonetime.com"
- Positive assertions:
  - CHG-20260721-193-POS-001: The implementation and evidence satisfy this exact source atom: info@onetimeonetime.com
- Negative assertions:
  - CHG-20260721-193-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: info@onetimeonetime.com

### CHG-20260721-194
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > status: > status:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: status:
- Exact payload: {"verbatim_requirement":"status:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: status:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S194 [5976, 5983]: "status:"
- Positive assertions:
  - CHG-20260721-194-POS-001: The implementation and evidence satisfy this exact source atom: status:
- Negative assertions:
  - CHG-20260721-194-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: status:

### CHG-20260721-195
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > active > active
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: active
- Exact payload: {"verbatim_requirement":"active"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: active
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S195 [5985, 5991]: "active"
- Positive assertions:
  - CHG-20260721-195-POS-001: The implementation and evidence satisfy this exact source atom: active
- Negative assertions:
  - CHG-20260721-195-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: active

### CHG-20260721-196
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ### account_security > ### account_security
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ### account_security
- Exact payload: {"verbatim_requirement":"### account_security"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ### account_security
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S196 [5995, 6015]: "### account_security"
- Positive assertions:
  - CHG-20260721-196-POS-001: The implementation and evidence satisfy this exact source atom: ### account_security
- Negative assertions:
  - CHG-20260721-196-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ### account_security

### CHG-20260721-197
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > display_name: > display_name:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: display_name:
- Exact payload: {"verbatim_requirement":"display_name:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: display_name:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S197 [6019, 6032]: "display_name:"
- Positive assertions:
  - CHG-20260721-197-POS-001: The implementation and evidence satisfy this exact source atom: display_name:
- Negative assertions:
  - CHG-20260721-197-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: display_name:

### CHG-20260721-198
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > One Time Mishnayos Account > One Time Mishnayos Account
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: One Time Mishnayos Account
- Exact payload: {"verbatim_requirement":"One Time Mishnayos Account"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: One Time Mishnayos Account
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S198 [6034, 6060]: "One Time Mishnayos Account"
- Positive assertions:
  - CHG-20260721-198-POS-001: The implementation and evidence satisfy this exact source atom: One Time Mishnayos Account
- Negative assertions:
  - CHG-20260721-198-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: One Time Mishnayos Account

### CHG-20260721-199
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > preferred_from_email: > preferred_from_email:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: preferred_from_email:
- Exact payload: {"verbatim_requirement":"preferred_from_email:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: preferred_from_email:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S199 [6064, 6085]: "preferred_from_email:"
- Positive assertions:
  - CHG-20260721-199-POS-001: The implementation and evidence satisfy this exact source atom: preferred_from_email:
- Negative assertions:
  - CHG-20260721-199-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: preferred_from_email:

### CHG-20260721-200
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > account@onetimeonetime.com > account@onetimeonetime.com
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: account@onetimeonetime.com
- Exact payload: {"verbatim_requirement":"account@onetimeonetime.com"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: account@onetimeonetime.com
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S200 [6087, 6113]: "account@onetimeonetime.com"
- Positive assertions:
  - CHG-20260721-200-POS-001: The implementation and evidence satisfy this exact source atom: account@onetimeonetime.com
- Negative assertions:
  - CHG-20260721-200-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: account@onetimeonetime.com

### CHG-20260721-201
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > current_fallback_from_email: > current_fallback_from_email:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: current_fallback_from_email:
- Exact payload: {"verbatim_requirement":"current_fallback_from_email:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: current_fallback_from_email:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S201 [6117, 6145]: "current_fallback_from_email:"
- Positive assertions:
  - CHG-20260721-201-POS-001: The implementation and evidence satisfy this exact source atom: current_fallback_from_email:
- Negative assertions:
  - CHG-20260721-201-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: current_fallback_from_email:

### CHG-20260721-202
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > info@onetimeonetime.com > info@onetimeonetime.com
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: info@onetimeonetime.com
- Exact payload: {"verbatim_requirement":"info@onetimeonetime.com"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: info@onetimeonetime.com
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S202 [6147, 6170]: "info@onetimeonetime.com"
- Positive assertions:
  - CHG-20260721-202-POS-001: The implementation and evidence satisfy this exact source atom: info@onetimeonetime.com
- Negative assertions:
  - CHG-20260721-202-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: info@onetimeonetime.com

### CHG-20260721-203
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > provider: > provider:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: provider:
- Exact payload: {"verbatim_requirement":"provider:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: provider:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S203 [6174, 6183]: "provider:"
- Positive assertions:
  - CHG-20260721-203-POS-001: The implementation and evidence satisfy this exact source atom: provider:
- Negative assertions:
  - CHG-20260721-203-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: provider:

### CHG-20260721-204
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Resend > Resend
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Resend
- Exact payload: {"verbatim_requirement":"Resend"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Resend
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S204 [6185, 6191]: "Resend"
- Positive assertions:
  - CHG-20260721-204-POS-001: The implementation and evidence satisfy this exact source atom: Resend
- Negative assertions:
  - CHG-20260721-204-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Resend

### CHG-20260721-205
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > status: > status:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: status:
- Exact payload: {"verbatim_requirement":"status:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: status:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S205 [6195, 6202]: "status:"
- Positive assertions:
  - CHG-20260721-205-POS-001: The implementation and evidence satisfy this exact source atom: status:
- Negative assertions:
  - CHG-20260721-205-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: status:

### CHG-20260721-206
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > preferred_address_pending_domain_acceptance > preferred_address_pending_domain_acceptance
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: preferred_address_pending_domain_acceptance
- Exact payload: {"verbatim_requirement":"preferred_address_pending_domain_acceptance"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: preferred_address_pending_domain_acceptance
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S206 [6204, 6247]: "preferred_address_pending_domain_acceptance"
- Positive assertions:
  - CHG-20260721-206-POS-001: The implementation and evidence satisfy this exact source atom: preferred_address_pending_domain_acceptance
- Negative assertions:
  - CHG-20260721-206-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: preferred_address_pending_domain_acceptance

### CHG-20260721-207
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Do not claim account@ is live until verified. > Do not claim account@ is live until verified.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Do not claim account@ is live until verified.
- Exact payload: {"verbatim_requirement":"Do not claim account@ is live until verified."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Do not claim account@ is live until verified.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S207 [6251, 6296]: "Do not claim account@ is live until verified."
- Positive assertions:
  - CHG-20260721-207-POS-001: The implementation and evidence satisfy this exact source atom: Do not claim account@ is live until verified.
- Negative assertions:
  - CHG-20260721-207-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Do not claim account@ is live until verified.

### CHG-20260721-208
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ## Message-class registry > ## Message-class registry
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ## Message-class registry
- Exact payload: {"verbatim_requirement":"## Message-class registry"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ## Message-class registry
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S208 [6300, 6325]: "## Message-class registry"
- Positive assertions:
  - CHG-20260721-208-POS-001: The implementation and evidence satisfy this exact source atom: ## Message-class registry
- Negative assertions:
  - CHG-20260721-208-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ## Message-class registry

### CHG-20260721-209
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Register every customer email class. > Register every customer email class.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Register every customer email class.
- Exact payload: {"verbatim_requirement":"Register every customer email class."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Register every customer email class.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S209 [6329, 6365]: "Register every customer email class."
- Positive assertions:
  - CHG-20260721-209-POS-001: The implementation and evidence satisfy this exact source atom: Register every customer email class.
- Negative assertions:
  - CHG-20260721-209-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Register every customer email class.

### CHG-20260721-210
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ### Rabbi campaign / GHL > ### Rabbi campaign / GHL
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ### Rabbi campaign / GHL
- Exact payload: {"verbatim_requirement":"### Rabbi campaign / GHL"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ### Rabbi campaign / GHL
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S210 [6369, 6393]: "### Rabbi campaign / GHL"
- Positive assertions:
  - CHG-20260721-210-POS-001: The implementation and evidence satisfy this exact source atom: ### Rabbi campaign / GHL
- Negative assertions:
  - CHG-20260721-210-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ### Rabbi campaign / GHL

### CHG-20260721-211
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - warm_enrollment_campaign > - warm_enrollment_campaign
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - warm_enrollment_campaign
- Exact payload: {"verbatim_requirement":"- warm_enrollment_campaign"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - warm_enrollment_campaign
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S211 [6397, 6423]: "- warm_enrollment_campaign"
- Positive assertions:
  - CHG-20260721-211-POS-001: The implementation and evidence satisfy this exact source atom: - warm_enrollment_campaign
- Negative assertions:
  - CHG-20260721-211-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - warm_enrollment_campaign

### CHG-20260721-212
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - existing_subscriber_migration > - existing_subscriber_migration
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - existing_subscriber_migration
- Exact payload: {"verbatim_requirement":"- existing_subscriber_migration"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - existing_subscriber_migration
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S212 [6425, 6456]: "- existing_subscriber_migration"
- Positive assertions:
  - CHG-20260721-212-POS-001: The implementation and evidence satisfy this exact source atom: - existing_subscriber_migration
- Negative assertions:
  - CHG-20260721-212-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - existing_subscriber_migration

### CHG-20260721-213
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - prelaunch_nurture > - prelaunch_nurture
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - prelaunch_nurture
- Exact payload: {"verbatim_requirement":"- prelaunch_nurture"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - prelaunch_nurture
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S213 [6458, 6477]: "- prelaunch_nurture"
- Positive assertions:
  - CHG-20260721-213-POS-001: The implementation and evidence satisfy this exact source atom: - prelaunch_nurture
- Negative assertions:
  - CHG-20260721-213-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - prelaunch_nurture

### CHG-20260721-214
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - torah_newsletter > - torah_newsletter
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - torah_newsletter
- Exact payload: {"verbatim_requirement":"- torah_newsletter"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - torah_newsletter
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S214 [6479, 6497]: "- torah_newsletter"
- Positive assertions:
  - CHG-20260721-214-POS-001: The implementation and evidence satisfy this exact source atom: - torah_newsletter
- Negative assertions:
  - CHG-20260721-214-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - torah_newsletter

### CHG-20260721-215
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - rabbi_teaching_email > - rabbi_teaching_email
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - rabbi_teaching_email
- Exact payload: {"verbatim_requirement":"- rabbi_teaching_email"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - rabbi_teaching_email
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S215 [6499, 6521]: "- rabbi_teaching_email"
- Positive assertions:
  - CHG-20260721-215-POS-001: The implementation and evidence satisfy this exact source atom: - rabbi_teaching_email
- Negative assertions:
  - CHG-20260721-215-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - rabbi_teaching_email

### CHG-20260721-216
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - rabbi_event_invitation > - rabbi_event_invitation
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - rabbi_event_invitation
- Exact payload: {"verbatim_requirement":"- rabbi_event_invitation"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - rabbi_event_invitation
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S216 [6523, 6547]: "- rabbi_event_invitation"
- Positive assertions:
  - CHG-20260721-216-POS-001: The implementation and evidence satisfy this exact source atom: - rabbi_event_invitation
- Negative assertions:
  - CHG-20260721-216-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - rabbi_event_invitation

### CHG-20260721-217
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ### Rabbi personal / GHL > ### Rabbi personal / GHL
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ### Rabbi personal / GHL
- Exact payload: {"verbatim_requirement":"### Rabbi personal / GHL"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ### Rabbi personal / GHL
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S217 [6551, 6575]: "### Rabbi personal / GHL"
- Positive assertions:
  - CHG-20260721-217-POS-001: The implementation and evidence satisfy this exact source atom: ### Rabbi personal / GHL
- Negative assertions:
  - CHG-20260721-217-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ### Rabbi personal / GHL

### CHG-20260721-218
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - torah_answer > - torah_answer
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - torah_answer
- Exact payload: {"verbatim_requirement":"- torah_answer"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - torah_answer
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S218 [6579, 6593]: "- torah_answer"
- Positive assertions:
  - CHG-20260721-218-POS-001: The implementation and evidence satisfy this exact source atom: - torah_answer
- Negative assertions:
  - CHG-20260721-218-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - torah_answer

### CHG-20260721-219
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - torah_follow_up > - torah_follow_up
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - torah_follow_up
- Exact payload: {"verbatim_requirement":"- torah_follow_up"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - torah_follow_up
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S219 [6595, 6612]: "- torah_follow_up"
- Positive assertions:
  - CHG-20260721-219-POS-001: The implementation and evidence satisfy this exact source atom: - torah_follow_up
- Negative assertions:
  - CHG-20260721-219-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - torah_follow_up

### CHG-20260721-220
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ### Office / GHL > ### Office / GHL
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ### Office / GHL
- Exact payload: {"verbatim_requirement":"### Office / GHL"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ### Office / GHL
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S220 [6616, 6632]: "### Office / GHL"
- Positive assertions:
  - CHG-20260721-220-POS-001: The implementation and evidence satisfy this exact source atom: ### Office / GHL
- Negative assertions:
  - CHG-20260721-220-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ### Office / GHL

### CHG-20260721-221
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - support_reply > - support_reply
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - support_reply
- Exact payload: {"verbatim_requirement":"- support_reply"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - support_reply
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S221 [6636, 6651]: "- support_reply"
- Positive assertions:
  - CHG-20260721-221-POS-001: The implementation and evidence satisfy this exact source atom: - support_reply
- Negative assertions:
  - CHG-20260721-221-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - support_reply

### CHG-20260721-222
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - access_help > - access_help
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - access_help
- Exact payload: {"verbatim_requirement":"- access_help"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - access_help
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S222 [6653, 6666]: "- access_help"
- Positive assertions:
  - CHG-20260721-222-POS-001: The implementation and evidence satisfy this exact source atom: - access_help
- Negative assertions:
  - CHG-20260721-222-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - access_help

### CHG-20260721-223
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - billing_help > - billing_help
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - billing_help
- Exact payload: {"verbatim_requirement":"- billing_help"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - billing_help
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S223 [6668, 6682]: "- billing_help"
- Positive assertions:
  - CHG-20260721-223-POS-001: The implementation and evidence satisfy this exact source atom: - billing_help
- Negative assertions:
  - CHG-20260721-223-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - billing_help

### CHG-20260721-224
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - payment_failed_support > - payment_failed_support
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - payment_failed_support
- Exact payload: {"verbatim_requirement":"- payment_failed_support"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - payment_failed_support
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S224 [6684, 6708]: "- payment_failed_support"
- Positive assertions:
  - CHG-20260721-224-POS-001: The implementation and evidence satisfy this exact source atom: - payment_failed_support
- Negative assertions:
  - CHG-20260721-224-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - payment_failed_support

### CHG-20260721-225
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - cancellation_help > - cancellation_help
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - cancellation_help
- Exact payload: {"verbatim_requirement":"- cancellation_help"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - cancellation_help
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S225 [6710, 6729]: "- cancellation_help"
- Positive assertions:
  - CHG-20260721-225-POS-001: The implementation and evidence satisfy this exact source atom: - cancellation_help
- Negative assertions:
  - CHG-20260721-225-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - cancellation_help

### CHG-20260721-226
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - refund_help > - refund_help
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - refund_help
- Exact payload: {"verbatim_requirement":"- refund_help"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - refund_help
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S226 [6731, 6744]: "- refund_help"
- Positive assertions:
  - CHG-20260721-226-POS-001: The implementation and evidence satisfy this exact source atom: - refund_help
- Negative assertions:
  - CHG-20260721-226-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - refund_help

### CHG-20260721-227
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - complaint_reply > - complaint_reply
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - complaint_reply
- Exact payload: {"verbatim_requirement":"- complaint_reply"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - complaint_reply
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S227 [6746, 6763]: "- complaint_reply"
- Positive assertions:
  - CHG-20260721-227-POS-001: The implementation and evidence satisfy this exact source atom: - complaint_reply
- Negative assertions:
  - CHG-20260721-227-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - complaint_reply

### CHG-20260721-228
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - parent_administration_reply > - parent_administration_reply
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - parent_administration_reply
- Exact payload: {"verbatim_requirement":"- parent_administration_reply"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - parent_administration_reply
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S228 [6765, 6794]: "- parent_administration_reply"
- Positive assertions:
  - CHG-20260721-228-POS-001: The implementation and evidence satisfy this exact source atom: - parent_administration_reply
- Negative assertions:
  - CHG-20260721-228-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - parent_administration_reply

### CHG-20260721-229
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ### Brand / GHL > ### Brand / GHL
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ### Brand / GHL
- Exact payload: {"verbatim_requirement":"### Brand / GHL"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ### Brand / GHL
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S229 [6798, 6813]: "### Brand / GHL"
- Positive assertions:
  - CHG-20260721-229-POS-001: The implementation and evidence satisfy this exact source atom: ### Brand / GHL
- Negative assertions:
  - CHG-20260721-229-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ### Brand / GHL

### CHG-20260721-230
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - signup_confirmation > - signup_confirmation
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - signup_confirmation
- Exact payload: {"verbatim_requirement":"- signup_confirmation"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - signup_confirmation
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S230 [6817, 6838]: "- signup_confirmation"
- Positive assertions:
  - CHG-20260721-230-POS-001: The implementation and evidence satisfy this exact source atom: - signup_confirmation
- Negative assertions:
  - CHG-20260721-230-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - signup_confirmation

### CHG-20260721-231
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - event_registration_confirmation > - event_registration_confirmation
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - event_registration_confirmation
- Exact payload: {"verbatim_requirement":"- event_registration_confirmation"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - event_registration_confirmation
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S231 [6840, 6873]: "- event_registration_confirmation"
- Positive assertions:
  - CHG-20260721-231-POS-001: The implementation and evidence satisfy this exact source atom: - event_registration_confirmation
- Negative assertions:
  - CHG-20260721-231-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - event_registration_confirmation

### CHG-20260721-232
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - event_reminder > - event_reminder
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - event_reminder
- Exact payload: {"verbatim_requirement":"- event_reminder"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - event_reminder
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S232 [6875, 6891]: "- event_reminder"
- Positive assertions:
  - CHG-20260721-232-POS-001: The implementation and evidence satisfy this exact source atom: - event_reminder
- Negative assertions:
  - CHG-20260721-232-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - event_reminder

### CHG-20260721-233
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - class_reminder > - class_reminder
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - class_reminder
- Exact payload: {"verbatim_requirement":"- class_reminder"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - class_reminder
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S233 [6893, 6909]: "- class_reminder"
- Positive assertions:
  - CHG-20260721-233-POS-001: The implementation and evidence satisfy this exact source atom: - class_reminder
- Negative assertions:
  - CHG-20260721-233-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - class_reminder

### CHG-20260721-234
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - schedule_change > - schedule_change
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - schedule_change
- Exact payload: {"verbatim_requirement":"- schedule_change"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - schedule_change
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S234 [6911, 6928]: "- schedule_change"
- Positive assertions:
  - CHG-20260721-234-POS-001: The implementation and evidence satisfy this exact source atom: - schedule_change
- Negative assertions:
  - CHG-20260721-234-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - schedule_change

### CHG-20260721-235
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - recording_available > - recording_available
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - recording_available
- Exact payload: {"verbatim_requirement":"- recording_available"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - recording_available
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S235 [6930, 6951]: "- recording_available"
- Positive assertions:
  - CHG-20260721-235-POS-001: The implementation and evidence satisfy this exact source atom: - recording_available
- Negative assertions:
  - CHG-20260721-235-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - recording_available

### CHG-20260721-236
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - new_video_available > - new_video_available
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - new_video_available
- Exact payload: {"verbatim_requirement":"- new_video_available"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - new_video_available
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S236 [6953, 6974]: "- new_video_available"
- Positive assertions:
  - CHG-20260721-236-POS-001: The implementation and evidence satisfy this exact source atom: - new_video_available
- Negative assertions:
  - CHG-20260721-236-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - new_video_available

### CHG-20260721-237
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - worksheet_available > - worksheet_available
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - worksheet_available
- Exact payload: {"verbatim_requirement":"- worksheet_available"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - worksheet_available
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S237 [6976, 6997]: "- worksheet_available"
- Positive assertions:
  - CHG-20260721-237-POS-001: The implementation and evidence satisfy this exact source atom: - worksheet_available
- Negative assertions:
  - CHG-20260721-237-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - worksheet_available

### CHG-20260721-238
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - portal_welcome > - portal_welcome
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - portal_welcome
- Exact payload: {"verbatim_requirement":"- portal_welcome"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - portal_welcome
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S238 [6999, 7015]: "- portal_welcome"
- Positive assertions:
  - CHG-20260721-238-POS-001: The implementation and evidence satisfy this exact source atom: - portal_welcome
- Negative assertions:
  - CHG-20260721-238-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - portal_welcome

### CHG-20260721-239
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - portal_activated > - portal_activated
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - portal_activated
- Exact payload: {"verbatim_requirement":"- portal_activated"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - portal_activated
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S239 [7017, 7035]: "- portal_activated"
- Positive assertions:
  - CHG-20260721-239-POS-001: The implementation and evidence satisfy this exact source atom: - portal_activated
- Negative assertions:
  - CHG-20260721-239-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - portal_activated

### CHG-20260721-240
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - payment_receipt > - payment_receipt
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - payment_receipt
- Exact payload: {"verbatim_requirement":"- payment_receipt"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - payment_receipt
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S240 [7037, 7054]: "- payment_receipt"
- Positive assertions:
  - CHG-20260721-240-POS-001: The implementation and evidence satisfy this exact source atom: - payment_receipt
- Negative assertions:
  - CHG-20260721-240-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - payment_receipt

### CHG-20260721-241
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - cancellation_confirmation > - cancellation_confirmation
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - cancellation_confirmation
- Exact payload: {"verbatim_requirement":"- cancellation_confirmation"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - cancellation_confirmation
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S241 [7056, 7083]: "- cancellation_confirmation"
- Positive assertions:
  - CHG-20260721-241-POS-001: The implementation and evidence satisfy this exact source atom: - cancellation_confirmation
- Negative assertions:
  - CHG-20260721-241-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - cancellation_confirmation

### CHG-20260721-242
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - support_acknowledgement > - support_acknowledgement
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - support_acknowledgement
- Exact payload: {"verbatim_requirement":"- support_acknowledgement"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - support_acknowledgement
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S242 [7085, 7110]: "- support_acknowledgement"
- Positive assertions:
  - CHG-20260721-242-POS-001: The implementation and evidence satisfy this exact source atom: - support_acknowledgement
- Negative assertions:
  - CHG-20260721-242-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - support_acknowledgement

### CHG-20260721-243
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ### Account security / Resend > ### Account security / Resend
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ### Account security / Resend
- Exact payload: {"verbatim_requirement":"### Account security / Resend"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ### Account security / Resend
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S243 [7114, 7143]: "### Account security / Resend"
- Positive assertions:
  - CHG-20260721-243-POS-001: The implementation and evidence satisfy this exact source atom: ### Account security / Resend
- Negative assertions:
  - CHG-20260721-243-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ### Account security / Resend

### CHG-20260721-244
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - activation_token > - activation_token
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - activation_token
- Exact payload: {"verbatim_requirement":"- activation_token"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - activation_token
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S244 [7147, 7165]: "- activation_token"
- Positive assertions:
  - CHG-20260721-244-POS-001: The implementation and evidence satisfy this exact source atom: - activation_token
- Negative assertions:
  - CHG-20260721-244-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - activation_token

### CHG-20260721-245
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - password_setup > - password_setup
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - password_setup
- Exact payload: {"verbatim_requirement":"- password_setup"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - password_setup
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S245 [7167, 7183]: "- password_setup"
- Positive assertions:
  - CHG-20260721-245-POS-001: The implementation and evidence satisfy this exact source atom: - password_setup
- Negative assertions:
  - CHG-20260721-245-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - password_setup

### CHG-20260721-246
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - password_reset > - password_reset
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - password_reset
- Exact payload: {"verbatim_requirement":"- password_reset"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - password_reset
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S246 [7185, 7201]: "- password_reset"
- Positive assertions:
  - CHG-20260721-246-POS-001: The implementation and evidence satisfy this exact source atom: - password_reset
- Negative assertions:
  - CHG-20260721-246-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - password_reset

### CHG-20260721-247
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - email_verification > - email_verification
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - email_verification
- Exact payload: {"verbatim_requirement":"- email_verification"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - email_verification
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S247 [7203, 7223]: "- email_verification"
- Positive assertions:
  - CHG-20260721-247-POS-001: The implementation and evidence satisfy this exact source atom: - email_verification
- Negative assertions:
  - CHG-20260721-247-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - email_verification

### CHG-20260721-248
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - login_challenge > - login_challenge
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - login_challenge
- Exact payload: {"verbatim_requirement":"- login_challenge"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - login_challenge
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S248 [7225, 7242]: "- login_challenge"
- Positive assertions:
  - CHG-20260721-248-POS-001: The implementation and evidence satisfy this exact source atom: - login_challenge
- Negative assertions:
  - CHG-20260721-248-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - login_challenge

### CHG-20260721-249
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - security_notice > - security_notice
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - security_notice
- Exact payload: {"verbatim_requirement":"- security_notice"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - security_notice
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S249 [7244, 7261]: "- security_notice"
- Positive assertions:
  - CHG-20260721-249-POS-001: The implementation and evidence satisfy this exact source atom: - security_notice
- Negative assertions:
  - CHG-20260721-249-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - security_notice

### CHG-20260721-250
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Every canonical workflow must reference one message class and one sender key. > Every canonical workflow must reference one message class and one sender key.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Every canonical workflow must reference one message class and one sender key.
- Exact payload: {"verbatim_requirement":"Every canonical workflow must reference one message class and one sender key."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Every canonical workflow must reference one message class and one sender key.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S250 [7265, 7342]: "Every canonical workflow must reference one message class and one sender key."
- Positive assertions:
  - CHG-20260721-250-POS-001: The implementation and evidence satisfy this exact source atom: Every canonical workflow must reference one message class and one sender key.
- Negative assertions:
  - CHG-20260721-250-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Every canonical workflow must reference one message class and one sender key.

### CHG-20260721-251
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > No workflow may contain an unregistered sender identity. > No workflow may contain an unregistered sender identity.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: No workflow may contain an unregistered sender identity.
- Exact payload: {"verbatim_requirement":"No workflow may contain an unregistered sender identity."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: No workflow may contain an unregistered sender identity.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S251 [7346, 7402]: "No workflow may contain an unregistered sender identity."
- Positive assertions:
  - CHG-20260721-251-POS-001: The implementation and evidence satisfy this exact source atom: No workflow may contain an unregistered sender identity.
- Negative assertions:
  - CHG-20260721-251-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: No workflow may contain an unregistered sender identity.

### CHG-20260721-252
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ## Pipeline registry > ## Pipeline registry
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ## Pipeline registry
- Exact payload: {"verbatim_requirement":"## Pipeline registry"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ## Pipeline registry
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S252 [7406, 7426]: "## Pipeline registry"
- Positive assertions:
  - CHG-20260721-252-POS-001: The implementation and evidence satisfy this exact source atom: ## Pipeline registry
- Negative assertions:
  - CHG-20260721-252-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ## Pipeline registry

### CHG-20260721-253
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Create or reconcile: > Create or reconcile:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Create or reconcile:
- Exact payload: {"verbatim_requirement":"Create or reconcile:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Create or reconcile:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S253 [7430, 7450]: "Create or reconcile:"
- Positive assertions:
  - CHG-20260721-253-POS-001: The implementation and evidence satisfy this exact source atom: Create or reconcile:
- Negative assertions:
  - CHG-20260721-253-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Create or reconcile:

### CHG-20260721-254
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ### One Time Enrollment and Conversion > ### One Time Enrollment and Conversion
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ### One Time Enrollment and Conversion
- Exact payload: {"verbatim_requirement":"### One Time Enrollment and Conversion"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ### One Time Enrollment and Conversion
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S254 [7454, 7492]: "### One Time Enrollment and Conversion"
- Positive assertions:
  - CHG-20260721-254-POS-001: The implementation and evidence satisfy this exact source atom: ### One Time Enrollment and Conversion
- Negative assertions:
  - CHG-20260721-254-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ### One Time Enrollment and Conversion

### CHG-20260721-255
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Stages: > Stages:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Stages:
- Exact payload: {"verbatim_requirement":"Stages:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Stages:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S255 [7496, 7503]: "Stages:"
- Positive assertions:
  - CHG-20260721-255-POS-001: The implementation and evidence satisfy this exact source atom: Stages:
- Negative assertions:
  - CHG-20260721-255-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Stages:

### CHG-20260721-256
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Warm Lead > - Warm Lead
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Warm Lead
- Exact payload: {"verbatim_requirement":"- Warm Lead"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Warm Lead
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S256 [7507, 7518]: "- Warm Lead"
- Positive assertions:
  - CHG-20260721-256-POS-001: The implementation and evidence satisfy this exact source atom: - Warm Lead
- Negative assertions:
  - CHG-20260721-256-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Warm Lead

### CHG-20260721-257
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Contacted > - Contacted
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Contacted
- Exact payload: {"verbatim_requirement":"- Contacted"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Contacted
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S257 [7520, 7531]: "- Contacted"
- Positive assertions:
  - CHG-20260721-257-POS-001: The implementation and evidence satisfy this exact source atom: - Contacted
- Negative assertions:
  - CHG-20260721-257-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Contacted

### CHG-20260721-258
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Engaged > - Engaged
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Engaged
- Exact payload: {"verbatim_requirement":"- Engaged"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Engaged
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S258 [7533, 7542]: "- Engaged"
- Positive assertions:
  - CHG-20260721-258-POS-001: The implementation and evidence satisfy this exact source atom: - Engaged
- Negative assertions:
  - CHG-20260721-258-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Engaged

### CHG-20260721-259
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Signup Started > - Signup Started
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Signup Started
- Exact payload: {"verbatim_requirement":"- Signup Started"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Signup Started
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S259 [7544, 7560]: "- Signup Started"
- Positive assertions:
  - CHG-20260721-259-POS-001: The implementation and evidence satisfy this exact source atom: - Signup Started
- Negative assertions:
  - CHG-20260721-259-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Signup Started

### CHG-20260721-260
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Signed Up > - Signed Up
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Signed Up
- Exact payload: {"verbatim_requirement":"- Signed Up"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Signed Up
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S260 [7562, 7573]: "- Signed Up"
- Positive assertions:
  - CHG-20260721-260-POS-001: The implementation and evidence satisfy this exact source atom: - Signed Up
- Negative assertions:
  - CHG-20260721-260-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Signed Up

### CHG-20260721-261
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Active Member > - Active Member
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Active Member
- Exact payload: {"verbatim_requirement":"- Active Member"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Active Member
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S261 [7575, 7590]: "- Active Member"
- Positive assertions:
  - CHG-20260721-261-POS-001: The implementation and evidence satisfy this exact source atom: - Active Member
- Negative assertions:
  - CHG-20260721-261-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Active Member

### CHG-20260721-262
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Not Now > - Not Now
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Not Now
- Exact payload: {"verbatim_requirement":"- Not Now"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Not Now
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S262 [7592, 7601]: "- Not Now"
- Positive assertions:
  - CHG-20260721-262-POS-001: The implementation and evidence satisfy this exact source atom: - Not Now
- Negative assertions:
  - CHG-20260721-262-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Not Now

### CHG-20260721-263
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Unqualified > - Unqualified
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Unqualified
- Exact payload: {"verbatim_requirement":"- Unqualified"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Unqualified
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S263 [7603, 7616]: "- Unqualified"
- Positive assertions:
  - CHG-20260721-263-POS-001: The implementation and evidence satisfy this exact source atom: - Unqualified
- Negative assertions:
  - CHG-20260721-263-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Unqualified

### CHG-20260721-264
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ### One Time Member Support > ### One Time Member Support
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ### One Time Member Support
- Exact payload: {"verbatim_requirement":"### One Time Member Support"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ### One Time Member Support
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S264 [7620, 7647]: "### One Time Member Support"
- Positive assertions:
  - CHG-20260721-264-POS-001: The implementation and evidence satisfy this exact source atom: ### One Time Member Support
- Negative assertions:
  - CHG-20260721-264-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ### One Time Member Support

### CHG-20260721-265
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Stages: > Stages:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Stages:
- Exact payload: {"verbatim_requirement":"Stages:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Stages:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S265 [7651, 7658]: "Stages:"
- Positive assertions:
  - CHG-20260721-265-POS-001: The implementation and evidence satisfy this exact source atom: Stages:
- Negative assertions:
  - CHG-20260721-265-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Stages:

### CHG-20260721-266
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - New > - New
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - New
- Exact payload: {"verbatim_requirement":"- New"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - New
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S266 [7662, 7667]: "- New"
- Positive assertions:
  - CHG-20260721-266-POS-001: The implementation and evidence satisfy this exact source atom: - New
- Negative assertions:
  - CHG-20260721-266-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - New

### CHG-20260721-267
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Triaged > - Triaged
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Triaged
- Exact payload: {"verbatim_requirement":"- Triaged"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Triaged
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S267 [7669, 7678]: "- Triaged"
- Positive assertions:
  - CHG-20260721-267-POS-001: The implementation and evidence satisfy this exact source atom: - Triaged
- Negative assertions:
  - CHG-20260721-267-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Triaged

### CHG-20260721-268
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - In Progress > - In Progress
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - In Progress
- Exact payload: {"verbatim_requirement":"- In Progress"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - In Progress
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S268 [7680, 7693]: "- In Progress"
- Positive assertions:
  - CHG-20260721-268-POS-001: The implementation and evidence satisfy this exact source atom: - In Progress
- Negative assertions:
  - CHG-20260721-268-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - In Progress

### CHG-20260721-269
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Waiting on Member > - Waiting on Member
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Waiting on Member
- Exact payload: {"verbatim_requirement":"- Waiting on Member"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Waiting on Member
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S269 [7695, 7714]: "- Waiting on Member"
- Positive assertions:
  - CHG-20260721-269-POS-001: The implementation and evidence satisfy this exact source atom: - Waiting on Member
- Negative assertions:
  - CHG-20260721-269-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Waiting on Member

### CHG-20260721-270
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Waiting on External Fix > - Waiting on External Fix
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Waiting on External Fix
- Exact payload: {"verbatim_requirement":"- Waiting on External Fix"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Waiting on External Fix
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S270 [7716, 7741]: "- Waiting on External Fix"
- Positive assertions:
  - CHG-20260721-270-POS-001: The implementation and evidence satisfy this exact source atom: - Waiting on External Fix
- Negative assertions:
  - CHG-20260721-270-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Waiting on External Fix

### CHG-20260721-271
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Resolved > - Resolved
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Resolved
- Exact payload: {"verbatim_requirement":"- Resolved"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Resolved
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S271 [7743, 7753]: "- Resolved"
- Positive assertions:
  - CHG-20260721-271-POS-001: The implementation and evidence satisfy this exact source atom: - Resolved
- Negative assertions:
  - CHG-20260721-271-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Resolved

### CHG-20260721-272
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Closed > - Closed
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Closed
- Exact payload: {"verbatim_requirement":"- Closed"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Closed
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S272 [7755, 7763]: "- Closed"
- Positive assertions:
  - CHG-20260721-272-POS-001: The implementation and evidence satisfy this exact source atom: - Closed
- Negative assertions:
  - CHG-20260721-272-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Closed

### CHG-20260721-273
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ### One Time Torah Questions > ### One Time Torah Questions
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ### One Time Torah Questions
- Exact payload: {"verbatim_requirement":"### One Time Torah Questions"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ### One Time Torah Questions
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S273 [7767, 7795]: "### One Time Torah Questions"
- Positive assertions:
  - CHG-20260721-273-POS-001: The implementation and evidence satisfy this exact source atom: ### One Time Torah Questions
- Negative assertions:
  - CHG-20260721-273-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ### One Time Torah Questions

### CHG-20260721-274
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Stages: > Stages:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Stages:
- Exact payload: {"verbatim_requirement":"Stages:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Stages:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S274 [7799, 7806]: "Stages:"
- Positive assertions:
  - CHG-20260721-274-POS-001: The implementation and evidence satisfy this exact source atom: Stages:
- Negative assertions:
  - CHG-20260721-274-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Stages:

### CHG-20260721-275
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - New > - New
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - New
- Exact payload: {"verbatim_requirement":"- New"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - New
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S275 [7810, 7815]: "- New"
- Positive assertions:
  - CHG-20260721-275-POS-001: The implementation and evidence satisfy this exact source atom: - New
- Negative assertions:
  - CHG-20260721-275-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - New

### CHG-20260721-276
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Shloimie Review > - Shloimie Review
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Shloimie Review
- Exact payload: {"verbatim_requirement":"- Shloimie Review"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Shloimie Review
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S276 [7817, 7834]: "- Shloimie Review"
- Positive assertions:
  - CHG-20260721-276-POS-001: The implementation and evidence satisfy this exact source atom: - Shloimie Review
- Negative assertions:
  - CHG-20260721-276-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Shloimie Review

### CHG-20260721-277
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Assigned to Rabbi > - Assigned to Rabbi
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Assigned to Rabbi
- Exact payload: {"verbatim_requirement":"- Assigned to Rabbi"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Assigned to Rabbi
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S277 [7836, 7855]: "- Assigned to Rabbi"
- Positive assertions:
  - CHG-20260721-277-POS-001: The implementation and evidence satisfy this exact source atom: - Assigned to Rabbi
- Negative assertions:
  - CHG-20260721-277-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Assigned to Rabbi

### CHG-20260721-278
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Rabbi Reviewing > - Rabbi Reviewing
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Rabbi Reviewing
- Exact payload: {"verbatim_requirement":"- Rabbi Reviewing"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Rabbi Reviewing
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S278 [7857, 7874]: "- Rabbi Reviewing"
- Positive assertions:
  - CHG-20260721-278-POS-001: The implementation and evidence satisfy this exact source atom: - Rabbi Reviewing
- Negative assertions:
  - CHG-20260721-278-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Rabbi Reviewing

### CHG-20260721-279
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Answer Sent > - Answer Sent
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Answer Sent
- Exact payload: {"verbatim_requirement":"- Answer Sent"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Answer Sent
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S279 [7876, 7889]: "- Answer Sent"
- Positive assertions:
  - CHG-20260721-279-POS-001: The implementation and evidence satisfy this exact source atom: - Answer Sent
- Negative assertions:
  - CHG-20260721-279-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Answer Sent

### CHG-20260721-280
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Waiting on Follow-Up > - Waiting on Follow-Up
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Waiting on Follow-Up
- Exact payload: {"verbatim_requirement":"- Waiting on Follow-Up"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Waiting on Follow-Up
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S280 [7891, 7913]: "- Waiting on Follow-Up"
- Positive assertions:
  - CHG-20260721-280-POS-001: The implementation and evidence satisfy this exact source atom: - Waiting on Follow-Up
- Negative assertions:
  - CHG-20260721-280-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Waiting on Follow-Up

### CHG-20260721-281
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Closed > - Closed
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Closed
- Exact payload: {"verbatim_requirement":"- Closed"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Closed
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S281 [7915, 7923]: "- Closed"
- Positive assertions:
  - CHG-20260721-281-POS-001: The implementation and evidence satisfy this exact source atom: - Closed
- Negative assertions:
  - CHG-20260721-281-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Closed

### CHG-20260721-282
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > The existing: > The existing:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: The existing:
- Exact payload: {"verbatim_requirement":"The existing:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: The existing:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S282 [7927, 7940]: "The existing:"
- Positive assertions:
  - CHG-20260721-282-POS-001: The implementation and evidence satisfy this exact source atom: The existing:
- Negative assertions:
  - CHG-20260721-282-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: The existing:

### CHG-20260721-283
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > One Time Business > One Time Business
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: One Time Business
- Exact payload: {"verbatim_requirement":"One Time Business"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: One Time Business
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S283 [7944, 7961]: "One Time Business"
- Positive assertions:
  - CHG-20260721-283-POS-001: The implementation and evidence satisfy this exact source atom: One Time Business
- Negative assertions:
  - CHG-20260721-283-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: One Time Business

### CHG-20260721-284
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > pipeline remains a compatibility alias until existing opportunities are mapped. > pipeline remains a compatibility alias until existing opportunities are mapped.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: pipeline remains a compatibility alias until existing opportunities are mapped.
- Exact payload: {"verbatim_requirement":"pipeline remains a compatibility alias until existing opportunities are mapped."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: pipeline remains a compatibility alias until existing opportunities are mapped.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S284 [7965, 8044]: "pipeline remains a compatibility alias until existing opportunities are mapped."
- Positive assertions:
  - CHG-20260721-284-POS-001: The implementation and evidence satisfy this exact source atom: pipeline remains a compatibility alias until existing opportunities are mapped.
- Negative assertions:
  - CHG-20260721-284-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: pipeline remains a compatibility alias until existing opportunities are mapped.

### CHG-20260721-285
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Do not delete or silently migrate existing opportunities in this lane. > Do not delete or silently migrate existing opportunities in this lane.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Do not delete or silently migrate existing opportunities in this lane.
- Exact payload: {"verbatim_requirement":"Do not delete or silently migrate existing opportunities in this lane."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Do not delete or silently migrate existing opportunities in this lane.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S285 [8048, 8118]: "Do not delete or silently migrate existing opportunities in this lane."
- Positive assertions:
  - CHG-20260721-285-POS-001: The implementation and evidence satisfy this exact source atom: Do not delete or silently migrate existing opportunities in this lane.
- Negative assertions:
  - CHG-20260721-285-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Do not delete or silently migrate existing opportunities in this lane.

### CHG-20260721-286
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Use the HighLevel API to create/reconcile the three pipelines and stages when the current API supports it. > Use the HighLevel API to create/reconcile the three pipelines and stages when the current API supports it.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Use the HighLevel API to create/reconcile the three pipelines and stages when the current API supports it.
- Exact payload: {"verbatim_requirement":"Use the HighLevel API to create/reconcile the three pipelines and stages when the current API supports it."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Use the HighLevel API to create/reconcile the three pipelines and stages when the current API supports it.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S286 [8122, 8228]: "Use the HighLevel API to create/reconcile the three pipelines and stages when the current API supports it."
- Positive assertions:
  - CHG-20260721-286-POS-001: The implementation and evidence satisfy this exact source atom: Use the HighLevel API to create/reconcile the three pipelines and stages when the current API supports it.
- Negative assertions:
  - CHG-20260721-286-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Use the HighLevel API to create/reconcile the three pipelines and stages when the current API supports it.

### CHG-20260721-287
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > When API rate limiting occurs: > When API rate limiting occurs:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: When API rate limiting occurs:
- Exact payload: {"verbatim_requirement":"When API rate limiting occurs:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: When API rate limiting occurs:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S287 [8232, 8262]: "When API rate limiting occurs:"
- Positive assertions:
  - CHG-20260721-287-POS-001: The implementation and evidence satisfy this exact source atom: When API rate limiting occurs:
- Negative assertions:
  - CHG-20260721-287-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: When API rate limiting occurs:

### CHG-20260721-288
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - retry with bounded exponential backoff > - retry with bounded exponential backoff
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - retry with bounded exponential backoff
- Exact payload: {"verbatim_requirement":"- retry with bounded exponential backoff"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - retry with bounded exponential backoff
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S288 [8266, 8306]: "- retry with bounded exponential backoff"
- Positive assertions:
  - CHG-20260721-288-POS-001: The implementation and evidence satisfy this exact source atom: - retry with bounded exponential backoff
- Negative assertions:
  - CHG-20260721-288-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - retry with bounded exponential backoff

### CHG-20260721-289
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - respect Retry-After > - respect Retry-After
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - respect Retry-After
- Exact payload: {"verbatim_requirement":"- respect Retry-After"}
- Placement: parent=The exact registry, workflow, queue, commit, or response section named in the source atom.; before=; after=; order=Preserve the exact positional or ordering relationship stated in the source atom.
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - respect Retry-After
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S289 [8309, 8330]: "- respect Retry-After"
- Positive assertions:
  - CHG-20260721-289-POS-001: The implementation and evidence satisfy this exact source atom: - respect Retry-After
- Negative assertions:
  - CHG-20260721-289-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - respect Retry-After

### CHG-20260721-290
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - do not treat failed reads as missing assets > - do not treat failed reads as missing assets
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - do not treat failed reads as missing assets
- Exact payload: {"verbatim_requirement":"- do not treat failed reads as missing assets"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - do not treat failed reads as missing assets
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S290 [8333, 8378]: "- do not treat failed reads as missing assets"
- Positive assertions:
  - CHG-20260721-290-POS-001: The implementation and evidence satisfy this exact source atom: - do not treat failed reads as missing assets
- Negative assertions:
  - CHG-20260721-290-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - do not treat failed reads as missing assets

### CHG-20260721-291
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - do not create duplicates > - do not create duplicates
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - do not create duplicates
- Exact payload: {"verbatim_requirement":"- do not create duplicates"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - do not create duplicates
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S291 [8381, 8407]: "- do not create duplicates"
- Positive assertions:
  - CHG-20260721-291-POS-001: The implementation and evidence satisfy this exact source atom: - do not create duplicates
- Negative assertions:
  - CHG-20260721-291-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - do not create duplicates

### CHG-20260721-292
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - record a safe API result. > - record a safe API result.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - record a safe API result.
- Exact payload: {"verbatim_requirement":"- record a safe API result."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - record a safe API result.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S292 [8410, 8437]: "- record a safe API result."
- Positive assertions:
  - CHG-20260721-292-POS-001: The implementation and evidence satisfy this exact source atom: - record a safe API result.
- Negative assertions:
  - CHG-20260721-292-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - record a safe API result.

### CHG-20260721-293
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > When an operation remains UI-only, create an Agent Mode job. > When an operation remains UI-only, create an Agent Mode job.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: When an operation remains UI-only, create an Agent Mode job.
- Exact payload: {"verbatim_requirement":"When an operation remains UI-only, create an Agent Mode job."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: When an operation remains UI-only, create an Agent Mode job.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S293 [8441, 8501]: "When an operation remains UI-only, create an Agent Mode job."
- Positive assertions:
  - CHG-20260721-293-POS-001: The implementation and evidence satisfy this exact source atom: When an operation remains UI-only, create an Agent Mode job.
- Negative assertions:
  - CHG-20260721-293-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: When an operation remains UI-only, create an Agent Mode job.

### CHG-20260721-294
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ## Event registry > ## Event registry
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ## Event registry
- Exact payload: {"verbatim_requirement":"## Event registry"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ## Event registry
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S294 [8505, 8522]: "## Event registry"
- Positive assertions:
  - CHG-20260721-294-POS-001: The implementation and evidence satisfy this exact source atom: ## Event registry
- Negative assertions:
  - CHG-20260721-294-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ## Event registry

### CHG-20260721-295
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Register: > Register:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Register:
- Exact payload: {"verbatim_requirement":"Register:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Register:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S295 [8526, 8535]: "Register:"
- Positive assertions:
  - CHG-20260721-295-POS-001: The implementation and evidence satisfy this exact source atom: Register:
- Negative assertions:
  - CHG-20260721-295-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Register:

### CHG-20260721-296
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > event_code: > event_code:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: event_code:
- Exact payload: {"verbatim_requirement":"event_code:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: event_code:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S296 [8539, 8550]: "event_code:"
- Positive assertions:
  - CHG-20260721-296-POS-001: The implementation and evidence satisfy this exact source atom: event_code:
- Negative assertions:
  - CHG-20260721-296-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: event_code:

### CHG-20260721-297
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > tisha-bav-2026 > tisha-bav-2026
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: tisha-bav-2026
- Exact payload: {"verbatim_requirement":"tisha-bav-2026"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: tisha-bav-2026
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S297 [8552, 8566]: "tisha-bav-2026"
- Positive assertions:
  - CHG-20260721-297-POS-001: The implementation and evidence satisfy this exact source atom: tisha-bav-2026
- Negative assertions:
  - CHG-20260721-297-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: tisha-bav-2026

### CHG-20260721-298
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Canonical workflow: > Canonical workflow:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Canonical workflow:
- Exact payload: {"verbatim_requirement":"Canonical workflow:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Canonical workflow:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S298 [8570, 8589]: "Canonical workflow:"
- Positive assertions:
  - CHG-20260721-298-POS-001: The implementation and evidence satisfy this exact source atom: Canonical workflow:
- Negative assertions:
  - CHG-20260721-298-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Canonical workflow:

### CHG-20260721-299
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > OT-E01 Tisha B'Av 2026 Registration and Reminders > OT-E01 Tisha B'Av 2026 Registration and Reminders
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: OT-E01 Tisha B'Av 2026 Registration and Reminders
- Exact payload: {"verbatim_requirement":"OT-E01 Tisha B'Av 2026 Registration and Reminders"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: OT-E01 Tisha B'Av 2026 Registration and Reminders
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S299 [8593, 8642]: "OT-E01 Tisha B'Av 2026 Registration and Reminders"
- Positive assertions:
  - CHG-20260721-299-POS-001: The implementation and evidence satisfy this exact source atom: OT-E01 Tisha B'Av 2026 Registration and Reminders
- Negative assertions:
  - CHG-20260721-299-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: OT-E01 Tisha B'Av 2026 Registration and Reminders

### CHG-20260721-300
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Canonical campaign: > Canonical campaign:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Canonical campaign:
- Exact payload: {"verbatim_requirement":"Canonical campaign:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Canonical campaign:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S300 [8646, 8665]: "Canonical campaign:"
- Positive assertions:
  - CHG-20260721-300-POS-001: The implementation and evidence satisfy this exact source atom: Canonical campaign:
- Negative assertions:
  - CHG-20260721-300-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Canonical campaign:

### CHG-20260721-301
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > OT-C01 Tisha B'Av 2026 Warm Invitation > OT-C01 Tisha B'Av 2026 Warm Invitation
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: OT-C01 Tisha B'Av 2026 Warm Invitation
- Exact payload: {"verbatim_requirement":"OT-C01 Tisha B'Av 2026 Warm Invitation"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: OT-C01 Tisha B'Av 2026 Warm Invitation
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S301 [8669, 8707]: "OT-C01 Tisha B'Av 2026 Warm Invitation"
- Positive assertions:
  - CHG-20260721-301-POS-001: The implementation and evidence satisfy this exact source atom: OT-C01 Tisha B'Av 2026 Warm Invitation
- Negative assertions:
  - CHG-20260721-301-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: OT-C01 Tisha B'Av 2026 Warm Invitation

### CHG-20260721-302
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Event invitation sender: > Event invitation sender:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Event invitation sender:
- Exact payload: {"verbatim_requirement":"Event invitation sender:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Event invitation sender:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S302 [8711, 8735]: "Event invitation sender:"
- Positive assertions:
  - CHG-20260721-302-POS-001: The implementation and evidence satisfy this exact source atom: Event invitation sender:
- Negative assertions:
  - CHG-20260721-302-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Event invitation sender:

### CHG-20260721-303
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > rabbi_campaign > rabbi_campaign
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: rabbi_campaign
- Exact payload: {"verbatim_requirement":"rabbi_campaign"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: rabbi_campaign
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S303 [8739, 8753]: "rabbi_campaign"
- Positive assertions:
  - CHG-20260721-303-POS-001: The implementation and evidence satisfy this exact source atom: rabbi_campaign
- Negative assertions:
  - CHG-20260721-303-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: rabbi_campaign

### CHG-20260721-304
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Registration/reminder sender: > Registration/reminder sender:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Registration/reminder sender:
- Exact payload: {"verbatim_requirement":"Registration/reminder sender:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Registration/reminder sender:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S304 [8757, 8786]: "Registration/reminder sender:"
- Positive assertions:
  - CHG-20260721-304-POS-001: The implementation and evidence satisfy this exact source atom: Registration/reminder sender:
- Negative assertions:
  - CHG-20260721-304-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Registration/reminder sender:

### CHG-20260721-305
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > brand or rabbi_campaign according to the approved prompt version. > brand or rabbi_campaign according to the approved prompt version.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: brand or rabbi_campaign according to the approved prompt version.
- Exact payload: {"verbatim_requirement":"brand or rabbi_campaign according to the approved prompt version."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: brand or rabbi_campaign according to the approved prompt version.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S305 [8790, 8855]: "brand or rabbi_campaign according to the approved prompt version."
- Positive assertions:
  - CHG-20260721-305-POS-001: The implementation and evidence satisfy this exact source atom: brand or rabbi_campaign according to the approved prompt version.
- Negative assertions:
  - CHG-20260721-305-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: brand or rabbi_campaign according to the approved prompt version.

### CHG-20260721-306
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Preserve event tags and values from the Tisha B'Av lane when already present. > Preserve event tags and values from the Tisha B'Av lane when already present.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Preserve event tags and values from the Tisha B'Av lane when already present.
- Exact payload: {"verbatim_requirement":"Preserve event tags and values from the Tisha B'Av lane when already present."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Preserve event tags and values from the Tisha B'Av lane when already present.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S306 [8859, 8936]: "Preserve event tags and values from the Tisha B'Av lane when already present."
- Positive assertions:
  - CHG-20260721-306-POS-001: The implementation and evidence satisfy this exact source atom: Preserve event tags and values from the Tisha B'Av lane when already present.
- Negative assertions:
  - CHG-20260721-306-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Preserve event tags and values from the Tisha B'Av lane when already present.

### CHG-20260721-307
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Do not duplicate them. > Do not duplicate them.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Do not duplicate them.
- Exact payload: {"verbatim_requirement":"Do not duplicate them."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Do not duplicate them.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S307 [8940, 8962]: "Do not duplicate them."
- Positive assertions:
  - CHG-20260721-307-POS-001: The implementation and evidence satisfy this exact source atom: Do not duplicate them.
- Negative assertions:
  - CHG-20260721-307-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Do not duplicate them.

### CHG-20260721-308
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ## Workflow sender mapping > ## Workflow sender mapping
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ## Workflow sender mapping
- Exact payload: {"verbatim_requirement":"## Workflow sender mapping"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ## Workflow sender mapping
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S308 [8966, 8992]: "## Workflow sender mapping"
- Positive assertions:
  - CHG-20260721-308-POS-001: The implementation and evidence satisfy this exact source atom: ## Workflow sender mapping
- Negative assertions:
  - CHG-20260721-308-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ## Workflow sender mapping

### CHG-20260721-309
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Update all canonical workflow prompt files and checklists. > Update all canonical workflow prompt files and checklists.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Update all canonical workflow prompt files and checklists.
- Exact payload: {"verbatim_requirement":"Update all canonical workflow prompt files and checklists."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Update all canonical workflow prompt files and checklists.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S309 [8996, 9054]: "Update all canonical workflow prompt files and checklists."
- Positive assertions:
  - CHG-20260721-309-POS-001: The implementation and evidence satisfy this exact source atom: Update all canonical workflow prompt files and checklists.
- Negative assertions:
  - CHG-20260721-309-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Update all canonical workflow prompt files and checklists.

### CHG-20260721-310
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ### rabbi_campaign > ### rabbi_campaign
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ### rabbi_campaign
- Exact payload: {"verbatim_requirement":"### rabbi_campaign"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ### rabbi_campaign
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S310 [9058, 9076]: "### rabbi_campaign"
- Positive assertions:
  - CHG-20260721-310-POS-001: The implementation and evidence satisfy this exact source atom: ### rabbi_campaign
- Negative assertions:
  - CHG-20260721-310-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ### rabbi_campaign

### CHG-20260721-311
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - OT-02A Existing Subscriber Migration 2026 v1 > - OT-02A Existing Subscriber Migration 2026 v1
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - OT-02A Existing Subscriber Migration 2026 v1
- Exact payload: {"verbatim_requirement":"- OT-02A Existing Subscriber Migration 2026 v1"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - OT-02A Existing Subscriber Migration 2026 v1
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S311 [9080, 9126]: "- OT-02A Existing Subscriber Migration 2026 v1"
- Positive assertions:
  - CHG-20260721-311-POS-001: The implementation and evidence satisfy this exact source atom: - OT-02A Existing Subscriber Migration 2026 v1
- Negative assertions:
  - CHG-20260721-311-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - OT-02A Existing Subscriber Migration 2026 v1

### CHG-20260721-312
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - OT-02B New Lead Nurture v1 > - OT-02B New Lead Nurture v1
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - OT-02B New Lead Nurture v1
- Exact payload: {"verbatim_requirement":"- OT-02B New Lead Nurture v1"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - OT-02B New Lead Nurture v1
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S312 [9128, 9156]: "- OT-02B New Lead Nurture v1"
- Positive assertions:
  - CHG-20260721-312-POS-001: The implementation and evidence satisfy this exact source atom: - OT-02B New Lead Nurture v1
- Negative assertions:
  - CHG-20260721-312-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - OT-02B New Lead Nurture v1

### CHG-20260721-313
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - OT-C01 Tisha B'Av 2026 Warm Invitation > - OT-C01 Tisha B'Av 2026 Warm Invitation
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - OT-C01 Tisha B'Av 2026 Warm Invitation
- Exact payload: {"verbatim_requirement":"- OT-C01 Tisha B'Av 2026 Warm Invitation"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - OT-C01 Tisha B'Av 2026 Warm Invitation
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S313 [9158, 9198]: "- OT-C01 Tisha B'Av 2026 Warm Invitation"
- Positive assertions:
  - CHG-20260721-313-POS-001: The implementation and evidence satisfy this exact source atom: - OT-C01 Tisha B'Av 2026 Warm Invitation
- Negative assertions:
  - CHG-20260721-313-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - OT-C01 Tisha B'Av 2026 Warm Invitation

### CHG-20260721-314
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - future Torah newsletters > - future Torah newsletters
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - future Torah newsletters
- Exact payload: {"verbatim_requirement":"- future Torah newsletters"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - future Torah newsletters
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S314 [9200, 9226]: "- future Torah newsletters"
- Positive assertions:
  - CHG-20260721-314-POS-001: The implementation and evidence satisfy this exact source atom: - future Torah newsletters
- Negative assertions:
  - CHG-20260721-314-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - future Torah newsletters

### CHG-20260721-315
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ### brand > ### brand
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ### brand
- Exact payload: {"verbatim_requirement":"### brand"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ### brand
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S315 [9230, 9239]: "### brand"
- Positive assertions:
  - CHG-20260721-315-POS-001: The implementation and evidence satisfy this exact source atom: ### brand
- Negative assertions:
  - CHG-20260721-315-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ### brand

### CHG-20260721-316
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - OT-04 Payment Active confirmation > - OT-04 Payment Active confirmation
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - OT-04 Payment Active confirmation
- Exact payload: {"verbatim_requirement":"- OT-04 Payment Active confirmation"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - OT-04 Payment Active confirmation
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S316 [9243, 9278]: "- OT-04 Payment Active confirmation"
- Positive assertions:
  - CHG-20260721-316-POS-001: The implementation and evidence satisfy this exact source atom: - OT-04 Payment Active confirmation
- Negative assertions:
  - CHG-20260721-316-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - OT-04 Payment Active confirmation

### CHG-20260721-317
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - OT-07 Parent Portal companion/welcome > - OT-07 Parent Portal companion/welcome
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - OT-07 Parent Portal companion/welcome
- Exact payload: {"verbatim_requirement":"- OT-07 Parent Portal companion/welcome"}
- Placement: parent=The exact registry, workflow, queue, commit, or response section named in the source atom.; before=; after=; order=Preserve the exact positional or ordering relationship stated in the source atom.
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - OT-07 Parent Portal companion/welcome
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S317 [9280, 9319]: "- OT-07 Parent Portal companion/welcome"
- Positive assertions:
  - CHG-20260721-317-POS-001: The implementation and evidence satisfy this exact source atom: - OT-07 Parent Portal companion/welcome
- Negative assertions:
  - CHG-20260721-317-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - OT-07 Parent Portal companion/welcome

### CHG-20260721-318
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - OT-08 Parent Portal Activated > - OT-08 Parent Portal Activated
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - OT-08 Parent Portal Activated
- Exact payload: {"verbatim_requirement":"- OT-08 Parent Portal Activated"}
- Placement: parent=The exact registry, workflow, queue, commit, or response section named in the source atom.; before=; after=; order=Preserve the exact positional or ordering relationship stated in the source atom.
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - OT-08 Parent Portal Activated
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S318 [9321, 9352]: "- OT-08 Parent Portal Activated"
- Positive assertions:
  - CHG-20260721-318-POS-001: The implementation and evidence satisfy this exact source atom: - OT-08 Parent Portal Activated
- Negative assertions:
  - CHG-20260721-318-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - OT-08 Parent Portal Activated

### CHG-20260721-319
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - OT-09 Parent Class Reminder > - OT-09 Parent Class Reminder
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - OT-09 Parent Class Reminder
- Exact payload: {"verbatim_requirement":"- OT-09 Parent Class Reminder"}
- Placement: parent=The exact registry, workflow, queue, commit, or response section named in the source atom.; before=; after=; order=Preserve the exact positional or ordering relationship stated in the source atom.
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - OT-09 Parent Class Reminder
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S319 [9354, 9383]: "- OT-09 Parent Class Reminder"
- Positive assertions:
  - CHG-20260721-319-POS-001: The implementation and evidence satisfy this exact source atom: - OT-09 Parent Class Reminder
- Negative assertions:
  - CHG-20260721-319-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - OT-09 Parent Class Reminder

### CHG-20260721-320
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - OT-10 New Recording Available > - OT-10 New Recording Available
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - OT-10 New Recording Available
- Exact payload: {"verbatim_requirement":"- OT-10 New Recording Available"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - OT-10 New Recording Available
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S320 [9385, 9416]: "- OT-10 New Recording Available"
- Positive assertions:
  - CHG-20260721-320-POS-001: The implementation and evidence satisfy this exact source atom: - OT-10 New Recording Available
- Negative assertions:
  - CHG-20260721-320-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - OT-10 New Recording Available

### CHG-20260721-321
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - OT-E01 event registration/reminders unless explicitly Rabbi-authored > - OT-E01 event registration/reminders unless explicitly Rabbi-authored
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - OT-E01 event registration/reminders unless explicitly Rabbi-authored
- Exact payload: {"verbatim_requirement":"- OT-E01 event registration/reminders unless explicitly Rabbi-authored"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - OT-E01 event registration/reminders unless explicitly Rabbi-authored
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S321 [9418, 9488]: "- OT-E01 event registration/reminders unless explicitly Rabbi-authored"
- Positive assertions:
  - CHG-20260721-321-POS-001: The implementation and evidence satisfy this exact source atom: - OT-E01 event registration/reminders unless explicitly Rabbi-authored
- Negative assertions:
  - CHG-20260721-321-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - OT-E01 event registration/reminders unless explicitly Rabbi-authored

### CHG-20260721-322
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - signup confirmations > - signup confirmations
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - signup confirmations
- Exact payload: {"verbatim_requirement":"- signup confirmations"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - signup confirmations
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S322 [9490, 9512]: "- signup confirmations"
- Positive assertions:
  - CHG-20260721-322-POS-001: The implementation and evidence satisfy this exact source atom: - signup confirmations
- Negative assertions:
  - CHG-20260721-322-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - signup confirmations

### CHG-20260721-323
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - schedule notices > - schedule notices
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - schedule notices
- Exact payload: {"verbatim_requirement":"- schedule notices"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - schedule notices
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S323 [9514, 9532]: "- schedule notices"
- Positive assertions:
  - CHG-20260721-323-POS-001: The implementation and evidence satisfy this exact source atom: - schedule notices
- Negative assertions:
  - CHG-20260721-323-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - schedule notices

### CHG-20260721-324
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - content notices > - content notices
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - content notices
- Exact payload: {"verbatim_requirement":"- content notices"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - content notices
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S324 [9534, 9551]: "- content notices"
- Positive assertions:
  - CHG-20260721-324-POS-001: The implementation and evidence satisfy this exact source atom: - content notices
- Negative assertions:
  - CHG-20260721-324-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - content notices

### CHG-20260721-325
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ### office > ### office
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ### office
- Exact payload: {"verbatim_requirement":"### office"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ### office
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S325 [9555, 9565]: "### office"
- Positive assertions:
  - CHG-20260721-325-POS-001: The implementation and evidence satisfy this exact source atom: ### office
- Negative assertions:
  - CHG-20260721-325-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ### office

### CHG-20260721-326
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - OT-05 Payment Failed / Grace > - OT-05 Payment Failed / Grace
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - OT-05 Payment Failed / Grace
- Exact payload: {"verbatim_requirement":"- OT-05 Payment Failed / Grace"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - OT-05 Payment Failed / Grace
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S326 [9569, 9599]: "- OT-05 Payment Failed / Grace"
- Positive assertions:
  - CHG-20260721-326-POS-001: The implementation and evidence satisfy this exact source atom: - OT-05 Payment Failed / Grace
- Negative assertions:
  - CHG-20260721-326-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - OT-05 Payment Failed / Grace

### CHG-20260721-328
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - OT-13 Refund / Chargeback > - OT-13 Refund / Chargeback
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - OT-13 Refund / Chargeback
- Exact payload: {"verbatim_requirement":"- OT-13 Refund / Chargeback"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - OT-13 Refund / Chargeback
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S328 [9663, 9690]: "- OT-13 Refund / Chargeback"
- Positive assertions:
  - CHG-20260721-328-POS-001: The implementation and evidence satisfy this exact source atom: - OT-13 Refund / Chargeback
- Negative assertions:
  - CHG-20260721-328-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - OT-13 Refund / Chargeback

### CHG-20260721-329
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - customer-support replies > - customer-support replies
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - customer-support replies
- Exact payload: {"verbatim_requirement":"- customer-support replies"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - customer-support replies
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S329 [9692, 9718]: "- customer-support replies"
- Positive assertions:
  - CHG-20260721-329-POS-001: The implementation and evidence satisfy this exact source atom: - customer-support replies
- Negative assertions:
  - CHG-20260721-329-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - customer-support replies

### CHG-20260721-330
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ### account_security / Resend > ### account_security / Resend
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ### account_security / Resend
- Exact payload: {"verbatim_requirement":"### account_security / Resend"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ### account_security / Resend
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S330 [9722, 9751]: "### account_security / Resend"
- Positive assertions:
  - CHG-20260721-330-POS-001: The implementation and evidence satisfy this exact source atom: ### account_security / Resend
- Negative assertions:
  - CHG-20260721-330-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ### account_security / Resend

### CHG-20260721-331
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - secure activation/setup > - secure activation/setup
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - secure activation/setup
- Exact payload: {"verbatim_requirement":"- secure activation/setup"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - secure activation/setup
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S331 [9755, 9780]: "- secure activation/setup"
- Positive assertions:
  - CHG-20260721-331-POS-001: The implementation and evidence satisfy this exact source atom: - secure activation/setup
- Negative assertions:
  - CHG-20260721-331-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - secure activation/setup

### CHG-20260721-332
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - password reset > - password reset
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - password reset
- Exact payload: {"verbatim_requirement":"- password reset"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - password reset
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S332 [9782, 9798]: "- password reset"
- Positive assertions:
  - CHG-20260721-332-POS-001: The implementation and evidence satisfy this exact source atom: - password reset
- Negative assertions:
  - CHG-20260721-332-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - password reset

### CHG-20260721-333
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - email verification > - email verification
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - email verification
- Exact payload: {"verbatim_requirement":"- email verification"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - email verification
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S333 [9800, 9820]: "- email verification"
- Positive assertions:
  - CHG-20260721-333-POS-001: The implementation and evidence satisfy this exact source atom: - email verification
- Negative assertions:
  - CHG-20260721-333-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - email verification

### CHG-20260721-334
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Administrator challenge > - Administrator challenge
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Administrator challenge
- Exact payload: {"verbatim_requirement":"- Administrator challenge"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Administrator challenge
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S334 [9822, 9847]: "- Administrator challenge"
- Positive assertions:
  - CHG-20260721-334-POS-001: The implementation and evidence satisfy this exact source atom: - Administrator challenge
- Negative assertions:
  - CHG-20260721-334-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Administrator challenge

### CHG-20260721-335
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Split OT-07 explicitly: > Split OT-07 explicitly:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Split OT-07 explicitly:
- Exact payload: {"verbatim_requirement":"Split OT-07 explicitly:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Split OT-07 explicitly:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S335 [9851, 9874]: "Split OT-07 explicitly:"
- Positive assertions:
  - CHG-20260721-335-POS-001: The implementation and evidence satisfy this exact source atom: Split OT-07 explicitly:
- Negative assertions:
  - CHG-20260721-335-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Split OT-07 explicitly:

### CHG-20260721-336
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > GHL sends the companion/welcome email. > GHL sends the companion/welcome email.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: GHL sends the companion/welcome email.
- Exact payload: {"verbatim_requirement":"GHL sends the companion/welcome email."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: GHL sends the companion/welcome email.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S336 [9881, 9919]: "GHL sends the companion/welcome email."
- Positive assertions:
  - CHG-20260721-336-POS-001: The implementation and evidence satisfy this exact source atom: GHL sends the companion/welcome email.
- Negative assertions:
  - CHG-20260721-336-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: GHL sends the companion/welcome email.

### CHG-20260721-337
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > One Time/Resend sends the secure activation token. > One Time/Resend sends the secure activation token.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: One Time/Resend sends the secure activation token.
- Exact payload: {"verbatim_requirement":"One Time/Resend sends the secure activation token."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: One Time/Resend sends the secure activation token.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S337 [9924, 9974]: "One Time/Resend sends the secure activation token."
- Positive assertions:
  - CHG-20260721-337-POS-001: The implementation and evidence satisfy this exact source atom: One Time/Resend sends the secure activation token.
- Negative assertions:
  - CHG-20260721-337-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: One Time/Resend sends the secure activation token.

### CHG-20260721-338
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > GHL must never store or send the activation/reset token. > GHL must never store or send the activation/reset token.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: GHL must never store or send the activation/reset token.
- Exact payload: {"verbatim_requirement":"GHL must never store or send the activation/reset token."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: GHL must never store or send the activation/reset token.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S338 [9978, 10034]: "GHL must never store or send the activation/reset token."
- Positive assertions:
  - CHG-20260721-338-POS-001: The implementation and evidence satisfy this exact source atom: GHL must never store or send the activation/reset token.
- Negative assertions:
  - CHG-20260721-338-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: GHL must never store or send the activation/reset token.

### CHG-20260721-339
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ## OT-A1 bot > ## OT-A1 bot
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ## OT-A1 bot
- Exact payload: {"verbatim_requirement":"## OT-A1 bot"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ## OT-A1 bot
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S339 [10038, 10050]: "## OT-A1 bot"
- Positive assertions:
  - CHG-20260721-339-POS-001: The implementation and evidence satisfy this exact source atom: ## OT-A1 bot
- Negative assertions:
  - CHG-20260721-339-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ## OT-A1 bot

### CHG-20260721-340
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Preserve one canonical bot: > Preserve one canonical bot:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Preserve one canonical bot:
- Exact payload: {"verbatim_requirement":"Preserve one canonical bot:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Preserve one canonical bot:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S340 [10054, 10081]: "Preserve one canonical bot:"
- Positive assertions:
  - CHG-20260721-340-POS-001: The implementation and evidence satisfy this exact source atom: Preserve one canonical bot:
- Negative assertions:
  - CHG-20260721-340-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Preserve one canonical bot:

### CHG-20260721-341
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > OT-A1 One Time Enrollment Assistant > OT-A1 One Time Enrollment Assistant
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: OT-A1 One Time Enrollment Assistant
- Exact payload: {"verbatim_requirement":"OT-A1 One Time Enrollment Assistant"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: OT-A1 One Time Enrollment Assistant
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S341 [10085, 10120]: "OT-A1 One Time Enrollment Assistant"
- Positive assertions:
  - CHG-20260721-341-POS-001: The implementation and evidence satisfy this exact source atom: OT-A1 One Time Enrollment Assistant
- Negative assertions:
  - CHG-20260721-341-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: OT-A1 One Time Enrollment Assistant

### CHG-20260721-342
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Channels: > Channels:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Channels:
- Exact payload: {"verbatim_requirement":"Channels:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Channels:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S342 [10124, 10133]: "Channels:"
- Positive assertions:
  - CHG-20260721-342-POS-001: The implementation and evidence satisfy this exact source atom: Channels:
- Negative assertions:
  - CHG-20260721-342-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Channels:

### CHG-20260721-343
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Website Live Chat > - Website Live Chat
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Website Live Chat
- Exact payload: {"verbatim_requirement":"- Website Live Chat"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Website Live Chat
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S343 [10137, 10156]: "- Website Live Chat"
- Positive assertions:
  - CHG-20260721-343-POS-001: The implementation and evidence satisfy this exact source atom: - Website Live Chat
- Negative assertions:
  - CHG-20260721-343-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Website Live Chat

### CHG-20260721-344
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - WhatsApp > - WhatsApp
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - WhatsApp
- Exact payload: {"verbatim_requirement":"- WhatsApp"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - WhatsApp
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S344 [10158, 10168]: "- WhatsApp"
- Positive assertions:
  - CHG-20260721-344-POS-001: The implementation and evidence satisfy this exact source atom: - WhatsApp
- Negative assertions:
  - CHG-20260721-344-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - WhatsApp

### CHG-20260721-345
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Voice remains deferred. > Voice remains deferred.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Voice remains deferred.
- Exact payload: {"verbatim_requirement":"Voice remains deferred."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Voice remains deferred.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S345 [10172, 10195]: "Voice remains deferred."
- Positive assertions:
  - CHG-20260721-345-POS-001: The implementation and evidence satisfy this exact source atom: Voice remains deferred.
- Negative assertions:
  - CHG-20260721-345-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Voice remains deferred.

### CHG-20260721-346
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Default operational owner: > Default operational owner:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Default operational owner:
- Exact payload: {"verbatim_requirement":"Default operational owner:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Default operational owner:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S346 [10199, 10225]: "Default operational owner:"
- Positive assertions:
  - CHG-20260721-346-POS-001: The implementation and evidence satisfy this exact source atom: Default operational owner:
- Negative assertions:
  - CHG-20260721-346-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Default operational owner:

### CHG-20260721-347
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Shloimie > Shloimie
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Shloimie
- Exact payload: {"verbatim_requirement":"Shloimie"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Shloimie
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S347 [10229, 10237]: "Shloimie"
- Positive assertions:
  - CHG-20260721-347-POS-001: The implementation and evidence satisfy this exact source atom: Shloimie
- Negative assertions:
  - CHG-20260721-347-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Shloimie

### CHG-20260721-348
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Only explicit substantive Torah questions route to: > Only explicit substantive Torah questions route to:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Only explicit substantive Torah questions route to:
- Exact payload: {"verbatim_requirement":"Only explicit substantive Torah questions route to:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Only explicit substantive Torah questions route to:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S348 [10241, 10292]: "Only explicit substantive Torah questions route to:"
- Positive assertions:
  - CHG-20260721-348-POS-001: The implementation and evidence satisfy this exact source atom: Only explicit substantive Torah questions route to:
- Negative assertions:
  - CHG-20260721-348-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Only explicit substantive Torah questions route to:

### CHG-20260721-349
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > One Time Torah Questions > One Time Torah Questions
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: One Time Torah Questions
- Exact payload: {"verbatim_requirement":"One Time Torah Questions"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: One Time Torah Questions
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S349 [10296, 10320]: "One Time Torah Questions"
- Positive assertions:
  - CHG-20260721-349-POS-001: The implementation and evidence satisfy this exact source atom: One Time Torah Questions
- Negative assertions:
  - CHG-20260721-349-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: One Time Torah Questions

### CHG-20260721-350
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Do not create: > Do not create:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Do not create:
- Exact payload: {"verbatim_requirement":"Do not create:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Do not create:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S350 [10324, 10338]: "Do not create:"
- Positive assertions:
  - CHG-20260721-350-POS-001: The implementation and evidence satisfy this exact source atom: Do not create:
- Negative assertions:
  - CHG-20260721-350-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Do not create:

### CHG-20260721-351
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Human Handoff > - Human Handoff
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Human Handoff
- Exact payload: {"verbatim_requirement":"- Human Handoff"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Human Handoff
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S351 [10342, 10357]: "- Human Handoff"
- Positive assertions:
  - CHG-20260721-351-POS-001: The implementation and evidence satisfy this exact source atom: - Human Handoff
- Negative assertions:
  - CHG-20260721-351-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Human Handoff

### CHG-20260721-352
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - human tasks > - human tasks
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - human tasks
- Exact payload: {"verbatim_requirement":"- human tasks"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - human tasks
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S352 [10360, 10373]: "- human tasks"
- Positive assertions:
  - CHG-20260721-352-POS-001: The implementation and evidence satisfy this exact source atom: - human tasks
- Negative assertions:
  - CHG-20260721-352-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - human tasks

### CHG-20260721-353
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - separate WhatsApp qualification bot > - separate WhatsApp qualification bot
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - separate WhatsApp qualification bot
- Exact payload: {"verbatim_requirement":"- separate WhatsApp qualification bot"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - separate WhatsApp qualification bot
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S353 [10376, 10413]: "- separate WhatsApp qualification bot"
- Positive assertions:
  - CHG-20260721-353-POS-001: The implementation and evidence satisfy this exact source atom: - separate WhatsApp qualification bot
- Negative assertions:
  - CHG-20260721-353-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - separate WhatsApp qualification bot

### CHG-20260721-354
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - duplicate lead workflows > - duplicate lead workflows
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - duplicate lead workflows
- Exact payload: {"verbatim_requirement":"- duplicate lead workflows"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - duplicate lead workflows
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S354 [10416, 10442]: "- duplicate lead workflows"
- Positive assertions:
  - CHG-20260721-354-POS-001: The implementation and evidence satisfy this exact source atom: - duplicate lead workflows
- Negative assertions:
  - CHG-20260721-354-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - duplicate lead workflows

### CHG-20260721-355
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - automatic promise that a person will reply. > - automatic promise that a person will reply.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - automatic promise that a person will reply.
- Exact payload: {"verbatim_requirement":"- automatic promise that a person will reply."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - automatic promise that a person will reply.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S355 [10445, 10490]: "- automatic promise that a person will reply."
- Positive assertions:
  - CHG-20260721-355-POS-001: The implementation and evidence satisfy this exact source atom: - automatic promise that a person will reply.
- Negative assertions:
  - CHG-20260721-355-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - automatic promise that a person will reply.

### CHG-20260721-356
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Fallback remains: > Fallback remains:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Fallback remains:
- Exact payload: {"verbatim_requirement":"Fallback remains:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Fallback remains:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S356 [10494, 10511]: "Fallback remains:"
- Positive assertions:
  - CHG-20260721-356-POS-001: The implementation and evidence satisfy this exact source atom: Fallback remains:
- Negative assertions:
  - CHG-20260721-356-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Fallback remains:

### CHG-20260721-357
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > I do not have that information confirmed. > I do not have that information confirmed.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: I do not have that information confirmed.
- Exact payload: {"verbatim_requirement":"I do not have that information confirmed."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: I do not have that information confirmed.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S357 [10515, 10556]: "I do not have that information confirmed."
- Positive assertions:
  - CHG-20260721-357-POS-001: The implementation and evidence satisfy this exact source atom: I do not have that information confirmed.
- Negative assertions:
  - CHG-20260721-357-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: I do not have that information confirmed.

### CHG-20260721-358
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Please email info@onetimeonetime.com. > Please email info@onetimeonetime.com.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Please email info@onetimeonetime.com.
- Exact payload: {"verbatim_requirement":"Please email info@onetimeonetime.com."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Please email info@onetimeonetime.com.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S358 [10557, 10594]: "Please email info@onetimeonetime.com."
- Positive assertions:
  - CHG-20260721-358-POS-001: The implementation and evidence satisfy this exact source atom: Please email info@onetimeonetime.com.
- Negative assertions:
  - CHG-20260721-358-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Please email info@onetimeonetime.com.

### CHG-20260721-359
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ## Telegram contract > ## Telegram contract
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ## Telegram contract
- Exact payload: {"verbatim_requirement":"## Telegram contract"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ## Telegram contract
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S359 [10598, 10618]: "## Telegram contract"
- Positive assertions:
  - CHG-20260721-359-POS-001: The implementation and evidence satisfy this exact source atom: ## Telegram contract
- Negative assertions:
  - CHG-20260721-359-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ## Telegram contract

### CHG-20260721-360
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Create: > Create:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Create:
- Exact payload: {"verbatim_requirement":"Create:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Create:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S360 [10622, 10629]: "Create:"
- Positive assertions:
  - CHG-20260721-360-POS-001: The implementation and evidence satisfy this exact source atom: Create:
- Negative assertions:
  - CHG-20260721-360-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Create:

### CHG-20260721-361
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/registry/rabbi-telegram-contract.yaml > integrations/highlevel/registry/rabbi-telegram-contract.yaml
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/registry/rabbi-telegram-contract.yaml
- Exact payload: {"verbatim_requirement":"integrations/highlevel/registry/rabbi-telegram-contract.yaml"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/registry/rabbi-telegram-contract.yaml
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S361 [10633, 10693]: "integrations/highlevel/registry/rabbi-telegram-contract.yaml"
- Positive assertions:
  - CHG-20260721-361-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/registry/rabbi-telegram-contract.yaml
- Negative assertions:
  - CHG-20260721-361-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/registry/rabbi-telegram-contract.yaml

### CHG-20260721-362
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Register: > Register:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Register:
- Exact payload: {"verbatim_requirement":"Register:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Register:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S362 [10697, 10706]: "Register:"
- Positive assertions:
  - CHG-20260721-362-POS-001: The implementation and evidence satisfy this exact source atom: Register:
- Negative assertions:
  - CHG-20260721-362-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Register:

### CHG-20260721-363
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > one_time_rabbi_torah_console > one_time_rabbi_torah_console
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: one_time_rabbi_torah_console
- Exact payload: {"verbatim_requirement":"one_time_rabbi_torah_console"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: one_time_rabbi_torah_console
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S363 [10710, 10738]: "one_time_rabbi_torah_console"
- Positive assertions:
  - CHG-20260721-363-POS-001: The implementation and evidence satisfy this exact source atom: one_time_rabbi_torah_console
- Negative assertions:
  - CHG-20260721-363-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: one_time_rabbi_torah_console

### CHG-20260721-364
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Allowed: > Allowed:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Allowed:
- Exact payload: {"verbatim_requirement":"Allowed:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Allowed:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S364 [10742, 10750]: "Allowed:"
- Positive assertions:
  - CHG-20260721-364-POS-001: The implementation and evidence satisfy this exact source atom: Allowed:
- Negative assertions:
  - CHG-20260721-364-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Allowed:

### CHG-20260721-365
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - list assigned Torah questions > - list assigned Torah questions
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - list assigned Torah questions
- Exact payload: {"verbatim_requirement":"- list assigned Torah questions"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - list assigned Torah questions
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S365 [10754, 10785]: "- list assigned Torah questions"
- Positive assertions:
  - CHG-20260721-365-POS-001: The implementation and evidence satisfy this exact source atom: - list assigned Torah questions
- Negative assertions:
  - CHG-20260721-365-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - list assigned Torah questions

### CHG-20260721-366
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - open question > - open question
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - open question
- Exact payload: {"verbatim_requirement":"- open question"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - open question
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S366 [10788, 10803]: "- open question"
- Positive assertions:
  - CHG-20260721-366-POS-001: The implementation and evidence satisfy this exact source atom: - open question
- Negative assertions:
  - CHG-20260721-366-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - open question

### CHG-20260721-367
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - accept Rabbi text or voice response > - accept Rabbi text or voice response
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - accept Rabbi text or voice response
- Exact payload: {"verbatim_requirement":"- accept Rabbi text or voice response"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - accept Rabbi text or voice response
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S367 [10806, 10843]: "- accept Rabbi text or voice response"
- Positive assertions:
  - CHG-20260721-367-POS-001: The implementation and evidence satisfy this exact source atom: - accept Rabbi text or voice response
- Negative assertions:
  - CHG-20260721-367-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - accept Rabbi text or voice response

### CHG-20260721-368
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - produce a preview > - produce a preview
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - produce a preview
- Exact payload: {"verbatim_requirement":"- produce a preview"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - produce a preview
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S368 [10846, 10865]: "- produce a preview"
- Positive assertions:
  - CHG-20260721-368-POS-001: The implementation and evidence satisfy this exact source atom: - produce a preview
- Negative assertions:
  - CHG-20260721-368-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - produce a preview

### CHG-20260721-369
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - save draft > - save draft
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - save draft
- Exact payload: {"verbatim_requirement":"- save draft"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - save draft
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S369 [10868, 10880]: "- save draft"
- Positive assertions:
  - CHG-20260721-369-POS-001: The implementation and evidence satisfy this exact source atom: - save draft
- Negative assertions:
  - CHG-20260721-369-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - save draft

### CHG-20260721-370
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - send confirmed reply through the same GHL conversation > - send confirmed reply through the same GHL conversation
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - send confirmed reply through the same GHL conversation
- Exact payload: {"verbatim_requirement":"- send confirmed reply through the same GHL conversation"}
- Placement: parent=The exact registry, workflow, queue, commit, or response section named in the source atom.; before=; after=; order=Preserve the exact positional or ordering relationship stated in the source atom.
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - send confirmed reply through the same GHL conversation
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S370 [10883, 10939]: "- send confirmed reply through the same GHL conversation"
- Positive assertions:
  - CHG-20260721-370-POS-001: The implementation and evidence satisfy this exact source atom: - send confirmed reply through the same GHL conversation
- Negative assertions:
  - CHG-20260721-370-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - send confirmed reply through the same GHL conversation

### CHG-20260721-371
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - return question to Shloimie > - return question to Shloimie
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - return question to Shloimie
- Exact payload: {"verbatim_requirement":"- return question to Shloimie"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - return question to Shloimie
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S371 [10942, 10971]: "- return question to Shloimie"
- Positive assertions:
  - CHG-20260721-371-POS-001: The implementation and evidence satisfy this exact source atom: - return question to Shloimie
- Negative assertions:
  - CHG-20260721-371-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - return question to Shloimie

### CHG-20260721-372
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - close question > - close question
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - close question
- Exact payload: {"verbatim_requirement":"- close question"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - close question
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S372 [10974, 10990]: "- close question"
- Positive assertions:
  - CHG-20260721-372-POS-001: The implementation and evidence satisfy this exact source atom: - close question
- Negative assertions:
  - CHG-20260721-372-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - close question

### CHG-20260721-373
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - draft Torah newsletter > - draft Torah newsletter
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - draft Torah newsletter
- Exact payload: {"verbatim_requirement":"- draft Torah newsletter"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - draft Torah newsletter
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S373 [10993, 11017]: "- draft Torah newsletter"
- Positive assertions:
  - CHG-20260721-373-POS-001: The implementation and evidence satisfy this exact source atom: - draft Torah newsletter
- Negative assertions:
  - CHG-20260721-373-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - draft Torah newsletter

### CHG-20260721-374
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - draft warm enrollment email > - draft warm enrollment email
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - draft warm enrollment email
- Exact payload: {"verbatim_requirement":"- draft warm enrollment email"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - draft warm enrollment email
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S374 [11020, 11049]: "- draft warm enrollment email"
- Positive assertions:
  - CHG-20260721-374-POS-001: The implementation and evidence satisfy this exact source atom: - draft warm enrollment email
- Negative assertions:
  - CHG-20260721-374-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - draft warm enrollment email

### CHG-20260721-375
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - show campaign audience and suppression results > - show campaign audience and suppression results
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - show campaign audience and suppression results
- Exact payload: {"verbatim_requirement":"- show campaign audience and suppression results"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - show campaign audience and suppression results
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S375 [11052, 11100]: "- show campaign audience and suppression results"
- Positive assertions:
  - CHG-20260721-375-POS-001: The implementation and evidence satisfy this exact source atom: - show campaign audience and suppression results
- Negative assertions:
  - CHG-20260721-375-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - show campaign audience and suppression results

### CHG-20260721-376
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - trigger an approved campaign only after explicit confirmation. > - trigger an approved campaign only after explicit confirmation.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - trigger an approved campaign only after explicit confirmation.
- Exact payload: {"verbatim_requirement":"- trigger an approved campaign only after explicit confirmation."}
- Placement: parent=The exact registry, workflow, queue, commit, or response section named in the source atom.; before=; after=; order=Preserve the exact positional or ordering relationship stated in the source atom.
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - trigger an approved campaign only after explicit confirmation.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S376 [11103, 11167]: "- trigger an approved campaign only after explicit confirmation."
- Positive assertions:
  - CHG-20260721-376-POS-001: The implementation and evidence satisfy this exact source atom: - trigger an approved campaign only after explicit confirmation.
- Negative assertions:
  - CHG-20260721-376-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - trigger an approved campaign only after explicit confirmation.

### CHG-20260721-377
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Forbidden: > Forbidden:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Forbidden:
- Exact payload: {"verbatim_requirement":"Forbidden:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Forbidden:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S377 [11171, 11181]: "Forbidden:"
- Positive assertions:
  - CHG-20260721-377-POS-001: The implementation and evidence satisfy this exact source atom: Forbidden:
- Negative assertions:
  - CHG-20260721-377-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Forbidden:

### CHG-20260721-378
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - general support queue > - general support queue
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - general support queue
- Exact payload: {"verbatim_requirement":"- general support queue"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - general support queue
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S378 [11185, 11208]: "- general support queue"
- Positive assertions:
  - CHG-20260721-378-POS-001: The implementation and evidence satisfy this exact source atom: - general support queue
- Negative assertions:
  - CHG-20260721-378-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - general support queue

### CHG-20260721-379
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - technical issues > - technical issues
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - technical issues
- Exact payload: {"verbatim_requirement":"- technical issues"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - technical issues
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S379 [11211, 11229]: "- technical issues"
- Positive assertions:
  - CHG-20260721-379-POS-001: The implementation and evidence satisfy this exact source atom: - technical issues
- Negative assertions:
  - CHG-20260721-379-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - technical issues

### CHG-20260721-380
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - billing > - billing
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - billing
- Exact payload: {"verbatim_requirement":"- billing"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - billing
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S380 [11232, 11241]: "- billing"
- Positive assertions:
  - CHG-20260721-380-POS-001: The implementation and evidence satisfy this exact source atom: - billing
- Negative assertions:
  - CHG-20260721-380-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - billing

### CHG-20260721-381
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - parent administration > - parent administration
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - parent administration
- Exact payload: {"verbatim_requirement":"- parent administration"}
- Placement: parent=The exact registry, workflow, queue, commit, or response section named in the source atom.; before=; after=; order=Preserve the exact positional or ordering relationship stated in the source atom.
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - parent administration
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S381 [11244, 11267]: "- parent administration"
- Positive assertions:
  - CHG-20260721-381-POS-001: The implementation and evidence satisfy this exact source atom: - parent administration
- Negative assertions:
  - CHG-20260721-381-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - parent administration

### CHG-20260721-382
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - independent AI Torah answers > - independent AI Torah answers
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - independent AI Torah answers
- Exact payload: {"verbatim_requirement":"- independent AI Torah answers"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - independent AI Torah answers
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S382 [11270, 11300]: "- independent AI Torah answers"
- Positive assertions:
  - CHG-20260721-382-POS-001: The implementation and evidence satisfy this exact source atom: - independent AI Torah answers
- Negative assertions:
  - CHG-20260721-382-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - independent AI Torah answers

### CHG-20260721-383
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - independent bulk audience selection > - independent bulk audience selection
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - independent bulk audience selection
- Exact payload: {"verbatim_requirement":"- independent bulk audience selection"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - independent bulk audience selection
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S383 [11303, 11340]: "- independent bulk audience selection"
- Positive assertions:
  - CHG-20260721-383-POS-001: The implementation and evidence satisfy this exact source atom: - independent bulk audience selection
- Negative assertions:
  - CHG-20260721-383-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - independent bulk audience selection

### CHG-20260721-384
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - separate Telegram transcript > - separate Telegram transcript
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - separate Telegram transcript
- Exact payload: {"verbatim_requirement":"- separate Telegram transcript"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - separate Telegram transcript
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S384 [11343, 11373]: "- separate Telegram transcript"
- Positive assertions:
  - CHG-20260721-384-POS-001: The implementation and evidence satisfy this exact source atom: - separate Telegram transcript
- Negative assertions:
  - CHG-20260721-384-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - separate Telegram transcript

### CHG-20260721-385
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - vague bulk-send command. > - vague bulk-send command.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - vague bulk-send command.
- Exact payload: {"verbatim_requirement":"- vague bulk-send command."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - vague bulk-send command.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S385 [11376, 11402]: "- vague bulk-send command."
- Positive assertions:
  - CHG-20260721-385-POS-001: The implementation and evidence satisfy this exact source atom: - vague bulk-send command.
- Negative assertions:
  - CHG-20260721-385-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - vague bulk-send command.

### CHG-20260721-386
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ## Custom values > ## Custom values
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ## Custom values
- Exact payload: {"verbatim_requirement":"## Custom values"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ## Custom values
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S386 [11406, 11422]: "## Custom values"
- Positive assertions:
  - CHG-20260721-386-POS-001: The implementation and evidence satisfy this exact source atom: ## Custom values
- Negative assertions:
  - CHG-20260721-386-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ## Custom values

### CHG-20260721-387
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Create/reconcile registered sender custom values. > Create/reconcile registered sender custom values.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Create/reconcile registered sender custom values.
- Exact payload: {"verbatim_requirement":"Create/reconcile registered sender custom values."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Create/reconcile registered sender custom values.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S387 [11426, 11475]: "Create/reconcile registered sender custom values."
- Positive assertions:
  - CHG-20260721-387-POS-001: The implementation and evidence satisfy this exact source atom: Create/reconcile registered sender custom values.
- Negative assertions:
  - CHG-20260721-387-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Create/reconcile registered sender custom values.

### CHG-20260721-388
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Suggested folder: > Suggested folder:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Suggested folder:
- Exact payload: {"verbatim_requirement":"Suggested folder:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Suggested folder:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S388 [11479, 11496]: "Suggested folder:"
- Positive assertions:
  - CHG-20260721-388-POS-001: The implementation and evidence satisfy this exact source atom: Suggested folder:
- Negative assertions:
  - CHG-20260721-388-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Suggested folder:

### CHG-20260721-389
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > One Time - Senders > One Time - Senders
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: One Time - Senders
- Exact payload: {"verbatim_requirement":"One Time - Senders"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: One Time - Senders
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S389 [11500, 11518]: "One Time - Senders"
- Positive assertions:
  - CHG-20260721-389-POS-001: The implementation and evidence satisfy this exact source atom: One Time - Senders
- Negative assertions:
  - CHG-20260721-389-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: One Time - Senders

### CHG-20260721-390
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Values: > Values:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Values:
- Exact payload: {"verbatim_requirement":"Values:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Values:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S390 [11522, 11529]: "Values:"
- Positive assertions:
  - CHG-20260721-390-POS-001: The implementation and evidence satisfy this exact source atom: Values:
- Negative assertions:
  - CHG-20260721-390-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Values:

### CHG-20260721-391
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - One Time Rabbi Campaign Sender Name > - One Time Rabbi Campaign Sender Name
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - One Time Rabbi Campaign Sender Name
- Exact payload: {"verbatim_requirement":"- One Time Rabbi Campaign Sender Name"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - One Time Rabbi Campaign Sender Name
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S391 [11533, 11570]: "- One Time Rabbi Campaign Sender Name"
- Positive assertions:
  - CHG-20260721-391-POS-001: The implementation and evidence satisfy this exact source atom: - One Time Rabbi Campaign Sender Name
- Negative assertions:
  - CHG-20260721-391-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - One Time Rabbi Campaign Sender Name

### CHG-20260721-392
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - One Time Rabbi Campaign Phase 1 From > - One Time Rabbi Campaign Phase 1 From
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - One Time Rabbi Campaign Phase 1 From
- Exact payload: {"verbatim_requirement":"- One Time Rabbi Campaign Phase 1 From"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - One Time Rabbi Campaign Phase 1 From
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S392 [11572, 11610]: "- One Time Rabbi Campaign Phase 1 From"
- Positive assertions:
  - CHG-20260721-392-POS-001: The implementation and evidence satisfy this exact source atom: - One Time Rabbi Campaign Phase 1 From
- Negative assertions:
  - CHG-20260721-392-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - One Time Rabbi Campaign Phase 1 From

### CHG-20260721-393
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - One Time Rabbi Campaign Phase 2 From > - One Time Rabbi Campaign Phase 2 From
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - One Time Rabbi Campaign Phase 2 From
- Exact payload: {"verbatim_requirement":"- One Time Rabbi Campaign Phase 2 From"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - One Time Rabbi Campaign Phase 2 From
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S393 [11612, 11650]: "- One Time Rabbi Campaign Phase 2 From"
- Positive assertions:
  - CHG-20260721-393-POS-001: The implementation and evidence satisfy this exact source atom: - One Time Rabbi Campaign Phase 2 From
- Negative assertions:
  - CHG-20260721-393-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - One Time Rabbi Campaign Phase 2 From

### CHG-20260721-394
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - One Time Rabbi Personal Sender Name > - One Time Rabbi Personal Sender Name
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - One Time Rabbi Personal Sender Name
- Exact payload: {"verbatim_requirement":"- One Time Rabbi Personal Sender Name"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - One Time Rabbi Personal Sender Name
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S394 [11652, 11689]: "- One Time Rabbi Personal Sender Name"
- Positive assertions:
  - CHG-20260721-394-POS-001: The implementation and evidence satisfy this exact source atom: - One Time Rabbi Personal Sender Name
- Negative assertions:
  - CHG-20260721-394-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - One Time Rabbi Personal Sender Name

### CHG-20260721-395
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - One Time Rabbi Personal From > - One Time Rabbi Personal From
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - One Time Rabbi Personal From
- Exact payload: {"verbatim_requirement":"- One Time Rabbi Personal From"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - One Time Rabbi Personal From
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S395 [11691, 11721]: "- One Time Rabbi Personal From"
- Positive assertions:
  - CHG-20260721-395-POS-001: The implementation and evidence satisfy this exact source atom: - One Time Rabbi Personal From
- Negative assertions:
  - CHG-20260721-395-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - One Time Rabbi Personal From

### CHG-20260721-396
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - One Time Office Sender Name > - One Time Office Sender Name
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - One Time Office Sender Name
- Exact payload: {"verbatim_requirement":"- One Time Office Sender Name"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - One Time Office Sender Name
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S396 [11723, 11752]: "- One Time Office Sender Name"
- Positive assertions:
  - CHG-20260721-396-POS-001: The implementation and evidence satisfy this exact source atom: - One Time Office Sender Name
- Negative assertions:
  - CHG-20260721-396-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - One Time Office Sender Name

### CHG-20260721-397
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - One Time Office From > - One Time Office From
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - One Time Office From
- Exact payload: {"verbatim_requirement":"- One Time Office From"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - One Time Office From
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S397 [11754, 11776]: "- One Time Office From"
- Positive assertions:
  - CHG-20260721-397-POS-001: The implementation and evidence satisfy this exact source atom: - One Time Office From
- Negative assertions:
  - CHG-20260721-397-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - One Time Office From

### CHG-20260721-398
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - One Time Brand Sender Name > - One Time Brand Sender Name
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - One Time Brand Sender Name
- Exact payload: {"verbatim_requirement":"- One Time Brand Sender Name"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - One Time Brand Sender Name
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S398 [11778, 11806]: "- One Time Brand Sender Name"
- Positive assertions:
  - CHG-20260721-398-POS-001: The implementation and evidence satisfy this exact source atom: - One Time Brand Sender Name
- Negative assertions:
  - CHG-20260721-398-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - One Time Brand Sender Name

### CHG-20260721-399
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - One Time Brand From > - One Time Brand From
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - One Time Brand From
- Exact payload: {"verbatim_requirement":"- One Time Brand From"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - One Time Brand From
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S399 [11808, 11829]: "- One Time Brand From"
- Positive assertions:
  - CHG-20260721-399-POS-001: The implementation and evidence satisfy this exact source atom: - One Time Brand From
- Negative assertions:
  - CHG-20260721-399-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - One Time Brand From

### CHG-20260721-400
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - One Time Account Sender Name > - One Time Account Sender Name
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - One Time Account Sender Name
- Exact payload: {"verbatim_requirement":"- One Time Account Sender Name"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - One Time Account Sender Name
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S400 [11831, 11861]: "- One Time Account Sender Name"
- Positive assertions:
  - CHG-20260721-400-POS-001: The implementation and evidence satisfy this exact source atom: - One Time Account Sender Name
- Negative assertions:
  - CHG-20260721-400-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - One Time Account Sender Name

### CHG-20260721-401
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - One Time Account Preferred From > - One Time Account Preferred From
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - One Time Account Preferred From
- Exact payload: {"verbatim_requirement":"- One Time Account Preferred From"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - One Time Account Preferred From
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S401 [11863, 11896]: "- One Time Account Preferred From"
- Positive assertions:
  - CHG-20260721-401-POS-001: The implementation and evidence satisfy this exact source atom: - One Time Account Preferred From
- Negative assertions:
  - CHG-20260721-401-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - One Time Account Preferred From

### CHG-20260721-402
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - One Time Default Reply-To > - One Time Default Reply-To
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - One Time Default Reply-To
- Exact payload: {"verbatim_requirement":"- One Time Default Reply-To"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - One Time Default Reply-To
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S402 [11898, 11925]: "- One Time Default Reply-To"
- Positive assertions:
  - CHG-20260721-402-POS-001: The implementation and evidence satisfy this exact source atom: - One Time Default Reply-To
- Negative assertions:
  - CHG-20260721-402-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - One Time Default Reply-To

### CHG-20260721-403
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Do not delete the existing generic sender values. > Do not delete the existing generic sender values.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Do not delete the existing generic sender values.
- Exact payload: {"verbatim_requirement":"Do not delete the existing generic sender values."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Do not delete the existing generic sender values.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S403 [11929, 11978]: "Do not delete the existing generic sender values."
- Positive assertions:
  - CHG-20260721-403-POS-001: The implementation and evidence satisfy this exact source atom: Do not delete the existing generic sender values.
- Negative assertions:
  - CHG-20260721-403-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Do not delete the existing generic sender values.

### CHG-20260721-404
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Mark them as compatibility aliases and map them to the appropriate canonical sender. > Mark them as compatibility aliases and map them to the appropriate canonical sender.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Mark them as compatibility aliases and map them to the appropriate canonical sender.
- Exact payload: {"verbatim_requirement":"Mark them as compatibility aliases and map them to the appropriate canonical sender."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Mark them as compatibility aliases and map them to the appropriate canonical sender.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S404 [11982, 12066]: "Mark them as compatibility aliases and map them to the appropriate canonical sender."
- Positive assertions:
  - CHG-20260721-404-POS-001: The implementation and evidence satisfy this exact source atom: Mark them as compatibility aliases and map them to the appropriate canonical sender.
- Negative assertions:
  - CHG-20260721-404-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Mark them as compatibility aliases and map them to the appropriate canonical sender.

### CHG-20260721-405
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Use the HighLevel API to create the custom values when supported. > Use the HighLevel API to create the custom values when supported.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Use the HighLevel API to create the custom values when supported.
- Exact payload: {"verbatim_requirement":"Use the HighLevel API to create the custom values when supported."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Use the HighLevel API to create the custom values when supported.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S405 [12070, 12135]: "Use the HighLevel API to create the custom values when supported."
- Positive assertions:
  - CHG-20260721-405-POS-001: The implementation and evidence satisfy this exact source atom: Use the HighLevel API to create the custom values when supported.
- Negative assertions:
  - CHG-20260721-405-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Use the HighLevel API to create the custom values when supported.

### CHG-20260721-406
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Do not activate unresolved addresses. > Do not activate unresolved addresses.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Do not activate unresolved addresses.
- Exact payload: {"verbatim_requirement":"Do not activate unresolved addresses."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Do not activate unresolved addresses.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S406 [12139, 12176]: "Do not activate unresolved addresses."
- Positive assertions:
  - CHG-20260721-406-POS-001: The implementation and evidence satisfy this exact source atom: Do not activate unresolved addresses.
- Negative assertions:
  - CHG-20260721-406-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Do not activate unresolved addresses.

### CHG-20260721-407
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ## Prompt updates > ## Prompt updates
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ## Prompt updates
- Exact payload: {"verbatim_requirement":"## Prompt updates"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ## Prompt updates
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S407 [12180, 12197]: "## Prompt updates"
- Positive assertions:
  - CHG-20260721-407-POS-001: The implementation and evidence satisfy this exact source atom: ## Prompt updates
- Negative assertions:
  - CHG-20260721-407-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ## Prompt updates

### CHG-20260721-408
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Update every workflow AI prompt and checklist under: > Update every workflow AI prompt and checklist under:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Update every workflow AI prompt and checklist under:
- Exact payload: {"verbatim_requirement":"Update every workflow AI prompt and checklist under:"}
- Placement: parent=The exact registry, workflow, queue, commit, or response section named in the source atom.; before=; after=; order=Preserve the exact positional or ordering relationship stated in the source atom.
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Update every workflow AI prompt and checklist under:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S408 [12201, 12253]: "Update every workflow AI prompt and checklist under:"
- Positive assertions:
  - CHG-20260721-408-POS-001: The implementation and evidence satisfy this exact source atom: Update every workflow AI prompt and checklist under:
- Negative assertions:
  - CHG-20260721-408-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Update every workflow AI prompt and checklist under:

### CHG-20260721-409
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/ai-workflow-prompts/ > integrations/highlevel/ai-workflow-prompts/
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/ai-workflow-prompts/
- Exact payload: {"verbatim_requirement":"integrations/highlevel/ai-workflow-prompts/"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/ai-workflow-prompts/
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S409 [12257, 12300]: "integrations/highlevel/ai-workflow-prompts/"
- Positive assertions:
  - CHG-20260721-409-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/ai-workflow-prompts/
- Negative assertions:
  - CHG-20260721-409-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/ai-workflow-prompts/

### CHG-20260721-410
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/workflow-checklists/ > integrations/highlevel/workflow-checklists/
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/workflow-checklists/
- Exact payload: {"verbatim_requirement":"integrations/highlevel/workflow-checklists/"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/workflow-checklists/
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S410 [12302, 12345]: "integrations/highlevel/workflow-checklists/"
- Positive assertions:
  - CHG-20260721-410-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/workflow-checklists/
- Negative assertions:
  - CHG-20260721-410-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/workflow-checklists/

### CHG-20260721-411
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Also update: > Also update:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Also update:
- Exact payload: {"verbatim_requirement":"Also update:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Also update:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S411 [12349, 12361]: "Also update:"
- Positive assertions:
  - CHG-20260721-411-POS-001: The implementation and evidence satisfy this exact source atom: Also update:
- Negative assertions:
  - CHG-20260721-411-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Also update:

### CHG-20260721-412
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/prompts/active/ > integrations/highlevel/prompts/active/
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/prompts/active/
- Exact payload: {"verbatim_requirement":"integrations/highlevel/prompts/active/"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/prompts/active/
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S412 [12365, 12403]: "integrations/highlevel/prompts/active/"
- Positive assertions:
  - CHG-20260721-412-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/prompts/active/
- Negative assertions:
  - CHG-20260721-412-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/prompts/active/

### CHG-20260721-413
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/agent-prompts/ > integrations/highlevel/agent-prompts/
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/agent-prompts/
- Exact payload: {"verbatim_requirement":"integrations/highlevel/agent-prompts/"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/agent-prompts/
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S413 [12405, 12442]: "integrations/highlevel/agent-prompts/"
- Positive assertions:
  - CHG-20260721-413-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/agent-prompts/
- Negative assertions:
  - CHG-20260721-413-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/agent-prompts/

### CHG-20260721-414
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/knowledge-bases/active/ > integrations/highlevel/knowledge-bases/active/
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/knowledge-bases/active/
- Exact payload: {"verbatim_requirement":"integrations/highlevel/knowledge-bases/active/"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/knowledge-bases/active/
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S414 [12444, 12490]: "integrations/highlevel/knowledge-bases/active/"
- Positive assertions:
  - CHG-20260721-414-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/knowledge-bases/active/
- Negative assertions:
  - CHG-20260721-414-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/knowledge-bases/active/

### CHG-20260721-415
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Each workflow prompt must contain: > Each workflow prompt must contain:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Each workflow prompt must contain:
- Exact payload: {"verbatim_requirement":"Each workflow prompt must contain:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Each workflow prompt must contain:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S415 [12494, 12528]: "Each workflow prompt must contain:"
- Positive assertions:
  - CHG-20260721-415-POS-001: The implementation and evidence satisfy this exact source atom: Each workflow prompt must contain:
- Negative assertions:
  - CHG-20260721-415-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Each workflow prompt must contain:

### CHG-20260721-416
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - message_class > - message_class
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - message_class
- Exact payload: {"verbatim_requirement":"- message_class"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - message_class
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S416 [12532, 12547]: "- message_class"
- Positive assertions:
  - CHG-20260721-416-POS-001: The implementation and evidence satisfy this exact source atom: - message_class
- Negative assertions:
  - CHG-20260721-416-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - message_class

### CHG-20260721-417
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - sender_key > - sender_key
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - sender_key
- Exact payload: {"verbatim_requirement":"- sender_key"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - sender_key
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S417 [12550, 12562]: "- sender_key"
- Positive assertions:
  - CHG-20260721-417-POS-001: The implementation and evidence satisfy this exact source atom: - sender_key
- Negative assertions:
  - CHG-20260721-417-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - sender_key

### CHG-20260721-418
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - exact workflow > - exact workflow
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - exact workflow
- Exact payload: {"verbatim_requirement":"- exact workflow"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - exact workflow
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S418 [12565, 12581]: "- exact workflow"
- Positive assertions:
  - CHG-20260721-418-POS-001: The implementation and evidence satisfy this exact source atom: - exact workflow
- Negative assertions:
  - CHG-20260721-418-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - exact workflow

### CHG-20260721-419
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - exact folder > - exact folder
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - exact folder
- Exact payload: {"verbatim_requirement":"- exact folder"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - exact folder
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S419 [12584, 12598]: "- exact folder"
- Positive assertions:
  - CHG-20260721-419-POS-001: The implementation and evidence satisfy this exact source atom: - exact folder
- Negative assertions:
  - CHG-20260721-419-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - exact folder

### CHG-20260721-420
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - exact trigger > - exact trigger
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - exact trigger
- Exact payload: {"verbatim_requirement":"- exact trigger"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - exact trigger
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S420 [12601, 12616]: "- exact trigger"
- Positive assertions:
  - CHG-20260721-420-POS-001: The implementation and evidence satisfy this exact source atom: - exact trigger
- Negative assertions:
  - CHG-20260721-420-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - exact trigger

### CHG-20260721-421
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - no-send/no-publish default > - no-send/no-publish default
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - no-send/no-publish default
- Exact payload: {"verbatim_requirement":"- no-send/no-publish default"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - no-send/no-publish default
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S421 [12619, 12647]: "- no-send/no-publish default"
- Positive assertions:
  - CHG-20260721-421-POS-001: The implementation and evidence satisfy this exact source atom: - no-send/no-publish default
- Negative assertions:
  - CHG-20260721-421-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - no-send/no-publish default

### CHG-20260721-422
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - dependency on the registry > - dependency on the registry
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - dependency on the registry
- Exact payload: {"verbatim_requirement":"- dependency on the registry"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - dependency on the registry
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S422 [12650, 12678]: "- dependency on the registry"
- Positive assertions:
  - CHG-20260721-422-POS-001: The implementation and evidence satisfy this exact source atom: - dependency on the registry
- Negative assertions:
  - CHG-20260721-422-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - dependency on the registry

### CHG-20260721-423
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - exact custom values selected from the picker > - exact custom values selected from the picker
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - exact custom values selected from the picker
- Exact payload: {"verbatim_requirement":"- exact custom values selected from the picker"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - exact custom values selected from the picker
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S423 [12681, 12727]: "- exact custom values selected from the picker"
- Positive assertions:
  - CHG-20260721-423-POS-001: The implementation and evidence satisfy this exact source atom: - exact custom values selected from the picker
- Negative assertions:
  - CHG-20260721-423-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - exact custom values selected from the picker

### CHG-20260721-424
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - prohibition on guessed sender text. > - prohibition on guessed sender text.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - prohibition on guessed sender text.
- Exact payload: {"verbatim_requirement":"- prohibition on guessed sender text."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - prohibition on guessed sender text.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S424 [12730, 12767]: "- prohibition on guessed sender text."
- Positive assertions:
  - CHG-20260721-424-POS-001: The implementation and evidence satisfy this exact source atom: - prohibition on guessed sender text.
- Negative assertions:
  - CHG-20260721-424-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - prohibition on guessed sender text.

### CHG-20260721-425
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ## Agent Mode queue regeneration > ## Agent Mode queue regeneration
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ## Agent Mode queue regeneration
- Exact payload: {"verbatim_requirement":"## Agent Mode queue regeneration"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ## Agent Mode queue regeneration
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S425 [12771, 12803]: "## Agent Mode queue regeneration"
- Positive assertions:
  - CHG-20260721-425-POS-001: The implementation and evidence satisfy this exact source atom: ## Agent Mode queue regeneration
- Negative assertions:
  - CHG-20260721-425-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ## Agent Mode queue regeneration

### CHG-20260721-426
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Update: > Update:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Update:
- Exact payload: {"verbatim_requirement":"Update:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Update:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S426 [12807, 12814]: "Update:"
- Positive assertions:
  - CHG-20260721-426-POS-001: The implementation and evidence satisfy this exact source atom: Update:
- Negative assertions:
  - CHG-20260721-426-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Update:

### CHG-20260721-427
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/agent-mode/GHL-AGENT-MODE-QUEUE.json > integrations/highlevel/agent-mode/GHL-AGENT-MODE-QUEUE.json
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/agent-mode/GHL-AGENT-MODE-QUEUE.json
- Exact payload: {"verbatim_requirement":"integrations/highlevel/agent-mode/GHL-AGENT-MODE-QUEUE.json"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/agent-mode/GHL-AGENT-MODE-QUEUE.json
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S427 [12818, 12877]: "integrations/highlevel/agent-mode/GHL-AGENT-MODE-QUEUE.json"
- Positive assertions:
  - CHG-20260721-427-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/agent-mode/GHL-AGENT-MODE-QUEUE.json
- Negative assertions:
  - CHG-20260721-427-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/agent-mode/GHL-AGENT-MODE-QUEUE.json

### CHG-20260721-428
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/agent-mode/GHL-AGENT-MODE-EXPORT.json > integrations/highlevel/agent-mode/GHL-AGENT-MODE-EXPORT.json
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/agent-mode/GHL-AGENT-MODE-EXPORT.json
- Exact payload: {"verbatim_requirement":"integrations/highlevel/agent-mode/GHL-AGENT-MODE-EXPORT.json"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/agent-mode/GHL-AGENT-MODE-EXPORT.json
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S428 [12879, 12939]: "integrations/highlevel/agent-mode/GHL-AGENT-MODE-EXPORT.json"
- Positive assertions:
  - CHG-20260721-428-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/agent-mode/GHL-AGENT-MODE-EXPORT.json
- Negative assertions:
  - CHG-20260721-428-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/agent-mode/GHL-AGENT-MODE-EXPORT.json

### CHG-20260721-429
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Add ordered jobs: > Add ordered jobs:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Add ordered jobs:
- Exact payload: {"verbatim_requirement":"Add ordered jobs:"}
- Placement: parent=The exact registry, workflow, queue, commit, or response section named in the source atom.; before=; after=; order=Preserve the exact positional or ordering relationship stated in the source atom.
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Add ordered jobs:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S429 [12943, 12960]: "Add ordered jobs:"
- Positive assertions:
  - CHG-20260721-429-POS-001: The implementation and evidence satisfy this exact source atom: Add ordered jobs:
- Negative assertions:
  - CHG-20260721-429-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Add ordered jobs:

### CHG-20260721-430
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - create sender custom-value folder > - create sender custom-value folder
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - create sender custom-value folder
- Exact payload: {"verbatim_requirement":"- create sender custom-value folder"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - create sender custom-value folder
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S430 [12964, 12999]: "- create sender custom-value folder"
- Positive assertions:
  - CHG-20260721-430-POS-001: The implementation and evidence satisfy this exact source atom: - create sender custom-value folder
- Negative assertions:
  - CHG-20260721-430-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - create sender custom-value folder

### CHG-20260721-431
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - reconcile sender values > - reconcile sender values
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - reconcile sender values
- Exact payload: {"verbatim_requirement":"- reconcile sender values"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - reconcile sender values
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S431 [13002, 13027]: "- reconcile sender values"
- Positive assertions:
  - CHG-20260721-431-POS-001: The implementation and evidence satisfy this exact source atom: - reconcile sender values
- Negative assertions:
  - CHG-20260721-431-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - reconcile sender values

### CHG-20260721-432
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - create/reconcile pipelines > - create/reconcile pipelines
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - create/reconcile pipelines
- Exact payload: {"verbatim_requirement":"- create/reconcile pipelines"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - create/reconcile pipelines
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S432 [13030, 13058]: "- create/reconcile pipelines"
- Positive assertions:
  - CHG-20260721-432-POS-001: The implementation and evidence satisfy this exact source atom: - create/reconcile pipelines
- Negative assertions:
  - CHG-20260721-432-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - create/reconcile pipelines

### CHG-20260721-433
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - update workflow sender identities > - update workflow sender identities
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - update workflow sender identities
- Exact payload: {"verbatim_requirement":"- update workflow sender identities"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - update workflow sender identities
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S433 [13061, 13096]: "- update workflow sender identities"
- Positive assertions:
  - CHG-20260721-433-POS-001: The implementation and evidence satisfy this exact source atom: - update workflow sender identities
- Negative assertions:
  - CHG-20260721-433-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - update workflow sender identities

### CHG-20260721-434
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - update OT-A1 > - update OT-A1
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - update OT-A1
- Exact payload: {"verbatim_requirement":"- update OT-A1"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - update OT-A1
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S434 [13099, 13113]: "- update OT-A1"
- Positive assertions:
  - CHG-20260721-434-POS-001: The implementation and evidence satisfy this exact source atom: - update OT-A1
- Negative assertions:
  - CHG-20260721-434-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - update OT-A1

### CHG-20260721-435
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - verify sending domain > - verify sending domain
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - verify sending domain
- Exact payload: {"verbatim_requirement":"- verify sending domain"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - verify sending domain
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S435 [13116, 13139]: "- verify sending domain"
- Positive assertions:
  - CHG-20260721-435-POS-001: The implementation and evidence satisfy this exact source atom: - verify sending domain
- Negative assertions:
  - CHG-20260721-435-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - verify sending domain

### CHG-20260721-436
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - phase-1 seed > - phase-1 seed
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - phase-1 seed
- Exact payload: {"verbatim_requirement":"- phase-1 seed"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - phase-1 seed
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S436 [13142, 13156]: "- phase-1 seed"
- Positive assertions:
  - CHG-20260721-436-POS-001: The implementation and evidence satisfy this exact source atom: - phase-1 seed
- Negative assertions:
  - CHG-20260721-436-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - phase-1 seed

### CHG-20260721-437
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - office seed > - office seed
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - office seed
- Exact payload: {"verbatim_requirement":"- office seed"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - office seed
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S437 [13159, 13172]: "- office seed"
- Positive assertions:
  - CHG-20260721-437-POS-001: The implementation and evidence satisfy this exact source atom: - office seed
- Negative assertions:
  - CHG-20260721-437-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - office seed

### CHG-20260721-438
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - brand seed > - brand seed
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - brand seed
- Exact payload: {"verbatim_requirement":"- brand seed"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - brand seed
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S438 [13175, 13187]: "- brand seed"
- Positive assertions:
  - CHG-20260721-438-POS-001: The implementation and evidence satisfy this exact source atom: - brand seed
- Negative assertions:
  - CHG-20260721-438-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - brand seed

### CHG-20260721-439
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - capture workflow IDs > - capture workflow IDs
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - capture workflow IDs
- Exact payload: {"verbatim_requirement":"- capture workflow IDs"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - capture workflow IDs
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S439 [13190, 13212]: "- capture workflow IDs"
- Positive assertions:
  - CHG-20260721-439-POS-001: The implementation and evidence satisfy this exact source atom: - capture workflow IDs
- Negative assertions:
  - CHG-20260721-439-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - capture workflow IDs

### CHG-20260721-440
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - capture pipeline IDs > - capture pipeline IDs
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - capture pipeline IDs
- Exact payload: {"verbatim_requirement":"- capture pipeline IDs"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - capture pipeline IDs
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S440 [13215, 13237]: "- capture pipeline IDs"
- Positive assertions:
  - CHG-20260721-440-POS-001: The implementation and evidence satisfy this exact source atom: - capture pipeline IDs
- Negative assertions:
  - CHG-20260721-440-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - capture pipeline IDs

### CHG-20260721-441
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - save/readback > - save/readback
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - save/readback
- Exact payload: {"verbatim_requirement":"- save/readback"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - save/readback
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S441 [13240, 13255]: "- save/readback"
- Positive assertions:
  - CHG-20260721-441-POS-001: The implementation and evidence satisfy this exact source atom: - save/readback
- Negative assertions:
  - CHG-20260721-441-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - save/readback

### CHG-20260721-442
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - phase-2 rabbi@ acceptance, blocked until prerequisites pass. > - phase-2 rabbi@ acceptance, blocked until prerequisites pass.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - phase-2 rabbi@ acceptance, blocked until prerequisites pass.
- Exact payload: {"verbatim_requirement":"- phase-2 rabbi@ acceptance, blocked until prerequisites pass."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - phase-2 rabbi@ acceptance, blocked until prerequisites pass.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S442 [13258, 13320]: "- phase-2 rabbi@ acceptance, blocked until prerequisites pass."
- Positive assertions:
  - CHG-20260721-442-POS-001: The implementation and evidence satisfy this exact source atom: - phase-2 rabbi@ acceptance, blocked until prerequisites pass.
- Negative assertions:
  - CHG-20260721-442-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - phase-2 rabbi@ acceptance, blocked until prerequisites pass.

### CHG-20260721-443
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Every job must instruct Agent Mode to: > Every job must instruct Agent Mode to:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Every job must instruct Agent Mode to:
- Exact payload: {"verbatim_requirement":"Every job must instruct Agent Mode to:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Every job must instruct Agent Mode to:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S443 [13324, 13362]: "Every job must instruct Agent Mode to:"
- Positive assertions:
  - CHG-20260721-443-POS-001: The implementation and evidence satisfy this exact source atom: Every job must instruct Agent Mode to:
- Negative assertions:
  - CHG-20260721-443-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Every job must instruct Agent Mode to:

### CHG-20260721-444
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > use the pinned registry commit > use the pinned registry commit
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: use the pinned registry commit
- Exact payload: {"verbatim_requirement":"use the pinned registry commit"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: use the pinned registry commit
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S444 [13369, 13399]: "use the pinned registry commit"
- Positive assertions:
  - CHG-20260721-444-POS-001: The implementation and evidence satisfy this exact source atom: use the pinned registry commit
- Negative assertions:
  - CHG-20260721-444-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: use the pinned registry commit

### CHG-20260721-445
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > perform only registered actions > perform only registered actions
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: perform only registered actions
- Exact payload: {"verbatim_requirement":"perform only registered actions"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: perform only registered actions
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S445 [13405, 13436]: "perform only registered actions"
- Positive assertions:
  - CHG-20260721-445-POS-001: The implementation and evidence satisfy this exact source atom: perform only registered actions
- Negative assertions:
  - CHG-20260721-445-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: perform only registered actions

### CHG-20260721-446
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > click Save > click Save
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: click Save
- Exact payload: {"verbatim_requirement":"click Save"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: click Save
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S446 [13442, 13452]: "click Save"
- Positive assertions:
  - CHG-20260721-446-POS-001: The implementation and evidence satisfy this exact source atom: click Save
- Negative assertions:
  - CHG-20260721-446-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: click Save

### CHG-20260721-447
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > reopen and verify > reopen and verify
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: reopen and verify
- Exact payload: {"verbatim_requirement":"reopen and verify"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: reopen and verify
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S447 [13458, 13475]: "reopen and verify"
- Positive assertions:
  - CHG-20260721-447-POS-001: The implementation and evidence satisfy this exact source atom: reopen and verify
- Negative assertions:
  - CHG-20260721-447-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: reopen and verify

### CHG-20260721-448
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > capture safe IDs > capture safe IDs
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: capture safe IDs
- Exact payload: {"verbatim_requirement":"capture safe IDs"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: capture safe IDs
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S448 [13481, 13497]: "capture safe IDs"
- Positive assertions:
  - CHG-20260721-448-POS-001: The implementation and evidence satisfy this exact source atom: capture safe IDs
- Negative assertions:
  - CHG-20260721-448-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: capture safe IDs

### CHG-20260721-449
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > return to Agent Action drop-off > return to Agent Action drop-off
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: return to Agent Action drop-off
- Exact payload: {"verbatim_requirement":"return to Agent Action drop-off"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: return to Agent Action drop-off
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S449 [13503, 13534]: "return to Agent Action drop-off"
- Positive assertions:
  - CHG-20260721-449-POS-001: The implementation and evidence satisfy this exact source atom: return to Agent Action drop-off
- Negative assertions:
  - CHG-20260721-449-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: return to Agent Action drop-off

### CHG-20260721-450
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > save the result > save the result
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: save the result
- Exact payload: {"verbatim_requirement":"save the result"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: save the result
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S450 [13540, 13555]: "save the result"
- Positive assertions:
  - CHG-20260721-450-POS-001: The implementation and evidence satisfy this exact source atom: save the result
- Negative assertions:
  - CHG-20260721-450-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: save the result

### CHG-20260721-451
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > verify readback > verify readback
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: verify readback
- Exact payload: {"verbatim_requirement":"verify readback"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: verify readback
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S451 [13561, 13576]: "verify readback"
- Positive assertions:
  - CHG-20260721-451-POS-001: The implementation and evidence satisfy this exact source atom: verify readback
- Negative assertions:
  - CHG-20260721-451-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: verify readback

### CHG-20260721-452
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > never finish with a chat-only completion claim. > never finish with a chat-only completion claim.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: never finish with a chat-only completion claim.
- Exact payload: {"verbatim_requirement":"never finish with a chat-only completion claim."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: never finish with a chat-only completion claim.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S452 [13582, 13629]: "never finish with a chat-only completion claim."
- Positive assertions:
  - CHG-20260721-452-POS-001: The implementation and evidence satisfy this exact source atom: never finish with a chat-only completion claim.
- Negative assertions:
  - CHG-20260721-452-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: never finish with a chat-only completion claim.

### CHG-20260721-453
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ## Immutable Agent Mode handoff > ## Immutable Agent Mode handoff
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ## Immutable Agent Mode handoff
- Exact payload: {"verbatim_requirement":"## Immutable Agent Mode handoff"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ## Immutable Agent Mode handoff
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S453 [13633, 13664]: "## Immutable Agent Mode handoff"
- Positive assertions:
  - CHG-20260721-453-POS-001: The implementation and evidence satisfy this exact source atom: ## Immutable Agent Mode handoff
- Negative assertions:
  - CHG-20260721-453-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ## Immutable Agent Mode handoff

### CHG-20260721-454
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Use a two-commit process. > Use a two-commit process.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Use a two-commit process.
- Exact payload: {"verbatim_requirement":"Use a two-commit process."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Use a two-commit process.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S454 [13668, 13693]: "Use a two-commit process."
- Positive assertions:
  - CHG-20260721-454-POS-001: The implementation and evidence satisfy this exact source atom: Use a two-commit process.
- Negative assertions:
  - CHG-20260721-454-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Use a two-commit process.

### CHG-20260721-455
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ### Commit A — canonical registry > ### Commit A — canonical registry
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ### Commit A — canonical registry
- Exact payload: {"verbatim_requirement":"### Commit A — canonical registry"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ### Commit A — canonical registry
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S455 [13697, 13730]: "### Commit A — canonical registry"
- Positive assertions:
  - CHG-20260721-455-POS-001: The implementation and evidence satisfy this exact source atom: ### Commit A — canonical registry
- Negative assertions:
  - CHG-20260721-455-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ### Commit A — canonical registry

### CHG-20260721-456
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Commit all sender, message-class, pipeline, workflow and prompt changes. > Commit all sender, message-class, pipeline, workflow and prompt changes.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Commit all sender, message-class, pipeline, workflow and prompt changes.
- Exact payload: {"verbatim_requirement":"Commit all sender, message-class, pipeline, workflow and prompt changes."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Commit all sender, message-class, pipeline, workflow and prompt changes.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S456 [13734, 13806]: "Commit all sender, message-class, pipeline, workflow and prompt changes."
- Positive assertions:
  - CHG-20260721-456-POS-001: The implementation and evidence satisfy this exact source atom: Commit all sender, message-class, pipeline, workflow and prompt changes.
- Negative assertions:
  - CHG-20260721-456-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Commit all sender, message-class, pipeline, workflow and prompt changes.

### CHG-20260721-457
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Record Commit A SHA. > Record Commit A SHA.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Record Commit A SHA.
- Exact payload: {"verbatim_requirement":"Record Commit A SHA."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Record Commit A SHA.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S457 [13810, 13830]: "Record Commit A SHA."
- Positive assertions:
  - CHG-20260721-457-POS-001: The implementation and evidence satisfy this exact source atom: Record Commit A SHA.
- Negative assertions:
  - CHG-20260721-457-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Record Commit A SHA.

### CHG-20260721-458
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > This SHA is the immutable registry SHA. > This SHA is the immutable registry SHA.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: This SHA is the immutable registry SHA.
- Exact payload: {"verbatim_requirement":"This SHA is the immutable registry SHA."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: This SHA is the immutable registry SHA.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S458 [13834, 13873]: "This SHA is the immutable registry SHA."
- Positive assertions:
  - CHG-20260721-458-POS-001: The implementation and evidence satisfy this exact source atom: This SHA is the immutable registry SHA.
- Negative assertions:
  - CHG-20260721-458-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: This SHA is the immutable registry SHA.

### CHG-20260721-459
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ### Commit B — Agent Mode handoff > ### Commit B — Agent Mode handoff
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ### Commit B — Agent Mode handoff
- Exact payload: {"verbatim_requirement":"### Commit B — Agent Mode handoff"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ### Commit B — Agent Mode handoff
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S459 [13877, 13910]: "### Commit B — Agent Mode handoff"
- Positive assertions:
  - CHG-20260721-459-POS-001: The implementation and evidence satisfy this exact source atom: ### Commit B — Agent Mode handoff
- Negative assertions:
  - CHG-20260721-459-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ### Commit B — Agent Mode handoff

### CHG-20260721-460
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Generate: > Generate:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Generate:
- Exact payload: {"verbatim_requirement":"Generate:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Generate:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S460 [13914, 13923]: "Generate:"
- Positive assertions:
  - CHG-20260721-460-POS-001: The implementation and evidence satisfy this exact source atom: Generate:
- Negative assertions:
  - CHG-20260721-460-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Generate:

### CHG-20260721-461
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md > integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md
- Exact payload: {"verbatim_requirement":"integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S461 [13927, 13993]: "integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md"
- Positive assertions:
  - CHG-20260721-461-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md
- Negative assertions:
  - CHG-20260721-461-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md

### CHG-20260721-462
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/agent-mode/GHL-SENDER-UI-JOB.private.template.json > integrations/highlevel/agent-mode/GHL-SENDER-UI-JOB.private.template.json
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/agent-mode/GHL-SENDER-UI-JOB.private.template.json
- Exact payload: {"verbatim_requirement":"integrations/highlevel/agent-mode/GHL-SENDER-UI-JOB.private.template.json"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/agent-mode/GHL-SENDER-UI-JOB.private.template.json
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S462 [13995, 14068]: "integrations/highlevel/agent-mode/GHL-SENDER-UI-JOB.private.template.json"
- Positive assertions:
  - CHG-20260721-462-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/agent-mode/GHL-SENDER-UI-JOB.private.template.json
- Negative assertions:
  - CHG-20260721-462-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/agent-mode/GHL-SENDER-UI-JOB.private.template.json

### CHG-20260721-463
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > The executor prompt must embed: > The executor prompt must embed:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: The executor prompt must embed:
- Exact payload: {"verbatim_requirement":"The executor prompt must embed:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: The executor prompt must embed:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S463 [14072, 14103]: "The executor prompt must embed:"
- Positive assertions:
  - CHG-20260721-463-POS-001: The implementation and evidence satisfy this exact source atom: The executor prompt must embed:
- Negative assertions:
  - CHG-20260721-463-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: The executor prompt must embed:

### CHG-20260721-464
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - repository > - repository
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - repository
- Exact payload: {"verbatim_requirement":"- repository"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - repository
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S464 [14107, 14119]: "- repository"
- Positive assertions:
  - CHG-20260721-464-POS-001: The implementation and evidence satisfy this exact source atom: - repository
- Negative assertions:
  - CHG-20260721-464-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - repository

### CHG-20260721-465
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - PR > - PR
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - PR
- Exact payload: {"verbatim_requirement":"- PR"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - PR
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S465 [14122, 14126]: "- PR"
- Positive assertions:
  - CHG-20260721-465-POS-001: The implementation and evidence satisfy this exact source atom: - PR
- Negative assertions:
  - CHG-20260721-465-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - PR

### CHG-20260721-466
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - branch > - branch
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - branch
- Exact payload: {"verbatim_requirement":"- branch"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - branch
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S466 [14129, 14137]: "- branch"
- Positive assertions:
  - CHG-20260721-466-POS-001: The implementation and evidence satisfy this exact source atom: - branch
- Negative assertions:
  - CHG-20260721-466-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - branch

### CHG-20260721-467
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Commit A immutable SHA > - Commit A immutable SHA
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Commit A immutable SHA
- Exact payload: {"verbatim_requirement":"- Commit A immutable SHA"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Commit A immutable SHA
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S467 [14140, 14164]: "- Commit A immutable SHA"
- Positive assertions:
  - CHG-20260721-467-POS-001: The implementation and evidence satisfy this exact source atom: - Commit A immutable SHA
- Negative assertions:
  - CHG-20260721-467-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Commit A immutable SHA

### CHG-20260721-468
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - exact registry paths > - exact registry paths
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - exact registry paths
- Exact payload: {"verbatim_requirement":"- exact registry paths"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - exact registry paths
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S468 [14167, 14189]: "- exact registry paths"
- Positive assertions:
  - CHG-20260721-468-POS-001: The implementation and evidence satisfy this exact source atom: - exact registry paths
- Negative assertions:
  - CHG-20260721-468-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - exact registry paths

### CHG-20260721-469
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - exact GHL location > - exact GHL location
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - exact GHL location
- Exact payload: {"verbatim_requirement":"- exact GHL location"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - exact GHL location
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S469 [14192, 14212]: "- exact GHL location"
- Positive assertions:
  - CHG-20260721-469-POS-001: The implementation and evidence satisfy this exact source atom: - exact GHL location
- Negative assertions:
  - CHG-20260721-469-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - exact GHL location

### CHG-20260721-470
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - exact job order > - exact job order
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - exact job order
- Exact payload: {"verbatim_requirement":"- exact job order"}
- Placement: parent=The exact registry, workflow, queue, commit, or response section named in the source atom.; before=; after=; order=Preserve the exact positional or ordering relationship stated in the source atom.
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - exact job order
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S470 [14215, 14232]: "- exact job order"
- Positive assertions:
  - CHG-20260721-470-POS-001: The implementation and evidence satisfy this exact source atom: - exact job order
- Negative assertions:
  - CHG-20260721-470-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - exact job order

### CHG-20260721-471
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - save/readback behavior. > - save/readback behavior.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - save/readback behavior.
- Exact payload: {"verbatim_requirement":"- save/readback behavior."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - save/readback behavior.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S471 [14235, 14260]: "- save/readback behavior."
- Positive assertions:
  - CHG-20260721-471-POS-001: The implementation and evidence satisfy this exact source atom: - save/readback behavior.
- Negative assertions:
  - CHG-20260721-471-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - save/readback behavior.

### CHG-20260721-472
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Commit only the prompt/template in Commit B. > Commit only the prompt/template in Commit B.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Commit only the prompt/template in Commit B.
- Exact payload: {"verbatim_requirement":"Commit only the prompt/template in Commit B."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Commit only the prompt/template in Commit B.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S472 [14264, 14308]: "Commit only the prompt/template in Commit B."
- Positive assertions:
  - CHG-20260721-472-POS-001: The implementation and evidence satisfy this exact source atom: Commit only the prompt/template in Commit B.
- Negative assertions:
  - CHG-20260721-472-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Commit only the prompt/template in Commit B.

### CHG-20260721-473
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Push both commits. > Push both commits.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Push both commits.
- Exact payload: {"verbatim_requirement":"Push both commits."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Push both commits.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S473 [14312, 14330]: "Push both commits."
- Positive assertions:
  - CHG-20260721-473-POS-001: The implementation and evidence satisfy this exact source atom: Push both commits.
- Negative assertions:
  - CHG-20260721-473-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Push both commits.

### CHG-20260721-474
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > The Agent Mode source-of-truth SHA is Commit A. > The Agent Mode source-of-truth SHA is Commit A.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: The Agent Mode source-of-truth SHA is Commit A.
- Exact payload: {"verbatim_requirement":"The Agent Mode source-of-truth SHA is Commit A."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: The Agent Mode source-of-truth SHA is Commit A.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S474 [14334, 14381]: "The Agent Mode source-of-truth SHA is Commit A."
- Positive assertions:
  - CHG-20260721-474-POS-001: The implementation and evidence satisfy this exact source atom: The Agent Mode source-of-truth SHA is Commit A.
- Negative assertions:
  - CHG-20260721-474-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: The Agent Mode source-of-truth SHA is Commit A.

### CHG-20260721-475
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Do not require the operator to edit or paste a SHA manually. > Do not require the operator to edit or paste a SHA manually.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Do not require the operator to edit or paste a SHA manually.
- Exact payload: {"verbatim_requirement":"Do not require the operator to edit or paste a SHA manually."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Do not require the operator to edit or paste a SHA manually.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S475 [14385, 14445]: "Do not require the operator to edit or paste a SHA manually."
- Positive assertions:
  - CHG-20260721-475-POS-001: The implementation and evidence satisfy this exact source atom: Do not require the operator to edit or paste a SHA manually.
- Negative assertions:
  - CHG-20260721-475-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Do not require the operator to edit or paste a SHA manually.

### CHG-20260721-476
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ## Validation > ## Validation
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ## Validation
- Exact payload: {"verbatim_requirement":"## Validation"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ## Validation
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S476 [14449, 14462]: "## Validation"
- Positive assertions:
  - CHG-20260721-476-POS-001: The implementation and evidence satisfy this exact source atom: ## Validation
- Negative assertions:
  - CHG-20260721-476-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ## Validation

### CHG-20260721-477
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Run: > Run:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Run:
- Exact payload: {"verbatim_requirement":"Run:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Run:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S477 [14466, 14470]: "Run:"
- Positive assertions:
  - CHG-20260721-477-POS-001: The implementation and evidence satisfy this exact source atom: Run:
- Negative assertions:
  - CHG-20260721-477-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Run:

### CHG-20260721-478
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - canonical registry validation > - canonical registry validation
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - canonical registry validation
- Exact payload: {"verbatim_requirement":"- canonical registry validation"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - canonical registry validation
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S478 [14474, 14505]: "- canonical registry validation"
- Positive assertions:
  - CHG-20260721-478-POS-001: The implementation and evidence satisfy this exact source atom: - canonical registry validation
- Negative assertions:
  - CHG-20260721-478-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - canonical registry validation

### CHG-20260721-479
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - duplicate sender detection > - duplicate sender detection
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - duplicate sender detection
- Exact payload: {"verbatim_requirement":"- duplicate sender detection"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - duplicate sender detection
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S479 [14508, 14536]: "- duplicate sender detection"
- Positive assertions:
  - CHG-20260721-479-POS-001: The implementation and evidence satisfy this exact source atom: - duplicate sender detection
- Negative assertions:
  - CHG-20260721-479-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - duplicate sender detection

### CHG-20260721-480
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - duplicate pipeline detection > - duplicate pipeline detection
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - duplicate pipeline detection
- Exact payload: {"verbatim_requirement":"- duplicate pipeline detection"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - duplicate pipeline detection
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S480 [14539, 14569]: "- duplicate pipeline detection"
- Positive assertions:
  - CHG-20260721-480-POS-001: The implementation and evidence satisfy this exact source atom: - duplicate pipeline detection
- Negative assertions:
  - CHG-20260721-480-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - duplicate pipeline detection

### CHG-20260721-481
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - message-class coverage validation > - message-class coverage validation
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - message-class coverage validation
- Exact payload: {"verbatim_requirement":"- message-class coverage validation"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - message-class coverage validation
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S481 [14572, 14607]: "- message-class coverage validation"
- Positive assertions:
  - CHG-20260721-481-POS-001: The implementation and evidence satisfy this exact source atom: - message-class coverage validation
- Negative assertions:
  - CHG-20260721-481-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - message-class coverage validation

### CHG-20260721-482
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - workflow sender dependency validation > - workflow sender dependency validation
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - workflow sender dependency validation
- Exact payload: {"verbatim_requirement":"- workflow sender dependency validation"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - workflow sender dependency validation
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S482 [14610, 14649]: "- workflow sender dependency validation"
- Positive assertions:
  - CHG-20260721-482-POS-001: The implementation and evidence satisfy this exact source atom: - workflow sender dependency validation
- Negative assertions:
  - CHG-20260721-482-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - workflow sender dependency validation

### CHG-20260721-483
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Agent Mode queue validation > - Agent Mode queue validation
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Agent Mode queue validation
- Exact payload: {"verbatim_requirement":"- Agent Mode queue validation"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Agent Mode queue validation
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S483 [14652, 14681]: "- Agent Mode queue validation"
- Positive assertions:
  - CHG-20260721-483-POS-001: The implementation and evidence satisfy this exact source atom: - Agent Mode queue validation
- Negative assertions:
  - CHG-20260721-483-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Agent Mode queue validation

### CHG-20260721-484
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - prompt dependency validation > - prompt dependency validation
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - prompt dependency validation
- Exact payload: {"verbatim_requirement":"- prompt dependency validation"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - prompt dependency validation
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S484 [14684, 14714]: "- prompt dependency validation"
- Positive assertions:
  - CHG-20260721-484-POS-001: The implementation and evidence satisfy this exact source atom: - prompt dependency validation
- Negative assertions:
  - CHG-20260721-484-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - prompt dependency validation

### CHG-20260721-485
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - bounded HighLevel API reconciliation > - bounded HighLevel API reconciliation
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - bounded HighLevel API reconciliation
- Exact payload: {"verbatim_requirement":"- bounded HighLevel API reconciliation"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - bounded HighLevel API reconciliation
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S485 [14717, 14755]: "- bounded HighLevel API reconciliation"
- Positive assertions:
  - CHG-20260721-485-POS-001: The implementation and evidence satisfy this exact source atom: - bounded HighLevel API reconciliation
- Negative assertions:
  - CHG-20260721-485-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - bounded HighLevel API reconciliation

### CHG-20260721-486
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - typecheck > - typecheck
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - typecheck
- Exact payload: {"verbatim_requirement":"- typecheck"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - typecheck
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S486 [14758, 14769]: "- typecheck"
- Positive assertions:
  - CHG-20260721-486-POS-001: The implementation and evidence satisfy this exact source atom: - typecheck
- Negative assertions:
  - CHG-20260721-486-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - typecheck

### CHG-20260721-487
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - lint > - lint
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - lint
- Exact payload: {"verbatim_requirement":"- lint"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - lint
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S487 [14772, 14778]: "- lint"
- Positive assertions:
  - CHG-20260721-487-POS-001: The implementation and evidence satisfy this exact source atom: - lint
- Negative assertions:
  - CHG-20260721-487-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - lint

### CHG-20260721-488
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - secret scan > - secret scan
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - secret scan
- Exact payload: {"verbatim_requirement":"- secret scan"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - secret scan
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S488 [14781, 14794]: "- secret scan"
- Positive assertions:
  - CHG-20260721-488-POS-001: The implementation and evidence satisfy this exact source atom: - secret scan
- Negative assertions:
  - CHG-20260721-488-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - secret scan

### CHG-20260721-489
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - git diff --check. > - git diff --check.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - git diff --check.
- Exact payload: {"verbatim_requirement":"- git diff --check."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - git diff --check.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S489 [14797, 14816]: "- git diff --check."
- Positive assertions:
  - CHG-20260721-489-POS-001: The implementation and evidence satisfy this exact source atom: - git diff --check.
- Negative assertions:
  - CHG-20260721-489-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - git diff --check.

### CHG-20260721-490
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Do not run the full product browser suite. > Do not run the full product browser suite.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Do not run the full product browser suite.
- Exact payload: {"verbatim_requirement":"Do not run the full product browser suite."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Do not run the full product browser suite.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S490 [14820, 14862]: "Do not run the full product browser suite."
- Positive assertions:
  - CHG-20260721-490-POS-001: The implementation and evidence satisfy this exact source atom: Do not run the full product browser suite.
- Negative assertions:
  - CHG-20260721-490-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Do not run the full product browser suite.

### CHG-20260721-491
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > ## Final response > ## Final response
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: ## Final response
- Exact payload: {"verbatim_requirement":"## Final response"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: ## Final response
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S491 [14866, 14883]: "## Final response"
- Positive assertions:
  - CHG-20260721-491-POS-001: The implementation and evidence satisfy this exact source atom: ## Final response
- Negative assertions:
  - CHG-20260721-491-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: ## Final response

### CHG-20260721-492
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Begin exactly: > Begin exactly:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Begin exactly:
- Exact payload: {"verbatim_requirement":"Begin exactly:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Begin exactly:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S492 [14887, 14901]: "Begin exactly:"
- Positive assertions:
  - CHG-20260721-492-POS-001: The implementation and evidence satisfy this exact source atom: Begin exactly:
- Negative assertions:
  - CHG-20260721-492-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Begin exactly:

### CHG-20260721-493
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > HIGHLEVEL_SCHEMA_VERSION: 1.1.0 > HIGHLEVEL_SCHEMA_VERSION: 1.1.0
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: HIGHLEVEL_SCHEMA_VERSION: 1.1.0
- Exact payload: {"verbatim_requirement":"HIGHLEVEL_SCHEMA_VERSION: 1.1.0"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: HIGHLEVEL_SCHEMA_VERSION: 1.1.0
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S493 [14905, 14936]: "HIGHLEVEL_SCHEMA_VERSION: 1.1.0"
- Positive assertions:
  - CHG-20260721-493-POS-001: The implementation and evidence satisfy this exact source atom: HIGHLEVEL_SCHEMA_VERSION: 1.1.0
- Negative assertions:
  - CHG-20260721-493-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: HIGHLEVEL_SCHEMA_VERSION: 1.1.0

### CHG-20260721-494
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > SENDER_REGISTRY: COMPLETE | BLOCKED(<one exact action>) > SENDER_REGISTRY: COMPLETE | BLOCKED(<one exact action>)
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: SENDER_REGISTRY: COMPLETE | BLOCKED(<one exact action>)
- Exact payload: {"verbatim_requirement":"SENDER_REGISTRY: COMPLETE | BLOCKED(<one exact action>)"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: SENDER_REGISTRY: COMPLETE | BLOCKED(<one exact action>)
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S494 [14938, 14993]: "SENDER_REGISTRY: COMPLETE | BLOCKED(<one exact action>)"
- Positive assertions:
  - CHG-20260721-494-POS-001: The implementation and evidence satisfy this exact source atom: SENDER_REGISTRY: COMPLETE | BLOCKED(<one exact action>)
- Negative assertions:
  - CHG-20260721-494-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: SENDER_REGISTRY: COMPLETE | BLOCKED(<one exact action>)

### CHG-20260721-495
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > MESSAGE_CLASS_REGISTRY: COMPLETE | BLOCKED(<reason>) > MESSAGE_CLASS_REGISTRY: COMPLETE | BLOCKED(<reason>)
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: MESSAGE_CLASS_REGISTRY: COMPLETE | BLOCKED(<reason>)
- Exact payload: {"verbatim_requirement":"MESSAGE_CLASS_REGISTRY: COMPLETE | BLOCKED(<reason>)"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: MESSAGE_CLASS_REGISTRY: COMPLETE | BLOCKED(<reason>)
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S495 [14995, 15047]: "MESSAGE_CLASS_REGISTRY: COMPLETE | BLOCKED(<reason>)"
- Positive assertions:
  - CHG-20260721-495-POS-001: The implementation and evidence satisfy this exact source atom: MESSAGE_CLASS_REGISTRY: COMPLETE | BLOCKED(<reason>)
- Negative assertions:
  - CHG-20260721-495-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: MESSAGE_CLASS_REGISTRY: COMPLETE | BLOCKED(<reason>)

### CHG-20260721-496
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > PIPELINE_REGISTRY: COMPLETE | BLOCKED(<reason>) > PIPELINE_REGISTRY: COMPLETE | BLOCKED(<reason>)
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: PIPELINE_REGISTRY: COMPLETE | BLOCKED(<reason>)
- Exact payload: {"verbatim_requirement":"PIPELINE_REGISTRY: COMPLETE | BLOCKED(<reason>)"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: PIPELINE_REGISTRY: COMPLETE | BLOCKED(<reason>)
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S496 [15049, 15096]: "PIPELINE_REGISTRY: COMPLETE | BLOCKED(<reason>)"
- Positive assertions:
  - CHG-20260721-496-POS-001: The implementation and evidence satisfy this exact source atom: PIPELINE_REGISTRY: COMPLETE | BLOCKED(<reason>)
- Negative assertions:
  - CHG-20260721-496-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: PIPELINE_REGISTRY: COMPLETE | BLOCKED(<reason>)

### CHG-20260721-497
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > SENDER_CUSTOM_VALUES_API: COMPLETE | PARTIAL | BLOCKED(<reason>) > SENDER_CUSTOM_VALUES_API: COMPLETE | PARTIAL | BLOCKED(<reason>)
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: SENDER_CUSTOM_VALUES_API: COMPLETE | PARTIAL | BLOCKED(<reason>)
- Exact payload: {"verbatim_requirement":"SENDER_CUSTOM_VALUES_API: COMPLETE | PARTIAL | BLOCKED(<reason>)"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: SENDER_CUSTOM_VALUES_API: COMPLETE | PARTIAL | BLOCKED(<reason>)
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S497 [15098, 15162]: "SENDER_CUSTOM_VALUES_API: COMPLETE | PARTIAL | BLOCKED(<reason>)"
- Positive assertions:
  - CHG-20260721-497-POS-001: The implementation and evidence satisfy this exact source atom: SENDER_CUSTOM_VALUES_API: COMPLETE | PARTIAL | BLOCKED(<reason>)
- Negative assertions:
  - CHG-20260721-497-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: SENDER_CUSTOM_VALUES_API: COMPLETE | PARTIAL | BLOCKED(<reason>)

### CHG-20260721-498
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > PIPELINES_API: COMPLETE | PARTIAL | BLOCKED(<reason>) > PIPELINES_API: COMPLETE | PARTIAL | BLOCKED(<reason>)
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: PIPELINES_API: COMPLETE | PARTIAL | BLOCKED(<reason>)
- Exact payload: {"verbatim_requirement":"PIPELINES_API: COMPLETE | PARTIAL | BLOCKED(<reason>)"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: PIPELINES_API: COMPLETE | PARTIAL | BLOCKED(<reason>)
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S498 [15164, 15217]: "PIPELINES_API: COMPLETE | PARTIAL | BLOCKED(<reason>)"
- Positive assertions:
  - CHG-20260721-498-POS-001: The implementation and evidence satisfy this exact source atom: PIPELINES_API: COMPLETE | PARTIAL | BLOCKED(<reason>)
- Negative assertions:
  - CHG-20260721-498-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: PIPELINES_API: COMPLETE | PARTIAL | BLOCKED(<reason>)

### CHG-20260721-499
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > WORKFLOW_PROMPTS_UPDATED: <count>/<total> > WORKFLOW_PROMPTS_UPDATED: <count>/<total>
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: WORKFLOW_PROMPTS_UPDATED: <count>/<total>
- Exact payload: {"verbatim_requirement":"WORKFLOW_PROMPTS_UPDATED: <count>/<total>"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: WORKFLOW_PROMPTS_UPDATED: <count>/<total>
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S499 [15219, 15260]: "WORKFLOW_PROMPTS_UPDATED: <count>/<total>"
- Positive assertions:
  - CHG-20260721-499-POS-001: The implementation and evidence satisfy this exact source atom: WORKFLOW_PROMPTS_UPDATED: <count>/<total>
- Negative assertions:
  - CHG-20260721-499-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: WORKFLOW_PROMPTS_UPDATED: <count>/<total>

### CHG-20260721-500
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > AGENT_MODE_EXECUTOR: READY | BLOCKED(<reason>) > AGENT_MODE_EXECUTOR: READY | BLOCKED(<reason>)
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: AGENT_MODE_EXECUTOR: READY | BLOCKED(<reason>)
- Exact payload: {"verbatim_requirement":"AGENT_MODE_EXECUTOR: READY | BLOCKED(<reason>)"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: AGENT_MODE_EXECUTOR: READY | BLOCKED(<reason>)
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S500 [15262, 15308]: "AGENT_MODE_EXECUTOR: READY | BLOCKED(<reason>)"
- Positive assertions:
  - CHG-20260721-500-POS-001: The implementation and evidence satisfy this exact source atom: AGENT_MODE_EXECUTOR: READY | BLOCKED(<reason>)
- Negative assertions:
  - CHG-20260721-500-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: AGENT_MODE_EXECUTOR: READY | BLOCKED(<reason>)

### CHG-20260721-501
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > MESSAGES_SENT: 0 > MESSAGES_SENT: 0
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: MESSAGES_SENT: 0
- Exact payload: {"verbatim_requirement":"MESSAGES_SENT: 0"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: MESSAGES_SENT: 0
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S501 [15310, 15326]: "MESSAGES_SENT: 0"
- Positive assertions:
  - CHG-20260721-501-POS-001: The implementation and evidence satisfy this exact source atom: MESSAGES_SENT: 0
- Negative assertions:
  - CHG-20260721-501-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: MESSAGES_SENT: 0

### CHG-20260721-502
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Then include exactly: > Then include exactly:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Then include exactly:
- Exact payload: {"verbatim_requirement":"Then include exactly:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Then include exactly:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S502 [15330, 15351]: "Then include exactly:"
- Positive assertions:
  - CHG-20260721-502-POS-001: The implementation and evidence satisfy this exact source atom: Then include exactly:
- Negative assertions:
  - CHG-20260721-502-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Then include exactly:

### CHG-20260721-503
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - branch > - branch
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - branch
- Exact payload: {"verbatim_requirement":"- branch"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - branch
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S503 [15355, 15363]: "- branch"
- Positive assertions:
  - CHG-20260721-503-POS-001: The implementation and evidence satisfy this exact source atom: - branch
- Negative assertions:
  - CHG-20260721-503-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - branch

### CHG-20260721-504
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - PR > - PR
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - PR
- Exact payload: {"verbatim_requirement":"- PR"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - PR
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S504 [15366, 15370]: "- PR"
- Positive assertions:
  - CHG-20260721-504-POS-001: The implementation and evidence satisfy this exact source atom: - PR
- Negative assertions:
  - CHG-20260721-504-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - PR

### CHG-20260721-505
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Commit A immutable registry SHA > - Commit A immutable registry SHA
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Commit A immutable registry SHA
- Exact payload: {"verbatim_requirement":"- Commit A immutable registry SHA"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Commit A immutable registry SHA
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S505 [15373, 15406]: "- Commit A immutable registry SHA"
- Positive assertions:
  - CHG-20260721-505-POS-001: The implementation and evidence satisfy this exact source atom: - Commit A immutable registry SHA
- Negative assertions:
  - CHG-20260721-505-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Commit A immutable registry SHA

### CHG-20260721-506
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - Commit B final branch head > - Commit B final branch head
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - Commit B final branch head
- Exact payload: {"verbatim_requirement":"- Commit B final branch head"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - Commit B final branch head
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S506 [15409, 15437]: "- Commit B final branch head"
- Positive assertions:
  - CHG-20260721-506-POS-001: The implementation and evidence satisfy this exact source atom: - Commit B final branch head
- Negative assertions:
  - CHG-20260721-506-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - Commit B final branch head

### CHG-20260721-507
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - sender registry path > - sender registry path
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - sender registry path
- Exact payload: {"verbatim_requirement":"- sender registry path"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - sender registry path
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S507 [15440, 15462]: "- sender registry path"
- Positive assertions:
  - CHG-20260721-507-POS-001: The implementation and evidence satisfy this exact source atom: - sender registry path
- Negative assertions:
  - CHG-20260721-507-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - sender registry path

### CHG-20260721-508
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - pipeline registry path > - pipeline registry path
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - pipeline registry path
- Exact payload: {"verbatim_requirement":"- pipeline registry path"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - pipeline registry path
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S508 [15465, 15489]: "- pipeline registry path"
- Positive assertions:
  - CHG-20260721-508-POS-001: The implementation and evidence satisfy this exact source atom: - pipeline registry path
- Negative assertions:
  - CHG-20260721-508-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - pipeline registry path

### CHG-20260721-509
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - pinned Agent Mode executor path > - pinned Agent Mode executor path
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - pinned Agent Mode executor path
- Exact payload: {"verbatim_requirement":"- pinned Agent Mode executor path"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - pinned Agent Mode executor path
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S509 [15492, 15525]: "- pinned Agent Mode executor path"
- Positive assertions:
  - CHG-20260721-509-POS-001: The implementation and evidence satisfy this exact source atom: - pinned Agent Mode executor path
- Negative assertions:
  - CHG-20260721-509-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - pinned Agent Mode executor path

### CHG-20260721-510
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - GHL API asset IDs created > - GHL API asset IDs created
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - GHL API asset IDs created
- Exact payload: {"verbatim_requirement":"- GHL API asset IDs created"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - GHL API asset IDs created
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S510 [15528, 15555]: "- GHL API asset IDs created"
- Positive assertions:
  - CHG-20260721-510-POS-001: The implementation and evidence satisfy this exact source atom: - GHL API asset IDs created
- Negative assertions:
  - CHG-20260721-510-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - GHL API asset IDs created

### CHG-20260721-511
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > - one exact unresolved action. > - one exact unresolved action.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: - one exact unresolved action.
- Exact payload: {"verbatim_requirement":"- one exact unresolved action."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: - one exact unresolved action.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S511 [15558, 15588]: "- one exact unresolved action."
- Positive assertions:
  - CHG-20260721-511-POS-001: The implementation and evidence satisfy this exact source atom: - one exact unresolved action.
- Negative assertions:
  - CHG-20260721-511-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: - one exact unresolved action.

### CHG-20260721-512
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Also paste the complete contents of: > Also paste the complete contents of:
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Also paste the complete contents of:
- Exact payload: {"verbatim_requirement":"Also paste the complete contents of:"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Also paste the complete contents of:
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S512 [15592, 15628]: "Also paste the complete contents of:"
- Positive assertions:
  - CHG-20260721-512-POS-001: The implementation and evidence satisfy this exact source atom: Also paste the complete contents of:
- Negative assertions:
  - CHG-20260721-512-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Also paste the complete contents of:

### CHG-20260721-513
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md > integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md
- Exact payload: {"verbatim_requirement":"integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md"}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S513 [15632, 15698]: "integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md"
- Positive assertions:
  - CHG-20260721-513-POS-001: The implementation and evidence satisfy this exact source atom: integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md
- Negative assertions:
  - CHG-20260721-513-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: integrations/highlevel/agent-mode/GHL-SENDER-UI-EXECUTOR-PINNED.md

### CHG-20260721-514
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > into the final response so the operator can copy it once into Agent Mode. > into the final response so the operator can copy it once into Agent Mode.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: into the final response so the operator can copy it once into Agent Mode.
- Exact payload: {"verbatim_requirement":"into the final response so the operator can copy it once into Agent Mode."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: into the final response so the operator can copy it once into Agent Mode.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S514 [15702, 15775]: "into the final response so the operator can copy it once into Agent Mode."
- Positive assertions:
  - CHG-20260721-514-POS-001: The implementation and evidence satisfy this exact source atom: into the final response so the operator can copy it once into Agent Mode.
- Negative assertions:
  - CHG-20260721-514-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: into the final response so the operator can copy it once into Agent Mode.

### CHG-20260721-515
- Classification: HARD_EXACT
- Target: integrations/highlevel > Sender registry convergence packet > Do not end with another recommendation. > Do not end with another recommendation.
- Operation: behavior
- Current state: PR #99 is the verified base. Current-state implementation must be inspected before this atom is changed.
- Required state: Implement or preserve the exact source atom without weakening it: Do not end with another recommendation.
- Exact payload: {"verbatim_requirement":"Do not end with another recommendation."}
- Placement: parent=; before=; after=; order=
- Style allowlist: (none)
- Style forbidden targets: (none)
- Must preserve: Do not end with another recommendation.
- Must remove: (none)
- Dependencies: (none)
- Supersedes: (none)
- Source spans:
  - RAW-20260721-001:S515 [15779, 15818]: "Do not end with another recommendation."
- Positive assertions:
  - CHG-20260721-515-POS-001: The implementation and evidence satisfy this exact source atom: Do not end with another recommendation.
- Negative assertions:
  - CHG-20260721-515-NEG-001: No implementation, API action, workflow, prompt, queue job, commit, push, or PR may contradict this source atom: Do not end with another recommendation.

## Forbidden

- Do not paraphrase exact payloads.
- Do not weaken HARD_EXACT constraints with SOFT_GOAL language.
- Do not implement unresolved ambiguous changes.
- Do not edit product code before PQC and downstream readiness gates when product/UI work is in scope.
