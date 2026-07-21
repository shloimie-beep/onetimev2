# OT-08 Parent Portal Activated Prompt

Build in HighLevel Draft state only. Do not publish, send messages, enroll production contacts, mutate Stripe, or create Student contacts from this prompt.

Canonical registry: one-time-highlevel@1.1.0
Exact workflow: OT-08 Parent Portal Activated
Folder: 30 - Portal Lifecycle
Exact trigger: One Time parent portal projection becomes Active
message_class: portal_activated
sender_key: brand
transport: GHL
Purpose: Parent portal activation projection.

Registry dependencies:
- `integrations/highlevel/registry/sender-registry.yaml`
- `integrations/highlevel/registry/message-class-registry.yaml`
- `integrations/highlevel/registry/communications-contract.json`
- `integrations/highlevel/registry/workflow-registry.yaml`

Exact sender custom values to select from the picker:
- One Time Brand Sender Name
- One Time Brand From
- One Time Default Reply-To
- Do not type or guess sender display-name, From, reply-to, or provider text.
- If a registered sender value is absent from the picker, block this workflow instead of inventing it.

Required boundaries:
- Use only registered One Time fields, tags and custom values from `integrations/highlevel/registry/current.json`.
- Preserve unrelated existing tags on contacts.
- Check suppression and consent before any non-transactional communication.
- Do not create human tasks or Human Handoff actions.
- Do not expose raw Zoom links, raw Vimeo links, tokens, payment-card data, internal IDs, usernames or passwords.
- A GHL tag or field is not authorization for One Time portal access.

Record parent portal activation after One Time emits the event.
Do not expose Student data or learning progress in HighLevel.

Test state:
- Use only a protected operator-owned test contact.
- Record the workflow ID only after it exists in the verified location.
- Keep publish toggle off until explicit separate approval.
