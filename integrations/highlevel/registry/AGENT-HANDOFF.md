Before creating or changing a One Time HighLevel field, tag, custom value, workflow, form mapping, bot prompt, knowledge base or contact import, read the canonical registry under integrations/highlevel/registry/. Do not create an unregistered asset.

# One Time HighLevel Agent Handoff

Canonical schema: one-time-highlevel@1.0.0

Canonical bot:

- OT-A1 One Time Enrollment Assistant.
- Channels: Website Live Chat and WhatsApp.
- Voice AI deferred.
- No Human Handover action.
- No task-creation action.
- No separate WhatsApp lead-qualification bot or workflow.

Workflow boundary:

- Business workflows: OT-01, OT-02A, OT-02B, OT-03, OT-04, OT-05, OT-06, OT-07, OT-08, OT-09, OT-10, OT-13.
- Bot-action workflows: OT-B01, OT-B02, OT-B03, OT-B04, OT-B05.
- Deprecated: OT-11, OT-12 when it creates tasks, OT - Human Handoff and duplicate lead-capture workflows.

Safety:

- Do not create Student contacts, Student fields or Student tags in HighLevel.
- Do not send messages, publish workflows, enroll production contacts, mutate Stripe or expose private One Time links unless a later task explicitly authorizes the exact action.
- Reconcile protected import manifest and contact map before any contact import write.
