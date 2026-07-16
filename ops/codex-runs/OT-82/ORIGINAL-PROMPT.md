# DIRECT CODEX EXECUTION PROMPT — OT-82 One Time Brand and Shell Foundation

You are the implementation agent for OT-82. Execute this packet against the repository named below. Do not reinterpret the task as a design mockup, a BNA task, a deployment task, or a general refactor.

## 1. Fixed identity and required outcome

- Repository: `webcraft-media/onetimev2`
- Canonical HTTPS origin: `https://github.com/webcraft-media/onetimev2.git`
- Required dependency branch: `codex/ot81-dayone-certification-staging`
- Required product branch: `codex/ot82-brand-system-foundation`
- Required checkpoint branch when the dependency is absent: `codex/ot82-brand-system-foundation-checkpoint`
- Required stacked draft PR base: `codex/ot81-dayone-certification-staging`
- Required stacked draft PR title: `OT82: One Time brand system foundation`
- Repository-backed run directory: `ops/codex-runs/OT-82/`
- Evidence directory: `ops/evidence/ot-82/`

Create a permanent, code-enforced One Time brand system so the landing page, signup, login, CRM, owner/admin routes, parent portal, and student portal cannot independently recreate or drift in fonts, colors, spacing, buttons, headers, footers, cards, forms, toolbars, drawers, dialogs, or status states.

OT-82 is complete only when the canonical manifest, tokens, primitives, shell variants, route migrations, CI enforcement, screenshots, behavioral proof, bundle proof, repository run state, pushed branch, and stacked draft PR all exist and are internally consistent.

## 2. Packet integrity and packet persistence

Treat the directory containing this `CODEX-PROMPT.md` file as `PACKET_DIR`.

Before touching any repository:

1. Read every packet file:
   - `CODEX-PROMPT.md`
   - `DECISIONS.json`
   - `FILE-OWNERSHIP.md`
   - `ACCEPTANCE-MATRIX.md`
   - `VISUAL-MATRIX.md`
   - `SOURCES.md`
   - `SHA256SUMS.txt`
2. Verify `SHA256SUMS.txt` against the other six packet files. Use `sha256sum -c SHA256SUMS.txt` when available. On PowerShell, use `Get-FileHash -Algorithm SHA256` and compare every listed value.
3. Do not alter the packet copies in `PACKET_DIR`.
4. Copy all seven packet files into `ops/codex-runs/OT-82/packet/` in the One Time repository as part of the first repository-backed checkpoint.

A packet hash failure is a hard stop. Record the failure in a repository-backed checkpoint if a safe One Time checkpoint branch can be created; otherwise report the exact file and expected/actual digest without editing any unrelated repository.

## 3. Repository location is untrusted

The current window or current working directory may be BNA or another repository. Never assume the open folder is One Time.

Resolve the repository as follows:

1. Inspect the current directory only to identify it. Do not modify it.
2. Accept a checkout only when:
   - `git rev-parse --show-toplevel` succeeds, and
   - the normalized `origin` URL identifies exactly `webcraft-media/onetimev2`.
3. Accepted origin forms include HTTPS and SSH forms for the same owner/repository. A BNA remote, similarly named folder, fork, or unverified copy is not acceptable.
4. If the current checkout is not One Time, look for an existing clean local clone under the user home directory. Verify its origin before using it.
5. If no verified clone exists, clone `https://github.com/webcraft-media/onetimev2.git` into `$HOME/.codex/repos/webcraft-media-onetimev2`.
6. Use the verified clone only as a Git source/administrative checkout. Product work must occur in a clean external Git worktree.
7. Never copy BNA source, BNA generated assets, BNA Operations shell code, BNA secrets, BNA cookies, BNA provider runtime, or BNA styling into One Time.

Do not run `git reset --hard`, `git clean -fd`, a force checkout over unrelated work, or any command that discards uncommitted work. Do not remove or repurpose another worktree. Do not force-push.

## 4. Resolve the dependency branch at execution time

From the verified One Time source checkout:

