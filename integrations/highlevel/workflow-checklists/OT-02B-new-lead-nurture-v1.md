# OT-02B New Lead Nurture v1 UI Checklist

Folder: 10 - Enrollment & Nurture
Exact trigger: registered new lead nurture audience entry
message_class: prelaunch_nurture
sender_key: rabbi_campaign
transport: GHL
Registry: integrations/highlevel/registry/workflow-registry.yaml

- Build only in Draft.
- Confirm every field, tag and custom value exists in `registry/current.json` before use.
- Read `sender-registry.yaml`, `message-class-registry.yaml`, and `communications-contract.json` before sender configuration.
- Select the registered picker value: One Time Rabbi Campaign Sender Name.
- Select the registered picker value: One Time Rabbi Campaign Phase 1 From.
- Select the registered picker value: One Time Rabbi Campaign Phase 2 From.
- Select the registered picker value: One Time Default Reply-To.
- Never guess or hardcode an unregistered sender identity.
- No Human Handoff action.
- No human task creation.
- No production contact enrollment.
- No outbound message send in this lane.
- No Student contact, Student field or Student tag.
- Record the workflow ID in `WORKFLOW-ID-CAPTURE.md` after creation.
