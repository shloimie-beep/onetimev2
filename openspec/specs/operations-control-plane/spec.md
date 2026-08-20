# Operations Control Plane Specification

## Purpose

Keep repository execution durable, reviewable, and separate from product/provider
control planes.

## Requirements

### Requirement: GitHub execution truth

GitHub Issues/Projects and PRs SHALL be the task and execution truth. Historical
Boards and packets SHALL remain evidence only.

#### Scenario: A new task is started

- **WHEN** a contributor starts material work
- **THEN** the GitHub task and Draft PR define the branch/base/review record without
  creating another editable Markdown or YAML Board.

### Requirement: Safe repository operations

Work SHALL begin from the exact remote integration head. Contributors SHALL stage
explicit intended paths, avoid git add -A in the contaminated Windows checkout, and
preserve unrelated worktree changes.

#### Scenario: A local worktree is dirty

- **WHEN** local changes are discovered
- **THEN** they are inventoried and preserved before an isolated task worktree is
  created from the remote base.

### Requirement: Tooling provenance

OpenSpec and DESIGN.md tooling SHALL be exact pinned development dependencies, run
without OpenSpec telemetry, and be validated in repository checks.

#### Scenario: CI validates source truth

- **WHEN** source-truth validation runs
- **THEN** it verifies authority routing, required tracks, active skills, and the
  DESIGN.md lint result deterministically.
