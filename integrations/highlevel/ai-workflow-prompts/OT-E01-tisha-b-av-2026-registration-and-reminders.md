# OT-E01 Tisha B'Av 2026 Registration and Reminders Prompt

Apply only to the existing canonical workflow ID `a34ea513-4612-4f53-8bd8-49e89e6610f9`. Do not create a workflow, campaign, audience, contact, enrollment, test, or customer send. The existing Published workflow may be saved and republished only to apply the explicitly approved registered-attendee email change below; preserve its in-flight enrollment and reopen/read back the same ID after the brief Draft interval.

Do not publish a new workflow or any unrelated workflow. Republish only the same existing OT-E01 ID after its governed Email A save/readback.

Canonical registry: one-time-highlevel@1.1.0
Exact workflow: OT-E01 Tisha B'Av 2026 Registration and Reminders
Folder: 45 - Events
Exact trigger: Tisha B'Av 2026 registration or approved reminder milestone is recorded
message_class: event_registration_confirmation
sender_key: brand
approved_step_sender_override: Email A - Immediate Confirmation -> rabbi_campaign
transport: GHL
Purpose: Registered Tisha B'Av 2026 registration and reminder workflow.

Registry dependencies:

- `integrations/highlevel/registry/sender-registry.yaml`
- `integrations/highlevel/registry/message-class-registry.yaml`
- `integrations/highlevel/registry/communications-contract.json`
- `integrations/highlevel/registry/workflow-registry.yaml`

Exact sender custom values to select from the picker:

- Email A - Immediate Confirmation: One Time Rabbi Campaign Sender Name
- Email A - Immediate Confirmation: One Time Rabbi Campaign Phase 1 From
- Email C - One Hour and Email D - Join Now: One Time Brand Sender Name
- Email C - One Hour and Email D - Join Now: One Time Brand From
- One Time Default Reply-To
- Do not type or guess sender display-name, From, reply-to, or provider text.
- If a registered sender value is absent from the picker, block this workflow instead of inventing it.

## Approved immediate registered-attendee email

This is an event registration confirmation, not account email verification, newsletter opt-in, marketing consent, or an invitation campaign.

Action: `Email A - Immediate Confirmation`

Subject:

`You're registered — let's strengthen ourselves together`

Pre-header:

`Join Rabbi Eli Scheller live from the Holy Land this Tisha B'Av.`

Body:

```text
Hi {{default contact.first_name "there"}},

Thank you for signing up for Rabbi Eli Scheller's live Tisha B'Av class.

Together, we'll strengthen ourselves and help fill the world with knowledge of Hashem through digital Torah learning.

Join us for a special class, live from the Holy Land.

Thursday, July 23, 2026
3:00 PM Eastern
10:00 PM Israel

We'll email the private class access before the program begins.

[View the One Time Mishnah Class Page]
{{custom_values.one_time_tisha_bav_landing_url}}

Can't wait to see you,

Rabbi Eli Scheller
One Time Mishnah Learning
```

Link semantics:

- The only link in this immediate email is the registered protected One Time landing custom value `one_time_tisha_bav_landing_url`.
- No raw meeting-provider URL, token, customer address, or secret may be copied into Git evidence.
- The public invitation campaign OT-C01 is out of scope and remains Draft with zero sends.

Delivery eligibility:

- exact Tisha B'Av registered-event permission only;
- email present and syntactically valid;
- email DND false;
- no unsubscribe, complaint, hard bounce, or global suppression;
- no Student contacts or Student data;
- duplicate registration must not create duplicate enrollment or confirmation;
- newsletter consent is neither required nor inferred for this event-only email.

Required boundaries:

- Use only registered One Time fields, tags and custom values from `integrations/highlevel/registry/current.json`.
- Preserve unrelated existing tags on contacts.
- Check suppression and consent before any non-transactional communication.
- Do not create human tasks or Human Handoff actions.
- Do not expose raw Zoom links, raw Vimeo links, tokens, payment-card data, internal IDs, usernames or passwords.
- A GHL tag or field is not authorization for One Time portal access.

Use event_code tisha-bav-2026 and the canonical Tisha B'Av registration/reminder state.
Use `rabbi_campaign` only for the explicitly Rabbi-authored immediate confirmation above. Preserve `brand` for the one-hour and ten-minute reminder steps unless a later Git-authored approval changes them.
Do not duplicate event tags or custom values.

Verification state:

- Do not send a test or customer email from this change.
- Save the edited action, save the existing workflow, reopen/read back the exact subject, pre-header, sender keys, protected-link presence, and event-only copy, then republish the same workflow ID.
- Confirm the existing operator enrollment remains at its current wait; do not reenroll, advance, or duplicate it.
