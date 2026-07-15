# Branch, remote prerequisite, worktree, and resumability contract

## Hard remote prerequisite

- Run `git fetch --all --prune` before branch creation.
- Find `refs/remotes/*/codex/ot86a-vimeo-content-kb`.
- Exactly one remote ref must exist.
- Zero matches means OT-86B must not run: create no branch, worktree, migration, report, commit, or PR.
- Multiple matches are ambiguous and also a hard stop.
- The peeled SHA of the unique remote ref is the OT-86B base.

## Target

- Branch: `codex/ot86b-buffer-social`.
- Worktree: directory `OT-86B` under `${OT86_WORKTREE_ROOT}` when set, otherwise `.ot86-worktrees` in the parent directory of the primary repository root.
- If the remote target branch exists, resume it after verifying ancestry from the resolved OT-86A SHA.
- A local-only target branch may be resumed only when the resolved OT-86A SHA is an ancestor and its dedicated worktree is clean.
- Never reset, clean, delete, overwrite, or stash an existing worktree.

## Run ledger

After the remote precondition and clean worktree succeed, atomically create/update `ops/codex-runs/OT-86B/RUN.json` with actual values and these major step ids:

`preflight`, `discovery`, `owned_roots`, `migrations`, `event_inbox`, `draft_model`, `renderers_previews`, `approval_schedule`, `buffer_adapter`, `scheduler_publish`, `correction_retraction`, `security_tests`, `performance_tests`, `ot86a_regression`, `reports`, `commit`, `push`, `pull_request`.

Required top-level fields match OT-86A's ledger, with `packet_id=OT-86B`, `branch=codex/ot86b-buffer-social`, and a `base_branch=codex/ot86a-vimeo-content-kb` field.

On resume, verify each completed step against current code and reports before continuing. Do not duplicate migrations, event receipts, draft revisions, publish commands, provider posts, commits, or PRs.

## Push and PR failures

Code is not `completed` until push and PR creation/reuse succeed. A provider-account checkpoint is permitted; a missing OT-86A remote, failing test, failing migration, privacy gap, auto-publish path, or push failure is not.