1. Run a normal remote fetch with pruning.
2. Query the exact remote ref `refs/heads/codex/ot81-dayone-certification-staging`.
3. Resolve the remote head SHA from `refs/remotes/origin/codex/ot81-dayone-certification-staging`.
4. Record both the query result and resolved SHA in `ops/codex-runs/OT-82/INPUTS.json`.
5. Do not substitute `main`, OT80, a local OT81 branch, a PR merge ref, or a remembered SHA for the required product base.

The packet compiler observed no remote OT81 dependency branch on July 15, 2026. That observation is provenance only. You must query the remote again because the branch may now exist.

### 4.1 Required waiting protocol when OT81 is not remote

When `refs/heads/codex/ot81-dayone-certification-staging` does not exist remotely:

1. Do not start product edits.
2. Resolve the remote default branch solely as the administrative base for a checkpoint.
3. Create or safely resume the external worktree for branch `codex/ot82-brand-system-foundation-checkpoint`.
4. If the remote checkpoint branch already exists, resume it without resetting or force-pushing. Otherwise create it from the resolved remote default-branch head.
5. Under `ops/codex-runs/OT-82/`:
   - copy the complete packet to `packet/`;
   - write `ORIGINAL-PROMPT.md` as an exact copy of `packet/CODEX-PROMPT.md`;
   - write `INPUTS.json` with repository identity, the missing dependency ref, the remote default-branch SHA, packet digests, and zero secrets;
   - write `STATE.json` with status `ready_waiting_for_base`;
   - write `RESUME.md` with the verified source checkout path, checkpoint worktree path, exact fetch/ref-check commands, and the instruction to create the product worktree only after the dependency ref exists;
   - write `FINAL-REPORT.md` with status `READY_WAITING_FOR_BASE`, the missing ref, checkpoint commit SHA once committed, checkpoint branch, external mutations, and resume path;
   - write a marker file named exactly `READY_WAITING_FOR_BASE` containing the missing ref and UTC observation time.
6. Commit the packet and run-state files with message `chore(ot82): checkpoint packet pending OT81 base`.
7. Push `codex/ot82-brand-system-foundation-checkpoint` normally.
8. Do not open a product PR against an unrelated base.
9. End the run by reporting `READY_WAITING_FOR_BASE`, the checkpoint branch and commit SHA, and `ops/codex-runs/OT-82/RESUME.md`.

This waiting result is successful preservation, not OT-82 product completion. On a later run, read the checkpoint files with `git show` or from a clean checkpoint worktree; do not merge the checkpoint branch history into the product branch merely to recover the packet.

### 4.2 Required product-branch protocol when OT81 is remote

When the required dependency branch exists:

1. Set `BASE_SHA` to the exact current remote head of `origin/codex/ot81-dayone-certification-staging`.
2. Create a clean external worktree under `$HOME/.codex/worktrees/webcraft-media-onetimev2/`. Use the directory name `ot82-brand-system-foundation`; if that exact path is occupied, create a new sibling with a UTC timestamp suffix and record the selected path.
3. If `origin/codex/ot82-brand-system-foundation` does not exist, create local branch `codex/ot82-brand-system-foundation` directly from `BASE_SHA`.
4. If the product branch already exists remotely, resume it in the external worktree. Fetch the current dependency head and merge it normally into the product branch when it is not already an ancestor. Resolve conflicts by three-way reconciliation. Never reset the product branch to the dependency and never force-push.
5. Confirm the product worktree is clean before writing run state.
6. Record the exact source checkout, worktree, dependency ref, resolved base SHA, pre-edit branch head SHA, Node version, npm version, operating system, packet digests, and historical audit refs in `INPUTS.json`.

## 5. Repository-backed run state must precede product edits

Before modifying product source, create and commit these files under `ops/codex-runs/OT-82/`:

