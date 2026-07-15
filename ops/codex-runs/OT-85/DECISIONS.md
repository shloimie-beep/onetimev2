# OT-85 Decisions

- WhatsApp is implemented as a separate domain slice. Telegram tables, Telegram config, Telegram worker logic, and Telegram identity mapping were not reused.
- Meta webhook ingestion uses `express.raw` before global JSON parsing so signatures are verified against exact raw bytes.
- Inbound message text, outbound message text, and E.164 values are encrypted at rest. Sender and recipient identity keys use HMAC-derived stable keys.
- Phone number alone never authenticates a user. The account-link seam stores only a token hash and grants a 15-minute `safe_status_only` capability after an existing authenticated portal session and household authorization.
- OT-85 contact persistence uses WhatsApp-specific internal email aliases and leaves `contacts.phone_normalized` null for new WhatsApp-only leads. Encrypted WhatsApp tables retain the sender value.
- Archived matching contacts are not reactivated. Re-inquiries create `archived_contact_reinquiry` lead events for human review.
- School interest is lead-only. The implementation records no household, subscriber, portal, class access, reminder, or class-link side effect for school leads.
- Family reminder consent is separate from reactive conversation consent. STOP/START does not restore reminder consent.
- Public program answers come only from `OT85_PUBLIC_FACTS`; unsupported questions receive a fallback instead of invented details.
- Real canary send is not attempted without `ONETIME_CANARY_WHATSAPP_RECIPIENT_E164` and explicit staging authorization.
