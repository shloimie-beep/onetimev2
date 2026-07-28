# AGENTS.md v2.1 Authority Replacement

This file is an exact patch instruction for C00. It is not a request to discard still-compatible repository engineering guidance.

## Required edit

At the first v2.1 bootstrap commit:

1. replace every paragraph that names the old launch Board, old acceptance files, old decisions, or old goal files as current status/source-of-truth;
2. insert the block below at the top of repository `AGENTS.md`, immediately after any repository-wide safety preamble;
3. retain existing architecture, code-quality, environment, and verification guidance only when it does not conflict with this block or the v2.1 package;
4. remove or rewrite instructions that tell agents to begin with `ops/goals/CURRENT.yaml`, an old Board, a v2.0 acceptance file, or the default `main` branch;
5. validate that a new Codex window reading only `AGENTS.md` reaches the v2.1 execution pack first.

## Exact authority block

```markdown
# One Time v2.1 current authority

The sole current product repository is `shloimie-beep/onetimev2`.

For One Time v2.1, authority is ordered:

1. `ops/v2.1-execution/source-spec/03-DECISION-REGISTER-v2.1.md`;
2. the remaining locked documents in `ops/v2.1-execution/source-spec/`, with
   `02-ACCEPTANCE-CONTRACT-v2.1.yaml` defining acceptance;
3. `ops/v2.1-execution/PACKAGE-LOCK.yaml` and `EXECUTION-CONTRACT.md`;
4. the assigned task packet and checksum-bound task context;
5. candidate-bound result records for status only.

The old launch Board, old acceptance IDs, old goal/current files, v2.0 drafts,
preview/demo/test-lane definitions, and historical handoffs are evidence only.
They may not define product behavior, completion status, or work priority.

The reviewed implementation baseline is commit `73dda293079f602c83929d1bbccb8dd5b9d1a455` on
`codex/one-time-launch-convergence-20260727` (PR #130). Do not branch v2.1 work from default `main` and
do not use a synthetic PR merge SHA. Every later task starts from the exact SHA
authorized on remote `codex/v21-control` in
`ops/v2.1-execution/control/READY-QUEUE.yaml`; never trust a stale worktree copy
of that queue.

Every Codex task is `START_OR_RESUME`. Its remote branch and committed files
under `ops/v2.1-execution/runtime/<TASK-ID>/` are durable memory. If their
digests match, resume `next_action`; do not repeat a repository-wide audit or
reconsider locked v2.1 decisions.

Only the control tower changes global execution ledgers. A worker changes only
its own branch state/handoff/result files and its assigned code scope. Shared
hotspots, migrations, generated registries, provider locks, and live effects
obey `WRITER-SCOPES.yaml`, `MERGE-PROTOCOL.md`, and
`EXTERNAL-AUTHORITY-MATRIX.yaml`.

No task is complete because code exists or a branch check passed. Release
completion requires every release-blocking acceptance case to pass against the
same immutable candidate. Each case must run only in one of its own allowed
environments from `ACCEPTANCE-ENVIRONMENT-MATRIX.yaml`; there is deliberately
no requirement that all cases share one environment. Release also requires zero
stale evidence, unexpected effects, unauthorized waivers, fictional fixtures,
exposed child data, raw Zoom or Vimeo bearers, Student GHL contacts, or
failed/untested/placeholder controls.
```
