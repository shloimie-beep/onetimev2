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
- Select the registered picker value: One Time Default Reply-To.
- The fixed post-acceptance visible From is `Rabbi Eli Scheller | One Time Mishnayos <rabbi@onetimeonetime.com>` using One Time Rabbi Campaign Phase 2 From; this is not an open product decision.
- Preserve the current Phase 1 From fallback until GHL-UI-24 proves provider acceptance. Do not activate or send from the desired address in this Draft-only task.
- Keep Reply-To at `info@onetimeonetime.com`; rabbi@ may use the same governed GHL Conversations route and needs no separately monitored second inbox.
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
