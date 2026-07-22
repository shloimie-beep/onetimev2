# OT-B03 Send Member Login UI Checklist

Folder: 60 - Bot Actions
Exact trigger: OT-A1 invokes the typed member-login adapter
message_class: access_help
sender_key: office
transport: GHL
Registry: integrations/highlevel/registry/workflow-registry.yaml

- Build only in Draft.
- Confirm every field, tag and custom value exists in `registry/current.json` before use.
- Read `sender-registry.yaml`, `message-class-registry.yaml`, and `communications-contract.json` before sender configuration.
- Select the registered picker value: One Time Office Sender Name.
- Select the registered picker value: One Time Office From.
- Select the registered picker value: One Time Default Reply-To.
- Never guess or hardcode an unregistered sender identity.
- No Human Handoff action.
- No human task creation.
- No production contact enrollment.
- No outbound message send in this lane.
- No Student contact, Student field or Student tag.
- Record the workflow ID in `WORKFLOW-ID-CAPTURE.md` after creation.
