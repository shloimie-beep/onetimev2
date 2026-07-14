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
