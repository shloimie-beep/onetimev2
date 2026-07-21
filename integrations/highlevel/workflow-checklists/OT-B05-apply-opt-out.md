# OT-B05 Apply Opt-Out UI Checklist

Folder: 00 - Intake & Data
Exact trigger: OT-A1 invokes the typed opt-out adapter; no acknowledgement send is authorized by this registry lane
message_class: support_acknowledgement
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
