# OPS-08 — Overnight semantic integration, premium product finish, staging deployment, and operator handoff

## Role

You are the sole final integration/deployment director. Other windows own leaf branches. Do not ask the operator to paste their reports; discover exact remote branches, PRs, checkpoint files, final reports, and GitHub checks yourself. The repository—not chat—is the handoff system.

## Goal

Produce one exact, green, isolated staging candidate that the operator can activate by email and test as owner/admin and as a separate parent. Integrate all completed Day-One product/provider/operations work, apply the coherent premium UI only after semantic convergence, run full role/provider acceptance, repair defects on the integration branch, and deploy the exact verified SHA. Never confuse `provider-off UI works` with `real provider passed`.

## Repository and initial reference

- Repository: `webcraft-media/onetimev2`
- Known green reference: `codex/ops03-staging-readiness-repair` at `fb5f5eebc539afc9e93833e9417ee67524d62c36`
- Existing isolated staging: `https://ot99-web-staging.up.railway.app`; verify rather than trust this URL/report.
- Current deployed evidence predates the reference head. `/version` must match the candidate after deployment.
- Create one clean external integration worktree/branch `integration/ops08-overnight-final-<UTC timestamp>` and draft PR. Never use BNA checkout as a One Time source.

## Unattended input monitor

Monitor these fixed branches and repository checkpoint reports:

- `codex/ops03b-email-step-up-login`
- `codex/ot104r-vimeo-private-runtime`
- `codex/ot101r-telegram-admin-runtime`
- `codex/ot110a-admin-content-workspace`
- `codex/ot111-legacy-activation-campaign`
- `codex/ot112-premium-product-system`
- `codex/ot113-portal-classroom-completion`
- `codex/ot114-crm-communications-support`
- `codex/ops05-provider-control-center`
- `codex/ops06-reliability-observability`
- `codex/ops07-dayone-journey-gates`

Also discover the newest branch matching `integration/ops04c-one-time-access-content-convergence-*`, the current heads/checks of PRs #42–#48 after OPS-09A repair, and the BNA branch `codex/bna-ops02-onetime-support-consumer` for cross-repo canary readiness only.

Poll remote state at no less than 60-second intervals, writing `ops/codex-runs/OPS-08/INPUT-STATUS.json` after each meaningful change. Do not generate noisy comments or hold an uncheckpointed state. Continue monitoring for up to eight hours or until all required product branches have a pushed checkpoint/final report. A provider canary marked blocked by missing protected config is still an acceptable code input; a preflight-only/no-code branch is not.

If time expires, integrate every completed safe input, push a clean resumable checkpoint, list missing branches, and do not claim/deploy a complete candidate. Do not discard available work because one optional provider secret is absent.

## Fleet acceptance

Before integration:

- Require repaired branch-local CI for Zoom PR #42, WhatsApp #43, student helper #44, Buffer #46, and Rabbi publisher #48; Stripe TEST #45 and premium landing #47 must remain green/current.
- Read each feature report and `INTEGRATION-DELTA`; branch existence alone is insufficient.
- Record exact input SHAs in immutable `INPUTS.json`.
- Scan every input for migration collisions/checksums, shared-hotspot changes, secrets, BNA/Operations imports, and scope drift.

## Ordered semantic convergence

Use the newest green OPS-03B email-login head as preferred base. Integrate behavior, not whole conflict sides, in this order:

1. no-authenticator email activation/login and trusted-device policy;
2. repaired premium landing;
3. parent/student/classroom completion plus repaired Zoom and student-helper leaves;
4. CRM/communications/support producer and legacy activation controls;
5. Content workspace/prompt registry, Rabbi publisher, private Vimeo runtime, Buffer runtime, student helper knowledge projection;
6. One Time Telegram admin runtime and WhatsApp public lead runtime;
7. Stripe TEST billing runtime;
8. provider control/webhook conformance;
9. worker reliability/observability/recovery;
10. product-system kit and Day-One journey/visual gates.

Use the prior OPS-04C integration as a source of already reconciled content/provider work, not a second competing base. Avoid double-merging commits. Renumber colliding forward migrations once and update registry/checksums/tests atomically.

Mount shared `app.ts`, config, worker dispatch, provider registry, route/navigation/branding, capability checks, and audit events exactly once. Verify every subsystem is actually reachable from runtime; unused library files are not implementation.

## Product finish after convergence

Apply OT-112's adoption map and repair the integrated product, including:

