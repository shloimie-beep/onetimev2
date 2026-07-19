# RABBI-DAY-ONE-CRM

Status: CRM-first slice implemented locally with corrected real-source dry run and transactional lifecycle email mode.

Branch: `codex/one-time-finish-now-20260719`  
PR: `https://github.com/webcraft-media/onetimev2/pull/92`  
Base head at pivot: `92fd518ca66680543b80592b724d4fc492e544b6`

## Delivered

- Corrected W12-100 CRM dry-run model so valid owned contacts can be stored in private CRM even when email/WhatsApp marketing consent is unknown.
- Split CRM storage counts from channel-send eligibility counts.
- Narrowed communications-export quarantine to actual message-body/call-log exports, not ordinary audience metadata.
- Added explicit lifecycle email mode: `disabled`, `canary`, `transactional`.
- Transactional lifecycle email now fails closed unless production runtime, authorization id, Resend key, approved sender, reply-to, webhook secret, lifecycle encryption key, and positive budgets are configured.
- Verified signup-to-CRM and WhatsApp lead-capture tests for the first slice.

## Corrected CRM Counts

Source packet: `C:/Users/User/.onetime-w13-104-private/crm-approved-source-packet`  
Report: `ops/codex-runs/RABBI-DAY-ONE-CRM/crm-corrected-dry-run.json`  
SHA-256: `2ef42a24d05f13a907405a7b4ae9fc5690885e471607c18004327a9a7ac73508`

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

## Blockers

- Real CRM production apply: current W12-100 apply path is dry-run-only; add/review production CRM writer and fresh backup/rollback proof before writing contacts.
- Production transactional email: configure production lifecycle email variables and run controlled operator-inbox send.
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

Known non-blocking check: `npm run format` fails on 1205 unrelated pre-existing files; targeted changed-file Prettier check passed.

External effects: none.
