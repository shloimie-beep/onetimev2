# OT-07 Parent Portal Invitation UI Checklist

Folder: 30 - Portal Lifecycle
Exact trigger: One Time access confirmation requests the parent portal companion email
message_class: portal_welcome
sender_key: brand
transport: GHL
Registry: integrations/highlevel/registry/workflow-registry.yaml

- Build only in Draft.
- Confirm every field, tag and custom value exists in `registry/current.json` before use.
- Read `sender-registry.yaml`, `message-class-registry.yaml`, and `communications-contract.json` before sender configuration.
- Select the registered picker value: One Time Brand Sender Name.
- Select the registered picker value: One Time Brand From.
- Select the registered picker value: One Time Default Reply-To.
- Never guess or hardcode an unregistered sender identity.
- No Human Handoff action.
- No human task creation.
- No production contact enrollment.
- No outbound message send in this lane.
- No Student contact, Student field or Student tag.
- Record the workflow ID in `WORKFLOW-ID-CAPTURE.md` after creation.
- Verify the split delivery contract: One Time/Resend separately sends activation_token through account_security; GHL never stores or sends the token.
