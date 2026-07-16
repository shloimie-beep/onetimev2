# OT-82 File Ownership and Conflict Contract

## Purpose

OT-82 owns the permanent One Time brand/design-system foundation, the shared UI/shell layer, narrowly scoped route migrations, enforcement, tests, and OT82 evidence. It does not own product-domain behavior, servers, databases, workers, providers, deployment, or BNA.

All paths are repository-relative.

## 1. Canonical new ownership

OT-82 may create and fully own:

- `packages/brand-system/**`
- `scripts/brand-system/**`
- `ops/codex-runs/OT-82/**`
- `ops/evidence/ot-82/**`
- `.github/workflows/ot82-brand-system.yml`
- `tests/unit/brand-system/**`
- `tests/integration/brand-system/**`
- `tests/e2e/brand-system.spec.ts`
- `tests/accessibility/brand-system.spec.ts`
- `tests/performance/brand-system.spec.ts`
- `tests/visual/brand-system.spec.ts`
- `tests/fixtures/brand-system/**`

The canonical package path is `packages/brand-system/`. Do not create a competing token package or another core-component root.

## 2. Canonical asset ownership

OT-82 may modify only brand/font assets and provenance needed to centralize the existing One Time identity:

- `apps/web/public/assets/brand/**`
- `apps/web/public/assets/fonts/**`

Restrictions:

- Preserve approved One Time assets unless the audit proves an obsolete duplicate.
- Do not replace content photography, gallery images, student images, Rabbi images, press marks, or other product media.
- Do not import BNA assets.
- Keep licenses and provenance beside the applicable font/asset evidence.
- Do not commit font source archives when the shipped WOFF2 files and licenses are sufficient.

## 3. Focused existing product files

OT-82 may modify these exact current files to consume the canonical package while preserving behavior:

### Public/auth build and enhancement

- `scripts/build-public-pages.ts`
- `apps/web/src/client/public/public-entry.ts`
- `apps/web/src/client/public/styles.css`
- `apps/web/vite.public.config.ts`

### Authenticated build and shells

- `apps/web/vite.app.config.ts`
- `apps/web/src/client/app/shell/AppShell.tsx`
- `apps/web/src/client/app/crm.css`
- `apps/web/src/client/app/crm-entry.tsx`
- `apps/web/src/client/app/portal-entry.tsx`

### Existing visible feature migrations

- `apps/web/src/client/app/communications/CommunicationsFeature.tsx`
- `apps/web/src/client/features/audience-reconciliation/AudienceReconciliationPanel.tsx`
- `apps/web/src/client/features/audience-reconciliation/audience-reconciliation-panel.css`
- `apps/web/src/client/features/portals/PortalFeatures.tsx`

These files may be decomposed into canonical package files and thin route composition files. Do not move domain logic into the brand package.

## 4. Root configuration and rulebook files

OT-82 may make narrow changes to:

- `AGENTS.md`
- `package.json`
- `package-lock.json`
- `eslint.config.js`
- `playwright.config.ts`
- `scripts/check-bundles.ts`
- `tsconfig.typecheck.json`

Permitted changes are limited to:

- adding the `@onetime/brand-system` workspace/package wiring;
- adding `brand:check` and focused test commands;
- adding exact lint/type/build/test inclusion needed by the canonical package;
- retaining or strengthening bundle separation/budgets;
- adding the dedicated OT82 CI workflow;
- pointing `AGENTS.md` to canonical sources.

Do not reformat or reorganize unrelated configuration.

## 5. Focused existing tests

OT-82 may modify these existing tests when necessary to preserve behavior while asserting canonical UI:

- `tests/e2e/landing-signup.spec.ts`
- `tests/e2e/crm-core.spec.ts`
- `tests/accessibility/public-a11y.spec.ts`
- `tests/performance/public-performance.spec.ts`
- `tests/unit/lead-validation.test.ts`

Existing domain assertions must remain. Add visual/brand assertions without weakening product or security checks.

