# One Time Agent Operating Guide

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

## Director Handoff

- For current control-plane context, start at `ops/goals/CURRENT.yaml`, then
  read the referenced `GOAL.md`, `SPEC.yaml`, `ACCEPTANCE.yaml`, `BOARD.yaml`,
  and `DECISIONS.yaml`.
- `BOARD.yaml` is the only current status map. Entrypoints, reports, PR
  descriptions, and generated projections must point to it rather than copying
  mutable status, SHAs, PRs, or deployment IDs.
- HighLevel automation desired state is edited only in
  `integrations/highlevel/registry/workflow-registry.yaml`. Its
  `integrations/highlevel/workflows.yaml`,
  `integrations/highlevel/registry/current.json`, and
  `integrations/highlevel/registry/WORKFLOW-CONTROL-REPORT.md` projections are
  generated and read-only.
- `ops/director/START-HERE.md` is a pointer-only entrypoint to those canonical
  files. It does not replace this AGENTS file.

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
