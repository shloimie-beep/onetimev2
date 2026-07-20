# OT-07 Parent Portal Invitation UI Checklist

Folder: 30 - Portal Lifecycle
Prompt file: integrations/highlevel/ai-workflow-prompts/OT-07-parent-portal-invitation.md

## Manual Fields AI Builder Cannot Safely Infer

- Exact trigger: One Time emits portal invitation business event after entitlement projection confirms access.
- Trigger filters: Parent contact only. Local access is active, grace, or complimentary.
- Opportunity stage: No billing stage change.
- Webhook actions: None. One Time remains source of auth truth.
- Publish toggle: leave Draft until explicitly approved.

## Exact Trigger Test

- Use test parent contact with active entitlement.
- Confirm no credentials are sent through HighLevel.

## Expected Result

- Tags/fields: OT | Portal Invited; One Time Portal Status, One Time Access Status, One Time Last Sync
- Outbound webhook: None. One Time remains source of auth truth.
- Messages: OT Portal Invitation Follow-Up - DRAFT; never include passwords or reset links.
- Stop conditions: Portal active, suppression, reply, access inactive.

## Workflow ID Location

- Copy the HighLevel workflow ID into WORKFLOW-ID-CAPTURE.md.
- Copy the same ID into integrations/highlevel/workflows.yaml.

## Rollback / Disable

- Disable workflow and clear only test task/enrollment.
