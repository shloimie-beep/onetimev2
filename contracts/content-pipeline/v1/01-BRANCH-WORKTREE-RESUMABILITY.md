# Branch, worktree, and resumability contract

## Remote base resolution

- Fetch all remotes with pruning.
- Find refs matching `refs/remotes/*/codex/ot83-household-portals-foundation`.
- Exactly one match is required. The segment after `refs/remotes/` and before `/codex/` is the selected remote.
- Record the full base ref and peeled commit SHA in `RUN.json` before edits.
- Never substitute a similarly named local branch, default branch, tag, or stale reflog entry.

## Target branch and worktree

- Target branch: `codex/ot86a-vimeo-content-kb`.
- Worktree directory name: `OT-86A` under `${OT86_WORKTREE_ROOT}` when set; otherwise under `.ot86-worktrees` in the parent directory of the primary repository root.
- If the selected remote already has the target branch, use that remote branch as the resumable head.
- If only a local target branch exists, it is reusable only when the resolved base SHA is an ancestor.
- Never force-reset a reusable branch to the base SHA.
- Never delete, clean, stash, or overwrite an existing worktree.
- A dirty target worktree is a hard stop because its changes may belong to another run.

## Persistent run ledger

`ops/codex-runs/OT-86A/RUN.json` is rewritten atomically after each major step. It must contain:

```json
{
  "packet_id": "OT-86A",
  "status": "in_progress",
  "branch": "codex/ot86a-vimeo-content-kb",
  "base_remote": "the uniquely resolved remote name",
  "base_ref": "the uniquely resolved remote ref",
  "base_sha": "a 40-character commit SHA",
  "worktree": "an absolute path",
  "started_at": "an ISO-8601 UTC timestamp",
  "finished_at": null,
  "head_sha": null,
  "completed_steps": [],
  "commands": [],
  "checkpoint": null,
  "pr_url": null
}
```

The explanatory strings above describe required runtime values; they are not literal values to commit. The completed report must contain actual discovered values.

Major step ids are exactly:

`preflight`, `discovery`, `owned_roots`, `migrations`, `content_state_machine`, `vimeo_adapter`, `transcription_parsing`, `approval_versioning`, `publish_handoff`, `one_time_library`, `student_retrieval`, `social_event`, `security_tests`, `performance_tests`, `reports`, `commit`, `push`, `pull_request`.

On resume, inspect the current commit, working tree, migration ledger, and reports. Re-run the validation for a completed step before trusting it. Continue from the earliest incomplete or invalid step. Never duplicate a migration, outbox message, fixture, or PR.

## Failure behavior

On any hard failure:

- update `RUN.json` to `failed` with a typed failure category and the failed command's exit code;
- preserve the worktree and evidence;
- do not push a knowingly failing branch unless the failure is solely the permitted Vimeo external-readiness checkpoint and all offline gates passed;
- never claim success based only on file creation.
