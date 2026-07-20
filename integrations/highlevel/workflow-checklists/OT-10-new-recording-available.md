# OT-10 New Recording Available UI Checklist

Folder: 40 - Classes & Content
Prompt file: integrations/highlevel/ai-workflow-prompts/OT-10-new-recording-available.md

## Manual Fields AI Builder Cannot Safely Infer

- Exact trigger: One Time emits recording available business event.
- Trigger filters: Parent contact only. Access active, grace, or complimentary. Not suppressed. Explicit channel opt-in for any message.
- Opportunity stage: No billing stage change.
- Webhook actions: None.
- Publish toggle: leave Draft until explicitly approved.

## Exact Trigger Test

- Use test content event.
- Confirm no Vimeo credentials or private URLs.

## Expected Result

- Tags/fields: OT | Recording Available; One Time Access Status, One Time Last Sync
- Outbound webhook: None.
- Messages: OT Recording Available - DRAFT; reference parent portal only, never raw Vimeo credentials.
- Stop conditions: Suppression, no access, no consent, reply, recording unpublished.

## Workflow ID Location

- Copy the HighLevel workflow ID into WORKFLOW-ID-CAPTURE.md.
- Copy the same ID into integrations/highlevel/workflows.yaml.

## Rollback / Disable

- Disable workflow and clear test tag.
