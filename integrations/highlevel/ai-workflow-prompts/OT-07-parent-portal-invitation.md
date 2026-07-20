# OT-07 Parent Portal Invitation AI Builder Prompt

Copy the text below into HighLevel AI Builder. Build in Draft state only.

```text
Create a HighLevel workflow named "OT-07 Parent Portal Invitation".
Place it in folder "30 - Portal Lifecycle".

Trigger: One Time emits portal invitation business event after entitlement projection confirms access.
Trigger filters: Parent contact only. Local access is active, grace, or complimentary.
Re-entry: Allow when One Time Portal Status changes back to invitation_pending.
Stop on response: Create support task on reply.
Timezone/business window: Asia/Jerusalem; Sunday-Thursday 9:00-20:30.
Tags to use: OT | Portal Invited
Custom fields to use: One Time Portal Status, One Time Access Status, One Time Last Sync

Build these If/Else branches:
- If no channel consent, create internal task only.
- If suppressed, do not send marketing follow-up.

Add these waits:
- Wait 10 minutes after One Time transactional activation email.

Messages/templates by exact safe name:
- OT Portal Invitation Follow-Up - DRAFT; never include passwords or reset links.

Workflow-to-workflow handoffs: Portal activation event to OT-08.
Opportunity stage changes: No billing stage change.
Tasks/internal notifications: Task if invite is not activated after 48 hours.
Custom webhook actions to One Time: None. One Time remains source of auth truth.
Stop conditions: Portal active, suppression, reply, access inactive.

Consent and suppression gates:
- Check OT | Marketing Suppressed before any outbound message.
- Check One Time Email Consent and OT | Email Opt-In before email.
- Check One Time WhatsApp Consent and OT | WhatsApp Opt-In before WhatsApp.
- Unknown consent may create an internal task, but must not send a campaign message.
- STOP, unsubscribe, complaint, hard bounce, and manual suppression win over every other branch.

Safety boundaries:
- Never create or message Student contacts.
- Never include Student names, ages, passwords, private notes, progress, attendance, Vimeo credentials, Zoom links, reset links, or raw internal IDs.
- Never unlock One Time portal access from a HighLevel tag alone.
- Never send a campaign, publish the workflow, or enroll production contacts from this prompt.

Test procedure:
- Use test parent contact with active entitlement.
- Confirm no credentials are sent through HighLevel.

Publish checklist:
- Leave workflow in Draft.
- Review every trigger, filter, branch, wait, message, task, webhook, and stop condition.
- Test with the protected operator-owned test contact only.
- Record the workflow ID in integrations/highlevel/WORKFLOW-ID-CAPTURE.md and workflows.yaml after it exists.
- Publish only after separate operator approval.
```
