# OT-104R Decisions

- Used an isolated worktree at
  `C:\Users\User\.batch-20260716-worktrees\OT-104R` from exact base
  `fb5f5eebc539afc9e93833e9417ee67524d62c36`.
- Implemented OT-104R as a narrow provider runtime under
  `packages/domain/src/content/vimeo-private-runtime.ts` with a matching
  contract file under `packages/contracts/src/content/vimeo-runtime.ts`.
- Added new OT-104R tables instead of reshaping shared app/router/UI surfaces:
  `ot104r_vimeo_sources`, `ot104r_vimeo_webhook_receipts`,
  `ot104r_vimeo_text_tracks`, and `ot104r_vimeo_audit_events`.
- Kept real Vimeo mode off by default. Missing Vimeo env vars block only the
  read-only canary.
- Added `createOt104rSinkVimeoAdapter` so provider-off tests cover complete
  registration, reconciliation, webhook, transcript, and projection behavior.
- Added a real adapter factory and canary entry point, but did not perform any
  upload, delete, publish, production deployment, DNS change, broad send, live
  charge, BNA mutation, Academy mutation, or unrelated provider mutation.
- Updated the migration-order integration assertion because OT-104R adds
  migration `2010_ot104r_vimeo_private_runtime`.
- Did not add app routes in this lane. The runtime exposes
  `projectOt104rPlaybackAccess` so the later Content workspace can mount a
  server-authorized playback/status route without provider credential leakage.
