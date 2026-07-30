MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

F04 completed the v2.1 adult-session persistence and household-label
correction under claim `ac096257-657d-40ab-88bb-80247126bf6b`, substantive
control `26f29aeb6734948dd8b80ab85a342831defaecc9`, authorized integration
start `c0a1e04b8f3ffcaa65b8c6c2a1ec64edf7c1346a`, and implementation
`dd5ce9ae49e2ef7800657289f7aa5bbc839163c4`.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-f04-household-identity
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/F04.yaml
Task context: ops/v2.1-execution/contexts/F04-CONTEXT.md
Task state: ops/v2.1-execution/runtime/F04/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/F04/HANDOFF.md

The exact five authorized paths now provide:

- atomic Parent-session create, access/refresh resolve, and bounded revoke
  against unchanged migration 2235;
- exact active adult/account/Parent membership/owner/household/scope/security,
  current canonical access, unrevoked session, and deadline checks;
- digest-only persistence with no raw opaque session material;
- owner-derived `<owner> household` or `<owner> school` labels without the
  nonexistent household display-name column.

Verification passed six focused deterministic tests, one isolated native
PostgreSQL 16 proof applying unchanged migrations 2234 and 2235, workspace
typecheck, focused ESLint/Prettier, diff hygiene, artifact hashing, and the
secret scan. The two-artifact aggregate is
`cd88df7415a8ef8643f4553b868dbe12410a93c1045ef32a958e2a43f6def9e9`.
The disposable native database and role were removed. Effects remain `0/0/0`.

The `ACCOUNT_HOUSEHOLD_IDENTITY` lease
`ecf3aa70-8429-4846-ab39-c74816547e35` was released before its
`2026-07-30T20:01:13Z` expiry. Current durable status is
`ready_for_review`.

Next action: C00 independently audits the exact pushed final, c0a1e04b
ancestry, five-path scope, two-artifact aggregate, focused/native proof,
released lease, normal remote equality, and zero effects before I36 admission.
Do not continue F04 implementation or perform candidate/provider effects
without a new exact READY authorization.
