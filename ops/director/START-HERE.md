# One Time Director Start Here

Generated: 2026-07-17T13:32:48+03:00

This folder is the canonical director handoff for fresh ChatGPT or Codex
sessions working on `webcraft-media/onetimev2`. It records the current release
state without depending on local chat memory.

## Read Order

1. `AGENTS.md`
2. `ops/director/START-HERE.md`
3. `ops/director/CURRENT-STATE.json`
4. `ops/director/CAPABILITY-MATRIX.json`
5. `ops/director/DEPLOYMENTS.json`
6. `ops/director/WORKSTREAMS.json`
7. `ops/director/BRANCH-FLEET.json`
8. `ops/director/PRODUCT-INVARIANTS.md`
9. `ops/director/DECISION-REGISTER.md`
10. `ops/director/NEW-CHAT-PROMPT.md`

The W12-00 execution artifacts live in `ops/codex-runs/W12-00/`.

## Current Truth

- Repository: `webcraft-media/onetimev2`
- Default branch: `main`
- Production URL: `https://join.onetimeonetime.com`
- Production `/version` readback during W12-00:
  `ops11-1197673` /
  `1197673fa409bfc4c649c2683f782e86775caa5e`
- Selected director base:
  `c7d46066517d7a458d189f2c782cc06200f7861c`
- Selected base rationale:
  `ops/codex-runs/W12-00/BASE-SELECTION.md`
- Release PR:
  `https://github.com/webcraft-media/onetimev2/pull/61`
- PR #61 state when inspected: draft, open, all six listed checks green.

## What Not To Do From This Handoff

- Do not deploy.
- Do not read, print, or commit secrets.
- Do not perform provider sends, WhatsApp/Telegram mutations, Stripe live
  actions, Buffer publication, DNS changes, customer Zoom mutations, production
  imports, or destructive database operations.
- Do not merge W12 feature lanes manually here. W12-99 owns final semantic
  convergence after feature branches have draft PRs.

## Fast Orientation

- Use `CURRENT-STATE.json` for release refs, live readback, PR checks, and
  safety notes.
- Use `CAPABILITY-MATRIX.json` for exact Day-One status classifications.
- Use `DEPLOYMENTS.json` for production/staging/rollback evidence.
- Use `WORKSTREAMS.json` for W12 lane ownership and convergence order.
- Use `BRANCH-FLEET.json` to avoid duplicate branch/PR work.
- Use `PRODUCT-INVARIANTS.md` and `DECISION-REGISTER.md` before changing
  product behavior.
