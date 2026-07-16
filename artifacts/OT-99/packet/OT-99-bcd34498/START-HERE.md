# OT-99 — Start Here

This packet is the execution contract for `OT-99` (`OT-99-bcd34498`). Supply `CODEX-PROMPT.md` to Codex from the root of the One Time repository and keep the packet files available for reference.

## OT-99 execution order

1. Read `CODEX-PROMPT.md`, every `OT-99` matrix, both `OT-99` schemas, and both `OT-99` evidence contracts before changing repository files.
2. Run `runtime/OT-99-persist-task-state.sh` from the existing repository checkout. It writes the immutable pre-edit state outside the worktree and prints the state directory.
3. Export the printed directory as `OT99_STATE_DIR`, then run `runtime/OT-99-discover-remote-state.sh`. The discovery pass fetches current remotes and records branches, pull requests, SHAs, reports, migrations, ancestry, and CI.
4. Stop before integration edits unless remote branch and report evidence for `OT-83R`, `OT-88`, and `OT-89A` is inspectable. `OT-83R` must have a semantically reviewed completion report.
5. Create the clean `OT-99` integration worktree from the selected completed `OT-83R` SHA. Do not branch from `main` merely because it is the default branch.
6. Execute the dependency, semantic collision, migration, staging, canary, and rollback matrices. Record every decision under `artifacts/OT-99/`.
7. Open one clean draft pull request for the exact integrated SHA. Deploy that exact SHA only when isolated One Time staging authorization is present and proven.
8. Run provider-off synthetic journeys first. Run protected provider canaries only with separate authorization for each canary.
9. Produce `artifacts/OT-99/release-manifest.json` conforming to `schemas/OT-99-release-manifest.schema.json` and `artifacts/OT-99/FINAL-REPORT.md` conforming to `docs/OT-99-final-report-contract.md`.

## OT-99 fail-closed rules

A launched prompt, queued job, opened pull request, green partial test, or successful command invocation is not completion evidence. Completion requires inspecting the resulting remote state, exact SHA, reports, CI, test artifacts, deployment evidence, and canary evidence.

Missing credentials or authorization must become an honest readiness state such as `blocked`, `not_run`, or `not_configured`. They must not be converted into fake pass states or generic task failure.

Landing, signup, CRM, and portals must remain usable while every external provider is disabled or unavailable.
