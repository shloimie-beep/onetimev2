# OPS-07 — Cross-role Day-One journey, visual, accessibility, and dead-control gates

## Mission

Build release-grade executable acceptance gates that prove the integrated product is actually usable—not merely compiled. This is primarily a test/evidence lane so it can run in parallel without fighting feature branches. Repair only clearly task-owned harness defects; report product defects precisely for the final conductor.

## Source

- Repository: `webcraft-media/onetimev2`
- Exact base: `codex/ops03-staging-readiness-repair` at `fb5f5eebc539afc9e93833e9417ee67524d62c36`
- Branch: `codex/ops07-dayone-journey-gates`
- Draft PR base: `codex/ops03-staging-readiness-repair`
- Own only `tests/visual/**`, `tests/ux/**`, `scripts/ux-certify/**`, new safe fixtures/helpers, and `ops/codex-runs/OPS-07/**` unless an existing harness entry absolutely requires a minimal change.

## Complete route/role coverage

Cover anonymous/public `/`, signup, login, activate, forgot/reset, privacy, terms, 404; owner/admin dashboard, CRM list/detail/communications, classes, content, billing, communications, support; parent portal; student portal; protected classroom launch; denied/wrong-role/session-expired/offline/error/empty/loading/long-content states.

Use deterministic fictional seeded identities. Never capture tokens/passwords/real PII.

## Required gates

- Wait for explicit route-specific usable marks and actionable visible controls. Fail if screenshot is taken while `Checking session`, `Refreshing`, `Signed out`, `Session expired`, skeletons, or spinners linger unexpectedly.
- Fail on console/page errors, uncaught rejection, unexpected 4xx/5xx, external request leakage, cross-role data, dead links, buttons with no action, placeholder/debug copy, duplicate primary heading, unauthorized home navigation, or missing back/retry path.
- Detect AppShell logo/home routing to a role-inappropriate destination.
- Detect raw engineering copy/IDs/methods/capabilities/idempotency/provider payloads in normal product UI.
- Detect `helper is not connected yet`-style raw placeholders; intentional unavailable states must be human and actionable.
- Test keyboard order, focus visibility/restoration/traps, names/labels/errors, contrast, reduced motion, RTL-safe layout, 200% zoom/reflow, virtual keyboard, safe areas, and touch targets.
- Test 360×800, 390×844, 768×1024, 1440×1000; populated, empty, loading, error, offline, permission denied, session expired, duplicate/conflict, provider-off, and long content.
- Add actual deterministic screenshot assertions/baselines, not informational screenshots only. Mask only unstable non-product data; do not mask defects.
- Per-route bundle/request/performance budgets: public must not load app/CRM/content; CRM must not preload content/providers; portals must not load admin; content heavy modules lazy-load; warm returns avoid broad refetch.
- Throttled-mobile p75 gates for signup usable, CRM list/detail/return, parent/student usable, classes, content list/detail, support, and auth lifecycle.

## Day-One functional matrix

Create a machine-readable matrix for lead signup→CRM, owner activation/login, trusted device, parent activation/learner access/reset, student login/class/resource/question, subscriber support, class occurrence/reminder/access, Content processing/artifact/prompt/social states, communications single-recipient draft/send sink, and provider-control status. Each is `PASS`, `FAIL`, `BLOCKED_EXTERNAL`, or `DEFERRED_APPROVED` with exact evidence.

Do not mark a provider action PASS from a mock when the row claims a real canary. Keep separate rows for domain/sink/provider acceptance/end-to-end delivery.

## Output

Persist `ops/codex-runs/OPS-07/{ORIGINAL-PROMPT.md,STATE.json,DECISIONS.md,ROUTE-MATRIX.json,DAYONE-MATRIX.json,FINDINGS.json,RESUME.md,FINAL-REPORT.md}`. Commit/push/open a draft PR. The final conductor will run these gates against its deployed exact SHA and make product fixes there. No deploy, provider mutation, send, charge, publish, DNS, BNA, or production data action is authorized here.
