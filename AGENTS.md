# One Time Agent Operating Guide

## Complete production launch authority — 2026-08-05

The active root goal and the single integration branch
`codex/one-time-complete-production-launch-20260805` own the complete One Time
launch through production acceptance. The authoritative launch brief is
`C:\Users\User\Downloads\ONE-TIME-FULL-PRODUCTION-LAUNCH-CODEX-GOAL.md`.
It supersedes the old Ready/claim/lease/control-tower process and any conflicting
date, copy, provider, or activation restriction below. Historical ledgers remain
read-only evidence and are not release gates.

Legacy governance compatibility remains pointer-only through
`ops/goals/CURRENT.yaml` and `ops/goals/OT-LAUNCH-01/BOARD.yaml`; those files are
read-only coordination evidence, not product authority. HighLevel desired state
continues to resolve through
`integrations/highlevel/registry/workflow-registry.yaml`.

Product paths and real user journeys take priority over control metadata. No
Ready entry, claim file, lease renewal, terminal packet, steward request, or
copied chat report is required. Focused safety verification, migration
integrity, provider idempotency, adult consent and suppression, child-data
boundaries, rollback, and final production acceptance remain mandatory.

The standing operator authority in the launch brief permits bounded repository,
Railway, HighLevel, Resend, Stripe, Zoom, Vimeo, Drive, DNS, Forward Email, and
Telegram work, progressive deployments, and operator-owned canaries. It never
permits exposing secrets or child data, creating Student contacts in HighLevel,
uncontrolled sends, unintended charges, changing existing Stripe/Replit
subscribers, or retrying an unknown external effect before reconciliation.

Locked launch replacements are: first class
`2026-08-16T19:00:00+03:00`; free access ends
`2026-09-11T18:00:00+03:00`; public Rabbi identity
`Rabbi Eli Scheller <rabbielischeller@onetimeonetime.com>`; operational identity
`info@onetimeonetime.com`; no WhatsApp lead assistant, Buffer, Class Helper,
demo/test-lab/preview product surface; and Tisha B'Av assets remain an archived,
inactive reusable template.

# One Time v2.1 current authority

The sole current product repository is `shloimie-beep/onetimev2`.

For One Time v2.1, authority is ordered:

1. `ops/v2.1-execution/source-spec/03-DECISION-REGISTER-v2.1.md`;
2. the remaining locked documents in `ops/v2.1-execution/source-spec/`, with
   `02-ACCEPTANCE-CONTRACT-v2.1.yaml` defining acceptance;
3. `ops/v2.1-execution/PACKAGE-LOCK.yaml` and `EXECUTION-CONTRACT.md`;
4. the assigned task packet and checksum-bound task context;
5. candidate-bound result records for status only.

The old launch Board, old acceptance IDs, old goal/current files, v2.0 drafts,
preview/demo/test-lane definitions, and historical handoffs are evidence only.
They may not define product behavior, completion status, or work priority.

