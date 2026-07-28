# P18 Handoff

## Identity

- Branch: `codex/v21-p18-embedded-classroom`
- Start SHA: `9ba92b070eedfa3756eff4f78fd328de72507a96`
- Implementation SHA before this handoff metadata commit: `9ba92b070eedfa3756eff4f78fd328de72507a96`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the observed remote head.
- Task packet digest: `e9128366095ad3d2552fbe6b5389c0b4f0f03d3f32c2f6902d9d8b755bbaa1b2`
- Context digest: `2385ac5d0555d75318577964ad92b850c55e8bc770127454e65afe776648142d`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim ID: `415e950e-cfbb-4635-9f1a-3ffd6af825ac`
- Writer: `codex-p18-worker-415e950e`
- EMBEDDED_CLASSROOM lease: `d44e1690-90e5-44b6-b17f-2faa92dfb220`
- Lease expiry: `2026-07-28T22:55:38Z`
- Containing control authorization: `e847dd790ae2f99ae526b0edcbd41897474c8f18`
- Ready-entry parent control head: `3cfe14a6e1171d002f7173c13776dc682fddd6a8`
- Ready-entry payload digest: `5bd82837c0f7aa83ac813092c767f1dec82f2671f7ea6562e53313c4325586f5`

## Completed behavior

Verified the exact repository, containing control authority, authorized
integration start, ready and registry entries, absent remote P18 branch,
canonical ready digest, live EMBEDDED_CLASSROOM lease, zero effect locks, all
200 locked blobs, and package/task/context/prompt/source-package digests.
Verified dependency implementation and integration ancestry, all three
canonical contract preimages, and all 27 exported artifact hashes across F05,
P16, and P32. P32's canonical preimage uses the checkpoint-specified literal
`path=` prefix before each actual path.

Created the isolated P18 branch from exact start
`9ba92b070eedfa3756eff4f78fd328de72507a96`. This checkpoint consumes only
the pre-issued claim and seeds the three task-local runtime files. No product
implementation, shared hotspot, provider action, or live effect occurred.

## Remaining work

Push and report this atomic claim checkpoint, then implement and verify the
embedded classroom authorization, bootstrap, single-device lease, occurrence
window, consent, reconnect, and reconciled attendance behavior.

## Exact next action

Push this sole-parent claim checkpoint normally, report the exact head to C00,
then inspect only P18-owned paths and named normative sections.

## Coverage

- Requirements: all five claimed; implementation not started.
- Acceptance cases: all six not run.

## Changed files and migrations

Only `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md` under P18 runtime.
Migrations: none.

## Verification

- Exact control/start/repository identity: passed.
- Ready/registry/branch/claim/lease/effect-lock checks: passed.
- Locked files and entry-bound digests: passed.
- F05/P16/P32 ancestry, three contract digests, and 27 dependency artifacts: passed.

## External effects

Authority `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security, privacy, and data handling

No secrets, provider payloads, customer or child data, private questions,
bearers, raw Zoom URLs, or provider identities were accessed or recorded.

## Blockers, deviations, and recovery

No blocker or deviation.
