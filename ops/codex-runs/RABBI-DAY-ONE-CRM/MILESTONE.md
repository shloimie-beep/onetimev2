# RABBI-DAY-ONE-CRM

Status: CRM-first slice is deployed to staging and production at `ed77a04`; staging transactional lifecycle email is provider-delivered. Production transactional email is configured and smoked, but the production controlled send/admin access is blocked by missing bootstrap identity.

Branch: `codex/one-time-finish-now-20260719`  
PR: `https://github.com/webcraft-media/onetimev2/pull/92`  
Current head: `ed77a04dd24391d5b79be7f839d7f5752a57e0f9`

## Delivered

- Corrected W12-100 CRM dry-run/import logic and added guarded production apply writer.
- Recorded CRM import approval inputs; refreshed readiness now removes the database URL blocker.
- Added/verified transactional lifecycle and admin email challenge delivery gates with generic campaign/provider modes still sink/off.
- Set protected One Time Resend variables on staging web/worker and production web/worker.
- Deployed staging web `0bf927dd-bab7-407b-afd2-35983d8c7351` and worker `385e3b5b-41f4-417d-996b-09e3b1a1f8e3`; staging `/version`, `/health`, and `/ready` passed.
- Sent one controlled staging account-lifecycle transactional email to the protected operator inbox. Outbox state became `provider_delivered`, attempts=1, raw token omitted, and Resend API readback reported `delivered`.
- Deployed production clean web `a3a9328c-3fb5-41c6-b8d4-cf402f400ca7` and worker `37ce9edf-d7aa-40fc-a013-87dde0f29e72`; production `/version`, `/health`, and `/ready` passed at `rabbi-day-one-crm-ed77a04`.

## Current Blockers

- Real CRM production apply: blocked by `BLOCKED_BACKUP_PROOF_NOT_PROVIDED`, `BLOCKED_CREATED_BY_USER_KEY_NOT_PROVIDED`, and `BLOCKED_PRODUCTION_CONFIRMATION_NOT_PROVIDED`.
- Production controlled transactional email/Admin access: blocked because production has zero active owner/admin users; issuing a product-native admin invitation requires fresh bootstrap/role-access authorization.
- WhatsApp production lead capture: provider remains off until Meta WhatsApp production webhook secrets and verify token are configured and canaried.
- Campaign seed: waiting on CRM production apply and production admin access/test-send proof. No broad campaign was sent.

## Evidence

- Transactional email release proof: `ops/codex-runs/RABBI-DAY-ONE-CRM/transactional-email-release.json`
- CRM corrected dry run: `ops/codex-runs/RABBI-DAY-ONE-CRM/crm-corrected-dry-run.json`
- CRM apply readiness: `ops/codex-runs/RABBI-DAY-ONE-CRM/crm-apply-readiness-preflight.json`
- Email inputs preflight: `ops/codex-runs/RABBI-DAY-ONE-CRM/email-inputs-preflight.json`

## Tests And Smokes

- `npm ci`
- `npm run director:truth:live`
- `npm run secret:scan`
- `npm run brand:check`
- `npm run lint`
- `npm run typecheck`
- `npm run unit`
- `npm run integration`
- `npm run build`
- `npm run e2e`
- `npm run accessibility`
- `npm run performance`
- Staging and production `/version`, `/health`, `/ready` smokes

Known non-blocking check: `npm run format` still fails on unrelated pre-existing repo-wide formatting debt.

External effects this slice: staging DB write for one lifecycle invitation/test, one staging email send, 64 Railway variable writes, 5 Railway deployments created including one superseded production web hygiene deploy. Production DB writes: 0. Production email sends: 0. Broad campaign sends: 0.