The reviewed implementation baseline is commit `73dda293079f602c83929d1bbccb8dd5b9d1a455` on
`codex/one-time-launch-convergence-20260727` (PR #130). Do not branch v2.1 work from default `main` and
do not use a synthetic PR merge SHA. Every later task starts from the exact SHA
authorized on remote `codex/v21-control` in
`ops/v2.1-execution/control/READY-QUEUE.yaml`; never trust a stale worktree copy
of that queue.

Every Codex task is `START_OR_RESUME`. Its remote branch and committed files
under `ops/v2.1-execution/runtime/<TASK-ID>/` are durable memory. If their
digests match, resume `next_action`; do not repeat a repository-wide audit or
reconsider locked v2.1 decisions.

The root launch goal owns shared hotspots, migrations, generated registries,
provider contracts, integration, deployments, and final proof. Bounded lanes
change only their assigned non-overlapping scopes.

No task is complete because code exists or a branch check passed. Release
completion requires every release-blocking acceptance case to pass against the
same immutable candidate. Each case must run only in one of its own allowed
environments from `ACCEPTANCE-ENVIRONMENT-MATRIX.yaml`; there is deliberately
no requirement that all cases share one environment. Release also requires zero
stale evidence, unexpected effects, unauthorized waivers, fictional fixtures,
exposed child data, raw Zoom or Vimeo bearers, Student GHL contacts, or
failed/untested/placeholder controls.

## Architecture Invariants

- This repository is standalone. Do not copy BNA `server.js`, Operations shell,
  generated Operations assets, provider runtime, Studio, agents, memory,
  secrets, or broad migrations.
- Stack: Node.js 24, TypeScript, Express 5, Vite, PostgreSQL through `pg`,
  parameterized SQL, forward-only checksummed migrations, and transactional
  outbox.
- Public and authenticated bundles are separate. Public routes must not import
  React or the future CRM bundle.
- Public pages are static Vite-built HTML plus minimal enhancement; no React
  hydration on landing or signup.
- Authenticated application routes may use route-chunked React after a future
  CRM implementation packet.
- No runtime schema creation in the web process. Use `npm run db:migrate`.

## Brand And Product

- One Time brand is black + yellow with restrained ice/cyan accents.
- BNA cream/navy/teal styling is out of scope.
- Customer-facing UI calls Shloimie `Admin`; internal architecture may refer to
  Rabbi as account owner.
- Do not expose `View as Rabbi`, BNA workspace keys, Operations diagnostics, or
  Super Admin controls in customer UI.
- Canonical brand rules live in `packages/brand-system/manifest/one-time-brand.v1.json`
  and `packages/brand-system/manifest/one-time-brand.schema.json`.
- Static public pages use `@onetime/brand-system/static`; authenticated React
  surfaces use `@onetime/brand-system/react`.
- Canonical primitives and shell pieces live under
  `packages/brand-system/src/primitives/`, `packages/brand-system/src/shells/`,
  and `packages/brand-system/src/styles/`.
- Route-to-shell assignments live in `packages/brand-system/src/route-branding.ts`.
- Run `npm run brand:check` before changing visible UI. Raw colors, font-family
  declarations, route-wide runtime style injection, and route-local core
  component definitions require exact checked exceptions in
  `packages/brand-system/src/styles/exceptions.json`.
- Do not create route-local Header, Footer, Button, Toolbar, Drawer, Dialog,
  Card, form-control, table, badge, alert, or state primitives when the
  canonical package can be composed instead.

## Repository Integration Guidance

- HighLevel automation desired state is edited only in
  `integrations/highlevel/registry/workflow-registry.yaml`. Its
  `integrations/highlevel/workflows.yaml`,
  `integrations/highlevel/registry/current.json`, and
  `integrations/highlevel/registry/WORKFLOW-CONTROL-REPORT.md` projections are
  generated and read-only.

## Safety

- No BNA session or cookie is shared.
- Server derives account/product scope. Browser payloads cannot choose scope.
- Production and provider work must stay within the standing launch authority,
  use exact reconciliation and idempotent effects, and keep secret values out of
  source, logs, evidence, and chat.
- Sender/reply-to and owner-test destinations come only from protected
  configuration.
- Public repeat submissions must not reveal whether another person exists.

## Verification

- Run focused tests before committing.
- Landing/signup visual work must be checked at 360x800, 390x844, tablet, and
  desktop.
- Performance gates use visible/user-centered marks, LCP <= 2.5s, CLS <= 0.1,
  no horizontal overflow, and public bundle separation from the future CRM
  bundle.

## One Time product-lead control

Before a material One Time action, read the current launch STATUS/EXECPLAN and only the relevant locked decision, acceptance case, result, and exact merged/deployed source. Classify natural-language statements as `VISION`, `LAUNCH DECISION`, `LATER`, `OFF`, `QUESTION`, or `AUTHORIZED ACTION`; brainstorming is not authorization to change code, providers, accounts, deployment, or production. Update the compact map before implementation, choose risk-sized verification, preserve the complete endgame, and present at most one operator action. Use the discoverable `one-time-product-lead` skill for this workflow. Do not repeat broad provider or architecture audits.

The current Initial Launch Scope Lock requires basic protected Zoom classroom entry and one real protected library video. Stage Host and OBS controls remain later enhancements; BNA task management and Telegram monitoring remain outside the initial-launch critical path. Buffer/Social is OFF. Do not broaden or restore deferred capability without a newer explicit OT-CTRL decision.

Family signup displays one required, initially unchecked agreement control. Record precise backend agreement/consent facts from that one action; never add a second marketing checkbox, send passwords to GHL, create Student GHL contacts, or treat marketing withdrawal as service/account/class withdrawal.