## 6. Narrow ownership expansion protocol

OT81 may add a new visible route file after this packet was compiled. OT-82 may modify an additional file only when every condition below is true:

1. The file is on the resolved OT81 dependency branch.
2. The file directly renders a visible public, auth, owner/admin, parent, or student UI that must migrate to the canonical primitives/shells.
3. The change is limited to presentation composition and does not alter domain, API, server, database, worker, provider, or deployment behavior.
4. Before editing, add the exact path, reason, current SHA, and planned migration to `ops/evidence/ot-82/file-ownership-delta.md`.
5. Include the path in `ops/evidence/ot-82/migration-status.md` and the final report.
6. Do not use directory-wide globs as an ownership expansion.

This protocol does not authorize edits to any prohibited area below.

## 7. Audit-only paths

Read these paths for provenance and behavior, but do not modify them unless another explicitly owned file imports a non-behavioral type that must move without changing semantics:

- `packages/domain/src/landing/campaign.ts`
- `packages/domain/src/landing/content.ts`
- `packages/contracts/**`
- `ops/execution/ot-73/**`
- `ops/evidence/ot-73/**`
- `ops/execution/ot-80/**`
- existing OT80 evidence outside `ops/evidence/ot-82/**`
- historical screenshots outside `ops/evidence/ot-82/**`

The campaign deadline/timezone and landing copy are product/domain inputs. The brand system consumes them; OT-82 does not rewrite them.

## 8. Prohibited ownership

OT-82 must not modify:

- `apps/web/src/server/**`
- `apps/worker/**`
- `packages/db/**`
- `packages/domain/**`, except no edits are expected and Section 7 remains audit-only
- `packages/contracts/**`
- database migrations
- provider adapters, workers, webhooks, repositories, or credentials
- release/deployment descriptors
- Railway, DNS, infrastructure, or environment configuration
- `.github/workflows/ot75-release-readiness.yml`
- `ops/day-one/**`
- `ops/release/**`
- `ops/observability/**`
- OT71, OT72, OT73, OT74, OT75, OT76, OT80, or OT81 execution/evidence records
- BNA repositories or BNA-linked files
- generated `dist/**`
- `node_modules/**`
- production data, secrets, cookies, tokens, or captured sessions

A failing UI test is not permission to edit a prohibited area.

## 9. Exact known OT81 overlap hotspots

Treat these files as likely dependency-conflict hotspots. Re-fetch OT81 before final validation and reconcile ordinary merge conflicts instead of overwriting dependency work:

