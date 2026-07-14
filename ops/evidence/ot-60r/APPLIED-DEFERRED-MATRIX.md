# OT-60R Applied/Deferred Matrix

| Input | Status | Notes |
| --- | --- | --- |
| Initial execution protocol | Applied | Committed and pushed at `5a3071cd8cb061ef4e58a59ed11760dec87a4203`. |
| PR #3 / OT-34 | Superseded | No merge/cherry-pick. Alternate migration/model excluded. |
| PR #9 / OT-38 | Partially ported | Only HMAC-derived login-CSRF proof was ported intentionally with tests. Alternate migration/model excluded. |
| PR #5 / OT-35 shell | Applied | Integrated authenticated CRM shell with canonical PR #2 auth/search, idempotent create contract, current screenshots, and E2E/accessibility/performance evidence. |
| PR #7 / OT-39 CRM privacy/performance | Pending | Integrate after PR #5 shell. |
| PR #11 / OT-42 CRM module | Pending | Integrate after PR #5/#7, extending canonical `/api/v1/crm`. |
| PR #4 / OT-36 delivery | Pending | Apply commit range in order, then PR #8 correction. |
| PR #8 / OT-40 delivery correction | Pending | Use corrected migration/file state. |
| PR #14 / OT-44 communications | Pending | Integrate after delivery lineage. |
| PR #12 / OT-46 Stripe fixture-only | Pending | Default-off, no live charges. |
| PR #15 / OT-52 portals | Pending | Relationship/learner scoped. |
| PR #13 / OT-51 Telegram mock-only | Pending | Default-off, no live Telegram. |
| PR #6 / OT-37 PostgreSQL assurance | Pending | Port after integrated schema exists. |
| PR #10 / OT-47 | Deferred evidence-only | Reference blocker evidence; do not claim content/library implementation. |
