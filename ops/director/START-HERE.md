# One Time Director Start Here

This is a pointer-only entrypoint. It intentionally contains no copied status,
current SHA, PR, deployment ID, or provider-readiness claim.

## Read Order

1. `AGENTS.md`
2. `ops/goals/CURRENT.yaml`
3. The referenced `GOAL.md`
4. The referenced `SPEC.yaml`
5. The referenced `ACCEPTANCE.yaml`
6. The referenced `BOARD.yaml`
7. The referenced `DECISIONS.yaml`
8. `integrations/highlevel/registry/workflow-registry.yaml` for HighLevel
   automation desired state

## Authority Boundaries

- `BOARD.yaml` is the only current status map.
- `SPEC.yaml` contains requirements, `ACCEPTANCE.yaml` contains acceptance
  criteria, and `DECISIONS.yaml` contains durable choices. None is a second
  status map.
- `integrations/highlevel/registry/workflow-registry.yaml` is the single
  editable HighLevel automation inventory.
- `integrations/highlevel/workflows.yaml`,
  `integrations/highlevel/registry/current.json`, and
  `integrations/highlevel/registry/WORKFLOW-CONTROL-REPORT.md` are source-hashed
  generated projections and are read-only.
- PR descriptions, deployments, historical run packets, evidence files, and
  local worktrees are supporting records only. Follow their references back to
  the canonical goal and registry before acting.

## Safety

Do not infer deployment, provider, send, enrollment, payment, production, or
destructive authority from this file. Use the exact current Board track,
reviewed job, and approval gate.
