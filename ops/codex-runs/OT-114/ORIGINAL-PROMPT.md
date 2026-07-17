# OT-114 — CRM communications and subscriber support completion

## Mission

Make the owner/admin CRM useful for daily work: clear lead/contact cards and tags, a human communications timeline, safe single-recipient replies, and a polished subscriber-only support experience. Produce the signed One Time support event for BNA, but do not edit BNA in this lane.

## Source

- Repository: `webcraft-media/onetimev2`
- Exact base: `codex/ops03-staging-readiness-repair` at `fb5f5eebc539afc9e93833e9417ee67524d62c36`
- Branch: `codex/ot114-crm-communications-support`
- Draft PR base: `codex/ops03-staging-readiness-repair`
- Reconcile existing OT-89A/support producer and communications code; do not replace proven auth/CRM foundations.

## CRM operator experience

- Contact list/card/table with readable names, search through POST body, filters, sorting, cursor pagination, stable warm return, and mobile filter scroller.
- Durable custom tags and truthful system facts: lead, legacy system, active legacy user, activated, school lead, subscriber, parent, student relationship. Do not collapse independent facts into one status.
- Contact detail: profile, household/relationships, enrollment/subscription summary, notes, tasks, communications, support tickets, audit/activity.
- Create/edit/note/archive with duplicate/identity-conflict and optimistic-version handling.
- No faded normal text, internal opaque IDs as primary labels, or empty buttons.

## Communications

- Unified per-contact timeline for lifecycle email, transactional email, WhatsApp, delivery/provider events, inbound messages when available, and internal notes. Distinguish queued, provider accepted, delivered, failed, bounced, complained, suppressed, and unknown.
- Owner/admin may compose a single-recipient email or WhatsApp reply only when capability, destination, consent/preference, suppression, and provider readiness permit it.
- Before sending, show exact destination in redacted form, channel, template/body revision, and confirmation. Require an idempotency key and audit.
- Provider-off mode saves a draft or sink event and says it was not externally sent. Never display sink success as delivery.
- Bulk campaigns remain owned by OT-111. This lane may deep-link to campaign preview but cannot execute a broad send.
- Rabbi/admin may answer appropriate operational questions; private student questions remain in the learner-question flow and are not automatically exposed to parents.

## Subscriber support

- Only an authenticated, entitled subscriber/parent or authorized owner/admin can open a technical/support ticket. Authorization is server-side; a hidden button is not enough.
- Anonymous/non-subscriber users receive public lead/help/WhatsApp guidance, never the subscriber ticket form.
- Put support list/detail/create/receipt inside the authenticated One Time shell rather than a raw HTML island.
- Use human statuses and copy. Do not show receipt IDs, delivery versions, signatures, internal event names, or provider payloads as normal UI.
- Categories: access/login, class/Zoom, billing, content, technical bug, account/family, other. Capture reproducible context with consent, but no secrets/raw tokens.
- Clear bugs may create a BNA triage candidate, but never automatically execute code or deploy. Requests/new features/ambiguous items must be marked `decision_needed` with structured options for the operator.

## Signed BNA producer

- Emit a minimal versioned support event through a feature-local outbox adapter with account/product scope, ticket public ID, entitlement proof snapshot/reference, category, severity, redacted summary, timestamps, idempotency key, and trace ID.
- Sign requests using protected per-integration credentials, timestamp/replay window, event ID deduplication, and destination allowlist. Never include passwords, activation/class links, provider secrets, raw messages unnecessary for triage, or full household data.
- Fail safely: ticket remains stored and visibly pending delivery; bounded retries/dead-letter; no duplicate BNA ticket.
- BNA endpoint absence blocks only real bridge canary, not implementation/tests/PR.

## Verification

Test all CRM operations and privacy/cache behavior, tag coexistence, timelines/states, consent/suppression, single-send preview/confirmation/idempotency, provider-off truthfulness, subscriber eligibility, anonymous denial, support shell mobile/a11y, signed-event tamper/replay/deduplication, retry/dead-letter, and cross-account isolation. No broad real send.

Persist `ops/codex-runs/OT-114/{ORIGINAL-PROMPT.md,STATE.json,DECISIONS.md,INTEGRATION-DELTA.md,RESUME.md,FINAL-REPORT.md}`. Commit/push/open a draft PR. Report exact routes/APIs/models/migrations/tests/screenshots, sink/canary status, and the BNA consumer contract. No deploy, BNA edit, production import, broad send, DNS change, charge, or provider mutation is authorized.
