# OT-73 Integration Manifest

## Branch

- Repository: `webcraft-media/onetimev2`
- Branch: `codex/ot73-landing-intent-reconciliation`
- Base SHA: `dfef7de2035e08f1ee72e0133ccf656fe7a74444`
- PR base: `codex/ot60r-recovery-convergence`

## Owned Files

- `packages/domain/src/landing/content.ts`
- `packages/domain/src/landing/campaign.ts`
- `scripts/build-public-pages.ts`
- `apps/web/src/client/public/public-entry.ts`
- `apps/web/src/client/public/styles.css`
- `tests/unit/lead-validation.test.ts`
- `tests/e2e/landing-signup.spec.ts`
- `apps/web/public/assets/fonts/dm-serif-display-latin.woff2`
- `apps/web/public/assets/fonts/dm-serif-display-OFL.txt`
- `ops/execution/ot-73/**`
- `ops/evidence/ot-73/**`
- `ops/execution/registry.json`

## Prohibitions Preserved

- No deployment.
- No production or provider mutation.
- No DNS mutation.
- No sends, payments, or real user creation.
- No BNA repository modification.
- No authenticated AppShell, server composition, auth, CRM, portals, provider code, migrations, shared barrel, or root package edit.
