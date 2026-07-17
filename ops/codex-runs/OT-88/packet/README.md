# OT-88 Zoom Learner Classroom and Question Queue — Codex Packet

Generated: 2026-07-15T11:16:20Z  
Source ticket: OT-88  
Required source branch: `codex/ot84-telegram-action-gateway`  
Required target branch: `codex/ot88-zoom-learner-classroom`

## Purpose

This packet is a self-contained implementation brief for a Codex coding run. It converts the OT-88 product decision into an executable engineering plan without changing GitHub or any repository during packet generation.

The direct prompt in `01-DIRECT-CODEX-PROMPT.md` is the controlling artifact. It requires Codex to:

1. locate the existing One Time repository;
2. prove that `codex/ot84-telegram-action-gateway` exists on a Git remote;
3. fetch and resolve that branch dynamically to a real commit;
4. prove that the resolved branch contains the OT-83 portal foundation;
5. create a clean worktree and the branch `codex/ot88-zoom-learner-classroom`;
6. persist prompt, state, resume, and final-report artifacts under `ops/codex-runs/OT-88/` before product-code edits;
7. implement and test the feature with Zoom disabled or sink-backed by default;
8. stop safely at `READY_FOR_ZOOM_CANARY` when protected Zoom credentials or account settings are unavailable; and
9. finish with a clean push and a draft pull request based on the OT-84 branch.

No commit SHA is prefilled in this packet. The source SHA must be resolved from the remote branch at run time and recorded in the run state.

## Product decisions encoded here

- The $67 family subscription grants **up to three named active learner seats**. It does not grant three reusable URLs.
- Each learner has a distinct profile/login/device context and may receive a protected launch action only for that learner and a specific immutable class occurrence.
- The daily class is scheduled at `19:00` in `Asia/Jerusalem`; the optional reminder is at `18:30` local time.
- Raw Zoom join URLs, meeting passcodes, SDK secrets, host tokens, and registrant tokens are excluded from ordinary portal state, logs, analytics, support output, and Telegram.
- Zoom Meeting SDK launch material is created or resolved only after server-side authorization and is released only through a dedicated, single-use, no-store launch bootstrap—not through normal portal endpoints.
- V1 student questions remain in a One Time application queue. They are not injected into Zoom chat.
- V1 `Feature next` is an application workflow for the Rabbi. It does not promise automatic Zoom pinning or spotlighting.
- The Meeting SDK is used for human participation only. No helper bot or AI notetaker joins Zoom media.

## Packet index

| File | Purpose |
|---|---|
| `01-DIRECT-CODEX-PROMPT.md` | Paste-ready Codex implementation prompt and completion contract. |
| `02-DOMAIN-DATA-MODEL.md` | Aggregates, entities, state machines, constraints, and data classifications. |
| `03-ZOOM-CAPABILITY-FINDINGS.md` | Official-source findings, design implications, and unproven capabilities. |
| `04-SEQUENCE-DIAGRAMS.md` | Text and Mermaid sequences for join, rejoin, questions, moderation, reminders, and canary. |
| `05-AUTHORIZATION-MATRIX.md` | Actor/resource/action policy matrix and policy pseudocode. |
| `06-FAILURE-STATE-MATRIX.md` | User-visible states, detectors, recovery, telemetry, and security behavior. |
| `07-TEST-CANARY-PLAN.md` | Provider-off, sink, end-to-end, performance, accessibility, privacy, and Zoom canary plan. |
| `08-SECURITY-PRIVACY-OBSERVABILITY.md` | Threat model, secret handling, redaction, telemetry, retention, and abuse controls. |
| `09-IMPLEMENTATION-BLUEPRINT.md` | Ports/adapters, API boundaries, UI shell, rollout flags, and delivery phases. |
| `10-EVIDENCE-RESUME-CONTRACT.md` | Exact run files, status vocabulary, evidence layout, and final report format. |
| `11-REQUIREMENTS-TRACEABILITY.md` | Maps every source requirement to design and verification coverage. |
| `SOURCES.md` | Official source register and claim map. |
| `SOURCE-SPEC.md` | Exact source specification supplied for this packet. |
| `VERIFY-CHECKSUMS.sh` | Portable checksum verification helper. |
| `MANIFEST.json` | Machine-readable inventory and hashes of packet content. |
| `SHA256SUMS` | SHA-256 hashes for packet files other than itself. |

## Reading order

Start with the direct Codex prompt. Use the data model and implementation blueprint as design detail. Use the authorization and failure matrices as acceptance criteria. Use the test/canary plan and evidence contract to decide whether the branch is complete.

## Safety posture

The implementation must fail closed. Missing credentials, unverified account authorization, inability to suppress provider invite/meeting-information controls, unsupported browser behavior, or unproven registration identity must disable the protected join action or force a verified safer fallback. It must not silently downgrade to a raw Zoom URL.

Provider mutation and real reminders remain off unless a deliberately scoped test canary is configured. Production Zoom meetings, production registrants, and broad recipient lists are never used for implementation verification.