- `ORIGINAL-PROMPT.md`: exact copy of this prompt.
- `INPUTS.json`: resolved repository and runtime inputs, with no credentials or secrets.
- `STATE.json`: status `initialized`, current phase `baseline_audit`, completed phases as an empty array, blocking issues as an empty array, the exact base SHA, and the current branch head SHA.
- `RESUME.md`: exact repository/worktree paths, branch names, current commit, completed action, next action, validation commands, and safe resume procedure.
- `FINAL-REPORT.md`: initialized with status `IN_PROGRESS`, repository, branch, base SHA, worktree, allowed external mutations, and repository-backed resume path. It must contain no blank sections; use `Not executed yet` for checks that have not run.

Also copy the packet into `ops/codex-runs/OT-82/packet/`.

Commit this initialization before product edits with message `chore(ot82): initialize repository-backed run state`, then push the product branch normally. Update `STATE.json`, `RESUME.md`, and `FINAL-REPORT.md` after every material phase and before every handoff.

## 6. Read-before-write audit

Read the current dependency branch and its history before deciding token values or component boundaries. At minimum inspect:

- `AGENTS.md`
- `package.json`
- `package-lock.json`
- `apps/web/vite.public.config.ts`
- `apps/web/vite.app.config.ts`
- `apps/web/src/client/public/styles.css`
- `apps/web/src/client/public/public-entry.ts`
- `apps/web/src/client/app/crm.css`
- `apps/web/src/client/app/crm-entry.tsx`
- `apps/web/src/client/app/portal-entry.tsx`
- `apps/web/src/client/app/shell/AppShell.tsx`
- `apps/web/src/client/features/portals/PortalFeatures.tsx`
- `scripts/build-public-pages.ts`
- `scripts/check-bundles.ts`
- `packages/domain/src/landing/campaign.ts`
- `packages/domain/src/landing/content.ts`
- `apps/web/public/assets/brand/`
- `apps/web/public/assets/fonts/`
- `ops/execution/ot-73/`
- `ops/evidence/ot-73/`
- `ops/execution/ot-80/`
- relevant OT80 evidence and screenshots carried into the dependency branch

Audit Git history for OT73 and OT80. The historical refs in `SOURCES.md` are evidence aids, not the OT82 base. Compare the current dependency branch against those refs and record any changes introduced later.

Create both:

- `ops/evidence/ot-82/brand-audit.json`
- `ops/evidence/ot-82/brand-audit.md`

The audit must inventory:

- every current visible raw color and where it is used;
- every font family, weight, source, license, preload, and fallback;
- every logo asset, variant, intrinsic size, and route usage;
- spacing, radius, border, shadow, motion, focus, z-index/layer, breakpoint, safe-area, and component-size values;
- all button, link, input, select, checkbox, alert, badge, card, row, table, drawer, dialog, state, filter, header, toolbar, and footer implementations;
- shell behavior for public marketing, signup/login, owner/admin, parent, and student;
- route-to-shell and route-to-ticker assignments;
- route-local CSS and runtime-injected CSS;
- current bundle sizes in raw and gzip bytes;
- current screenshot dimensions and behavioral baselines;
- current accessibility and keyboard behavior;
- exact differences between public yellow/ice-blue values and authenticated-app yellow/ice-blue values;
- overlap with dependency-branch files and any merge conflicts already reconciled.

Known OT80 values include public black `#050505`, public yellow `#ffd21f`, public ice/cyan `#7ed7e8`, and authenticated values including `#ede518` and `#86e8ff`. Treat those as audit leads only. Choose canonical semantic values from the current dependency branch and documented OT73/OT80 intent; do not blindly copy either palette.

Do not change product behavior during the audit.

## 7. Canonical package and manifest contract

Create the canonical workspace package:

- directory: `packages/brand-system/`
- package name: `@onetime/brand-system`

The package must be local, versioned, machine-readable, framework-aware, and usable without a network connection. It must have separate static and React entrypoints so public pages remain non-React.

At minimum create these stable public artifacts:

- `packages/brand-system/package.json`
- `packages/brand-system/README.md`
- `packages/brand-system/manifest/one-time-brand.schema.json`
- `packages/brand-system/manifest/one-time-brand.v1.json`
- `packages/brand-system/src/index.ts`
- `packages/brand-system/src/static.ts`
- `packages/brand-system/src/react.tsx`
- `packages/brand-system/src/tokens.css`
- `packages/brand-system/src/tokens.ts`
- `packages/brand-system/src/route-branding.ts`
- `packages/brand-system/src/primitives/`
- `packages/brand-system/src/shells/`
- `packages/brand-system/src/styles/`

