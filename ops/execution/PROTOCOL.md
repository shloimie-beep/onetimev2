# One Time Resumable Execution Protocol

This repository uses `ops/execution/` for long-running Codex integration tasks that must be recoverable from a fresh window.

## Required Files Per Task

Each task folder must include:

- `ORIGINAL-PROMPT.md`
- `STATE.json`
- `INPUTS.json`
- `CHECKPOINT.md`
- `IMPLEMENTED.md`
- `REMAINING.md`
- `DECISIONS.md`
- `TEST-RESULTS.md`
- `INTEGRATION-MANIFEST.md`
- `RESUME.md`

## State Rules

- Update `STATE.json` after each phase, blocker, test run, commit, and push.
- Keep `external_mutation_counts` explicit.
- Do not store secrets, personal data, provider URLs, class links, raw database rows, production payloads, or raw destination values.
- A task may be `building`, `blocked`, `candidate`, `superseded`, or `closed`.
- `candidate` means only that the local branch has an integrated, tested candidate with recorded evidence. It is not deployment approval.

## Checkpoint Rules

- Commit the initial task packet before risky integration.
- Commit after every successful integration unit.
- If a unit fails, revert only the in-progress unit, record the blocker, commit the checkpoint, and continue independent units.
- Push only the active task branch unless the prompt explicitly says otherwise.

## Safety Rules

- Deployment requires a separate explicit authorization.
- Production/provider mutations require a separate explicit authorization.
- Test fixtures and mocks must remain default-off unless explicitly promoted by a later approved task.
