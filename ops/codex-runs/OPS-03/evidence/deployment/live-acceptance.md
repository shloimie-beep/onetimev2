# OPS-03 Live Acceptance Evidence

Target: `https://ot99-web-staging.up.railway.app`

Result:

- Status: passed.
- Checks: 17 passed, 0 failed.
- Roles: administrator, owner, parent, student, viewer.
- Covered owner surfaces: CRM, dashboard, classes, content, billing.
- Covered portal surfaces: parent portal, student portal.
- Parent learner-access mutations: setup, suspend, restore, reset, restore.
- Isolation: cross-household parent dashboard request returned 404; viewer write isolation passed.
- Billing: read-only billing status verified with provider mutations `none` and payment transport disabled.
- Provider leakage guards: owner classes/content/billing, parent portal, and student portal passed.
- MFA: owner and administrator login prompts were answered from the local private handoff.
- Viewports: 360x800, 390x844, 768x1024, and 1440x1000 for parent and student portals.

Artifacts:

- Sanitized JSON report: `ops/codex-runs/OPS-03/evidence/deployment/live-acceptance.json`
- Screenshots: `ops/codex-runs/OPS-03/evidence/screenshots/`

No credentials, protected variables, row contents, real sends, charges, provider canaries, production imports, DNS changes, or BNA runtime mutations were used for this acceptance pass.