Internal subdivision beyond those paths is allowed. Do not create a second token store elsewhere.

The JSON Schema and manifest must be checked in. The manifest must include:

- `schemaVersion`;
- semantic version `1.0.0`;
- product and brand identifiers;
- provenance for OT73/OT80 audit decisions;
- asset registry;
- font registry and license/provenance references;
- semantic tokens;
- component variants and sizes;
- shell variants;
- route assignments;
- approved ticker routes;
- accessibility constraints;
- deprecation policy;
- compatibility metadata for static and React consumers.

The semantic token model must cover:

- color;
- typography;
- spacing;
- radius;
- border;
- shadow;
- motion;
- focus;
- layers/z-index;
- breakpoints;
- safe areas;
- component sizes.

Use semantic names such as background, surface, text, action, focus, status, and shell roles. Raw values belong only in the canonical manifest/token outputs and narrowly documented asset exceptions. Route code must consume semantic tokens or canonical components.

Validate the manifest against the schema in CI and in unit tests. Keep JSON, TypeScript, and CSS token outputs synchronized. A generated artifact is acceptable only when its generation is deterministic, the source of truth is explicit, and CI proves no drift.

## 8. Asset and typography policy

Preserve the One Time black/yellow identity, restrained approved ice-blue support accent, canonical DM Serif Display treatment, and legible body typography.

Requirements:

1. The canonical logo must be registered in the manifest and rendered through the shared Logo primitive.
2. Do not invent route-local logo sizing, filters, text lockups, or fallback marks.
3. DM Serif Display remains self-hosted with its license/provenance.
4. Any non-system body font retained after the audit must also be self-hosted in WOFF2 form with license/provenance. If the audit concludes that the canonical body stack is a system stack, encode that decision explicitly in the manifest.
5. No Google Fonts, CDN fonts, BNA-hosted fonts, or runtime font downloads.
6. Font-face declarations, weights, display behavior, and fallbacks must be centralized.
7. Preload only fonts proven to be above-the-fold and budget-compatible.
8. Keep the total shipped WOFF2 font payload at or below 250,000 raw bytes unless the dependency branch already exceeds that value. An existing higher baseline may not grow.
9. Logo and font files must be content-addressed or otherwise versioned through the manifest; route code references canonical asset exports or canonical public paths.

## 9. Required primitives

Implement and export shared, accessible primitives for:

- Logo
- Button
- Link
- Input
- Select
- Checkbox
- Alert
- Badge
- Card
- List/Card Row
- Table
- Drawer
- Dialog
- Empty State
- Loading State
- Error State
- Filter Strip
- Footer

Also provide canonical Header and Toolbar composition because those may not be recreated route-by-route.

Each primitive must define:

- semantic variants;
- supported sizes;
- disabled/loading/error behavior where applicable;
- keyboard and focus behavior;
- accessible name/role/state requirements;
- static-renderer support where the public pages need it;
- React support for authenticated surfaces;
- stable data attributes for tests;
- token-only styling outside documented asset exceptions.

Do not expose separate public, CRM, parent, and student Button implementations. A shell may choose a variant, but the underlying primitive and token contract must be shared.

If a visible action has no handler or destination, do not render it as enabled. Omit it or render a correctly disabled control with an explicit reason. Do not invent backend workflows to make a dead action appear functional.

## 10. Intentional shell variants

Implement these shell variants through the canonical shell layer:

1. `public-marketing`
2. `auth`
3. `owner-admin`
4. `parent`
5. `student`

Consistency means shared primitives, assets, and tokens. It does not mean placing the marketing ticker, marketing navigation, or marketing footer inside CRM or portals.

Required route assignments at the current known route set:

