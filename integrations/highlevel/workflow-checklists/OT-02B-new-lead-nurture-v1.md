# OT-02B New Lead Nurture v1 UI Checklist

Folder: 10 - Enrollment & Nurture
Exact trigger: registered new lead nurture audience entry
message_class: prelaunch_nurture
sender_key: rabbi_campaign
transport: GHL
Registry: integrations/highlevel/registry/workflow-registry.yaml

- Build only in Draft.
- Confirm every field, tag, and custom value exists in `registry/current.json` before use.
- Read `sender-registry.yaml`, `message-class-registry.yaml`, and `communications-contract.json` before sender configuration.
- Select the registered picker value: One Time Rabbi Campaign Sender Name.
- Select the registered picker value: One Time Rabbi Campaign Phase 1 From.
- Select the registered picker value: One Time Default Reply-To.
- Do not select One Time Rabbi Campaign Phase 2 From; it remains pending the separately gated GHL-UI-24 acceptance.
- Never guess or hardcode an unregistered sender identity.
- Use only Reviewed Email One `rabbi_new_program_prelaunch_nurture_v1` from the paired canonical prompt; keep later nurture copy blocked pending separate review.
- Insert only the registered One Time Home URL custom value for the CTA.
- Do not select an audience. Only independently proven adult general-marketing permission may authorize a later audience; Tisha registration, attendance, payment, portal state, deliverability, and legacy tags never do.
- No Human Handoff action.
- No human task creation.
- No production contact enrollment.
- No outbound message send in this lane.
- No Student contact, Student field, or Student tag.
- Record the workflow ID in `WORKFLOW-ID-CAPTURE.md` after creation.
