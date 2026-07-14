# OT-64 Commands

## Registrar Commands

- `gh repo clone webcraft-media/onetimev2 <fresh-recovery-worktree>`
- `git cat-file -t 4ac288968ba24e30a5c3f8c6924f492eedf4338f`
- `git ls-remote --heads origin codex/recovery-blocked-ot61-ot70 codex/crm-core-v1`
- `git switch --detach 4ac288968ba24e30a5c3f8c6924f492eedf4338f`
- `git switch -c codex/recovery-blocked-ot61-ot70`
- `rg -l ... <allowed-discovery-roots>`

## Future Resume Commands

- `git fetch origin codex/recovery-blocked-ot61-ot70 codex/crm-core-v1 --prune`
- `git switch --create <task-owned-branch> --track origin/<approved-base-branch>` only after task preflight gates pass.
- Run task-specific tests listed by the future implementation prompt; this recovery packet does not authorize product tests as proof of implementation.