- `/` → `public-marketing`
- `/signup` → `auth`
- `/login` → `auth`
- `/privacy` → `public-marketing` without ticker
- `/terms` → `public-marketing` without ticker
- `/404.html` and not-found output → `public-marketing` without ticker
- `/app/crm` → `owner-admin`
- `/app/dashboard` → `owner-admin`
- `/app/classes` → `owner-admin`
- `/app/content` → `owner-admin`
- `/app/billing` → `owner-admin`
- `/app/parent` → `parent`
- `/app/student` → `student`

If OT81 added routes, assign each visible route to exactly one canonical shell and record the additional exact route in the manifest and audit. Do not leave any visible route unassigned.

The ticker allowlist is exactly `/` for OT-82 unless the current dependency branch contains another explicitly approved public marketing route backed by repository evidence. Any additional route requires an explicit manifest entry, a cited audit source, and a test proving absence everywhere else.

## 11. Promotional ticker contract

Preserve the approved moving promotion and countdown behavior:

- visible copy meaning: `Join now — free until Rosh Hashanah`;
- existing canonical campaign deadline and `Asia/Jerusalem` date behavior;
- link destination `/signup`;
- moving treatment on motion-enabled public landing;
- one static, fully readable item when reduced motion is requested;
- hidden after the canonical deadline according to the existing campaign contract;
- absent from signup, login, privacy, terms, CRM, owner/admin, parent, student, errors, and test-only component fixtures.

Do not restore the removed `$67/month afterward` hero line. Do not expose `$67`, monthly-price, trial, or `No card today` fragments in the landing hero or ticker. Billing product content elsewhere is not subject to a blanket `$67` source ban; the prohibition is specifically the removed landing promotion.

Use text casing as a presentation concern. The accessible name must be readable and semantically equivalent to the approved sentence.

## 12. Public mobile invariant

At initial scroll position zero for both `360x800` and `390x844`:

- the canonical logo is visible;
- the public header is visible;
- the header’s primary `Sign Up Now` CTA is visible and usable;
- the CTA and logo are not clipped or occluded by the ticker, safe area, viewport edge, drawer button, or another control;
- there is no horizontal overflow;
- no initial scrolling is required to reach that primary CTA.

Add stable selectors and Playwright assertions for bounding boxes and viewport intersection. Keep touch targets at least 44 by 44 CSS pixels.

## 13. Migration requirements

Migrate existing surfaces carefully without changing domain behavior, API contracts, routes, auth behavior, campaign logic, lead behavior, CRM behavior, parent behavior, or student behavior.

### 13.1 Public and auth

- Replace route-local header, footer, logo, button, drawer, form-control, card, and status markup with canonical static primitives/shells.
- Keep public pages static and non-React.
- Keep `public.js` free of React.
- Keep signup and login submit behavior, validation, API requests, return paths, focus management, and success/error copy behavior.
- Convert `apps/web/src/client/public/styles.css` into a narrow canonical import/route-composition layer; it must not remain an independent token system.
- Centralize public drawer behavior without making it a second Drawer implementation.
- Preserve current landing section order, content, imagery, gallery behavior, and approved campaign behavior.

### 13.2 Owner/admin and CRM

- Refactor `AppShell.tsx` to compose canonical owner/admin shell pieces.
- Replace embedded logo, header, footer, button, toolbar, drawer, alert, card, row, table, form, and state recreations with canonical primitives.
- Preserve navigation, session-expired handling, focus restoration, API calls, route behavior, filters, tables, and CRM user journeys.
- Do not add marketing chrome to authenticated routes.

### 13.3 Parent and student

- Use distinct parent and student shell variants backed by shared primitives/tokens.
- Remove runtime-injected route-wide CSS such as `portalFeatureStyles` when present.
- Replace `ot-button`, `ot-panel`, `ot-item`, `ot-empty`, `ot-status`, and similar local core primitives with canonical equivalents.
- Preserve role checks, protected actions, session handling, data loading, learner selection, class launch behavior, content behavior, and notices.
- Do not invent missing product operations. Disabled/omitted controls must accurately reflect handler availability.

### 13.4 CSS and component deduplication

