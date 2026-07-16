# OPS-04P Recommended Canary Order

No canary below was executed in OPS-04P. This is the recommended later order once protected variables, account mappings, and explicit operator approvals exist.

## Order

1. Preserve baseline and deploy identity
   - Reconfirm `GET /health`, `GET /version`, and `GET /ready`.
   - Snapshot sanitized Railway variable names and non-secret flags.
   - Confirm staging still reports commit `fb3c397ce8ece100cf7873fdddcd940a1552ea9b` or record the new intended SHA before any canary.

2. BNA signed support/content ingress with synthetic fixtures
   - Start with signed, non-sensitive local/staging fixture events because these prove internal HMAC boundaries without external messaging, payment, video, or social-provider side effects.
   - Keep BNA staging receiver and workspace mapping explicit.

3. Stripe TEST read-only validation
   - Configure TEST-only resources and run read-only validation before creating any checkout or portal session.
   - Correct webhook target must be `https://ot99-web-staging.up.railway.app/api/v1/billing/webhooks/provider`.
   - The obsolete `http://join.onetimeonetime.com` target must not be used.

4. Resend email provider readback, then one approved email canary
   - Verify sender/domain/account readiness read-only first.
   - Send only to the exact protected canary email destination.

5. WhatsApp provider readback, then one approved WhatsApp canary
   - Choose Meta Cloud or WAPI/Whapi before configuring.
   - Verify webhook destination/signature config read-only, then send only to the exact protected canary recipient.

6. Telegram Bot API readback, then one approved chat canary
   - Run read-only `getMe` and webhook info checks first.
   - Require bot token, webhook secret, owner/operator mapping, single-consumer gate, and exact canary chat.

7. Vimeo read-only identity/capability canary
   - Run read-only account/capability mode first.
   - Upload/private fixture mode remains a separate later authorization gated by `OT86_ALLOW_VIMEO_CANARY_UPLOAD=1`.

8. Buffer read-only profiles/channels canary
   - Read profiles and destination mapping only.
   - Draft/schedule/publish remains a later product workflow, not readiness proof.

9. Zoom read-only account/classroom readiness
   - Verify account, host, SDK, meeting/template, and settings read-only.
   - Meeting/registrant mutations should wait until the classroom canary is separately approved.

10. OpenAI/provider-neutral student helper runtime
    - Do this after approved content/retrieval scope is locked.
    - Require citation, privacy, and student-safety tests before any external inference call.

## Stop Conditions

- Any live-mode key or live payment capability appears where TEST/sink is expected.
- Any canary destination is missing or ambiguous.
- Any provider route points at production, DNS outside the staging origin, or the obsolete Stripe target.
- Any provider asks for broader scopes than the canary requires.
- Any evidence would require printing raw secrets, personal contact data, private notes, payment data, or message bodies.
