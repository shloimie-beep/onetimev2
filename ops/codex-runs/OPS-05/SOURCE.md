# OPS-05 Source And Intake

Task ID: `OPS-05`

Repository: `webcraft-media/onetimev2`

Worktree: `C:\Users\User\.ops05-worktrees\OPS-05`

Branch: `codex/ops05-observability-runbooks`

Base: `origin/codex/ot86b-buffer-social` at
`97fa0c91758888f4e9de0af17d70002a0124669f`

## Packet Validation

Requested trusted archive: `OPS-05-CODEX-PACKET.zip`

Result: blocked. No local ZIP had both `PACKET.json` with `task_id` `OPS-05`
and matching `SHA256SUMS.txt`.

Found fallback factory prompt files:

- `C:\Users\User\Downloads\OPS-05-OBSERVABILITY-RUNBOOKS-FACTORY.md`
- `C:\Users\User\Downloads\OPS-05-OBSERVABILITY-RUNBOOKS-FACTORY (1).md`

Both have SHA-256:
`51FD6161ECEF2E6EEF75CE973A1F184204446713E1545B74362CBA9BB0C104D7`

`ONETIME-NEXT-WAVE-2026-07-15.zip` also contains only the GPT-side OPS-05
factory prompt, not a Codex-ready packet.

## OT-99 Availability

`C:\Users\User\Downloads\OT-99-CODEX-PACKET.zip` exists and has SHA-256
`B00B4C5FA4859D3569BF52489C088455C173BBD6AE22A7A6FA4E6D0A81962A3D`.

After `git fetch origin --prune`, no `origin/codex/ot99*` branch was available.
OPS-05 therefore follows the user-provided fallback: complete reusable telemetry
contracts, privacy-safe metrics, alerts, runbooks, synthetic checks, and tests,
then publish a checkpoint.

## Guardrails

No deploy, provider calls, external sends, payments, DNS changes, production
data access, production database access, or PII/secret logging are authorized.
Ordinary One Time app routes must not synchronously call BNA. BNA support
integration may be represented only as asynchronous, redacted status contracts.
