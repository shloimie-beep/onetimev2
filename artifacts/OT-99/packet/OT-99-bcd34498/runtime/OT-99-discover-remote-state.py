#!/usr/bin/env python3
"""OT-99 runtime discovery of branches, PRs, reports, migrations, ancestry, and CI."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

TASK_ID = "OT-99"
PACKET_ID = "OT-99-bcd34498"
TASKS = [
    "OT-81", "OT-82", "OT-83", "OT-83R", "OT-84", "OT-85",
    "OT-86A", "OT-86B", "OT-87", "OT-88", "OT-89A", "OT-89B",
]
REQUIRED_INSPECTION = ["OT-83R", "OT-88", "OT-89A"]
DEPENDENCIES = {
    "OT-83": "OT-81",
    "OT-83R": "OT-83",
    "OT-84": "OT-83R",
    "OT-88": "OT-84",
    "OT-89A": "OT-84",
    "OT-85": "OT-83R",
    "OT-86A": "OT-83R",
    "OT-86B": "OT-86A",
    "OT-87": "OT-83R",
}
REPORT_WORDS = re.compile(r"(?:final|completion|complete|checkpoint|handoff|evidence|report|status)", re.I)
MIGRATION_WORDS = re.compile(r"(?:migration|migrations|alembic|prisma|flyway|liquibase|db/migrate|database)", re.I)


class DiscoveryError(RuntimeError):
    pass


def run(cmd: list[str], cwd: Path, check: bool = True) -> subprocess.CompletedProcess[str]:
    proc = subprocess.run(cmd, cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if check and proc.returncode != 0:
        raise DiscoveryError(f"command failed ({proc.returncode}): {' '.join(cmd)}\n{proc.stderr.strip()}")
    return proc


def gh_json(args: list[str], cwd: Path) -> tuple[Any | None, str | None]:
    proc = run(["gh", *args], cwd=cwd, check=False)
    if proc.returncode != 0:
        return None, proc.stderr.strip() or f"gh exited {proc.returncode}"
    try:
        return json.loads(proc.stdout), None
    except json.JSONDecodeError as exc:
        return None, f"invalid gh JSON: {exc}"


def mentions_task(value: str, task: str) -> bool:
    match = re.fullmatch(r"OT-(\d+)([A-Z]*)", task.upper())
    if not match:
        raise ValueError(f"invalid OT-99 task token: {task}")
    number, suffix = match.groups()
    suffix_pattern = "".join(r"[\s._/-]*" + re.escape(char) for char in suffix)
    pattern = re.compile(
        rf"(?<![A-Z0-9])OT[\s._/-]*{re.escape(number)}{suffix_pattern}(?![A-Z0-9])",
        re.I,
    )
    return bool(pattern.search(value))


def file_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def parse_refs(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        parts = line.split("\t", 4)
        if len(parts) < 5:
            continue
        full, short, sha, date, subject = parts
        if short.endswith("/HEAD"):
            continue
        rows.append({"ref": full, "short": short, "sha": sha, "committer_date": date, "subject": subject})
    return rows


def git_text(repo: Path, *args: str, check: bool = True) -> str:
    return run(["git", *args], cwd=repo, check=check).stdout


def list_tree(repo: Path, sha: str) -> list[str]:
    proc = run(["git", "ls-tree", "-r", "--name-only", sha], cwd=repo, check=False)
    if proc.returncode != 0:
        return []
    return [line for line in proc.stdout.splitlines() if line]


def show_file(repo: Path, sha: str, path: str) -> bytes | None:
    proc = subprocess.run(["git", "show", f"{sha}:{path}"], cwd=repo, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        return None
    return proc.stdout


def commit_mentions(repo: Path, sha: str, task: str) -> list[str]:
    proc = run(
        ["git", "log", "-n", "120", "--format=%H%x09%s%x09%b%x1e", sha],
        cwd=repo,
        check=False,
    )
    if proc.returncode != 0:
        return []
    matches: list[str] = []
    for record in proc.stdout.split("\x1e"):
        if mentions_task(record, task):
            first = record.strip().splitlines()[0] if record.strip() else ""
            if first:
                matches.append(first[:500])
    return matches[:20]


def report_entries(repo: Path, sha: str, task: str, paths: Iterable[str]) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    for path in paths:
        lower = path.lower()
        filename_match = mentions_task(path, task) and REPORT_WORDS.search(path)
        likely_report = REPORT_WORDS.search(path) and lower.endswith((".md", ".txt", ".json", ".yaml", ".yml"))
        if not filename_match and not likely_report:
            continue
        data = show_file(repo, sha, path)
        if data is None:
            continue
        text = data.decode("utf-8", errors="replace")
        if not filename_match and not mentions_task(text[:250_000], task):
            continue
        completion_terms = sorted(set(re.findall(r"\b(?:complete|completed|ready|passed|done)\b", text, re.I)))
        blocker_terms = sorted(set(re.findall(r"\b(?:blocked|incomplete|partial|failed|pending|missing)\b", text, re.I)))
        selected.append({
            "path": path,
            "sha256": file_sha256(data),
            "bytes_examined": len(data),
            "completion_terms": completion_terms,
            "blocker_terms": blocker_terms,
            "semantic_review_required": True,
        })
    return selected[:30]


def migration_entries(paths: Iterable[str]) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for path in paths:
        if not MIGRATION_WORDS.search(path):
            continue
        name = Path(path).name
        prefix = None
        match = re.match(r"^(\d+)[_-]", name)
        if match:
            prefix = int(match.group(1))
        entries.append({"path": path, "numeric_prefix": prefix})
    return entries


def diff_entries(repo: Path, base_sha: str | None, head_sha: str) -> list[dict[str, Any]]:
    if not base_sha:
        return []
    proc = run(
        ["git", "diff", "--name-status", "--find-renames", f"{base_sha}...{head_sha}"],
        cwd=repo,
        check=False,
    )
    if proc.returncode != 0:
        return []
    entries: list[dict[str, Any]] = []
    for line in proc.stdout.splitlines():
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        status = parts[0]
        if status.startswith("R") and len(parts) >= 3:
            entries.append({"status": status, "old_path": parts[1], "path": parts[2]})
        else:
            entries.append({"status": status, "path": parts[1]})
    return entries


def ancestry(repo: Path, sha: str, refs: dict[str, str]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for label, other in refs.items():
        proc = run(["git", "merge-base", "--is-ancestor", sha, other], cwd=repo, check=False)
        reverse = run(["git", "merge-base", "--is-ancestor", other, sha], cwd=repo, check=False)
        merge_base = run(["git", "merge-base", sha, other], cwd=repo, check=False)
        result[label] = {
            "candidate_is_ancestor": proc.returncode == 0,
            "reference_is_ancestor": reverse.returncode == 0,
            "merge_base": merge_base.stdout.strip() if merge_base.returncode == 0 else None,
        }
    return result


def ci_snapshot(repo: Path, repo_name: str, sha: str) -> dict[str, Any]:
    checks, checks_error = gh_json(["api", f"repos/{repo_name}/commits/{sha}/check-runs?per_page=100"], repo)
    status, status_error = gh_json(["api", f"repos/{repo_name}/commits/{sha}/status"], repo)
    runs, runs_error = gh_json(["api", f"repos/{repo_name}/actions/runs?head_sha={sha}&per_page=100"], repo)
    return {
        "check_runs": checks,
        "combined_status": status,
        "workflow_runs": runs,
        "errors": [e for e in [checks_error, status_error, runs_error] if e],
        "inspectable": checks is not None or status is not None or runs is not None,
    }


def candidate_score(task: str, branch: dict[str, str], prs: list[dict[str, Any]], commit_hits: list[str], reports: list[dict[str, Any]]) -> tuple[int, list[str], list[dict[str, Any]]]:
    score = 0
    reasons: list[str] = []
    branch_prs: list[dict[str, Any]] = []
    if mentions_task(branch["short"], task):
        score += 70
        reasons.append("task token in remote branch name")
    if mentions_task(branch.get("subject", ""), task):
        score += 15
        reasons.append("task token in remote head subject")
    for pr in prs:
        pr_head = str(pr.get("headRefName") or "")
        same_head = pr.get("headRefOid") == branch["sha"] or pr_head in {branch["short"], branch["short"].split("/", 1)[-1]}
        if same_head:
            branch_prs.append(pr)
        text = " ".join(str(pr.get(k) or "") for k in ["title", "body", "headRefName"])
        if same_head and mentions_task(text, task):
            score += 60
            reasons.append(f"task token in PR #{pr.get('number')}")
    if commit_hits:
        score += min(25, 5 * len(commit_hits))
        reasons.append("task token in reachable commit history")
    if reports:
        score += 40
        reasons.append("inspectable report at remote head")
    return score, sorted(set(reasons)), branch_prs


def main() -> int:
    parser = argparse.ArgumentParser(description="OT-99 remote state discovery")
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--state-dir", required=True)
    parser.add_argument("--repo-json", required=True)
    parser.add_argument("--prs-json", required=True)
    parser.add_argument("--refs-tsv", required=True)
    args = parser.parse_args()

    repo = Path(args.repo_root).resolve()
    state_dir = Path(args.state_dir).resolve()
    out_dir = state_dir / "discovery"
    out_dir.mkdir(parents=True, exist_ok=True)

    repo_info = read_json(Path(args.repo_json))
    repo_name = repo_info["nameWithOwner"]
    default_branch = (repo_info.get("defaultBranchRef") or {}).get("name") or "main"
    prs = read_json(Path(args.prs_json))
    refs = parse_refs(Path(args.refs_tsv))

    ref_lookup: dict[str, str] = {}
    for ref in refs:
        ref_lookup[ref["short"]] = ref["sha"]
    default_remote_candidates = [k for k in ref_lookup if k.endswith("/" + default_branch)]
    default_remote_candidates.sort(key=lambda name: (not name.startswith("origin/"), name))
    default_sha = ref_lookup[default_remote_candidates[0]] if default_remote_candidates else None

    def resolve_branch_sha(branch_name: str | None) -> tuple[str | None, str | None]:
        if not branch_name:
            return None, None
        matches = [name for name in ref_lookup if name == branch_name or name.endswith("/" + branch_name)]
        matches.sort(key=lambda name: (not name.startswith("origin/"), name))
        if not matches:
            return branch_name, None
        return matches[0], ref_lookup[matches[0]]

    all_candidates: dict[str, list[dict[str, Any]]] = {task: [] for task in TASKS}
    ci_cache: dict[str, dict[str, Any]] = {}

    for branch in refs:
        paths = list_tree(repo, branch["sha"])
        for task in TASKS:
            pr_likely = any(
                (
                    pr.get("headRefOid") == branch["sha"]
                    or str(pr.get("headRefName") or "") in {branch["short"], branch["short"].split("/", 1)[-1]}
                )
                and mentions_task(" ".join(str(pr.get(k) or "") for k in ["title", "body", "headRefName"]), task)
                for pr in prs
            )
            likely = mentions_task(branch["short"], task) or mentions_task(branch.get("subject", ""), task) or pr_likely
            commit_hits = commit_mentions(repo, branch["sha"], task) if likely else []
            reports = report_entries(repo, branch["sha"], task, paths) if likely or commit_hits else []
            score, reasons, branch_prs = candidate_score(task, branch, prs, commit_hits, reports)
            if score < 20:
                continue
            if branch["sha"] not in ci_cache:
                ci_cache[branch["sha"]] = ci_snapshot(repo, repo_name, branch["sha"])
            task_prs = [
                pr for pr in branch_prs
                if mentions_task(" ".join(str(pr.get(k) or "") for k in ["title", "body", "headRefName"]), task)
            ]
            selected_pr = task_prs[0] if task_prs else (branch_prs[0] if branch_prs else None)
            requested_base = selected_pr.get("baseRefName") if selected_pr else None
            resolved_base_ref, resolved_base_sha = resolve_branch_sha(requested_base)
            diff_basis_kind = "pull_request_base"
            if not resolved_base_sha:
                resolved_base_ref, resolved_base_sha = default_branch, default_sha
                diff_basis_kind = "default_branch_fallback"
            changes = diff_entries(repo, resolved_base_sha, branch["sha"])
            changed_paths = [entry["path"] for entry in changes]
            candidate = {
                "remote_ref": branch["ref"],
                "remote_branch": branch["short"],
                "head_sha": branch["sha"],
                "committer_date": branch["committer_date"],
                "head_subject": branch["subject"],
                "score": score,
                "score_reasons": reasons,
                "matching_commits": commit_hits,
                "pull_requests": branch_prs,
                "reports": reports,
                "diff_basis": {
                    "kind": diff_basis_kind,
                    "requested_base_ref": requested_base,
                    "resolved_base_ref": resolved_base_ref,
                    "resolved_base_sha": resolved_base_sha,
                },
                "changed_files": changes,
                "changed_file_count": len(changes),
                "migrations": migration_entries(changed_paths),
                "migration_inventory": migration_entries(paths),
                "ci": ci_cache[branch["sha"]],
                "ancestry": ancestry(repo, branch["sha"], {"default_branch": default_sha} if default_sha else {}),
                "owned_scope_requires_semantic_review": True,
            }
            all_candidates[task].append(candidate)

    for task in TASKS:
        all_candidates[task].sort(key=lambda x: (x["score"], x.get("committer_date") or "", x["head_sha"]), reverse=True)

    for task, dependency in DEPENDENCIES.items():
        dependency_candidates = all_candidates.get(dependency) or []
        if not dependency_candidates:
            continue
        dependency_head = dependency_candidates[0]
        for candidate in all_candidates.get(task) or []:
            dependency_changes = diff_entries(repo, dependency_head["head_sha"], candidate["head_sha"])
            dependency_paths = [entry["path"] for entry in dependency_changes]
            candidate["dependency_diff_basis"] = {
                "task": dependency,
                "remote_branch": dependency_head["remote_branch"],
                "head_sha": dependency_head["head_sha"],
            }
            candidate["dependency_changed_files"] = dependency_changes
            candidate["dependency_changed_file_count"] = len(dependency_changes)
            candidate["dependency_migrations"] = migration_entries(dependency_paths)

    pr_24 = next((pr for pr in prs if pr.get("number") == 24), None)
    pr_25 = next((pr for pr in prs if pr.get("number") == 25), None)
    pr_24_25: dict[str, Any] = {"pr_24": pr_24, "pr_25": pr_25, "comparison": None}
    if pr_24 and pr_25 and pr_24.get("headRefOid") and pr_25.get("headRefOid"):
        head24 = pr_24["headRefOid"]
        head25 = pr_25["headRefOid"]
        left = git_text(repo, "rev-list", "--left-only", "--cherry-pick", f"{head24}...{head25}", check=False).splitlines()
        right = git_text(repo, "rev-list", "--right-only", "--cherry-pick", f"{head24}...{head25}", check=False).splitlines()
        mb = git_text(repo, "merge-base", head24, head25, check=False).strip() or None
        pr_24_25["comparison"] = {
            "merge_base": mb,
            "unique_to_pr_24_patch_equivalence": left,
            "unique_to_pr_25_patch_equivalence": right,
            "semantic_review_required": True,
            "merge_both_histories_forbidden": True,
        }

    required_status: dict[str, Any] = {}
    for task in REQUIRED_INSPECTION:
        candidates = all_candidates[task]
        report_candidates = [candidate for candidate in candidates if candidate.get("reports")]
        inspectable = report_candidates[0] if report_candidates else None
        required_status[task] = {
            "candidate_found": bool(candidates),
            "candidate_count": len(candidates),
            "remote_head_inspectable": bool(inspectable and inspectable.get("head_sha")),
            "report_inspectable": bool(inspectable),
            "ci_inspectable": bool(inspectable and inspectable.get("ci", {}).get("inspectable")),
            "inspection_candidate_branch": inspectable.get("remote_branch") if inspectable else None,
            "inspection_candidate_sha": inspectable.get("head_sha") if inspectable else None,
            "semantic_adjudication_required": True,
        }
    machine_inspection_gate = all(
        item["candidate_found"] and item["remote_head_inspectable"] and item["report_inspectable"]
        for item in required_status.values()
    )

    collisions: dict[str, list[dict[str, Any]]] = {}
    for task, candidates in all_candidates.items():
        if not candidates:
            continue
        migration_set = candidates[0].get("dependency_migrations") or candidates[0].get("migrations", [])
        for migration in migration_set:
            prefix = migration.get("numeric_prefix")
            if prefix in {2000, 2100}:
                collisions.setdefault(str(prefix), []).append({
                    "task_id": task,
                    "branch": candidates[0]["remote_branch"],
                    "sha": candidates[0]["head_sha"],
                    "path": migration["path"],
                })

    result = {
        "task_id": TASK_ID,
        "packet_id": PACKET_ID,
        "generated_at_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "repository": repo_info,
        "default_branch": {"name": default_branch, "sha": default_sha},
        "candidates": all_candidates,
        "required_inspection": required_status,
        "machine_inspection_gate": machine_inspection_gate,
        "integration_may_start": False,
        "integration_may_start_reason": (
            "Codex must semantically adjudicate OT-83R completion and OT-88/OT-89A checkpoint reports before setting the gate true."
            if machine_inspection_gate
            else "Required remote branch or report evidence is not inspectable."
        ),
        "pull_request_24_25": pr_24_25,
        "migration_collision_snapshot": collisions,
        "instructions": {
            "adjudication_schema": "schemas/OT-99-candidate-adjudication.schema.json",
            "no_integration_edits_before_adjudication": True,
            "main_is_not_assumed_as_base": True,
            "prompt_launch_is_not_success": True,
        },
    }

    output = out_dir / "OT-99-remote-discovery.json"
    output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    summary = out_dir / "OT-99-remote-discovery-summary.txt"
    lines = [
        f"{TASK_ID} repository: {repo_name}",
        f"{TASK_ID} default branch: {default_branch} {default_sha or 'UNRESOLVED'}",
        f"{TASK_ID} machine inspection gate: {'OPEN_FOR_SEMANTIC_REVIEW' if machine_inspection_gate else 'CLOSED'}",
    ]
    for task in REQUIRED_INSPECTION:
        top = all_candidates[task][0] if all_candidates[task] else None
        lines.append(
            f"{TASK_ID} {task}: " +
            (f"{top['remote_branch']} {top['head_sha']} reports={len(top['reports'])}" if top else "NO_CANDIDATE")
        )
    summary.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(output)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except DiscoveryError as exc:
        print(f"{TASK_ID} discovery failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
