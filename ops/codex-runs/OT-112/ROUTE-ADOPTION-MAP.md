# OT-112 Route Adoption Map

This map records exact current adoption targets for the final conductor after parallel lanes converge. OT-112 provides the product-system contracts and gates; it does not broadly rewrite pages in this leaf.

## Canonical Sources Added Here

| Source                                                       | Purpose                                                                                         |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `packages/brand-system/src/route-branding.ts`                | Route template, shell, role, bundle, state, ticker, nav-label, and evidence-selector inventory. |
| `packages/brand-system/src/tokens.ts`                        | Canonical semantic token source for TypeScript and docs.                                        |
| `packages/brand-system/src/tokens.css`                       | Canonical CSS custom properties for app/public styles.                                          |
| `packages/brand-system/src/react.tsx`                        | Feature-neutral React primitives.                                                               |
| `packages/brand-system/src/visual-contract.ts`               | Component, viewport, mode, budget, and screenshot-ban contracts.                                |
| `ops/codex-runs/OT-112/evidence/visual-fixture-gallery.html` | Deterministic gallery for every component/state class using fictional data.                     |
| `ops/codex-runs/OT-112/evidence/visual-matrix.json`          | Route x viewport x mode matrix for visual regression planning.                                  |

## Route Inventory Coverage

| Route template                                                                                      | Role          | Shell                 | Bundle        | Required state coverage                                              |
| --------------------------------------------------------------------------------------------------- | ------------- | --------------------- | ------------- | -------------------------------------------------------------------- |
| `/`                                                                                                 | public        | public-marketing      | public        | ready, error, not-found, ticker                                      |
| `/signup`                                                                                           | public        | auth                  | public        | ready, loading, error, denied                                        |
| `/login`                                                                                            | auth          | auth                  | public        | ready, loading, error, denied, session-expired                       |
| `/activate`                                                                                         | auth          | auth                  | public        | ready, loading, error, denied, session-expired                       |
| `/forgot-password`                                                                                  | auth          | auth                  | public        | ready, loading, error, denied, session-expired                       |
| `/reset-password`                                                                                   | auth          | auth                  | public        | ready, loading, error, denied, session-expired                       |
| `/privacy`, `/terms`, `/404.html`                                                                   | public        | public-marketing      | public        | ready, error, not-found                                              |
| `/one-time`, `/one-time/signup`, `/rabbi-member`                                                    | redirect      | public/auth           | server-static | redirect                                                             |
| `/app/dashboard`, `/app/crm`, `/app/classes`, `/app/content`, `/app/billing`, `/app/communications` | owner/admin   | owner-admin           | app-crm       | ready, loading, empty, error, denied, offline, session-expired, slow |
| `/app/crm/contacts/:contactId`                                                                      | owner/admin   | owner-admin           | app-crm       | ready, loading, empty, error, denied, offline, session-expired, slow |
| `/app/crm/contacts/:contactId/communications`                                                       | owner/admin   | owner-admin           | app-crm       | ready, loading, empty, error, denied, offline, session-expired, slow |
| `/app/billing/checkout/redirect/:redirectKey`, `/app/billing/portal/redirect/:redirectKey`          | owner/admin   | owner-admin           | server-static | redirect, error, not-found                                           |
| `/app/support`, `/app/support/receipts/:receiptId`                                                  | authenticated | authenticated-support | app-crm       | ready, loading, empty, error, denied, session-expired, not-found     |
| `/app/parent`                                                                                       | parent        | parent                | app-portal    | ready, loading, empty, error, denied, offline, session-expired, slow |
| `/app/student`                                                                                      | student       | student               | app-portal    | ready, loading, empty, error, denied, offline, session-expired, slow |
| `/classroom/launch/:grantKey/:secret`                                                               | student       | student               | app-crm       | ready, loading, error, denied, session-expired, slow                 |

## Exact Adoption Targets

### Public Landing And Signup

- `scripts/build-public-pages.ts`
  - Keep `renderCampaignTicker(campaignTicker(), campaign.deadlineDate)` only on `/`.
  - Preserve top-fold `a.button.button-primary.hero-cta[href="/signup"]`.
  - Keep `/login` member link only when the real login route remains functional.
  - After PR #47 convergence, use its approved asset placements and carousel behavior without importing authenticated bundles into public HTML.
- `packages/brand-system/src/styles/public.css`
  - Continue replacing route-local colors with `--ot-*` tokens.
  - Preserve logo as borderless and visibly larger.
  - Keep `What you receive` card icon-above/subhead spacing and avoid overlapping decorative shapes.

### Auth Lifecycle

