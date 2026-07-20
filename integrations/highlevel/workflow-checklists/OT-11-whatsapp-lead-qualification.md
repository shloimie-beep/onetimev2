# OT-11 WhatsApp Lead Qualification UI Checklist

Folder: 00 - Intake & Data
Prompt file: integrations/highlevel/ai-workflow-prompts/OT-11-whatsapp-lead-qualification.md

## Manual Fields AI Builder Cannot Safely Infer

- Exact trigger: Agent Studio / Conversation AI creates or updates a WhatsApp lead and applies OT | Signup WhatsApp.
- Trigger filters: WhatsApp opt-in captured explicitly. Not suppressed. No Student data collected.
- Opportunity stage: Create or move opportunity to Lead when qualified.
- Webhook actions: No webhook unless One Time lead intake endpoint is registered.
- Publish toggle: leave Draft until explicitly approved.

## Exact Trigger Test

- Use test WhatsApp contact.
- Confirm separate consent capture and no Student fields.

## Expected Result

- Tags/fields: OT | Lead, OT | Signup WhatsApp, OT | WhatsApp Opt-In; One Time WhatsApp Consent, One Time Signup Source, One Time Source Classification
- Outbound webhook: No webhook unless One Time lead intake endpoint is registered.
- Messages: Conversation AI uses OT-A1 One Time Enrollment Concierge prompt.
- Stop conditions: STOP/opt-out, suppression, existing technical support, human handoff.

## Workflow ID Location

- Copy the HighLevel workflow ID into WORKFLOW-ID-CAPTURE.md.
- Copy the same ID into integrations/highlevel/workflows.yaml.

## Rollback / Disable

- Disable workflow and Agent Studio assignment for test channel only.
