# OT-LIVE-001.03 source candidate

## Authority and source

- Controller assignment: `OT-LIVE-001.03`
- Durable source claim: `b6b2a7f9-3635-4df4-b8f8-fbe4bd83b923`
- Writer: `codex-ot-live-001-03-product-repair-b6b2a7f9`
- Branch: `codex/ot-live-001-product-repair-20260804`
- Exact source base: `ffd1c55a50c5b16402f3dcbcbef4cb4464edcfb4`
- Assigned control checkpoint: `86106a67286ab0fbac781b879053d8be258c0d20`
- Deployment/canary authority: not issued; all provider mutations remained fenced.

## Implemented repair

- Replaced the landing hero with the approved eyebrow, headline, one truthful hero CTA, and the unchanged authentic Rabbi Scheller source photograph.
- Added the concise moving launch ribbon, a static reduced-motion treatment, the exact Downloads overview image, and three sanitized screenshots captured from working local Parent/Student routes.
- Removed the five retired landing sections and their anchors/copy.
- Mounted `/select-role`, made `RT-ADM-001` (`/app/dashboard`) a ready Admin route, added explicit Admin/Parent switching, and preserved one-session rotation and post-switch authorization.
- Added an idempotent, fail-closed migration that only adds the missing Parent membership to the existing normalized `sdratler@gmail.com` adult account when its Admin membership, credential, and sole active household are already present. It creates no identity, credential, household, or password reset.
- Converged public launch timing to August 16, 2026 at 7:00 PM and free-access expiry to September 11, 2026 at 6:00 PM, Asia/Jerusalem.

## Verification

- `npm run build`: pass, including typecheck.
- `npm run lint`: pass.
- `npm run secret:scan`: pass across 3,222 repository text files.
- Candidate-only Prettier check: pass.
- Focused Vitest matrix: 65 passed, 4 skipped across 9 files.
- Landing Playwright matrix: 10 passed, covering desktop/mobile/tablet overflow, accessibility, no-JavaScript behavior, ribbon boundary/motion, reduced motion, removed sections, assets, Member Login link, and CTA behavior.
- Focused public brand browser matrix: 2 passed (four viewports plus reduced motion).
- In-app browser measurements: no horizontal overflow at 360x800, 390x844, 768x1024, or 1440x1000; ticker transform changed while ordinary motion was enabled; reduced-motion animation was `none`; all three flow screenshots rendered at 379x213 from 1265x712 source images.
- Dual-role integration journey: `/select-role` 200; Admin dashboard 200; switch to Parent; Parent overview and Student management 200; Admin dashboard 403 in Parent context; switch back to Admin; dashboard 200.
- Migration proof: applying migration 2260 twice retained exactly one identity, account, credential, household, Admin membership, and Parent membership, with the existing password hash, credential version, and security version unchanged.

## Read-only domain inventory

Observed 2026-08-04 with DNS and anonymous HTTPS reads only:

- New application: `https://app.onetimeonetime.com`; CNAME `3vp17vx5.up.railway.app`; Railway (`server: railway-hikari`); `/`, `/health`, `/ready`, `/version`, and `/login` returned 200.
- Preserved documented transition/legacy endpoint: `https://join.onetimeonetime.com`; CNAME `awaz36ln.up.railway.app`; Railway (`server: railway-hikari`); `/`, `/health`, `/ready`, and `/version` returned 200; `/login` returned 302 to `https://app.onetimeonetime.com/login`.
- The repository documents no separate current legacy-authenticated URL beyond the preserved Join transition endpoint. No DNS, domain, redirect, or hosting setting was changed, and no `app.join...` hostname was created.

## Known inherited gates

- Repository-wide `brand:check` already fails on route-brand manifest drift (36 required routes) and one raw-color finding in `scripts/ops/validate-ot-launch-governance.ts`; this candidate adds no new finding to that output.
- Repository-wide Prettier reports 2,725 pre-existing files; every candidate text file passes a scoped Prettier check.

## Freeze

No Railway deployment, migration application, production identity write, DNS change, provider action, or signed-in production canary was performed. The next action requires fresh C00 deployment/migration/canary authority for the exact source checkpoint produced from this candidate.
