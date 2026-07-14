# One Time One Time

Standalone One Time Mishnayos runtime for the first foundation, landing, and
lead-capture slice.

The application is a Node.js 24 + TypeScript modular monolith with Express 5,
Vite-built public assets, PostgreSQL through `pg`, forward-only migrations, and
a transactional outbox worker that remains in sink/mock mode for this task.

## Current Scope

- Public landing at `/`
- Signup form at `/signup`
- Login placeholder at `/login`
- Future authenticated CRM route at `/app/crm`
- Canonical lead API at `POST /api/v1/leads`
- Temporary compatibility endpoint at `POST /api/one-time/interest`
- Legacy redirects from `/one-time`, `/one-time/signup`, and `/rabbi-member`

No deployment, DNS, production database, payment, portal access, or real
external messaging change is included.

## Local Workflow

```bash
npm install
npm run build
npm run db:migrate
npm run dev
```

Use `DATABASE_URL` for a local or test PostgreSQL database. Tests use an
in-memory PostgreSQL-compatible harness and still exercise the SQL migrations
and repository transaction boundaries.

## Verification

```bash
npm run format
npm run lint
npm run typecheck
npm run unit
npm run integration
npm run e2e
npm run accessibility
npm run performance
```

`npm run verify` runs the full local gate.
