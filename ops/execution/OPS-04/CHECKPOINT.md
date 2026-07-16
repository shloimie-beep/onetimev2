# OPS-04 Checkpoint

## Current State

- Validated and extracted packet `OPS-04-20260716-fd38cbd7`.
- Created isolated worktree `C:/Users/User/.ops04-worktrees/OPS-04`.
- Created branch `codex/ops-04-legacy-audience-migration`.
- Resolved base to `origin/codex/ot85-whatsapp-lead-assistant` at `fb6b3266e2bb2689fdfc1f751764fd98ecca8f0a`.
- Persisted required execution-state files before product code edits.
- Implemented OPS-04 additive migration, contracts, domain reconciliation engine, PostgreSQL rehearsal repository, and CLI tooling.
- Implemented deterministic synthetic dry-run reports with source-file manifest binding, HMAC row/contact provenance, dedupe, conflict quarantine, disposition totals, no-send channel snapshots, replay, verify, and rollback.
- Patched public lead capture so a public signup cannot overwrite CRM-owned canonical fields or silently queue WhatsApp to an unaccepted replacement phone.
- Published synthetic evidence under `ops/evidence/OPS-04/synthetic`.
- Final state is `waiting_for_source_export` because no real source export, row authorization, HMAC key, or staging database marker is available.

## Guardrails

- Do not import production contacts.
- Do not send migration campaigns or enqueue provider/outbox sends.
- Do not access real source rows without an exact `OPS04_ROW_ACCESS_AUTHORIZATION_PATH` receipt and `OPS04_FINGERPRINT_HMAC_KEY`.
- Do not apply to any database unless `ops04_nonproduction=true` is proven by marker and fingerprint.

## Verification

- `npm run unit -- tests/unit/ops04-reconciliation.test.ts` passed.
- `npm run integration -- tests/integration/ops04-repository.test.ts` passed.
- `npm run integration -- tests/integration/lead-capture.test.ts` passed.
- `npm run typecheck` passed.
- `npx tsx scripts/ops04.ts rehearse --out-dir=ops/evidence/OPS-04/synthetic` passed.
- `npx tsx scripts/ops04.ts scan-evidence --report=ops/evidence/OPS-04/synthetic/dry-run-report.json` passed.
