#!/usr/bin/env python3
"""OT-99 packet integrity and unresolved-marker validator."""

from __future__ import annotations

import csv
import hashlib
import json
import re
import sys
from pathlib import Path

TASK_ID = "OT-99"
REQUIRED = {
    "PACKET.json",
    "START-HERE.md",
    "CODEX-PROMPT.md",
    "SHA256SUMS.txt",
    "runtime/OT-99-persist-task-state.sh",
    "runtime/OT-99-discover-remote-state.sh",
    "runtime/OT-99-discover-remote-state.py",
    "matrices/OT-99-dependency-merge-matrix.csv",
    "matrices/OT-99-semantic-collision-matrix.csv",
    "matrices/OT-99-migration-renumber-matrix.csv",
    "matrices/OT-99-staging-matrix.csv",
    "matrices/OT-99-canary-matrix.csv",
    "matrices/OT-99-rollback-matrix.csv",
    "schemas/OT-99-release-manifest.schema.json",
}
FORBIDDEN_MARKERS = [
    re.compile(r"<[^>\n]+>"),
    re.compile(r"\b(?:TODO|TBD|FIXME|REPLACE_ME|INSERT_HERE|FILL_IN)\b", re.I),
    re.compile(r"\{\{[^}\n]+\}\}"),
]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]).resolve()
    files = {p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file()}
    missing = sorted(REQUIRED - files)
    if missing:
        raise SystemExit(f"{TASK_ID} missing required files: {missing}")

    packet = json.loads((root / "PACKET.json").read_text(encoding="utf-8"))
    if packet.get("task_id") != TASK_ID or packet.get("packet_id") != "OT-99-bcd34498":
        raise SystemExit(f"{TASK_ID} packet identity mismatch")

    for path in root.rglob("*"):
        if not path.is_file() or path.name in {"SHA256SUMS.txt", "OT-99-verify-packet.py"}:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for pattern in FORBIDDEN_MARKERS:
            match = pattern.search(text)
            if match:
                raise SystemExit(f"{TASK_ID} unresolved marker {match.group(0)!r} in {path.relative_to(root)}")
        if TASK_ID not in text:
            raise SystemExit(f"{TASK_ID} identity absent from {path.relative_to(root)}")

    for path in (root / "schemas").glob("*.json"):
        json.loads(path.read_text(encoding="utf-8"))
    for path in (root / "matrices").glob("*.csv"):
        with path.open(newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
            if not rows:
                raise SystemExit(f"{TASK_ID} empty matrix: {path.name}")
            if "TASK_ID" not in rows[0]:
                raise SystemExit(f"{TASK_ID} matrix lacks TASK_ID column: {path.name}")
            if any(row.get("TASK_ID") != TASK_ID for row in rows):
                raise SystemExit(f"{TASK_ID} matrix identity mismatch: {path.name}")

    expected: dict[str, str] = {}
    for line in (root / "SHA256SUMS.txt").read_text(encoding="utf-8").splitlines():
        digest, rel = line.split("  ", 1)
        expected[rel] = digest
    manifest_files = set(expected)
    actual_manifest_scope = files - {"SHA256SUMS.txt"}
    if manifest_files != actual_manifest_scope:
        missing_from_manifest = sorted(actual_manifest_scope - manifest_files)
        stale_manifest_entries = sorted(manifest_files - actual_manifest_scope)
        raise SystemExit(
            f"{TASK_ID} checksum manifest coverage mismatch: "
            f"missing={missing_from_manifest}, stale={stale_manifest_entries}"
        )
    for rel, digest in expected.items():
        actual = sha256(root / rel)
        if actual != digest:
            raise SystemExit(f"{TASK_ID} checksum mismatch: {rel}")

    print(f"{TASK_ID} packet verified: {len(files)} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