- No route may define its own raw palette or font family.
- No route may define a second core Header, Footer, Button, Toolbar, Drawer, Dialog, Card, Input, Select, Checkbox, Alert, Badge, Table, or state primitive.
- Route CSS may contain narrow layout rules and content-specific imagery only.
- Shared base/primitives/shell CSS must be emitted once per relevant bundle, not copied into each route entry.
- Do not ship runtime `<style>` injection for route-wide styling.
- Do not commit generated `dist/` output.

## 14. AGENTS.md rulebook

Update root `AGENTS.md` to point contributors and agents to:

- `packages/brand-system/manifest/one-time-brand.v1.json`;
- `packages/brand-system/manifest/one-time-brand.schema.json`;
- canonical package entrypoints;
- canonical primitive and shell roots;
- route assignment registry;
- brand validation command;
- raw color/font exception policy;
- the rule against route-local core components.

`AGENTS.md` is a rulebook. Do not duplicate raw token values into it. Preserve existing standalone-product, security, bundle-separation, and no-BNA invariants.

## 15. CI enforcement

Add deterministic CI enforcement and local commands. Add root script `brand:check` and include it in the repository verification path or a dedicated required workflow.

The enforcement must fail on:

- manifest/schema invalidity;
- JSON/TypeScript/CSS token drift;
- raw UI colors outside canonical token files;
- font-family declarations outside canonical typography files;
- external font URLs;
- duplicate core component definitions outside canonical roots;
- route-local header/footer/button/toolbar implementations;
- runtime-injected route-wide CSS;
- unassigned visible routes;
- ticker use outside its allowlist;
- route-wide CSS duplication;
- public React leakage;
- bundle budget violations.

The enforcement must not falsely block:

- SVG or raster image color data;
- canonical logo assets;
- canonical font binaries and licenses;
- test fixtures;
- screenshots and OT82 evidence;
- syntax highlighting or snapshot data that never ships;
- transparent/currentColor/inherit where semantically appropriate.

Document exceptions in a checked-in machine-readable allowlist owned by `packages/brand-system/`. Every exception requires an exact path, exact rule, rationale, and owner. Wildcard exemptions over application source are prohibited.

Add focused tests for the validator itself, including allowed SVG/image/test-fixture colors and rejected route-local CSS/component cases.

## 16. Visual and behavioral proof

Implement every required case in `VISUAL-MATRIX.md`.

General visual-test rules:

- Chromium, device scale factor 1.
- Exact viewports: `360x800`, `390x844`, `768x1024`, `1440x1000`.
- Wait for `document.fonts.ready`.
- Disable nonessential nondeterminism.
- Freeze visual-test time before the campaign deadline while separately testing deadline hiding.
- Commit stable baseline screenshots under `ops/evidence/ot-82/screenshots/`.
- Use deterministic seeded synthetic fixtures only.
- Do not use production data, production sessions, or live providers.
- Record the screenshot index and test command in `ops/evidence/ot-82/visual-index.md`.

Proof must cover:

- landing, signup, login, CRM, parent, and student shells at all four viewports;
- loading, empty, and error states;
- public and authenticated drawers;
- shared dialog;
- RTL;
- reduced motion;
- 200% zoom/reflow;
- visible keyboard focus and focus trapping/restoration;
- automated contrast and documented token-pair contrast;
- no horizontal overflow;
- mobile header/logo/CTA invariant;
- ticker route allowlist and deadline behavior;
- no dead visible action;
- no BNA/Operations requests.

Use `VISUAL-MATRIX.md` as the minimum, not a suggestion.

## 17. Accessibility requirements

At minimum:

- WCAG 2.2 AA contrast for text and UI components;
- visible focus indicator with sufficient contrast;
- logical heading order;
- labels, descriptions, errors, and status announcements;
- keyboard operation for every action;
- Escape close, focus trap, and focus restore for Drawer and Dialog;
- no focus loss during loading/error transitions;
- 44 by 44 CSS-pixel touch targets for interactive controls;
- semantic table headers and responsive table treatment;
- reduced-motion alternative;
- 200% zoom/reflow without two-dimensional scrolling for primary content;
- RTL-safe logical spacing and icon placement;
- no color-only state communication.

