# HighLevel Agent Mode

This is a pointer-only execution entrypoint, not a queue or status document.

## Read Order

1. `ops/goals/CURRENT.yaml`
2. The referenced goal files, with `BOARD.yaml` as the only current status map
3. `.agents/skills/one-time-ghl-ui-job/SKILL.md`
4. `integrations/highlevel/registry/workflow-registry.yaml`
5. The source-hashed generated projections:
   - `integrations/highlevel/workflows.yaml`
   - `integrations/highlevel/registry/current.json`
   - `integrations/highlevel/registry/WORKFLOW-CONTROL-REPORT.md`
6. The exact reviewed job assigned by the current Board track

## Execution Boundary

- `workflow-registry.yaml` is the single editable automation inventory.
- Generated projections and this README are never edited as status.
- Do not run jobs by filename order or from a historical PR description,
  deployment, or generated queue.
- Every mutation requires one exact reviewed job with asset kind, canonical
  key/ID/path, allowed operations, send/publish/enrollment authority, bounded
  test scope, and expected sanitized result path.
- Default to no send, no publish, no activation, no enrollment, no payment, and
  no destructive action.
- Close permitted work through save, navigate/reload, reopen/readback, bounded
  authorized canary, sanitized result, and drift validation.
- Agent Mode returns sanitized evidence. Codex alone reconciles canonical Git
  state, source-hashed projections, and Board status.
