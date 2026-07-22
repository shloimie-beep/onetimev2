---
name: one-time-goal-executor
description: Execute or review one conductor-assigned track from the canonical One Time goal system. Use for One Time goal, board, track, handoff, acceptance, ramble, staging-convergence, or evidence work where agents must share one Git-backed status model.
---

# One Time goal executor

## Required intake order

1. Read `ops/goals/CURRENT.yaml`.
2. Immediately read the referenced `GOAL.md`.
3. Read the referenced `SPEC.yaml`, `ACCEPTANCE.yaml`, `BOARD.yaml`, and `DECISIONS.yaml` completely.
4. If the input is an operator voice note or ramble, also read `RAMBLE-PROTOCOL.md`.
5. If a conductor assigned a track, read that track's `handoff_path` schema/template when it exists.

Stop if CURRENT points to missing/conflicting goal files. Do not invent a replacement status document, shadow board, or second canonical domain model.

## Assignment boundary

- The persistent-staging conductor assigns exactly one unclaimed/eligible track before dispatch.
- A non-conductor verifies that `BOARD.yaml` names its `task_id`, repository, branch/PR, system, write scope, dependencies, and acceptance IDs.
- If assignment is absent or mismatched, return a proposed assignment to the conductor. Do not claim a track.
- A non-conductor never edits `BOARD.yaml`. It writes only its stable sanitized handoff at `handoffs/<track-id>--<task-id>.json`.
- Only the conductor reads handoffs and updates BOARD evidence, blocker, remaining work, and next action.

## Execute one track

1. Restate the assigned acceptance IDs and forbidden behavior.
2. Inspect existing contracts, schemas, outboxes, provider adapters, and registry keys before adding anything.
3. Work only in the assigned `write_scope`. Reuse the canonical model and delivery path.
4. Treat pending tests, deployment, reseed, or readback as `remaining_work`, not a blocker.
5. If one sub-capability is blocked, record the exact dependency/authority/technical impasse and continue independent safe acceptance work in the same track.
6. Never infer provider readiness, customer-send authority, or completion from a feature flag, saved draft, believable fixture, or partial readback.
7. Produce objective evidence named by ACCEPTANCE: tests, route/browser proof, DB/provider readback, sanitized IDs/status, checksums, and negative cases.

## HighLevel control boundary

For a HighLevel track, also read `integrations/highlevel/workflows.yaml`, `integrations/highlevel/registry/workflow-registry.yaml`, the generated `WORKFLOW-CONTROL-REPORT.md`, and the assigned reviewed job/result. GitHub is canonical desired state; provider UI is observed evidence. Reuse the existing workflow control fields and states; never create a shadow dashboard or status model.

Require the closed loop: reviewed Git-authored job -> permitted browser change -> save -> navigate/reload -> reopen/readback -> bounded authorized canary -> sanitized result committed -> drift validator. Report unknown workflows and fail closed. Dependency-check before any separately authorized move to `99 - Deprecated`; never silently delete. Activation, broad sends, payments, and destructive actions require exact authority.

## Visual execution

For UI work, translate operator visual intent into exact route and breakpoint acceptance. Inspect current page state and screenshots first; repair obvious in-scope violations, retest every recorded breakpoint, and verify the deployed URL/head when deployment is assigned. Ask only for a genuine product choice, not routine implementation judgment.

## Handoff contract

Return machine-readable JSON containing:

- `schema_version`, `goal_id`, `track_id`, `task_id`;
- structured `owner` and exact `write_scope`;
- `result` with no broader completion claim than the evidence;
- `acceptance_results` keyed by acceptance ID;
- sanitized `evidence` paths/references;
- `remaining_work`;
- one exact `blocker` or `null`;
- `sanitized_at`.

Never include credentials, provider secrets, private destinations, customer/Student data, raw email/message copy, bearer tokens, or replayable links. Reports link to BOARD; they do not copy mutable heads/status into competing files.
