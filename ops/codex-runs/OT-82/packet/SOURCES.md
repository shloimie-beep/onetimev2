# OT-82 Sources and Provenance

## 1. Governing input

**Source file:** `PRO-01-BRAND-SYSTEM-FACTORY.md`  
**Packet interpretation:** The source requires a direct Codex execution packet, not implementation code. It fixes the target repository and branch names, the checkpoint behavior, the product outcome, proof requirements, ownership limits, stacked draft PR, and prohibition on deployment/provider mutation.

The governing source is copied outside this ZIP only as the user-provided specification. Its requirements are compiled into all six payload files in this packet.

## 2. Read-only repository observation

The packet compiler inspected GitHub read-only on **July 15, 2026**. No repository files, branches, pull requests, issues, workflows, deployments, or provider state were changed.

Repository observed:

- `webcraft-media/onetimev2`
- Canonical clone URL: `https://github.com/webcraft-media/onetimev2.git`
- Visibility observed: private
- Default branch observed: `main`
- Runtime stack observed in root `package.json`: Node 24, TypeScript, Express 5, Vite, React 19 for authenticated entries, static non-React public entry, Vitest, Playwright, and Zod.

### Dependency branch observation

A read-only branch search for `codex/ot81-dayone-certification-staging` and `ot81` returned no remote match at compile time.

This is not a permanent assertion. `CODEX-PROMPT.md` requires Codex to fetch and resolve the exact remote ref again at execution time. If it is still absent, Codex must use the checkpoint protocol and write `READY_WAITING_FOR_BASE`.

## 3. OT73 provenance

GitHub draft PR observed:

- PR: `https://github.com/webcraft-media/onetimev2/pull/19`
- Title: `OT-73 corrected landing addendum`
- Head branch: `codex/ot73-landing-intent-reconciliation`
- Head SHA observed: `ed2074254863468b4a70a0a3304490486ab2b71e`
- Base branch observed: `codex/ot60r-recovery-convergence`
- Base SHA observed: `dfef7de2035e08f1ee72e0133ccf656fe7a74444`
- Status observed: open draft

The PR description records:

- approved moving `JOIN NOW — FREE UNTIL ROSH HASHANAH` countdown ticker;
- removal of stale `$67`, monthly-price, trial, and `No card today` landing fragments;
- preservation of `Member Login` at `/login`;
- self-hosted DM Serif Display;
- landing, signup, accessibility, performance, bundle, secret-scan, and screenshot verification;
- no deployment or provider/BNA mutation.

Relevant OT73 paths observed:

- `apps/web/public/assets/fonts/dm-serif-display-OFL.txt`
- `apps/web/public/assets/fonts/dm-serif-display-latin.woff2`
- `apps/web/src/client/public/styles.css`
- `packages/domain/src/landing/campaign.ts`
- `packages/domain/src/landing/content.ts`
- `scripts/build-public-pages.ts`
- `tests/e2e/landing-signup.spec.ts`
- `ops/execution/ot-73/CORRECTED-LANDING-ADDENDUM.md`
- `ops/evidence/ot-73/**`

`ops/execution/ot-73/CORRECTED-LANDING-ADDENDUM.md`, blob SHA `8d09b3c9cb88d0ea72022a878622daa8c0368548`, records a campaign deadline of `2026-09-11` and timezone `Asia/Jerusalem` in the OT73 context. Codex must audit the current OT81 dependency branch before treating those values as current.

## 4. OT80 provenance

GitHub draft PR observed:

- PR: `https://github.com/webcraft-media/onetimev2/pull/23`
- Title: `OT80 final convergence candidate`
- Head branch: `codex/ot80-one-shot-final-convergence`
- Head SHA observed: `741af0c08ee1d43be4e220b7c6e4c77a2330adc2`
- Product/source candidate SHA recorded in the PR body: `b753d50ca562c01cfa8619762254e70c90b0105f`
- Base branch observed: `codex/ot60r-recovery-convergence`
- Base SHA observed: `dfef7de2035e08f1ee72e0133ccf656fe7a74444`
- Status observed: open draft, explicitly `NOT_READY`

The PR records OT73 integration, successful local/CI build and test suites, and an intentionally non-certified Day-One result. OT80 is historical convergence evidence; it is not the OT82 base.

## 5. Inspected OT80 file evidence

The following files were read from `codex/ot80-one-shot-final-convergence` to make ownership, audit, and conflict guidance concrete.

