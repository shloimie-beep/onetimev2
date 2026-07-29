MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Continue One Time v2.1 task P24 only after C00 reconciles its exact remote
atomic-claim head.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p24-support
Authoritative control ref: origin/codex/v21-control
Authorized atomic-claim start: 408b21afa4b9ac6f100b3ce33ea87984d18d4bf7
Task packet: ops/v2.1-execution/tasks/P24.yaml
Task context: ops/v2.1-execution/contexts/P24-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P24/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P24/HANDOFF.md
Claim: ff79d0ab-10d4-481b-ae90-48bb8bd9631a
SUPPORT lease: 4d0115d1-571f-4ca7-8b04-3fc79b43bcdf

Fetch remote refs and require the P24 branch to equal the exact pushed
three-file atomic-claim head. Require a newer exact control authorization whose
state identifies and reconciles that same head before resuming. Re-verify the
task, context, source package, package lock, READY payload, claim, lease, and
F03/F04/F05/F07 dependency identities recorded in `TASK-STATE.yaml`.

Until those checks pass, stop. Do not edit product, tests, requests,
registrations, steward files, or global control; do not inspect Telegram or any
provider; do not send; do not apply steward work; do not claim an effect lock.
External authority remains `none`.
