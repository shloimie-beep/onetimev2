# OT-76 Resume

Current branch: `codex/ot76-day-one-certification-harness`

Run audit mode:

```bash
node scripts/day-one-certification-harness.mjs audit
```

Run strict certification mode after OT-80 provides an integrated release
manifest:

```bash
node scripts/day-one-certification-harness.mjs certify --manifest ops/day-one/<ot80-release-manifest>.json
```

OT-80 wiring instructions:

1. Copy `ops/day-one/release-manifest.example.json`.
2. Replace capability statuses with integrated release evidence.
3. Attach route/action/capability registry paths for the integrated build.
4. Attach fresh test output paths for browser, accessibility, performance,
   security/leakage, migration/readiness, worker, and rollback evidence.
5. Run `audit` first to inspect gaps.
6. Run `certify` only when all 13 Day-One gates are expected to pass.

Do not run deployment, provider, production database, payment/access, DNS, or
Railway actions from OT-76.
