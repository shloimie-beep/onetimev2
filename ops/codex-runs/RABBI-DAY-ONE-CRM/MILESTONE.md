# RABBI-DAY-ONE-CRM

Status: CRM-first slice implemented locally with corrected real-source dry run, guarded CRM apply writer, and transactional lifecycle email mode.

Branch: `codex/one-time-finish-now-20260719`  
PR: `https://github.com/webcraft-media/onetimev2/pull/92`  
Base head at pivot: `92fd518ca66680543b80592b724d4fc492e544b6`

## Delivered

- Corrected W12-100 CRM dry-run model so valid owned contacts can be stored in private CRM even when email/WhatsApp marketing consent is unknown.
- Split CRM storage counts from channel-send eligibility counts.
- Narrowed communications-export quarantine to actual message-body/call-log exports, not ordinary audience metadata.
- Added explicit lifecycle email mode: `disabled`, `canary`, `transactional`.
- Transactional lifecycle email now fails closed unless production runtime, authorization id, Resend key, approved sender, reply-to, webhook secret, lifecycle encryption key, and positive budgets are configured.
- Added guarded W12-100 real-source CRM apply writer and migration. It inserts CRM contacts/facts plus hashed import ledger/audit rows only after exact source hash validation, backup proof, idempotency key, created-by user key, exact authorization, and production confirmation when targeting production.
- Updated the `--apply` CLI path from not implemented to protected apply/block mode. Missing guarded inputs now return a count-safe blocked apply report with no DB writes.
- Added sanitized Resend/email inputs preflight. It verifies protected keyholder files, approved domain, sender, reply-to, and private manifest readiness without printing raw values or writing secrets to the repo.
- Recorded same-window CRM production-apply authorization in protected local inputs. The readiness gate now accepts operator authorization, private manifest production approval, idempotency, and manual-review exclusion/handling.
- Generated the protected transactional email private manifest using the protected operator-owned inbox file. No email was sent.
- Fixed the delivery cron launch gate so fixed lifecycle transactional Resend mail can run in production sink-worker mode while generic provider/campaign sends remain disabled.
- Fixed the admin email challenge delivery gate so production transactional admin login email can use the same guarded Resend path without requiring the canary-only recipient variable.
- Verified signup-to-CRM and WhatsApp lead-capture tests for the first slice.

## Corrected CRM Counts

Source packet: `C:/Users/User/.onetime-w13-104-private/crm-approved-source-packet`  
Report: `ops/codex-runs/RABBI-DAY-ONE-CRM/crm-corrected-dry-run.json`  
SHA-256: `93be5a0837d3d90f8995e873c2ea302987f45e0e52de79f08170f01a6223f1d8`

| Field                      | Count |
| -------------------------- | ----: |
| total_rows                 |  2505 |
| unique_identity_count      |  1596 |
| crm_importable             |  1559 |
| email_campaign_eligible    |  1357 |
| whatsapp_campaign_eligible |     0 |
| suppressed                 |   152 |
| invalid                    |   811 |
| duplicate                  |    98 |
| identity_conflict          |    37 |
| quarantined                |     0 |
| manual_review_rows         |   848 |

## Email Inputs Preflight

Report: `ops/codex-runs/RABBI-DAY-ONE-CRM/email-inputs-preflight.json`

| Field                         | Status |
| ----------------------------- | ------ |
| keyholder_dir_available       | true   |
| resend_api_key_present        | true   |
| resend_webhook_secret_present | true   |
| approved_domain_matches       | true   |
| approved_sender_matches       | true   |
| approved_reply_to_matches     | true   |
| authorization_id_present      | true   |
| canary_destination_present    | true   |
| private_manifest_written      | true   |
| raw_values_included           | false  |
| secrets_printed               | false  |
| railway_variables_ready       | true   |

Protected manifest: `C:/Users/User/.onetime-w13-104-private/RABBI-DAY-ONE-EMAIL-INPUTS.private.json`

Email next action: deploy the worker/web candidate with exact staging/production Railway variables from the protected manifest, then run one controlled operator-inbox transactional test.

## CRM Apply Readiness

Report: `ops/codex-runs/RABBI-DAY-ONE-CRM/crm-apply-readiness-preflight.json`

Ready checks accepted:

- Source packet exists.
- Corrected dry-run report exists, is `done`, and SHA-256 matches
  `93be5a0837d3d90f8995e873c2ea302987f45e0e52de79f08170f01a6223f1d8`.
- Private CRM authorization manifest exists and is readable JSON.
- Private manifest production apply authorization, exact operator authorization, idempotency key, and manual-review exclusion/handling are present.
- Report includes no raw values, printed secrets, DB connection, DB read/write,
  external send, or provider mutation.

Production apply blockers:

- `BLOCKED_BACKUP_PROOF_NOT_PROVIDED`
- `BLOCKED_CREATED_BY_USER_KEY_NOT_PROVIDED`
- `BLOCKED_DATABASE_URL_NOT_CONFIGURED`
- `BLOCKED_PRODUCTION_CONFIRMATION_NOT_PROVIDED`

## Blockers

