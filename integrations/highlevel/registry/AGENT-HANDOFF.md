Before creating or changing a One Time HighLevel field, tag, custom value, workflow, form mapping, bot prompt, knowledge base or contact import, read the canonical registry under `integrations/highlevel/registry/`. Do not create an unregistered asset.

# One Time HighLevel Agent Handoff

Canonical schema: one-time-highlevel@1.1.0
Canonical location ID: pBSnOK2nkdxp6gf9Rg3o
Last API reconciliation: 2026-07-22T06:16:21.012Z

Required starting files:
- `integrations/highlevel/registry/current.json`
- `integrations/highlevel/registry/custom-fields.yaml`
- `integrations/highlevel/registry/tag-taxonomy.yaml`
- `integrations/highlevel/registry/custom-values.yaml`
- `integrations/highlevel/registry/workflow-registry.yaml`
- `integrations/highlevel/registry/sender-registry.yaml`
- `integrations/highlevel/registry/message-class-registry.yaml`
- `integrations/highlevel/registry/pipeline-registry.yaml`
- `integrations/highlevel/registry/event-registry.yaml`
- `integrations/highlevel/registry/communications-contract.json`
- `integrations/highlevel/registry/rabbi-telegram-contract.yaml`
- `integrations/highlevel/agent-mode/GHL-AGENT-MODE-QUEUE.json`

Canonical bot:
- OT-A1 One Time Enrollment Assistant.
- Channels: Website Live Chat and WhatsApp.
- Voice AI deferred.
- No Human Handover action.
- No task-creation action.
- No separate WhatsApp lead-qualification bot or workflow.

Workflow boundary:
- Business workflows: OT-01, OT-02A, OT-02B, OT-03, OT-04, OT-05, OT-06, OT-07, OT-08, OT-09, OT-10, OT-13, OT-C01, OT-E01.
- Bot-action workflows: OT-B01, OT-B02, OT-B03, OT-B04, OT-B05.
- Deprecated: OT-11, OT-12 when it creates tasks, OT - Human Handoff and duplicate lead-capture workflows.

Prompt boundary:
- Do not overwrite an active prompt with another agent prompt.
- Store incoming prompts under `integrations/highlevel/prompts/incoming/`, diff them against the active prompt, then promote explicitly.
- Store knowledge-base changes under `integrations/highlevel/knowledge-bases/incoming/` until approved.

Current safe counts:
- Contact custom fields: 34 total, 33 active, 0 pending.
- Tags: 38 total, 37 active, 0 pending.
- Custom values: 40 total, 30 active, 7 blocked pending UI/business value.
- Agent Mode jobs: 13 expected under integrations/highlevel/agent-mode/jobs/.

Safety:
- Do not create Student contacts, Student fields or Student tags in HighLevel.
- Do not send messages, publish workflows, enroll production contacts, mutate Stripe or expose private One Time links unless a later task explicitly authorizes the exact action.
- Reconcile protected import manifest and contact map before any contact import write.
- Every canonical workflow uses exactly one registered sender_key and message_class. Never guess sender text.
- Phase-2 rabbi@ remains inactive until every mailbox, From-address, seed, reply-to-Conversations, and recorded-result prerequisite passes.