- neutral boot shell; never show `Signed out`, `Session expired`, or `Checking session` while a valid session is merely loading;
- role-aware logo/home navigation;
- no owner/debug action registry, HTTP paths/methods, opaque keys, idempotency details, or provider mutation jargon in normal UI;
- clear owner/admin dashboard, CRM, classes, Content, billing, communications, and support hierarchy;
- no faded normal contact names;
- parent/student duplicate heading removal, compact mobile learner actions, clear next-class/content/progress/reward hierarchy, and intentional helper-unavailable states;
- distinguish `Ask in class` from `Private question`;
- support and receipt inside the authenticated shell with human status copy and no internal IDs;
- complete route-branding coverage for auth lifecycle, support/receipt, communications, nested CRM, classroom, error routes;
- one coherent token/component system across public/auth/app/portals while retaining route-specific bundles;
- no duplicate headphone-boy image; approved landing banner/copy/cards/color carousel/mobile CTA invariants from OT-112/PR47;
- no dead buttons, placeholder links, duplicate categories, horizontal overflow, or screenshots captured before usable state;
- route-local lazy loading and budgets so CRM never preloads Content/providers and portals never preload admin.

Do not redesign approved copy or invent provider success. Premium means complete, responsive, fast, accessible, and coherent.

## Shared runtime requirements

- Correct Resend raw-body Svix verification before enabling lifecycle webhook delivery.
- Stripe TEST webhook endpoint must be the canonical application POST path, not the site root; prove signature/replay/idempotency.
- Provider-specific signature algorithms remain provider-specific.
- Worker heartbeat, queue/outbox/dead-letter lag, graceful drain, protected diagnostics, and safe provider health are mounted.
- Optional provider failure cannot take down signup, login, CRM, or portals. Queue/failure is visible, bounded, idempotent, and retryable.
- BNA support consumer is a separate repository. If its branch is green and protected endpoints exist, run only a fictional signed ticket round-trip; never merge BNA code into One Time.

## Complete verification before deployment

Run full lint, format/touched format, typecheck, unit, integration, e2e, accessibility, performance, build/bundle, secret/PII scan, supply-chain checks, visual screenshot matrix, and disposable PostgreSQL 16 migration/concurrency/load/backup-restore proof. Use OPS-07 gates against local candidate first. Fix product defects on this integration branch and repeat until green.

Require exact route × role × viewport × state proof and fail on console/page errors, unexpected API errors, dead controls, cross-role leakage, raw provider URLs, placeholder/debug text, lingering skeleton/session text, or request fanout.

## Staging deployment and canaries

Before deployment, create a native staging backup and record current web/worker/DB rollback identifiers. Deploy the exact green candidate SHA to the existing isolated staging project only. Apply verified forward migrations once. Verify `/version`, `/health`, `/ready`, metadata/noindex, worker heartbeat, queue health, and all role journeys.

Protected credentials stay in Railway/secret storage and values are never printed. Configure/enable only providers whose exact staging variables, allowlist, webhook ownership, and rollback are complete. Missing variables are reported by name and leave that provider off.

Bounded canaries authorized here, only when protected configuration exists:

- at most one owner activation/reset and one separate parent-test activation email, deduplicated across prior runs;
- one fictional lead signup receipt to the exact protected allowlisted destination;
- Stripe TEST-mode webhook/Checkout/subscription fixture with no live charge;
- one protected Zoom fixture occurrence/access/reminder, never real customer class mutation;
- one public WhatsApp canary only to the protected exact test destination with verified consent/allowlist;
- one Telegram `/status`/fictional lookup/reversible task canary only to mapped operator identity;
- one private Vimeo fixture/read-only or minimal authorized ingest canary;
- one Buffer profile/draft/schedule-validation canary without live publication;
- one helper query against fictional approved knowledge;
- one fictional One Time→BNA support ticket and redacted BNA Telegram sink/live alert only if explicitly allowlisted.

No broad email/WhatsApp campaign, production contact import, live Stripe charge, live Buffer post, production deployment, or root/join DNS change is authorized.

## Morning handoff

Persist `ops/codex-runs/OPS-08/{ORIGINAL-PROMPT.md,INPUTS.json,INPUT-STATUS.json,STATE.json,DECISIONS.md,CONFLICT-LEDGER.md,CAPABILITY-MANIFEST.json,PROVIDER-CANARIES.json,ROLLBACK.md,RESUME.md,FINAL-REPORT.md}`. Commit/push/open/update the draft PR and keep the worktree clean.

The final report must lead with one of:

- `READY_FOR_OPERATOR_TESTING`
- `PARTIALLY_READY_FOR_OPERATOR_TESTING`
- `NOT_READY`

For every capability, separately state `UI/domain`, `sink/test`, `real staging canary`, and `production`. Provide exact input/candidate/deployed SHAs, PR, migrations, URLs, tests/performance/a11y/visual results, provider statuses/missing variable names, activation-email outcome, rollback IDs, and the operator's next human action. Never print passwords, tokens, emails, phone numbers, private URLs, or handoff secrets; the operator should receive activation through the approved channel.