| Repository path                                           | Blob SHA observed                          | Relevant evidence                                                                                                                  |
| --------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                            | `c7afa162d727c876882fa3b2a6ac868326f64af8` | Node `>=24 <25`; public and app Vite builds; existing build/lint/test/accessibility/performance/secret scripts                     |
| `AGENTS.md`                                               | `f4aa59d3e51563b673a907d0daf7305ae49c9283` | Standalone One Time, static non-React public pages, black/yellow plus restrained cyan, no BNA/provider mutation                    |
| `apps/web/src/client/public/styles.css`                   | `2b5712a9531813ac5930ec10014a17865b38098f` | Public raw token system, local DM Serif, public header/button/drawer/ticker/footer/forms, reduced-motion ticker                    |
| `apps/web/src/client/app/crm.css`                         | `44e32d0416784b1ba87e24d5ecd48042842e837f` | Separate authenticated raw palette, typography, shell/button/card/form rules                                                       |
| `apps/web/src/client/app/shell/AppShell.tsx`              | `0bc099396a9fb470a3255d373ce51f1cbe10d0f0` | Embedded authenticated header, logo, buttons, footer, drawer, toolbar, and session-expired state                                   |
| `scripts/build-public-pages.ts`                           | `9951825c2a6c4ad8f22d434c61d88ccafb707fd5` | Route-local public header/footer/ticker/form markup and known route outputs                                                        |
| `apps/web/src/client/public/public-entry.ts`              | `0f8f89ab3939bdd0502f0ae79124d327ba2ffa46` | Public drawer behavior, campaign deadline hiding, gallery, signup/login behavior                                                   |
| `apps/web/src/client/app/portal-entry.tsx`                | `38da8b2c7763dda53059e384cf6f117dffec9541` | Parent/student role selection, shared AppShell use, runtime portal style injection                                                 |
| `apps/web/src/client/features/portals/PortalFeatures.tsx` | `e000c280db163c75e22a2bec801c191ed91ab792` | Local `ot-*` buttons, panels, rows, state UI, and portal view-state inventory                                                      |
| `apps/web/vite.public.config.ts`                          | `585c3afe2b8e5499dfbfb305ddeba042f235386a` | Public entry `apps/web/src/client/public/public-entry.ts`; deterministic public asset names                                        |
| `apps/web/vite.app.config.ts`                             | `92f82aff2ee93063f7dd53b38bb05abcdcc8d4d2` | Separate React entries for CRM and portal                                                                                          |
| `scripts/check-bundles.ts`                                | `0deeb9d0273909b3ba9949b28b8f5837212931e0` | Existing public budgets: `public.js <= 45,000` raw bytes and `public.css <= 35,000` raw bytes; no React/public-auth bundle leakage |
| `ops/evidence/ot-39/performance-report.json`              | `7deac45cd1dc956aaa85f9080f1de6897009a7ae` | Existing synthetic performance evidence, zero BNA/Operations requests, public/auth bundle separation                               |

## 6. Known token discrepancy to audit

The OT80 public CSS contained these raw leads:

- black: `#050505`
- panel: `#111311`
- ink: `#f8faf7`
- muted: `#c7d2cc`
- yellow: `#ffd21f`
- yellow soft: `#ffe680`
- cyan/ice: `#7ed7e8`

The authenticated CRM CSS used values including:

- black: `#050505`
- yellow: `#ede518`
- ice/cyan: `#86e8ff`
- line: `#34464d`
- panel: `#071117`

This discrepancy is the reason the prompt requires a current OT73/OT80 audit before normalization. These values are not hard-coded as the final OT82 token choices.

## 7. Known route and shell evidence

The inspected public-page builder emitted these current-known routes:

- `/`
- `/signup`
- `/login`
- `/privacy`
- `/terms`
- not-found output
- `/app/crm`
- `/app/dashboard`
- `/app/classes`
- `/app/content`
- `/app/billing`
- `/app/parent`
- `/app/student`

The packet assigns each known route to one canonical shell in `DECISIONS.json`. Codex must add any OT81 routes found at runtime to the manifest and evidence rather than leaving them unassigned.

## 8. Source hierarchy

When sources differ, use this order:

1. The current remote head of `codex/ot81-dayone-certification-staging`.
2. The governing requirements in this packet.
3. Repository history and evidence from OT73 and OT80.
4. The packet compiler’s read-only observations.

Historical refs support audit and intent. They never replace the required runtime base SHA.
