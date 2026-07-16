#!/usr/bin/env bash
# OT-99: discover current remote branches, PRs, SHAs, reports, migrations, ancestry, and CI.
set -euo pipefail
umask 077

TASK_ID="OT-99"
PACKET_ID="OT-99-bcd34498"

require() {
  command -v "$1" >/dev/null 2>&1 || {
    printf '%s\n' "$TASK_ID missing required command: $1" >&2
    exit 69
  }
}

require git
require gh
require python3
require sha256sum

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  printf '%s\n' "$TASK_ID must run inside the One Time git repository" >&2
  exit 64
}

gh auth status >/dev/null 2>&1 || {
  printf '%s\n' "$TASK_ID requires authenticated gh access to inspect private PRs, reports, and CI" >&2
  exit 77
}

state_dir="${OT99_STATE_DIR:-}"
if [[ -z "$state_dir" ]]; then
  state_dir="$("$(dirname "${BASH_SOURCE[0]}")/OT-99-persist-task-state.sh")"
fi
mkdir -p "$state_dir/raw" "$state_dir/discovery"

git -C "$repo_root" fetch --all --prune --tags
: > "$state_dir/raw/special-pr-fetch.txt"
for pr_number in 24 25; do
  if git -C "$repo_root" fetch origin "pull/$pr_number/head:refs/remotes/origin/ot-99-pr-$pr_number" >> "$state_dir/raw/special-pr-fetch.txt" 2>&1; then
    printf '%s\n' "$TASK_ID fetched pull request #$pr_number head" >> "$state_dir/raw/special-pr-fetch.txt"
  else
    printf '%s\n' "$TASK_ID could not fetch pull request #$pr_number head; GitHub API metadata will still be recorded" >> "$state_dir/raw/special-pr-fetch.txt"
  fi
done

gh repo view --json nameWithOwner,url,defaultBranchRef > "$state_dir/raw/gh-repo.json"
gh pr list --state all --limit 500 \
  --json number,title,body,headRefName,headRefOid,baseRefName,state,isDraft,mergedAt,updatedAt,url,mergeCommit \
  > "$state_dir/raw/gh-prs.json"

git -C "$repo_root" for-each-ref \
  --format='%(refname)%09%(refname:short)%09%(objectname)%09%(committerdate:iso8601-strict)%09%(subject)' \
  refs/remotes > "$state_dir/raw/remote-refs.tsv"

python3 "$(dirname "${BASH_SOURCE[0]}")/OT-99-discover-remote-state.py" \
  --repo-root "$repo_root" \
  --state-dir "$state_dir" \
  --repo-json "$state_dir/raw/gh-repo.json" \
  --prs-json "$state_dir/raw/gh-prs.json" \
  --refs-tsv "$state_dir/raw/remote-refs.tsv" \
  > "$state_dir/raw/discovery-run.stdout"

(
  cd "$state_dir"
  find . -type f ! -name 'SHA256SUMS.txt' -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS.txt
)

chmod -R a-w "$state_dir"
printf '%s\n' "$state_dir/discovery/OT-99-remote-discovery.json"
