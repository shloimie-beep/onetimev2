# OPS-04 Resume

## Status

`waiting_for_source_export`

Independent OPS-04 tooling and tests are complete on branch `codex/ops-04-legacy-audience-migration` in `C:/Users/User/.ops04-worktrees/OPS-04`.

## Completed

- Validated and extracted packet `OPS-04-20260716-fd38cbd7`.
- Resolved base to `origin/codex/ot85-whatsapp-lead-assistant` at `fb6b3266e2bb2689fdfc1f751764fd98ecca8f0a`.
- Added `2100_ops04_legacy_audience_migration.sql`.
- Added OPS-04 contracts, domain dry-run engine, PostgreSQL rehearsal repository, and CLI tooling.
- Added deterministic synthetic fixture, dry-run report, apply receipt, replay/verify/rollback evidence.
- Patched public signup freshness/ownership behavior.
- Verified unit, integration, typecheck, CLI rehearsal, and evidence secret/PII scan.

## Resume Conditions

Before any real row read or non-synthetic apply:

1. Provide the final source export and schema/mapping contract.
2. Provide exact row-access authorization and `OPS04_FINGERPRINT_HMAC_KEY`.
3. Provide non-production/staging database marker and fingerprint.
4. Keep production import authorization and campaign send authorization separate.
5. Run `npx tsx scripts/ops04.ts dry-run --request=PATH --out=PATH` first and review aggregate-only output.

No production contacts were imported and no campaign sends were queued.
