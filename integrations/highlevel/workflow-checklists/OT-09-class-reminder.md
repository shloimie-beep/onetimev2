# OT-09 Class Reminder UI Checklist

Folder: 40 - Classes & Content
Prompt file: integrations/highlevel/ai-workflow-prompts/OT-09-class-reminder.md

## Manual Fields AI Builder Cannot Safely Infer

- Exact trigger: One Time emits next class reminder event or GHL scheduled parent reminder after local access check.
- Trigger filters: Parent contact only. Explicit channel opt-in. Not suppressed. Access active, grace, or complimentary.
- Opportunity stage: No billing stage change.
- Webhook actions: None.
- Publish toggle: leave Draft until explicitly approved.

## Exact Trigger Test

- Set test Next Class At.
- Confirm parent-facing message only.

## Expected Result

- Tags/fields: OT | Class Reminder Pending, OT | Email Opt-In, OT | WhatsApp Opt-In; One Time Next Class At, One Time Class Time Zone, One Time Access Status
- Outbound webhook: None.
- Messages: OT Class Reminder - DRAFT; parent-facing only, no student contact.
- Stop conditions: Suppression, no access, no consent, reply, class canceled.

## Workflow ID Location

- Copy the HighLevel workflow ID into WORKFLOW-ID-CAPTURE.md.
- Copy the same ID into integrations/highlevel/workflows.yaml.

## Rollback / Disable

- Disable workflow and clear test reminder tag.
