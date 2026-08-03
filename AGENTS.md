# One Time Agent Operating Guide

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

Only the control tower changes global execution ledgers. A worker changes only
its own branch state/handoff/result files and its assigned code scope. Shared
hotspots, migrations, generated registries, provider locks, and live effects
obey `WRITER-SCOPES.yaml`, `MERGE-PROTOCOL.md`, and
`EXTERNAL-AUTHORITY-MATRIX.yaml`.

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
- Do not connect to the production Rabbi database, copy live secrets, or send
  email, WhatsApp, Telegram, payments, webhooks, member access, portal access,
  Zoom links, or provider mutations from this task.
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
