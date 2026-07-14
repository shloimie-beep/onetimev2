# Resume OT-67

You are resuming OT-67 from repository state, not chat history.

1. Treat the active directory as untrusted until you verify it is exactly `webcraft-media/onetimev2`.
2. Locate a clean checkout/worktree whose origin resolves to `webcraft-media/onetimev2`. Do not reset, clean, stash, or rewrite another worktree.
3. Fetch the recovery checkpoint branch `codex/recovery-blocked-ot61-ot70` and the intended integration/base branch `codex/crm-core-v1`.
4. Verify the recorded recovery base SHA `4ac288968ba24e30a5c3f8c6924f492eedf4338f` and confirm the recovery branch contains this packet.
5. Read every file under `ops/codex-runs/OT-67/` before implementing anything.
6. Resolve dependencies automatically from remote branches, accepted manifests, and repository evidence. Do not ask the operator for values that can be discovered safely from the repository.
7. Do not redo completed preservation work and do not fabricate missing prompt or attempt-report evidence.
8. Continue from `STATE.json.next_action`. If ORIGINAL-PROMPT.md says ORIGINAL_PROMPT_NOT_FOUND, stop implementation and locate a trusted prompt first.
9. Preserve, checkpoint, commit, and push task-owned evidence before any future stop.
10. External, production, provider, payment, access-grant, DNS, BNA, or irreversible actions still require exact natural-language authorization and task evidence.

## Structured Dependencies

```json
[
  {
    "name": "OT-60 convergence",
    "resolution": "discover_from_remote_branches_and_acceptance_manifests"
  },
  {
    "name": "OT-44 communications V1A",
    "resolution": "discover_from_remote_branches_and_acceptance_manifests"
  },
  {
    "name": "OT-50 delivery-provider truth",
    "resolution": "discover_from_remote_branches_and_acceptance_manifests"
  }
]
```

## Current Disposition

- Lifecycle: PRESERVED
- Disposition: PAUSED_SECURITY
- Next action: Resolve unresolved inputs and run OT-67 preflight gates.
