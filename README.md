# One Time

One Time is a standalone Mishnayos learning application for Parents, Students, and
Rabbi-led classroom operations. It is not the BNA workspace, and it does not include
the later Platform Console control plane.

The runtime is a Node.js 24 + TypeScript modular monolith: Express 5, Vite-built
public assets, PostgreSQL through pg, checksummed forward-only migrations, and a
transactional outbox worker. Public and authenticated application bundles are kept
separate.

## Start here

- [Repository guide](AGENTS.md) defines stable boundaries, safety, branch, and
  verification rules.
- [OpenSpec capabilities](openspec/specs/) are the current product truth. Each
  material behavior change belongs to one track and, when needed, one change folder.
- [DESIGN.md](DESIGN.md) is the durable visual contract derived from the existing
  brand manifest.
- [Authority index](ops/launch/ONE-TIME-AUTHORITY-INDEX.md) distinguishes current
  authority from preserved historical launch evidence.
- GitHub Issues/Projects and PRs are the execution record: use the linked task and
  exact remote head to choose an integration base.

Historical BOARD.yaml files are evidence, not the current status map or task board.
Do not reactivate a Markdown/YAML Board for execution tracking.

## Local setup

    npm install
    npm run build
    npm run db:migrate
    npm run dev

Use DATABASE_URL for a local or test PostgreSQL database. The test suites use an
in-memory PostgreSQL-compatible harness while still exercising migrations and
repository transaction boundaries.

## Verification

    npm run source-truth:check
    npm run openspec:validate
    npm run design:lint
    npm run secret:scan
    npm run format
    npm run lint
    npm run typecheck
    npm run integration
    npm run build

npm run verify is the broader local gate. Run focused tests during iteration and
add browser checks only when the touched surface requires them.

## Canonical integration path

Re-fetch the GitHub task's exact base, create a focused topic branch, and open one
Draft PR to the named integration branch. Do not branch feature work from main,
push to main, force-push, or use a synthetic merge SHA. Stage explicit paths only;
the Windows checkout must never use git add -A.
