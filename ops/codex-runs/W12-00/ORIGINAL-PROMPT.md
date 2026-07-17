# W12-00 — Canonical director handoff

## Role and outcome

Act as release-state auditor and engineering director. Create durable repository memory so a fresh ChatGPT or Codex session can reconstruct the current state without this conversation.

## Source selection

1. Target only `webcraft-media/onetimev2`.
2. Fetch all remotes. Dynamically inspect PR #61, current release branches, OPS-10/OPS-11 reports, GitHub checks, and deployed `/version` evidence available in the repository.
3. Select the newest remotely pushed commit that contains the exact deployed application source plus the latest non-product release evidence. Record why in `BASE-SELECTION.md`. Never use a literal placeholder.
4. Create a clean external worktree and branch `codex/w12-00-canonical-director-handoff` (add a timestamp suffix only if that remote branch already exists with different work).

## Work

Create and validate:

- `ops/director/START-HERE.md`
- `ops/director/CURRENT-STATE.json`
- `ops/director/CAPABILITY-MATRIX.json`
- `ops/director/WORKSTREAMS.json`
- `ops/director/DEPLOYMENTS.json`
- `ops/director/PRODUCT-INVARIANTS.md`
- `ops/director/DECISION-REGISTER.md`
- `ops/director/NEW-CHAT-PROMPT.md`
- `ops/director/BRANCH-FLEET.json`

Classify every Day-One capability as exactly one of `working_live`, `working_staging`, `implemented_provider_off`, `fixture_only`, `degraded`, `not_configured`, `blocked`, or `not_built`. Include source SHA/ref and evidence path. Cover public landing/signup, auth/activation/recovery, dashboard, CRM/import/tags, communications/history/replies, billing/Stripe, parent/student portals, classes/Zoom, content/Vimeo/knowledge, Buffer/social, Telegram, WhatsApp, support/BNA bridge, workers/queues, observability, backups, and rollback.

Record these binding invariants: One Time owns product data; no synchronous BNA dependency; separate owner/admin/parent/student identities; no impersonation; separate One Time and BNA bots; protected secrets only; real imports/sends/canaries require bounded approval; landing mobile CTA and brand rules persist; technical diagnostics stay out of normal UI.

Add a concise root `AGENTS.md` pointer only if compatible with existing instructions; do not replace or weaken existing rules.

## Durable execution contract

Before any edit, save this exact prompt to `ops/codex-runs/W12-00/ORIGINAL-PROMPT.md`. Maintain `STATE.json`, `RESUME.md`, `FINAL-REPORT.md`, `CHANGED-FILES.txt`, and `HOTSPOTS.json`. If any source is unavailable, mark it `unverified` and continue with available evidence. Do not globally stop for metadata drift.

## Safety and completion

Read-only external inspection plus GitHub branch/PR publication only. No deploy, provider calls, database mutation, user mutation, send, charge, DNS, or secret access. Validate JSON/links, secret scan, formatting, and current-ref readback. Commit, push, open a draft PR, and report exact head.

