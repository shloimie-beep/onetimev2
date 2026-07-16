# OPS-06 read-only current-state audit

Task ID: `OPS-06`  
Packet ID: `OPS-06-20260716-d34103b1`  
Audit date: `2026-07-16`  
Repository: `webcraft-media/onetimev2`

## Source topology

The repository default branch `main` is the original foundation at `610b585f3d221addd4e7b824c92a5cc256cffcf9`; it is not the integrated product. The integrated product is spread across open Codex branches. The read-only audit anchor is OT87 at `6ecb680713a2fd5cd7bc03766fe9b8974c9b75df` because it includes the OT83 household/portal lineage plus family subscription and entitlement work. OT86A and OT86B are divergent content/social lanes from OT83; OT86B includes Buffer publishing capability, which must remain disabled and is never authorized by `OPS-06`.

No isolated staging URL or deployed SHA was proven by the audited PR metadata. The direct Codex prompt therefore treats source and staging discovery as a mandatory first gate and never assumes `main`, OT87, OT86A, OT86B, or any PR head is deployed.

## Confirmed foundations

- Family/School lead capture includes canonical `POST /api/v1/leads`, server-derived account/product scope, idempotent replay, contact/lead/audit/outbox persistence, and truthful school handling.
- Owner/admin authentication, protected CRM/dashboard shells, parent/student shells, session rotation, logout, and student-session revocation seams exist in the integrated lineage.
- Portal contracts include a literal three-active-learner maximum, student access lifecycle, protected class/library/review descriptors, progress, rewards, updates, and role/household/learner scoping.
- The delivery worker implements leasing, concurrency, retry classification, deterministic backoff, dead-letter outcomes, and sink routing.
- Existing browser suites cover selected responsive, accessibility, RTL, reduced-motion, reflow, CRM, Family/School signup, and 30-sample route performance scenarios.

## Mandatory gaps found

1. **Exact environment/source:** historical evidence says isolated staging was not deployed. `/version` discovery and repository SHA binding are mandatory.
2. **Action registry:** the existing registry is older, contains only 39 actions, lacks several requested fields, and marks visible controls `unavailable_by_design`. `OPS-06` allows only final readiness `ready`.
3. **CRM completeness:** the audited contact contract exposes one `internal_note` field but no tag collection, note history, relationships, or tasks contracts/routes.
4. **Question queue:** helper/query defaults to `ADAPTER_UNAVAILABLE`; the audited UI renders helper availability but no durable question queue form or receipt.
5. **Support receipt:** the current portal route is preview-only and returns `external_send_performed=false`; it does not prove a durable subscriber-support receipt.
6. **Protected controls:** parent/student add-learner, class-launch, content-open, and support controls may be disabled when handlers are absent; prior registry calls several unavailable by design.
7. **Fresh proof:** prior PostgreSQL, performance, accessibility, action, and worker evidence cannot be reused as `OPS-06` evidence. Real PostgreSQL 16 fresh/upgrade, worker restart, all roles/states, and every action must run again.

## Packet disposition

These findings are not silently repaired or waived by this packet. The Codex run may add test-harness/evidence glue, stable action IDs, deterministic provider-off fixture adapters, failure injection, health/readiness, fixture ledger/reset, and evidence emitters. A missing business capability such as tags, durable notes, relationships, tasks, question queue, or support receipt remains a `FAIL_PRODUCT_GAP` unless the exact deployed source already contains it. The run must not present preview-only, disabled, hidden, reserved, or Coming Soon UI as launch-ready.
