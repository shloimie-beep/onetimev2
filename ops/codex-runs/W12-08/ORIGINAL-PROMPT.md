# W12-08 — Admin dashboard and classroom productization

## Outcome

Replace technical/scaffold-like owner UI with usable product pages while preserving truthful capability states. Make dashboard, CRM entry, classroom, and linked detail flows understandable and actionable.

## Base/isolation

Target `webcraft-media/onetimev2`; dynamically select current accepted release source; create clean branch/worktree `codex/w12-08-admin-classroom-productization`.

## Work

1. Replace customer-visible phrases such as “Read-only, API-backed status,” raw API/action names, provider payload language, and generic “Needs setup” with human product copy.
2. Do not hide real limitations. Map states to `Ready`, `Processing`, `Action needed`, `Not connected`, `No data yet`, `Temporarily unavailable`, and `Last updated`, with a clear owner action or explanation.
3. Move technical endpoints, action registry, provider codes, and diagnostic details behind an owner-only Diagnostics disclosure/page.
4. Dashboard cards show meaningful counts/trends/next actions for new leads, current members, communications requiring attention, upcoming class, content processing, support, and billing/provider state. Never show unknown as zero.
5. Classroom becomes a usable schedule/list/detail: next class, protected access state, enrolled households/learners counts, attendance/progress summary, recording/content association, review sheet, questions, and failure states. No raw Zoom/Vimeo URLs.
6. Communications/contact cards deep-link to the correct CRM/contact/household/class/content surfaces. Contact detail may expose related parent/student records to authorized admin without entering their sessions.
7. Normalize branded filters/toolbars/cards using canonical tokens and 44px targets; mobile filters remain visible and horizontally usable.
8. Provide clear calls to create/import contacts, seed the Portal Test Lab, configure content, or inspect provider readiness only when permission allows.

Use typed application services and current capability matrix. Avoid duplicating W12-01 import logic, W12-02 communications history, W12-03 portal data, or W12-04 content pipeline. Use provisional adapters and document reconciliation.

## Proof/continuity

Maintain `ops/codex-runs/W12-08/**`. Test ready/empty/processing/error/stale/unknown, roles, no PII cache/log, mobile/desktop, accessibility, performance, links, and truthful provider-off behavior. No deploy/provider/data mutation. Document hotspots, commit, push, draft PR.

