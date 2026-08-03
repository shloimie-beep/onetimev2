# OT-LAUNCH-01 — Admin Information Architecture

## Assignment

- Task: `OT-LAUNCH-01-ADMIN-IA-01`
- Repository: `shloimie-beep/onetimev2`
- Governed base: use the exact current `codex/full-app-staging-live` head recorded by the conductor at dispatch
- Branch: `codex/admin-workspace-information-architecture`
- Status source: `ops/goals/OT-LAUNCH-01/BOARD.yaml`
- Result handoff: `ops/goals/OT-LAUNCH-01/handoffs/admin-information-architecture--OT-LAUNCH-01-ADMIN-IA-01.json`

Read `CURRENT.yaml`, `GOAL.md`, `SPEC.yaml`, `ACCEPTANCE.yaml`, `BOARD.yaml`,
`DECISIONS.yaml`, this packet, and `AGENTS.md` before work. Verify this exact
assignment. Do not edit `BOARD.yaml`.

## Outcome

Make the Administrator application feel like one focused operating system,
without changing payment, GHL, Telegram, Zoom, Vimeo, migration, or identity
semantics.

Primary Admin navigation is exactly:

1. Dashboard
2. Contacts
3. Content
4. Classroom
5. Live Console

Keep legacy URLs safe for bookmarks, but remove Household Access, Rewards,
Communications, Launch Status, Experience Preview, and Support from the primary
rail. Put staging-only Experience Preview and Launch Status in a utility/context
location. Move Rewards under Classroom and Studio under Content. Do not create
a global Studio or expose BNA/Super Admin controls.

## Page contract

- Dashboard: `Overview | Internal Tasks`; one selected main section, not a wall
  of unrelated launch/diagnostic cards.
- Contacts: `Parents | Students | Internal Tasks`; capability-gate data that
  is not yet delivered by the separate Contacts API task. Never fake a Student
  record or synthesize a GHL link in the browser.
- Content: `Library | Factory | Studio | Knowledge | Prompts`. Fold Processing
  into Library filters, Create/Social into Studio subviews, and Activity into
  item history. Preserve the existing prompt registry/version machinery.
- Classroom: `Overview | Schedule | Questions | Rewards`; one occurrence
  selector and one focused body. No ordinary create-class CTA for the current
  single-class operation.
- Live Console: `Current Class | Questions | Zoom`; place OBS/Stage controls
  under `Advanced` while preserving them.
- Experience Preview: role selector, section selector, then one selected role
  section. Remove the redundant bottom safe-route buttons and any visible BNA
  Agent Actions/bridge copy. Preserve one-use exchange, no-opener, GET-only,
  sibling-scoped, no-impersonation security.
- Parent/Student portals: AppShell owns desktop categories; contextual top
  controls are filters, not duplicate category navigation. The detached
  fictional Student preview may retain an explicit internal navigation mode.

Use canonical `SectionTabs`/brand primitives. At mobile widths use one compact
native selector or drawer. Do not invent route-local tab systems.

## Owned files

The task may change client shell/navigation, route branding, Admin CRM/content/
preview/portal UI, and focused tests. It may remove only customer-visible
Experience Preview bridge copy from the preview server projection.

It must not change DB migrations, provider configuration, GHL registry/runtime,
access/auth domain logic, Telegram, Zoom, Vimeo, payment behavior, or production.

## Acceptance

- Exact five-item Admin nav order on desktop and in the mobile drawer.
- One category controller per viewport; no duplicated role/category controls.
- No primary Household Access, Rewards, Communications, Launch Status,
  Experience Preview, or Support links.
- Content exposes Studio; Classroom exposes Rewards.
- No bottom Experience Preview safe-route buttons, customer-visible BNA text,
  or summary-card `Open …` shortcut wall.
- Legacy URLs resolve safely.
- Existing role-preview isolation and Parent/Student authorization remain green.
- Inspect current pages first; verify 360x800, 390x844, 768x1024, and 1440x1000
  with no page overflow and no serious accessibility violation.

Run scoped format/lint, typecheck, build, focused component/integration tests,
real Chromium desktop/mobile journeys, secret scan, and `git diff --check`.
Push a clean draft PR and return only the sanitized result handoff to the
conductor. Do not deploy production.
