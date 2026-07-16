# OT-89A Final Report

Status: `in_progress`

READY_FOR_OT99 is withheld until the repaired branch head is pushed and the new remote head is green.

## Implemented

- Subscriber-only `/app/support` route remains no-store/noindex and accessible.
- Anonymous and non-subscriber support views remain lead-only and never expose a ticket form.
- Support page and API now fail closed behind `OT89_SUPPORT_ENABLED`; disabled/unconfigured support returns a non-black-hole unavailable state.
- Production config now defaults support off when unconfigured, forbids `OT89_MOCK_BNA_ENABLED`, and rejects known local/test HMAC IDs and secrets.
- Attachment normalization now uses `sharp` to decode and re-encode supported images, strips metadata, bounds decoded pixels/dimensions, and rejects malformed, trailing-byte/polyglot, decompression-bomb, MIME mismatch, and decoded-size violations.
- Base64 JSON transport now allows the documented 10 MiB decoded aggregate while preserving strict decoded per-file and aggregate enforcement.
- Client submission failures now restore controls and announce/focus accessible status for server, network, and file-read failures.
- Focused unit, integration, e2e, and axe coverage was added for the four readiness defects.
- Playwright config now supports an optional `PORT` override for isolated local CI-mode browser runs while defaulting to 3100.

## Safety

- Live BNA delivery remains a later launch gate.
- No deployment, provider call, Telegram/WhatsApp/email send, production database write, DNS change, payment mutation, or real-user mutation was performed.
- The frozen contract file remains byte-for-byte unchanged with SHA-256 `cfcd0ac55cbf9e59d7fefc7779af1aa5112fb410ee510882cb843492a556e512`.

## Local Verification

- `npm run secret:scan`: pass.
- Scoped `npx prettier --check` on OT-89A touched files: pass.
- `npm run brand:check`: pass.
- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `npm run unit`: pass; 24 files, 140 tests.
- `npm run integration`: pass; 19 files, 97 tests.
- `npm run build`: pass.
- `CI=1 PORT=3101 npm run e2e`: pass; 27 tests.
- `CI=1 PORT=3102 npm run accessibility`: pass; 7 tests.
- `CI=1 PORT=3103 npm run performance`: pass; 6 tests plus bundle check.
- `git diff --check`: pass.

## Local Caveats

- `npm run verify` stops at repo-wide `npm run format` on this Windows checkout because Prettier reports 369 pre-existing CRLF-affected files. OT-89A touched files passed targeted Prettier checks.
- `npm run db:verify`: blocked locally; `DATABASE_URL is required for PostgreSQL-backed runtime`.
- OT-37 PostgreSQL assurance command: blocked locally; `connect ECONNREFUSED 127.0.0.1:5432`.
- OT-83 PostgreSQL concurrency command: blocked locally; `connect ECONNREFUSED 127.0.0.1:5432`.
- Local PostgreSQL/Docker/client tooling is absent, so GitHub's service-backed PostgreSQL checks are the authoritative DB verification for this pass.

## PR And CI

- Branch: `codex/ot89a-subscriber-support-producer`
- Existing draft PR: #36, `https://github.com/webcraft-media/onetimev2/pull/36`
- Audited remote head: `50b3a9c6790ee4befd457e16c4ac01674dc264ae`
- New repair commit: pending.
- New remote checks: pending.
