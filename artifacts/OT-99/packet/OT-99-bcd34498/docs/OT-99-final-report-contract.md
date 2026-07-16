# OT-99 — Final Report Contract

`artifacts/OT-99/FINAL-REPORT.md` must be plain, evidence-based, and understandable without reading command logs.

## OT-99 mandatory sections

1. **Exact release identity** — repository, selected completed `OT-83R` foundation branch and SHA, `OT-99` integration branch and SHA, draft pull request URL and number when real, and exact staging URL and deployed SHA only when real.
2. **Rabbi access** — a direct yes, no, blocked, or not-run answer to whether the Rabbi can log in, followed by the exact evidence.
3. **Actions that work** — concrete actions verified at the exact `OT-99` SHA.
4. **Actions that are disabled** — concrete actions, the truthful user-visible reason, and whether the cause is feature flag, missing credential, missing authorization, provider outage, incomplete dependency, or failed test.
5. **Component readiness table** — one row for landing, signup, CRM, portals, Rabbi authentication, Telegram `OT-84`, Zoom `OT-88`, support producer `OT-89A`, WhatsApp `OT-85`, Vimeo/content/KB `OT-86A`, Buffer `OT-86B`, Stripe TEST entitlements `OT-87`, and BNA support consumer `OT-89B`. Each row must independently report code present, integrated, configured, canary passed, staging accepted, and production live.
6. **Lineage and semantic convergence** — selected candidates, skipped candidates, double-merge prevention, pull request `#24/#25` decision, shared contract resolution, and the two-versus-three outbox resolution.
7. **Migration safety** — deterministic renumber mapping, applied identifiers preserved, ledger and checksum updates, PostgreSQL 16 fresh install, every relevant upgrade path, and rollback or forward-fix result.
8. **Validation** — outcome and evidence path for unit, integration, browser, accessibility, security, privacy, secret, PII, provider URL, bundle, request, performance, concurrency, role, account, household, sibling, every-visible-action, provider-outage, and migration tests.
9. **Staging and canaries** — isolation proof, provider-off synthetic result, separate protected-canary authorization and provider-side readback, or exact reason not run.
10. **BNA boundary** — `OT-89B` readiness and protocol compatibility without importing BNA code.
11. **Remaining blockers** — owner, reason, impact, and minimum evidence or action needed to clear each blocker.
12. **Rollback** — the tested rollback procedure, triggers, preserved data, and evidence.
13. **Shortest route to live** — the minimum ordered steps supported by current evidence. Do not include a production declaration.
14. **Prohibition attestation** — confirm no root DNS change, live Stripe charge, broad send, production contact import, automatic Buffer publication, hard delete, or production declaration occurred.

`production live` must remain `no` unless a separate authorized production release actually occurred and was independently verified. `OT-99` does not authorize that release.