Run the existing accessibility suite and add focused OT82 coverage.

## 18. Network, behavior, and safety proof

During browser tests, capture all requests and fail if a One Time page makes a request to BNA, Operations, an external font host, an unapproved analytics host, or a provider endpoint.

No OT-82 code may synchronously load a BNA brand control plane. Future BNA publishing may produce an explicitly versioned snapshot consumed in a later task, but One Time must render entirely from local checked-in assets and code.

No deployment, DNS mutation, Railway mutation, provider mutation, production database mutation, real send, real payment, real account/access mutation, or BNA repository mutation is allowed.

The only permitted external mutations are:

- pushing the OT82 checkpoint branch when waiting;
- pushing the OT82 product branch when implementing;
- opening or updating the stacked draft PR.

Use synthetic/local test data only.

## 19. Bundle and performance budgets

Measure the exact dependency-branch baseline before edits and the final branch after edits. Record raw and gzip bytes in `ops/evidence/ot-82/bundle-report.json` and explain changes in `bundle-report.md`.

Preserve the existing absolute public budgets:

- `public.js` at or below 45,000 raw bytes;
- `public.css` at or below 35,000 raw bytes;
- no React in the public JavaScript bundle;
- no authenticated bundle referenced by public HTML.

Additional budgets:

- total WOFF2 payload at or below 250,000 raw bytes, unless the dependency baseline is already higher; a higher existing baseline may not grow;
- each authenticated entry’s transitive JavaScript raw bytes may grow by no more than the smaller of 20,000 bytes or 10 percent of that entry’s dependency-branch baseline;
- authenticated CSS raw bytes may grow by no more than 15,000 bytes in total;
- no duplicate full primitive/shell CSS payload across CRM and portal entries;
- LCP at or below 2.5 seconds and CLS at or below 0.1 in existing performance profiles;
- no horizontal overflow.

Do not relax an existing stricter budget. If deduplication reduces a bundle, retain the tighter observed result where practical.

## 20. File ownership and conflict handling

Follow `FILE-OWNERSHIP.md` exactly.

OT81 is the dependency and may touch the same shell, route, test, package, or operations files. The exact known hotspots are listed in `FILE-OWNERSHIP.md`.

Before final validation:

1. Fetch the dependency branch again.
2. Resolve its new remote head.
3. If it advanced, merge that head normally into the OT82 product branch.
4. Reconcile conflicts line-by-line, preserving OT81 certification/staging behavior and OT82 brand-system behavior.
5. Never resolve a hotspot with wholesale `ours`, wholesale `theirs`, checkout-overwrite, reset, or force-push.
6. Record every overlap and resolution in `ops/evidence/ot-82/conflict-ledger.md`.
7. Rerun the complete relevant test and evidence suite after reconciliation.
8. Update `INPUTS.json`, `STATE.json`, `RESUME.md`, and `FINAL-REPORT.md` with the final resolved base SHA.

Do not edit out-of-scope server, database, worker, provider, deployment, or release behavior to make UI tests easier.

## 21. Required validation commands and reports

Run the repository’s normal install and validation flow using Node 24. At minimum run:

- clean dependency install;
- `npm run build`;
- `npm run brand:check`;
- `npm run lint`;
- `npm run typecheck`;
- `npm run unit`;
- `npm run integration`;
- `npm run e2e`;
- `npm run accessibility`;
- `npm run performance`;
- `npm run secret:scan`;
- formatting check;
- `git diff --check`.

Add focused commands when the repository supports them. Do not claim a pass without recording command, exit code, and result.

Create:

- `ops/evidence/ot-82/acceptance/acceptance-results.json`
- `ops/evidence/ot-82/acceptance/acceptance-results.md`
- `ops/evidence/ot-82/brand-audit.json`
- `ops/evidence/ot-82/brand-audit.md`
- `ops/evidence/ot-82/bundle-report.json`
- `ops/evidence/ot-82/bundle-report.md`
- `ops/evidence/ot-82/network-report.json`
- `ops/evidence/ot-82/interaction-report.json`
- `ops/evidence/ot-82/accessibility-report.json`
- `ops/evidence/ot-82/visual-index.md`
- `ops/evidence/ot-82/conflict-ledger.md`
- `ops/evidence/ot-82/migration-status.md`

