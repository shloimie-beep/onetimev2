# OPS-04 Test Results

## 2026-07-16 Packet And Base Preflight

- PASS: Highest browser-numbered packet selected from Downloads: `OPS-04-CODEX-PACKET (2).zip`.
- PASS: Packet manifest task ID `OPS-04`, packet ID `OPS-04-20260716-fd38cbd7`, packet version `1`, target repository `webcraft-media/onetimev2`.
- PASS: Archive entry path validation found no absolute, drive-rooted, null-byte, or parent-traversal paths.
- PASS: Checksum manifest `CHECKSUMS.sha256` verified every listed file.
- PASS: High-confidence secret scan found no OpenAI, Stripe, GitHub, Slack, AWS, private-key, or JWT token pattern.
- PASS: Base resolution selected `fb6b3266e2bb2689fdfc1f751764fd98ecca8f0a`; OT-80 convergence and OT-74 legacy-audience foundation are ancestors.

## 2026-07-16 Source-Independent OPS-04 Verification

- PASS: `npm run unit -- tests/unit/ops04-reconciliation.test.ts`
  - 4 tests passed for deterministic dry-run hashing, source manifest binding, HMAC-only reporting, ambiguous local phone quarantine, dedupe, conflict quarantine, independent facts, suppression precedence, current-subscriber read-only handling, and no-send channel snapshots.
- PASS: `npm run integration -- tests/integration/ops04-repository.test.ts`
  - 2 tests passed for migration `2100_ops04_legacy_audience_migration`, dry-run recording, idempotent replay, synthetic apply, verify, rollback, conflict rejection, zero contacts, zero `outbox_events`, and zero `whatsapp_outbox_messages`.
- PASS: `npm run integration -- tests/integration/lead-capture.test.ts`
  - 8 tests passed, including the new CRM-owned public signup freshness/ownership guard.
- PASS: `npm run typecheck`
  - TypeScript completed with no errors.
- PASS: `npx prettier --check ...`
  - All matched touched files use Prettier code style.
- PASS: `npm run secret:scan`
  - Secret scan passed across repo text files.
- PASS: `npx tsx scripts/ops04.ts rehearse --out-dir=ops/evidence/OPS-04/synthetic`
  - Synthetic dry-run, apply, replay, verify, rollback, and totals evidence written.
  - No-send diff was zero for `outbox_events`, `whatsapp_outbox_messages`, delivery-provider events, account invitations, access grants, and payment records.
- PASS: `npx tsx scripts/ops04.ts scan-evidence --report=ops/evidence/OPS-04/synthetic/dry-run-report.json`
  - Report scan found `0` raw email matches and `0` E.164 phone matches.
