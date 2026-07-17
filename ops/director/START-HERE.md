# One Time Director Start Here

Generated: 2026-07-17T17:44:58+03:00

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
- Production `/version` readback remains:
  `ops11-1197673` /
  `1197673fa409bfc4c649c2683f782e86775caa5e`
- Production runtime is distinct from the W12 candidate. Do not describe a W12
  branch as deployed production.
- Selected release/director base:
  `c7d46066517d7a458d189f2c782cc06200f7861c`
- Selected base rationale:
  `ops/codex-runs/W12-00/BASE-SELECTION.md`
- Release PR:
  `https://github.com/webcraft-media/onetimev2/pull/61`
- W12-99 candidate branch:
  `integration/w12-final-convergence-20260717T123715Z`
- W12-99 candidate head:
  `0d8d7168f066668f035176d777bdaaa4dcc5accd`
- W12-99 draft PR:
  `https://github.com/webcraft-media/onetimev2/pull/73`
- PR #73 state when inspected by W12-100-00: open draft, clean/mergeable,
  five listed checks successful.
- W12-00 through W12-08 are integrated by W12-99.
- W12-09 remains excluded pending an explicit decision.
- OPS-13A is now available as a sanitized preflight input from PR #72 at
  `d4f58801ebbb5fe8a41ef33621c7594f0ff6b2b4`. It is not import acceptance,
  provider acceptance, or launch proof.
- No W12 staging deployment, real import, provider acceptance, or production
  promotion has been performed.
- W12-100 owns isolated staging and launch proof.
- BNA remains a separate convergence train.

## What Not To Do From This Handoff

- Do not deploy.
- Do not read, print, or commit secrets.
- Do not perform provider sends, WhatsApp/Telegram mutations, Stripe live
  actions, Buffer publication, DNS changes, customer Zoom mutations, production
  imports, or destructive database operations.
- Do not merge W12 feature lanes manually here. W12-99 owns final semantic
  convergence after feature branches have draft PRs.
- Do not run OPS-13B unless a later prompt explicitly scopes it.
- Do not treat OPS-13A source metadata row counts as deduplicated people
  counts.

## Fast Orientation

- Use `CURRENT-STATE.json` for release refs, live readback, PR checks, and
  safety notes.
- Use `CAPABILITY-MATRIX.json` for exact Day-One status classifications.
- Use `DEPLOYMENTS.json` for production/staging/rollback evidence.
- Use `WORKSTREAMS.json` for W12 lane ownership and convergence order.
- Use `BRANCH-FLEET.json` to avoid duplicate branch/PR work.
- Use `PRODUCT-INVARIANTS.md` and `DECISION-REGISTER.md` before changing
  product behavior.
