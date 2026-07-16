#!/usr/bin/env bash
# OT-99: persist immutable pre-edit repository state without exposing secrets.
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
require python3
require sha256sum

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  printf '%s\n' "$TASK_ID must run inside the One Time git repository" >&2
  exit 64
}

utc_stamp="$(date -u +%Y%m%dT%H%M%SZ)"
head_sha="$(git -C "$repo_root" rev-parse HEAD)"
state_nonce="$(python3 -c 'import secrets; print(secrets.token_hex(4))')"
state_base="${OT99_STATE_ROOT:-${XDG_STATE_HOME:-$HOME/.local/state}/OT-99}"
state_dir="$state_base/${utc_stamp}-${head_sha:0:12}-${state_nonce}"
mkdir -p "$state_base"
mkdir "$state_dir"
mkdir "$state_dir/raw"

sanitize_url() {
  python3 - "$1" <<'PY'
import re
import sys
value = sys.argv[1]
value = re.sub(r'^(https?://)[^/@]+@', r'\1', value)
value = re.sub(r'([?&](?:access_token|token|key|secret)=)[^&]+', r'\1REDACTED', value, flags=re.I)
print(value)
PY
}

origin_url="$(git -C "$repo_root" remote get-url origin 2>/dev/null || true)"
safe_origin="$(sanitize_url "$origin_url")"
current_branch="$(git -C "$repo_root" branch --show-current)"

git -C "$repo_root" status --porcelain=v2 --branch > "$state_dir/raw/git-status.txt"
git -C "$repo_root" remote -v | while IFS= read -r line; do sanitize_url "$line"; done > "$state_dir/raw/git-remotes.txt"
git -C "$repo_root" for-each-ref --format='%(refname)%09%(objectname)%09%(committerdate:iso8601-strict)%09%(subject)' refs/heads refs/remotes refs/tags > "$state_dir/raw/git-refs.tsv"
git -C "$repo_root" log --decorate=full --date=iso-strict --format='%H%x09%P%x09%aI%x09%cI%x09%D%x09%s' -n 300 > "$state_dir/raw/git-log.tsv"
git -C "$repo_root" diff --stat > "$state_dir/raw/worktree-diff-stat.txt"
git -C "$repo_root" diff --cached --stat > "$state_dir/raw/index-diff-stat.txt"
git -C "$repo_root" ls-files --modified --others --exclude-standard > "$state_dir/raw/changed-and-untracked-files.txt"

{
  for tool in git gh node npm pnpm yarn python3 docker podman psql; do
    if command -v "$tool" >/dev/null 2>&1; then
      first_line="$($tool --version 2>&1 | head -n 1 || true)"
      printf '%s\t%s\n' "$tool" "$first_line"
    else
      printf '%s\t%s\n' "$tool" "NOT_INSTALLED"
    fi
  done
} > "$state_dir/raw/tool-versions.tsv"

packet_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$state_dir/packet"
cp -a "$packet_root"/. "$state_dir/packet/"
if [[ -f "$packet_root/SHA256SUMS.txt" ]]; then
  cp "$packet_root/SHA256SUMS.txt" "$state_dir/raw/packet-SHA256SUMS.txt"
fi

python3 - "$state_dir/OT-99-initial-state.json" <<PY
import json
from pathlib import Path

data = {
  "task_id": "$TASK_ID",
  "packet_id": "$PACKET_ID",
  "captured_at_utc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "repository_root": str(Path(r"$repo_root").resolve()),
  "origin_url_redacted": r"$safe_origin",
  "branch": r"$current_branch",
  "head_sha": "$head_sha",
  "state_directory": str(Path(r"$state_dir").resolve()),
  "secret_scan_status": "not_run",
  "copy_to_repository_requires_redaction": True,
  "integration_edits_started": False,
}
Path(r"$state_dir/OT-99-initial-state.json").write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
PY

(
  cd "$state_dir"
  find . -type f ! -name 'SHA256SUMS.txt' -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS.txt
)

printf '%s\n' "$state_dir"
