# One Time Authority and Historical Evidence Index

**Established:** 2026-08-20
**Scope:** Repository authority only; this file makes no deployment, provider, or
operator-acceptance claim.

## Current authority

1. Explicit operator authorization and the linked GitHub Issue/Project/PR establish
   the current execution scope and exact integration base.
2. AGENTS.md is the stable repository constitution and routing guide.
3. openspec/specs/ holds current product and operations requirements.
4. DESIGN.md holds the durable visual contract, derived from the existing brand
   manifest at packages/brand-system/manifest/one-time-brand.v1.json.
5. GitHub Issues/Projects and PRs are task and execution truth. They replace the
   old editable Board as the active work queue.

## Tooling provenance

- OpenSpec is pinned as development dependency @fission-ai/openspec 1.10.0 from
  Fission-AI/OpenSpec, MIT licensed, requiring Node >=20.19.0. Repository commands
  use scripts/ops/run-openspec.mjs with OPENSPEC_TELEMETRY=0 and DO_NOT_TRACK=1.
  Its published Zod 4.4.3 transitive artifact is currently missing a locale module,
  so the package lock uses the narrow @fission-ai/openspec-only Zod 4.4.2 override;
  this compatible MIT dependency is exercised by the CLI check.
- DESIGN.md is pinned as development dependency @google/design.md 0.4.0 from
  google-labs-code/design.md, Apache-2.0 licensed, requiring Node >=18.0.0. Its
  deterministic lint validates the repository DESIGN.md on every source-truth check.

## Historical evidence only

The following are retained because they document past decisions, checks, or incidents.
They are not current release instructions, deployment truth, task queues, or provider
authority:

- ops/goals/**/BOARD.yaml, ops/goals/CURRENT.yaml, task packets, claim/lease
  records, and handoffs;
- ops/v2.1-execution/** source packages, runtime records, and result artifacts;
- dated material in ops/launch/, including deployment snapshots and acceptance
  reports;
- ops/execution-windows/**, ops/codex-runs/**, and preserved evidence folders;
- generated GHL projections and provider readbacks, which remain evidence unless an
  explicitly authorized provider-scoped task reconciles them.

## Superseded emergency launch scope

CURRENT-LAUNCH-HANDOFF.md, ONE-TIME-FULL-LAUNCH-STATUS.md, and
ONE-TIME-FULL-LAUNCH-EXECPLAN.md retain historical emergency-launch context. Their
older dates, PR/source references, deployment claims, launch clock, worker routing,
and provider instructions are not active. Their pointer headers preserve them as
evidence and route current work here, then to OpenSpec and GitHub.

## Retired authority mechanisms

The one-time-goal-executor agent skill and its conductor/Board/claim/lease/handoff
workflow are archived from active discovery. The GHL skill remains active only as a
provider-scoped safety procedure; it does not route normal application work.

## How to use history safely

Read historical material only when a current issue, spec, or PR needs a narrow fact.
Verify it against the exact remote source, current tests, and current provider scope.
Do not promote a historical claim to DEPLOYED or OPERATOR ACCEPTED without the current
exact source and the required real operator-visible journey.
