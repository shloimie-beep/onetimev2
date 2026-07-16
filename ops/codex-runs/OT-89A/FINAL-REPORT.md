# OT-89A Final Report

Status: `READY_FOR_OT99`

## Implemented

- Subscriber-only `/app/support` route with no-store/noindex headers and an accessible support form.
- Anonymous and non-subscriber fallback showing only the public `/signup` lead path.
- Server-side active-entitlement recheck inside the support submission transaction.
- Durable local receipt, support audit rows, private attachment storage seam, support outbox, delivery attempts, retry/dead-letter/requeue flow, and cached status projection.
- Exact immutable v1 event schema validation and OT-89 HMAC signing/verification.
- Asynchronous worker delivery that uses stored raw event bytes and never runs during subscriber submission.
- Deterministic mock BNA event/status endpoints and reverse-HMAC private attachment endpoint.
- Focused tests for authorization, outage/retry/reconciliation, duplicate/collision, attachment security, privacy redaction, same-account receipt reads, and status projection.

## Safety

- Real BNA delivery remains disabled/fail-closed outside `mock`.
- No production deployment, provider call, Telegram/WhatsApp/email send, production database write, DNS change, payment mutation, or real-user mutation was performed.
- The frozen contract file remains byte-for-byte unchanged with SHA-256 `cfcd0ac55cbf9e59d7fefc7779af1aa5112fb410ee510882cb843492a556e512`.

## Evidence

- Migration manifest: `ops/codex-runs/OT-89A/MIGRATION-MANIFEST.md`.
- Test results: `ops/codex-runs/OT-89A/TEST-RESULTS.md`.
- Deployment/canary state: `ops/codex-runs/OT-89A/DEPLOYMENT-CANARY.md`.
- External mutations: `ops/codex-runs/OT-89A/EXTERNAL-MUTATIONS.md`.

## Local Verification

- `npm run secret:scan`: pass.
- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `npm run build`: pass.
- `npm run brand:check`: pass after build.
- `npm run test`: pass; 19 files, 94 tests.
- `CI=1 npm run e2e`: pass; 22 tests.
- `CI=1 npm run accessibility`: pass; 6 tests.
- `CI=1 npm run performance`: pass; 6 tests plus bundle check.
- OT-89A-touched files passed targeted Prettier checks.
- Repo-wide `npm run format` remains a local Windows checkout caveat on 377 pre-existing files; no OT-89A-touched file remains unformatted.

## PR And CI

- Branch: `codex/ot89a-subscriber-support-producer`
- Draft PR: #36, `https://github.com/webcraft-media/onetimev2/pull/36`
- Pushed implementation commit: `d2fa568ff0b486ebcb0dda91d50ed04fc6d76c52`
- Pushed CI-format follow-up commit: `ef52728f8b4cca24bb4ce63f4f235cffe7b641ff`
- Checks observed green before final closeout documentation commit:
  - `Node 24 verify`
  - `PostgreSQL 16 assurance harness`
  - `PostgreSQL 16 learner-seat proof`

Final closeout documentation is committed separately and must remain green before handoff.