- `apps/web/src/server/app.ts`
  - `loginPageHtml`, `activationPageHtml`, `forgotPasswordPageHtml`, and `resetPasswordPageHtml` should adopt `routeBranding` shell/state semantics.
  - Replace page-local duplicated form chrome with brand-system static primitives after auth-lane convergence.
  - Evidence selectors: `.login-page`, `.account-flow-panel`, `.form-status`.

### Owner/Admin CRM And Dashboard

- `apps/web/src/client/app/crm-entry.tsx`
  - Replace local `StatePanel`, `NoticeBanner`, `Chip`, `ReadOnlySkeleton`, card/table/action primitives with `@onetime/brand-system/react` primitives after convergence.
  - `ReadOnlyToolbar` currently renders `Refreshing...`; evidence capture must wait for usable marks before screenshots.
  - Nested route selectors to preserve: `[data-usable="crm-list"]`, `[data-usable="crm-detail"]`, `#crm-root`.
- `apps/web/src/client/app/communications/CommunicationsFeature.tsx`
  - Replace unavailable/fallback copy and local table/state markup with the shared state, table/mobile-card, filter scroller, and status chip primitives.
  - Keep `/app/communications` and `/app/crm/contacts/:contactId/communications` branded as owner-admin routes.
- `apps/web/src/server/communications/register.ts`
  - Replace raw `Forbidden` HTML with a branded denied state using the `owner-admin` shell.

### Parent And Student Portals

- `apps/web/src/client/app/portal-entry.tsx`
  - AppShell already sets `title` to `Parent Portal` or `Student Portal`.
- `apps/web/src/client/features/portals/PortalFeatures.tsx`
  - Remove duplicate inner page identity from `PortalTopline title="Parent Portal"` and `PortalTopline title="Student Portal"` once the outer shell title is present.
  - Use inner headings for household, learner, today's class, materials, progress, rewards, questions, and updates instead of repeating the shell title.
  - Replace `HelperState` fallback `helper.reason ?? 'Unavailable'` with branded unavailable/helper scope copy. Do not show helper-not-connected placeholder copy as product copy.
  - Replace parent `+`, reset, revoke, suspend, and long action rows with the shared mobile action pattern from `MobileCard`, `Button`, `StatusChip`, and `SectionTabs`.
- `packages/brand-system/src/styles/portal.css`
  - Migrate remaining portal-only raw aliases to `--ot-*` tokens after portal convergence.
  - Preserve 44px minimum targets and wrap-safe action rows at 360px and 390px.

### Support

- `apps/web/src/server/features/support/router.ts`
  - `supportLeadOnlyHtml`, `supportFormHtml`, and `supportReceiptHtml` should adopt `authenticated-support` route branding and shared state/form primitives.
  - Replace "Continue through the public WhatsApp lead path" with a product-facing support/access explanation after support-lane copy approval.
  - Evidence selectors: `.support-workspace`, `.state-panel`, `data-support-form`.

### Shell And Screenshot Readiness

- `apps/web/src/client/app/shell/AppShell.tsx`
  - Current unauthenticated fallback displays `Signed out`, `Session expired`, and `Checking session`.
  - These strings are allowed only as named auth/session states, not as final usable screenshots.
  - Use `data-ot-usable`/performance marks before evidence capture on authenticated pages.

## Replacement Selectors

| Current selector/component                  | Replace with                                                            |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| `.semantic-chip`, local `Chip`              | `StatusChip` variants                                                   |
| `.dashboard-card`, local route cards        | `Card`, `MetricTile`, `MobileCard`                                      |
| `.toolbar-filters`, local filters           | `FilterStrip`, `SectionTabs`                                            |
| local `StatePanel`, `.state-panel` variants | `StatePanel` variants                                                   |
| local table/mobile row split                | `Table` plus `MobileCard` stack                                         |
| support route raw forms                     | shared form controls and `Button` variants                              |
| portal `.ot-action-row` crowding            | shared wrap-safe action row using `Button` and stable min target tokens |

## Visual Matrix

Run `npm run brand:fixtures` to regenerate:

- `ops/codex-runs/OT-112/evidence/visual-fixture-gallery.html`
- `ops/codex-runs/OT-112/evidence/visual-matrix.json`

Run `npm run brand:visual` to capture:

- `ops/evidence/ot-112/screenshots/fixture-default-360x800.png`
- `ops/evidence/ot-112/screenshots/fixture-default-390x844.png`
- `ops/evidence/ot-112/screenshots/fixture-default-768x1024.png`
- `ops/evidence/ot-112/screenshots/fixture-default-1440x1000.png`
- RTL, reduced-motion, 200-percent effective zoom, keyboard/focus, long-content, slow-state, and error-state screenshots.