Every row in `ACCEPTANCE-MATRIX.md` must map to a result and evidence path.

## 22. Commit, push, and stacked draft PR

Use logical commits. The first product-branch commit is the required run-state initialization. Later commits should separate canonical foundation, migrations, and proof where practical.

Before publishing:

1. Confirm no secrets, production data, generated `dist/`, or unrelated files are staged.
2. Confirm the dependency branch was re-fetched and reconciled.
3. Confirm all required evidence and run-state files are current.
4. Commit all intended OT82 changes.
5. Push `codex/ot82-brand-system-foundation` normally. Never force-push.
6. Open or update a draft PR with:
   - base `codex/ot81-dayone-certification-staging`;
   - head `codex/ot82-brand-system-foundation`;
   - title `OT82: One Time brand system foundation`.
7. Do not create a duplicate PR when one already exists.

The PR body must report:

- resolved base branch and SHA;
- final head branch and SHA;
- summary of canonical manifest/tokens/primitives/shells;
- exact changed-file list or linked checked-in file list;
- migration status for landing, signup, login, CRM/owner-admin, parent, and student;
- screenshot index;
- test commands and results;
- raw/gzip bundle changes and budgets;
- conflict/overlap reconciliation;
- external mutations;
- explicit statement that no deployment/provider/BNA mutation occurred;
- repository-backed resume path `ops/codex-runs/OT-82/RESUME.md`.

## 23. Final repository report

Finalize `ops/codex-runs/OT-82/FINAL-REPORT.md` before the last push.

It must contain actual values for:

- final status;
- repository and verified origin;
- resolved dependency branch and final base SHA;
- product branch and final pushed head SHA;
- checkpoint branch/commit when used;
- worktree path;
- packet verification;
- changed files;
- manifest/schema paths and versions;
- primitive inventory;
- shell/route assignment inventory;
- route migration status;
- screenshot paths and visual result;
- test commands, exit codes, and results;
- bundle baseline/final/delta;
- accessibility, RTL, reduced-motion, zoom/reflow, focus, contrast, and network results;
- overlap conflicts and resolutions;
- external mutations;
- no-deployment/no-provider/no-BNA statement;
- draft PR URL;
- repository-backed resume path;
- remaining blockers, using `None` only when there are none.

Update `STATE.json` to `complete` only after the branch is pushed and the stacked draft PR exists. Update `RESUME.md` so another agent can reproduce the final state from repository data without relying on chat history or a local scratchpad.

## 24. Definition of done

Do not mark OT-82 complete unless all of the following are true:

- the product branch is based on the current remote OT81 dependency head after final reconciliation;
- the canonical versioned manifest and schema exist and validate;
- semantic tokens cover every required category;
- fonts and logos are local and canonical;
- all required primitives and five shell variants exist;
- the ticker is restricted to approved public marketing routes and has reduced-motion behavior;
- the removed landing pricing line remains absent;
- mobile logo/header/CTA invariants pass at both required mobile viewports;
- public, auth, CRM/owner-admin, parent, and student routes use the canonical system;
- duplicate core components and route-local token systems are removed;
- AGENTS.md points to canonical sources without storing raw token values;
- CI rejects unapproved raw colors/fonts and duplicate core components while honoring narrow asset/test exceptions;
- every visual and behavioral matrix case has evidence;
- bundle budgets pass;
- no BNA/Operations/provider requests occur;
- no visible action is dead;
- all required run-state and evidence files are committed;
- the product branch is pushed;
- the stacked draft PR is open;
- `FINAL-REPORT.md` contains the resolved base/head SHAs and all required proof.

When the dependency branch is absent, use the waiting protocol instead and report `READY_WAITING_FOR_BASE`. Never fabricate completion.
