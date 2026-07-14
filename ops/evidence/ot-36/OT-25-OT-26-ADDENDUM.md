# OT-36 Urgent Addendum — Intake OT-25 and OT-26

Paste this into the active OT-36 Codex window. It supplements and overrides the School-delivery wording in the original prompt.

```text
OT-36 FOLLOW-UP — OT-25/OT-26 INTAKE

Do not stop or restart OT-36. Apply these corrections in the same branch.

AUTHORITATIVE AUDIT FACTS
- Current legacy authority is BNA master@cebbfc5, not standalone One Time.
- It uses one protected recurring target, not a session-bound target.
- Schedule is daily 19:00 Asia/Jerusalem, DST-aware, 30-minute offset.
- Legacy dispatch cron exists, but there is no proved recurring producer cron. A green
  dispatcher can therefore process zero reminders forever.
- Standalone PR #2 has no schedule/occurrence/reminder producer or real transport.
- Do not copy the legacy alias family, cron wiring, provider activation, or raw target.

CORRECT SCHOOL BEHAVIOR — OVERRIDES ORIGINAL OT-36
- Every valid School signup receives a generic transactional EMAIL acknowledgement
  that says the inquiry was received and the team will follow up.
- That School email contains no class link, access language, join action, or reminder.
- A School signup selecting WhatsApp/Both may receive a generic WhatsApp receipt only
  when phone, consent, and suppression checks pass.
- The School WhatsApp receipt contains no class link/access/reminder.
- School never receives family class reminders or portal/member access.
- Internal owner alert remains a separate eligible event.
- Do not terminally skip every School public event merely because it is School; route
  it to the generic acknowledgement template.

FAMILY BEHAVIOR
- Every valid Family signup receives the transactional email acknowledgement,
  including reminder_preference=none.
- Family WhatsApp confirmation requires WhatsApp/Both, valid E.164 phone, recorded
  consent, active suppression state, and active/non-archived contact.
- The protected class target is resolved ephemerally at dispatch; it never appears in
  source fixtures, outbox JSON, CRM DTOs, logs, audit metadata, screenshots, or tests.

DISPATCH-TIME SAFETY
- Re-read account/product, audience classification, consent, preference, suppression,
  contact archived state, and supported event/channel immediately before dispatch.
- Scope contact/signup joins by account and product.
- Never claim provider-mode rows or unknown/future events.
- When an event has deliver_by/occurrence metadata, never send after expiry; record a
  stable safe expired/skipped outcome.
- Do not invent schedule/occurrence metadata for existing immediate rows.

OT-36 REMAINS BOUNDED
- Implement the transport-neutral sink worker and immediate acknowledgement templates.
- Do not add the 30-minute producer, class tables, occurrence generator, recurring cron,
  BNA dependency, live Resend/WAPI calls, Railway service, or raw URL storage.
- Preserve explicit seams for occurrence_id, policy_version, deliver_by, and
  deterministic occurrence/contact/channel delivery keys, but leave their producer to
  the next sequential class-fulfillment lane after core hardening.

CONFIGURATION
- Introduce only canonical standalone configuration names documented in your
  INTEGRATION.md. Do not reproduce six class-link aliases or the legacy WAPI/Resend
  alias families.
- No secret values in code/evidence.

TEST ADDITIONS
- School email acknowledgement: generic copy, no target.
- Eligible School WhatsApp receipt: generic copy, no target.
- School never gets family class-link/reminder template.
- Family email with preference=none remains eligible.
- Dispatch-time archived/suppressed/consent/preference changes fail closed.
- Expired deliver_by row is never sent.
- Raw target absence from outbox/DTO/log/audit/evidence is mechanically asserted.

FINAL HANDOFF
- State clearly that OT-36 does not prove recurring reminders.
- Record the missing recurring producer as the next implementation lane, not a small
  deployment setting.
```

