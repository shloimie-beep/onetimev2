# OT-01 New Lead Intake Prompt

Build in HighLevel Draft state only. Do not publish, send messages, enroll production contacts, mutate Stripe, or create Student contacts from this prompt.

Canonical registry: one-time-highlevel@1.1.0
Exact workflow: OT-01 New Lead Intake
Folder: 00 - Intake & Data
Exact trigger: successful durable Family-account creation committed with immediate free access
message_class: access_help
sender_key: office
transport: GHL
Purpose: Send the adult Family-account receipt after durable account and immediate-free-access readback.

Registry dependencies:

- `integrations/highlevel/registry/sender-registry.yaml`
- `integrations/highlevel/registry/message-class-registry.yaml`
- `integrations/highlevel/registry/communications-contract.json`
- `integrations/highlevel/registry/workflow-registry.yaml`

Exact sender custom values to select from the picker:

- One Time Office Sender Name
- One Time Office From
- One Time Default Reply-To
- Do not type or guess sender display-name, From, reply-to, or provider text.
- If a registered sender value is absent from the picker, block this workflow instead of inventing it.

Required boundaries:

- Use only registered One Time fields, tags and custom values from `integrations/highlevel/registry/current.json`.
- Preserve unrelated existing tags on contacts.
- Send only canonical copy `ghl.signup_confirmation.v1` to the adult whose durable Family account was successfully created.
- Require durable Family-account and immediate-free-access local readback before the receipt.
- Confirm up to three Student seats without creating any Student contact in GHL.
- State truthfully that no card was collected and there is no automatic charge.
- Keep every School inquiry on its separate manual path; never enter a School inquiry into OT-01 or automatic nurture.
- Stop on a missing durable-account readback, ambiguous adult match, invalid address, or applicable suppression.
- Do not create human tasks or Human Handoff actions.
- Do not expose raw Zoom links, raw Vimeo links, tokens, payment-card data, internal IDs, usernames or passwords.
- A GHL tag or field is not authorization for One Time portal access.

Trigger only after One Time commits successful durable Family-account creation plus immediate free access for the adult account owner.

Test state:

- Use only a protected operator-owned test contact.
- Record the workflow ID only after it exists in the verified location.
- Keep publish toggle off until explicit separate approval.
