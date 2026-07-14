# OT-60R Applied/Deferred Matrix

| Input | Status | Notes |
| --- | --- | --- |
| Initial execution protocol | Applied | Committed and pushed at `5a3071cd8cb061ef4e58a59ed11760dec87a4203`. |
| PR #3 / OT-34 | Superseded | No merge/cherry-pick. Alternate migration/model excluded. |
| PR #9 / OT-38 | Partially ported | Only HMAC-derived login-CSRF proof was ported intentionally with tests. Alternate migration/model excluded. |
| PR #5 / OT-35 shell | Applied | Integrated authenticated CRM shell with canonical PR #2 auth/search, idempotent create contract, current screenshots, and E2E/accessibility/performance evidence. |
| PR #7 / OT-39 CRM privacy/performance | Applied | Integrated privacy checks, post-paint usability marks, list cache, accessibility/performance proof, and OT-35 supersession sentinels; adapted search to canonical POST-body `/api/v1/crm/contacts/search`. |
| PR #11 / OT-42 CRM module | Applied | Integrated contracts, domain helpers, migration 1000, injectable router/register hooks, protected client cache, lazy tab loader, and focused tests. Kept unmounted from live CRM routes pending concrete repository implementations. |
| PR #4 / OT-36 delivery | Applied | Applied both commits in order and kept sink/mock delivery worker guardrails. |
| PR #8 / OT-40 delivery correction | Applied | Applied corrected delivery contract and final migration `0004` state. |
| PR #14 / OT-44 communications | Applied | Applied communications read model and wired shared app/server shell with read-only session scope, lazy global route, and contact Communications view. |
| PR #12 / OT-46 Stripe fixture-only | Applied | Integrated as isolated, unmounted fixture-only billing foundation with default-off flags, no Stripe network, no provider mutation, and no entitlement/access grant. |
| PR #15 / OT-52 portals | Applied | Integrated as isolated, unmounted parent/student portals with household-authorized parent scope, single-learner student scope, learner cap, credential digest, support-preview, helper, and protected-action safeguards. |
| PR #13 / OT-51 Telegram mock-only | Applied | Integrated as isolated mock/default-off Telegram foundation with no webhook registration, no polling activation, no real Telegram transport, no central runtime wiring, and no provider mutation. |
| PR #6 / OT-37 PostgreSQL assurance | Pending | Port after integrated schema exists. |
| PR #10 / OT-47 | Deferred evidence-only | Reference blocker evidence; do not claim content/library implementation. |
