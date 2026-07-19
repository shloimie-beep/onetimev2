# RABBI-DAY-ONE-CRM

Status: real One Time CRM import delivered to production; production signup proof delivered; WhatsApp and campaign seed remain gated.

Branch: `codex/one-time-finish-now-20260719`  
PR: `https://github.com/webcraft-media/onetimev2/pull/92`  
Current pushed head before this evidence commit: `e73b9d5edf38a300faf6c1ddb4929b913137031c`

## Delivered

- Corrected CRM dry-run/import model separates private CRM storage from channel-specific campaign consent.
- Fresh protected PostgreSQL 18 backup/restore proof passed through Railway deployment `4e58755e-1991-4ce5-b05f-0a5e8b4f25e7`.
- Production migration `2204_w12_100_real_source_crm_apply` applied after the fresh backup.
- CRM apply readiness is `ready`; production apply status is `applied`.
- Imported 1,555 new contacts and skipped 4 existing contacts from 1,559 CRM-importable identities.
- Recorded 2,505 import-row ledger rows, 4,594 provenance/contact-fact rows, and replayed the same idempotency key with no new writes.
- Campaign-safe counts: 1,357 email eligible, 0 WhatsApp eligible, 152 suppressed, 98 duplicate, 37 identity conflict, 811 invalid.
- Submitted one protected operator-owned production signup; replay was idempotent, with one canonical contact, one signup, two sink outbox intents, and zero WhatsApp rows.

## Remaining Gates

- `ONE_TIME_TRANSACTIONAL_EMAIL`: production is deployed/configured and staging delivered, but no fresh production final admin/access send was run in this CRM import slice.
- `RABBI_ADMIN_ACCESS`: prior W13-103 admin acceptance exists; no setup/reset link was consumed for a fresh CRM UI smoke here.
- `WHATSAPP_LEAD_CAPTURE`: provider remains off until Meta WhatsApp production webhook secrets and verify token are configured and canaried.
- `CAMPAIGN_SEED`: ready for operator approval, but one exact current campaign copy and seed-send approval were not identified here.
- `BROAD_CAMPAIGN`: not sent.

## Evidence

- CRM corrected dry run: `ops/codex-runs/RABBI-DAY-ONE-CRM/crm-corrected-dry-run.json`
- CRM apply readiness: `ops/codex-runs/RABBI-DAY-ONE-CRM/crm-apply-readiness-preflight.json`
- CRM production apply: `ops/codex-runs/RABBI-DAY-ONE-CRM/crm-production-apply.json`
- CRM replay proof: `ops/codex-runs/RABBI-DAY-ONE-CRM/crm-production-apply-replay.json`
- CRM reconciliation: `ops/codex-runs/RABBI-DAY-ONE-CRM/crm-production-reconcile.json`
- Production signup proof: `ops/codex-runs/RABBI-DAY-ONE-CRM/production-signup-proof.json`
- Transactional email release proof: `ops/codex-runs/RABBI-DAY-ONE-CRM/transactional-email-release.json`

External effects this slice: one Railway backup-proof deployment, one production DB migration, one production CRM import apply, one production signup submit, zero production external email sends from signup, zero WhatsApp sends, zero provider mutations, zero broad campaign sends.
