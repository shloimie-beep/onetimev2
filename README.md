# One Time One Time

Standalone One Time Mishnayos runtime.

The application is a Node.js 24 + TypeScript modular monolith with Express 5,
Vite-built public assets, PostgreSQL through `pg`, forward-only migrations, and
a transactional outbox worker.

## Canonical Control Plane

- Read `AGENTS.md`, then `ops/goals/CURRENT.yaml` and the goal files it
  references.
- `ops/goals/OT-LAUNCH-01/BOARD.yaml` is the only current status map.
- `integrations/highlevel/registry/workflow-registry.yaml` is the single
  editable HighLevel automation inventory.
- `integrations/highlevel/workflows.yaml`,
  `integrations/highlevel/registry/current.json`, and
  `integrations/highlevel/registry/WORKFLOW-CONTROL-REPORT.md` are generated
  projections and must not be edited as status.

This README is repository orientation only. Do not infer current readiness,
deployment state, or provider authority from historical PRs or evidence files.

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
npm run secret:scan
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
