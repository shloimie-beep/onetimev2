# P29 Corrected-Binding Atomic Claim Handoff

## Identity

- Branch: `codex/v21-p29-core-workflows`
- Authorized integration start: `49431959f58f284bdc13ca931acf09f980fc483a`
- Exact correction parent and expected existing head:
  `d5c779caa1859ef308fa009e6558076cf2031771`
- Prior implementation: `0a42c8701d75d2a15e59c5e7a2f4a3e5d7fb0d18`
- Prior ready-for-review head:
  `15dc7c87948c3df9dc6c77be89c79b706860448f`
- Correction claim: `308031d1-15e8-4ff5-aca0-6560e9a8c93d`
- Writer: `codex-p29-worker-308031d1`
- Control authorization:
  `0c911664217efe3dbb89b93b6fe29eb9eda2fec3`
- Ready-entry parent control:
  `e54ea923a743caf760ef47638a2c8d8a875faf34`
- Ready-entry digest:
  `634d4c807f31e08fd411457021d1bec960d70764cbe88b3c8339111a283455c2`
- GHL_CORE_WORKFLOWS lease:
  `8f82be8b-7a99-4edb-a079-d485b402729a`
- Lease issued: `2026-07-29T00:13:59Z`
- Lease expires: `2026-07-29T01:13:59Z`
- External effects: authority none; attempted 0; succeeded 0; reconciled 0

## This checkpoint

This commit is only the corrected-binding atomic P29 correction claim. The exact
`resume_existing_branch` entry, expected remote head, canonical payload digest,
task/package/dependency bindings, unexpired sole writer lease, and zero effect
locks were verified. Only `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`
change.

The completed repair was preserved without loss in named stash
`P29 product repair pending C00 reconciliation claim 308031d1`. No product,
workflow fragment, test, steward request, migration, interface, registry,
composer, provider, deployment, or external-effect change is included.

## Exact next action

Push this corrected-binding atomic correction claim checkpoint and stop. The
preserved product repair may be restored only after C00 observes and reconciles
claim `308031d1-15e8-4ff5-aca0-6560e9a8c93d` against the pushed checkpoint and
explicitly resumes P29.

## Pending correction

Do not restore the named product-repair stash until a post-reconciliation
continuation is explicitly authorized.
