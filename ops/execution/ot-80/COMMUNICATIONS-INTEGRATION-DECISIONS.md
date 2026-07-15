# Day-One communications integration decisions

The bundled copy archive is valid specification input, not a second runtime and
not live-send authority. Its ZIP SHA-256 is
`ba1ffe027c4f89e93133fdb3a1a4511b971e52d4441b06b758022cbd1876440d`.

## Binding reconciliation

1. Preserve the package's immediate Family acknowledgement as a **receipt**.
   It proves the committed signup was received; it must not promise class access
   before access exists.
2. Add separate versioned events/templates for secure access readiness:
   `class.access.ready.email` and, with affirmative purpose-matching consent,
   `class.access.ready.whatsapp`.
3. The access CTA must be a protected One Time route. A raw Zoom, Vimeo, meeting,
   provider, token, or signed URL must never enter template data, browser state,
   logs, analytics, audit metadata, or provider metadata.
4. If access is delayed, retain the receipt and a durable delayed state. Do not
   send a false access promise.
5. T-30 reminders remain distinct from receipt and access messages. They require
   committed Family status, active free-promotion/class eligibility, explicit
   reminder preference, channel consent, no active suppression, an active class
   occurrence, and a valid protected route.
6. A School submission receives only the School public acknowledgement and an
   internal owner/admin lead alert. School can never fall through to Family,
   access, reminder, parent/student, or class messaging.
7. Use `Asia/Jerusalem` for scheduling and DST. Say `Israel time` in external
   English copy.
8. The canonical public sender/signature brand is `One Time Mishnayos`. Preserve
   the submitted archive unchanged as version 1 audit evidence; create a new
   server-owned catalog version for reconciled copy rather than silently editing
   the archive.
9. Do not add pricing or commercial promises to transactional copy. The public
   landing may advertise the configured free-until-Rosh-Hashanah campaign; the
   communications catalog does not invent post-promotion pricing.
10. SMS is disabled. Telegram remains a separate authenticated internal helper
    and alert transport; do not infer Telegram messages from this catalog.
11. Parent/student activation, password reset, MFA recovery, and support messages
    stay dormant unless the corresponding route, authorization, state machine,
    expiry/revocation rules, and provider path are real and tested. No dead CTA.
12. The Member Login holding page is only a fallback. A working real login wins.

## Safe defaults that do not block code convergence

- transactional email: permitted only for committed business events and active
  suppression checks;
- WhatsApp: purpose-specific affirmative consent with durable evidence;
- internal alerts: visible to Rabbi owner and Shloimie admin in a protected
  inbox; configured internal email is optional;
- school follow-up: human-owned and explicit, never automatic enrollment;
- language: English V1 with RTL-safe layout and accessible rendering;
- support: secure in-app plus configured email, no SMS;
- provider outage: business commit succeeds; message becomes delayed/retryable;
- Stripe: test only; live charging remains disabled;
- transition host: `join.onetimeonetime.com`;
- unresolved retention/legal policy: minimize stored content and mark live
  activation of the affected feature blocked, not the rest of convergence.

## Required negative tests

- School cannot receive any Family/access/reminder/account message.
- Missing, revoked, mismatched, or suppressed WhatsApp consent produces no send.
- Missing protected link delays access/reminder; it never leaks a provider URL.
- Duplicate webhook, retry, worker restart, or concurrent claim cannot duplicate
  one logical recipient/session/channel/template-version delivery.
- Provider failure never rolls back the committed lead/contact.
- 401/403/session expiry clears protected state and never shows cached sibling or
  cross-account data.
- Archived contacts and expired delivery windows fail closed.
- User-facing `Sent` or `Delivered` labels appear only for matching persisted
  provider truth; sink/queued/processed is not delivery.

