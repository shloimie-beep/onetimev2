# OPS-11 Backup And Restore

Status: `passed`

Native production backup/restore proof was completed before production
promotion.

## Native Production Backup

- Runner: one-shot Railway service `ops11-pg18-proof-20260717`
- Service ID: `52db1072-b4eb-450c-bec7-5151cb9a8461`
- Successful deployment:
  `7b338893-641c-4c14-af99-2f9b2cc61125`
- Runner image digest:
  `sha256:4afa0888030043e3e7f5b3ebca4bf5efcc5980b54eebfa11423fd195608aef5b`
- Backup volume: `ops11-pg18-proof-20260717-volume`
- Volume ID: `c1792e77-efa5-4c15-bc51-ef40acb79e99`
- Private path:
  `/backup/ops11-prod-pg18-20260717T000000Z/production-pg18.dump`
- Generated: `2026-07-17T07:58:51Z`
- Format: PostgreSQL custom archive
- Flags: no owner, no ACL
- Size: `2515557` bytes
- SHA-256:
  `6f35f3a116e3b095ad8244f1d6d6cbc2668292f2adb4741753ce24e4ba750698`
- Archive entries: `3764`

## Restore Proof

- Restore target: disposable local PG18 database inside the one-shot runner
- Restored database name: `ops11_restore`
- Restore verdict: passed
- Hard failures: none
- Source/restored schema counts matched at proof time.
- Migration command was idempotent on the restored clone.
- No provider sends, Railway public domain changes, or production mutations were
  performed by the backup runner.

## Notes

The backup artifact was intentionally not downloaded into the repository.
Railway volume file download was unavailable without a local Railway SSH key, so
evidence records only the private path, checksum, size, versions, and sanitized
restore verdict.
