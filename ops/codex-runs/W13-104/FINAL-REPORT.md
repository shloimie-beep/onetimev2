# W13-104 Final Report

Terminal status: `READY_FOR_USE_EXTERNAL_ACCOUNTS_PENDING`

W13-104 was executed from the downloaded package and PR #91. The runtime
candidate advanced from starting PR head
`2a6b3a58167dd99a35b925062b0127fcf7660946` to validated runtime source
`688fc70cf64b72bc52f4ea7511d8593750d7ab45`.

Production result:

- Fresh W13-104 PostgreSQL 18 backup/restore proof passed before deployment.
- Staging deployed and smoke passed on version `w13-104-public-cls-688fc70`.
- Production deployed and smoke passed at `https://join.onetimeonetime.com`.
- Production `/version` reports commit
  `688fc70cf64b72bc52f4ea7511d8593750d7ab45`.
- Production web deployment:
  `74a6b736-dd67-4966-bdf6-b7dd80280d1a`.
- Production worker deployment:
  `0a0d730c-fa00-4338-b446-a8dcb8832c17`.

Validation result:

- Fixed the PR #91 Node 24 public-page CLS failure by preloading the self-hosted
  display font and using optional font display for the public shell.
- Fixed the W13-103 production-role integration test fixture so seeded session
  expiry is relative to the current test run.
- Passed local `secret:scan`, `typecheck`, `lint`, `brand:check`, scoped
  Prettier, `test`, `e2e`, `accessibility`, and final `performance` gates.
- PR #91 head `688fc70cf64b72bc52f4ea7511d8593750d7ab45` passed GitHub Node 24
  verify, OPS-06 deterministic checks, PostgreSQL 16 assurance, PostgreSQL 16
  learner-seat proof, and PostgreSQL 18 assurance.
- Captured W13-104 performance, mobile visual, backup, deployment, and live
  smoke evidence under `ops/codex-runs/W13-104/evidence/`.

External effects:

- Production runtime deployments were performed for web and worker after the
  fresh backup proof passed.
- No production database writes, CRM import applies, external emails, Telegram
  messages, WhatsApp messages, Zoom/Vimeo/OpenAI provider mutations, Stripe
  sessions, Buffer publications, DNS changes, or source-of-truth changes were
  performed.
- The production worker was sampled after deploy and reported zero claimed,
  delivered, sink-delivered, retried, or dead-lettered jobs.

Lane blockers:

- `EMAIL-INPUTS.private.json` is missing, blocking email/send work only.
- `CRM-IMPORT-AUTHORIZATION.private.json` is missing, blocking CRM import apply
  work only.
- `CANARY-AUTHORIZATION.private.json` is missing, blocking provider canaries
  only for providers without authorization/configuration.
- `OPERATIONS_PROBE_TOKEN` was unavailable through the production runtime, so
  protected internal diagnostics were not called.

Known caveats:

- Staging rollback and roll-forward rehearsal was not rerun after the W13-104
  staging deploy.
- Production synthetic signup submit was not run to avoid creating unnecessary
  production lead/outbox data while email/provider authorization manifests are
  absent.
- Production admin/parent/student private-link browser acceptance was not rerun
  because the protected W13-103 setup/reset links are consumable; the W13-103
  acceptance baseline remains recorded, and W13-104 changed public font loading
  plus a test fixture.
