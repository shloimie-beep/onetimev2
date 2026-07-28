# P29 Correction Claim Handoff

## Identity

- Branch: `codex/v21-p29-core-workflows`
- Authorized integration start: `49431959f58f284bdc13ca931acf09f980fc483a`
- Exact correction parent and expected existing head:
  `15dc7c87948c3df9dc6c77be89c79b706860448f`
- Prior implementation: `0a42c8701d75d2a15e59c5e7a2f4a3e5d7fb0d18`
- Prior ready-for-review head:
  `15dc7c87948c3df9dc6c77be89c79b706860448f`
- Correction claim: `22467835-84ad-4d38-8187-a3b64d88d132`
- Writer: `codex-p29-worker-22467835`
- Control authorization:
  `89ac83c2e816e9726f1ae2d2193e34e3269fb36c`
- Ready-entry parent control:
  `32c9ef6a0738f0a4fa038f1212ff7019e19992f1`
- Ready-entry digest:
  `4b5b332d4f27cf354d5b66f75370552ee288b018e39013839f555d8115939898`
- GHL_CORE_WORKFLOWS lease:
  `2eab904c-0a0d-4402-bd46-f1deedf1c5c7`
- Lease issued: `2026-07-28T23:51:24Z`
- Lease expires: `2026-07-29T00:51:24Z`
- External effects: authority none; attempted 0; succeeded 0; reconciled 0

## This checkpoint

This commit is only the atomic P29 correction claim. The exact
`resume_existing_branch` entry, expected remote head, canonical payload digest,
task/package/dependency bindings, unexpired sole writer lease, and zero effect
locks were verified. Only `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`
change.

No product, workflow fragment, test, steward request, migration, interface,
registry, composer, provider, deployment, or external-effect change is included.

## Exact next action

Push this atomic correction claim checkpoint and stop. Product correction may
begin only after C00 observes and reconciles claim
`22467835-84ad-4d38-8187-a3b64d88d132` against the pushed checkpoint.

## Pending correction

The correction scope has not started. Preserve the exact prior implementation
until a post-reconciliation continuation is explicitly authorized.
