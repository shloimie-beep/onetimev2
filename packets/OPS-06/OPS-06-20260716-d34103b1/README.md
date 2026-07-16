# OPS-06 Codex packet

Packet ID: `OPS-06-20260716-d34103b1`  
Task ID: `OPS-06`  
Generated on: `2026-07-16`  
Source request SHA-256: `291fb5d3937e78be8446f6d95178a1e8ab5fd71b653625b2f693f62b242f0f50`  
Read-only audit anchor: `webcraft-media/onetimev2@6ecb680713a2fd5cd7bc03766fe9b8974c9b75df`

## Purpose

This packet is a direct-to-Codex specification for a deterministic, repeatable, synthetic Day-One rehearsal of the integrated One Time product on isolated staging. It does not certify the current source and does not authorize GitHub or production changes.

## Execution entry point

Give Codex the source repository worktree and this packet directory, then use `DIRECT-CODEX-PROMPT.md` verbatim. Codex must validate `checksums.sha256`, persist run state before all other work, discover the exact isolated-staging URL and SHA, audit the exact source, add only permitted test/evidence glue, run every mandatory matrix, reset fixtures, and issue a schema-valid verdict.

## Required packet artifacts

- `MANIFEST.json`: packet identity, delivery disposition, source topology, and file inventory.
- `DIRECT-CODEX-PROMPT.md`: complete execution instruction.
- `AUDIT-CURRENT-STATE.md` and `.json`: read-only findings and known gaps.
- `fixtures.synthetic.json`: all allowed fictional data.
- `action-registry.required.json` and `action-registry.schema.json`: required visible-control baseline and schema.
- `action-matrix.csv`, `journey-matrix.csv`, `role-capability-matrix.csv`, `role-state-matrix.csv`, `error-state-matrix.csv`, `viewport-a11y-matrix.csv`, `isolation-matrix.csv`.
- `performance-budgets.json`, `acceptance-gates.json`, `evidence.schema.json`.
- `reset-rollback-plan.md`.
- `delivery-attempt.json` and `checksums.sha256`.

## Current audit posture

The repository default branch is only the original foundation. The current integrated work is split across open branches. OT87 at `6ecb680713a2fd5cd7bc03766fe9b8974c9b75df` is the capability-rich audit anchor for household portals plus family entitlements, while OT86A/OT86B are divergent content/social lanes. No isolated staging URL or deployed source SHA was proven. The run must discover the actual staging SHA and must fail rather than substitute a nearby branch.

The read-only audit found mandatory Day-One gaps in the known branch lineage: no proven CRM tags/notes history/relationships/tasks, helper query defaults unavailable rather than a durable learner-question queue, support is preview-only, and several visible portal controls can be disabled or marked unavailable by design. The packet encodes these as hard gates.

## Integrity

`checksums.sha256` covers every packet file except itself. Any mismatch invalidates the packet. No packet file contains a live credential, real user, production row identifier, provider secret, or provider authorization.