| Hotspot                                                                                  | Why overlap is expected                                               | OT-82 resolution requirement                                                                        |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                                                                              | OT81 may add certification/staging rules                              | Preserve all OT81 safety/certification rules; add canonical brand pointers without raw token values |
| `package.json`                                                                           | OT81 may add certification scripts; OT82 adds workspace/check scripts | Keep both script sets and existing verification order; add `brand:check` narrowly                   |
| `package-lock.json`                                                                      | Workspace or dependency graph may change in both branches             | Regenerate from reconciled `package.json` with Node 24/npm; never choose a whole side               |
| `apps/web/vite.public.config.ts`                                                         | Public build/bundle inputs may change                                 | Preserve OT81 inputs and public non-React separation; add only canonical static/CSS wiring          |
| `apps/web/vite.app.config.ts`                                                            | OT81 may add app entries/chunks                                       | Preserve every OT81 entry; ensure canonical shared chunks without deleting entries                  |
| `scripts/build-public-pages.ts`                                                          | OT81 may change route/auth/staging output                             | Preserve route and behavior changes; replace only duplicated shell/primitive rendering              |
| `apps/web/src/client/public/public-entry.ts`                                             | OT81 may change login/signup/campaign behavior                        | Preserve behavior and API calls; centralize only shared UI enhancement                              |
| `apps/web/src/client/public/styles.css`                                                  | OT73/OT80 branding and OT81 fixes converge here                       | Audit current values, then reduce to canonical imports and route-specific layout                    |
| `apps/web/src/client/app/shell/AppShell.tsx`                                             | Certification/staging and shell state may change                      | Preserve OT81 session/navigation behavior; compose canonical owner/parent/student shell pieces      |
| `apps/web/src/client/app/crm.css`                                                        | OT81 may add visible states and responsive fixes                      | Preserve route layout; remove raw palette/primitive duplication through canonical CSS               |
| `apps/web/src/client/app/crm-entry.tsx`                                                  | OT81 may wire Day-One states/actions                                  | Preserve all handlers, routes, and API behavior; swap presentation components only                  |
| `apps/web/src/client/app/portal-entry.tsx`                                               | OT81 may certify parent/student flows                                 | Preserve role/session/action behavior; apply explicit parent/student shell variants                 |
| `apps/web/src/client/features/portals/PortalFeatures.tsx`                                | Existing local primitives and states are concentrated here            | Preserve data/state behavior; replace local core primitives and runtime-injected CSS                |
| `apps/web/src/client/app/communications/CommunicationsFeature.tsx`                       | OT81 may certify communications status/actions                        | Preserve product behavior; migrate visible primitives only                                          |
| `apps/web/src/client/features/audience-reconciliation/AudienceReconciliationPanel.tsx`   | OT81 may stage/certify reconciliation UI                              | Preserve feature behavior; migrate visible primitives only                                          |
| `apps/web/src/client/features/audience-reconciliation/audience-reconciliation-panel.css` | Feature-local visual rules may overlap token work                     | Keep content layout; replace raw tokens/core component styling                                      |
| `scripts/check-bundles.ts`                                                               | OT81 may strengthen certification budgets                             | Retain stricter OT81 checks; add raw/gzip OT82 measurement without relaxation                       |
| `tests/e2e/landing-signup.spec.ts`                                                       | OT81 and OT82 both prove public/auth behavior                         | Keep OT81 behavior assertions and add canonical/mobile/ticker checks                                |
| `tests/e2e/crm-core.spec.ts`                                                             | OT81 and OT82 both prove authenticated behavior                       | Keep certification assertions and add shell/primitive/no-dead-action checks                         |
| `tests/accessibility/public-a11y.spec.ts`                                                | Both branches may expand accessibility proof                          | Preserve all checks; add OT82 modes without reducing coverage                                       |
| `tests/performance/public-performance.spec.ts`                                           | Both branches may touch budgets/marks                                 | Preserve OT81 performance semantics and existing thresholds                                         |
| `playwright.config.ts`                                                                   | OT81 may add projects/fixtures                                        | Merge project definitions; do not delete or replace an OT81 project                                 |

The dependency branch itself is not an overlap to overwrite. It is the required base.

## 10. Conflict reconciliation rules

For every hotspot conflict:

1. Fetch the latest dependency head.
2. Use Git’s ordinary three-way merge.
3. Read the base, OT81 side, and OT82 side.
4. Preserve OT81 certification/staging behavior and OT82 canonical brand behavior.
5. Do not resolve with blanket `git checkout --ours`, `git checkout --theirs`, `git restore --source` over the whole file, a hard reset, or force-push.
6. Run focused tests for the conflicted area immediately.
7. Record:
   - file;
   - conflict cause;
   - OT81 behavior preserved;
   - OT82 behavior preserved;
   - validation command;
   - result.
8. Store the record in `ops/evidence/ot-82/conflict-ledger.md`.

If a conflict cannot be reconciled without changing prohibited behavior, keep the branch draft, record the blocker, and do not fabricate a pass.

## 11. Changed-file hygiene

Before every commit and before the final push:

- inspect `git status --short`;
- inspect the full staged diff;
- compare changed paths to this ownership file;
- remove generated `dist/`, screenshots outside OT82 evidence, temporary files, editor files, and credentials;
- confirm no unrelated formatting churn;
- confirm no prohibited path changed.

The final report must contain the complete changed-file list and identify any Section 6 expansion explicitly.
