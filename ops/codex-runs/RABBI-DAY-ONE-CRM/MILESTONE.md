# RABBI-DAY-ONE-CRM

Status: real One Time CRM import delivered to production; production signup proof delivered; campaign seed approval packet ready; WhatsApp and external sends remain gated; GitHub Actions blocked by account billing/spending limit.

Branch: `codex/one-time-finish-now-20260719`  
PR: `https://github.com/webcraft-media/onetimev2/pull/92`  
CRM production evidence commit:
`25c271576be675c36261465e51d4f176a923b007`

## Delivered

- Corrected CRM dry-run/import model separates private CRM storage from channel-specific campaign consent.
- Fresh protected PostgreSQL 18 backup/restore proof passed through Railway deployment `4e58755e-1991-4ce5-b05f-0a5e8b4f25e7`.
- Production migration `2204_w12_100_real_source_crm_apply` applied after the fresh backup.
- CRM apply readiness is `ready`; production apply status is `applied`.
- Imported 1,555 new contacts and skipped 4 existing contacts from 1,559 CRM-importable identities.
- Recorded 2,505 import-row ledger rows, 4,594 provenance/contact-fact rows, and replayed the same idempotency key with no new writes.
- Campaign-safe counts: 1,357 email eligible, 0 WhatsApp eligible, 152 suppressed, 98 duplicate, 37 identity conflict, 811 invalid.
- Submitted one protected operator-owned production signup; replay was idempotent, with one canonical contact, one signup, two sink outbox intents, and zero WhatsApp rows.
- Generated a no-send campaign seed approval packet with exact proposed copy,
  snapshot hash `6e215ab2d0493f3e4175ca1bfb24d07099293f8da63e02d793e5ba4250246bd5`,
  required operator approval statement, and zero production side effects.

## Remaining Gates

- `ONE_TIME_TRANSACTIONAL_EMAIL`: production is deployed/configured and staging delivered, but no fresh production final admin/access send was run in this CRM import slice.
- `RABBI_ADMIN_ACCESS`: prior W13-103 admin acceptance exists; no setup/reset link was consumed for a fresh CRM UI smoke here.
- `WHATSAPP_LEAD_CAPTURE`: provider remains off until Meta WhatsApp production webhook secrets and verify token are configured and canaried.
- `CAMPAIGN_SEED`: ready for operator approval; exact proposed seed copy and required approval statement are recorded in `CAMPAIGN-SEED-APPROVAL.md`, but no seed send is authorized yet.
- `BROAD_CAMPAIGN`: not sent.
- `GITHUB_ACTIONS`: blocked before runner execution by GitHub account billing/spending-limit status; no job steps ran.

## Evidence

- CRM corrected dry run: `ops/codex-runs/RABBI-DAY-ONE-CRM/crm-corrected-dry-run.json`
- CRM apply readiness: `ops/codex-runs/RABBI-DAY-ONE-CRM/crm-apply-readiness-preflight.json`
- CRM production apply: `ops/codex-runs/RABBI-DAY-ONE-CRM/crm-production-apply.json`
- CRM replay proof: `ops/codex-runs/RABBI-DAY-ONE-CRM/crm-production-apply-replay.json`
- CRM reconciliation: `ops/codex-runs/RABBI-DAY-ONE-CRM/crm-production-reconcile.json`
- Production signup proof: `ops/codex-runs/RABBI-DAY-ONE-CRM/production-signup-proof.json`
- Campaign seed approval packet: `ops/codex-runs/RABBI-DAY-ONE-CRM/campaign-seed-approval-packet.json`
- Campaign seed approval Markdown: `ops/codex-runs/RABBI-DAY-ONE-CRM/CAMPAIGN-SEED-APPROVAL.md`
- Transactional email release proof: `ops/codex-runs/RABBI-DAY-ONE-CRM/transactional-email-release.json`
- GitHub Actions billing blocker: `ops/codex-runs/RABBI-DAY-ONE-CRM/github-actions-billing-blocker.json`
- GitHub Actions billing blocker Markdown: `ops/codex-runs/RABBI-DAY-ONE-CRM/GITHUB-ACTIONS-BILLING-BLOCKER.md`

External effects this slice: one Railway backup-proof deployment, one production DB migration, one production CRM import apply, one production signup submit, zero production external email sends from signup, zero WhatsApp sends, zero provider mutations, zero broad campaign sends.

GitHub Actions on PR #92 head
`f46375cdbfea26700e6d6a181745b2c35705412b` completed as failure for all five
jobs before runner steps started. The Checks API annotations classify the cause
as account billing/spending-limit failure, so there is no repo code fix to apply
until GitHub Billing & plans is fixed and the checks are rerun. Local validation
and production smokes previously passed.