- Real CRM production apply: guarded writer is accepted locally, and readiness preflight confirms source packet, corrected dry-run proof, operator authorization, idempotency, and manual-review handling are present. Production remains blocked until fresh backup proof JSON, `DATABASE_URL`, created-by user key, and `RABBI-DAY-ONE-CRM-PRODUCTION-APPLY-OK` are present.
- Production transactional email: protected Resend/sender/reply-to/operator-inbox inputs are present and policy-matching, and a protected private manifest was generated. The worker launch gate and admin email challenge gate now permit lifecycle transactional email without opening generic provider/campaign sends or requiring a canary recipient. Deploy the exact candidate with staging/production Railway variables from the protected manifest and run one controlled operator-inbox send.
- Rabbi/Admin access send: wait for production transactional email proof, then send final administrator access message.
- WhatsApp production lead capture: configure Meta WhatsApp production webhook secrets and verify token, then run approved canary.
- Campaign seed: wait for CRM production apply and transactional email proof; no broad campaign sent.

## Tests

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run secret:scan`
- `git diff --check`
- Targeted Prettier check for changed parseable files passed.
- `npm run unit -- tests/unit/w12-100-data/real-source-preflight.test.ts`
- `npm run integration -- tests/integration/accounts/account-lifecycle.test.ts tests/integration/w12-100-data/real-source-preflight-cli.test.ts`
- `npm run integration -- tests/integration/lead-capture.test.ts tests/integration/whatsapp/ot85-assistant.test.ts tests/integration/whatsapp/ot85-webhook-route.test.ts`
- `npm run unit -- tests/unit/whatsapp/ot85-intent-contract.test.ts tests/unit/delivery/eligibility.test.ts tests/unit/w13-10/delivery-activation-policy.test.ts`
- `npx vitest run --config vitest.unit.config.ts tests/unit/w12-100-data/real-source-preflight.test.ts`
- `npx vitest run --config vitest.integration.config.ts tests/integration/w12-100-data/real-source-preflight-cli.test.ts tests/integration/w12-100-data/real-source-crm-apply.test.ts`
- `npm run unit`
- `npm run integration`
- `npm run typecheck`
- `npm run lint`
- `npm run secret:scan`
- `git diff --check`
- `npx prettier --check scripts/w12-100/data/real-source-preflight.ts tests/integration/w12-100-data/real-source-crm-apply.test.ts tests/integration/w12-100-data/real-source-preflight-cli.test.ts`
- `npx prettier --write scripts/w12-100/email/email-inputs-preflight.ts tests/unit/w12-100-data/email-inputs-preflight.test.ts`
- `npx prettier --check scripts/w12-100/email/email-inputs-preflight.ts tests/unit/w12-100-data/email-inputs-preflight.test.ts ops/codex-runs/RABBI-DAY-ONE-CRM/STATE.json ops/codex-runs/RABBI-DAY-ONE-CRM/MILESTONE.md ops/codex-runs/RABBI-DAY-ONE-CRM/email-inputs-preflight.json`
- `npx vitest run --config vitest.unit.config.ts tests/unit/w12-100-data/email-inputs-preflight.test.ts`
- `node --import tsx scripts/w12-100/email/email-inputs-preflight.ts --keyholder-dir=C:/Users/User/BNA-Keyholder --out=ops/codex-runs/RABBI-DAY-ONE-CRM/email-inputs-preflight.json`
- `node --import tsx scripts/w12-100/email/email-inputs-preflight.ts --keyholder-dir=C:/Users/User/BNA-Keyholder --canary-email-file=C:/Users/User/BNA-Keyholder/zoom-account-owner.txt --create-private-manifest --private-manifest-out=C:/Users/User/.onetime-w13-104-private/RABBI-DAY-ONE-EMAIL-INPUTS.private.json --out=ops/codex-runs/RABBI-DAY-ONE-CRM/email-inputs-preflight.json`
- `npx prettier --write scripts/w12-100/data/crm-apply-readiness-preflight.ts tests/unit/w12-100-data/crm-apply-readiness-preflight.test.ts`
- `npx vitest run --config vitest.unit.config.ts tests/unit/w12-100-data/crm-apply-readiness-preflight.test.ts`
- `node --import tsx scripts/w12-100/data/crm-apply-readiness-preflight.ts --out=ops/codex-runs/RABBI-DAY-ONE-CRM/crm-apply-readiness-preflight.json`
- `node --import tsx scripts/w12-100/data/crm-apply-readiness-preflight.ts --out=ops/codex-runs/RABBI-DAY-ONE-CRM/crm-apply-readiness-preflight.json`
- `npx vitest run --config vitest.unit.config.ts tests/unit/delivery/config.test.ts`
- `npx prettier --write packages/domain/src/auth/service.ts tests/integration/accounts/account-lifecycle.test.ts`
- `npx vitest run --config vitest.integration.config.ts tests/integration/accounts/account-lifecycle.test.ts`
- `npx vitest run --config vitest.unit.config.ts tests/unit/delivery/config.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run secret:scan`
- `git diff --check`

Known non-blocking check: `npm run format` fails on 1205 unrelated pre-existing files; targeted changed-file Prettier check passed.

External effects: none.
