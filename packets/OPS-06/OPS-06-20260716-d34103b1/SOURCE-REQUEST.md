# OPS-06 resolved source request

Original uploaded request SHA-256: `291fb5d3937e78be8446f6d95178a1e8ab5fd71b653625b2f693f62b242f0f50`  
Resolved packet ID: `OPS-06-20260716-d34103b1`  
Resolved queue branch: `dropoff/ops-06-d34103b1`  
Resolved queue path: `packets/OPS-06/OPS-06-20260716-d34103b1/`

The request below is rendered with its delivery tokens resolved so this packet contains no unresolved placeholders.

# OPS-06 — Full Synthetic Day-One Launch Rehearsal Packet Factory

Act as a principal product-quality and release engineer. TASK_ID is `OPS-06`; use it everywhere.

Create a direct-to-Codex packet for a deterministic, repeatable, synthetic end-to-end Day-One rehearsal of the integrated One Time product on isolated staging. Audit current contracts/routes/tests read-only. Do not edit GitHub yourself.

The Codex prompt must discover the exact staging/source SHA and implement any missing test harness/evidence glue. It must persist state first and run this complete journey with fictional `.example.test` data:

landing → Family signup → idempotent CRM contact/lead/audit/outbox → truthful acknowledgement/reminder intent → owner/admin activation/login → dashboard → CRM list/search/filter/detail/edit/tags/notes/relationships/read-only communications/tasks → household → parent activation → three named learners and fourth-seat denial → student activation → parent/student portals → protected next-class/library/review/progress/rewards → learner question queue → subscriber support receipt → logout/session revocation.

Also prove School signup remains a CRM lead without subscription, classroom, portal, or support entitlement.

Create a machine-readable action registry for every visible control: stable ID, role/capability, route/component, label, read/write, handler/endpoint, confirmation, idempotency/audit, loading/success/error/offline/permission state, readiness, owner, and positive/negative tests. Hidden/dead/Coming Soon controls fail the gate.

Test owner, administrator, parent, student, anonymous, inactive subscriber, and school-lead roles across loading, empty, populated, partial error, retry, offline, session expiry, forbidden, conflict, duplicate, provider unavailable, and worker restart. Click every visible action at 360×800, 390×844, tablet, desktop; keyboard/a11y/RTL/reduced-motion/200% reflow; verify consistent design system/header/footer/navigation/buttons/cards/forms.

Require fresh/upgrade PostgreSQL 16, concurrency, account/role/household/sibling isolation, secret/PII/provider-URL scans, web/worker health, exact SHA, request/bundle budgets, 30-sample throttled-mobile p50/p75/p95, no BNA fanout, queue retry/dead-letter, and rollback reset of synthetic fixtures.

Provider-off mode is the mandatory baseline; provider canaries are separate. No broad send, real user, production row, live charge, Buffer publish, root DNS mutation, or production deploy.

## Delivery protocol

Try queue branch `dropoff/ops-06-d34103b1`, path `packets/OPS-06/OPS-06-20260716-d34103b1/`, PR `[OPS-06][PACKET READY] Day-One launch rehearsal`; return real URL+SHA. Otherwise create exactly `OPS-06-CODEX-PACKET.zip` in Library and return one link. No loose prose.

Include packet manifest, direct Codex prompt, journey/action/role/error matrices, evidence schema, reset/rollback plan, and checksums. No unresolved placeholders.

