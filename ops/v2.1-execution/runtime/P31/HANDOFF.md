# P31 Handoff

## Identity

- Branch: `codex/v21-p31-email-copy-approval`
- Start SHA: `80c281b7ae5826ed2c6abe95ba68a033ffa52174`
- Implementation SHA before this handoff metadata commit: `80c281b7ae5826ed2c6abe95ba68a033ffa52174`
- Current handoff commit: derive with `git rev-parse HEAD` after checkout; C00 records the observed remote head in `TASK-REGISTRY.yaml`
- Task packet digest: `bd03248c56abc9ea91dfbff449ec76dac0996fcd0eb336dccca28b96f184c374`
- Context digest: `c0a24633dbad28172a423203bfb228fa190faedd442fe5457925ad3fc6fa7342`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`

## Completed behavior

The initial claim is seeded from the C00-issued P31 ready entry. Remote control head `beb72be5ba1f993c1806e9314146e88f951affdb`, start SHA `80c281b7ae5826ed2c6abe95ba68a033ffa52174`, F01 interface integration proof, claim `39538a2e-2d15-44a7-9485-0cba68919b21`, and the active `COPY_CATALOG` lease were verified. No product files or external effects have been performed.

## Remaining work

Implement the P31-owned canonical copy catalog, Resend security/setup/reset templates, GHL lifecycle/newsletter copy fragments, and digest-bound human approval enforcement. Publish the required P31 interface checkpoint for P28/P29/P30, then run focused task-owned verification and checkpoint ready-for-review.

## Exact next action

Inspect the P31-owned paths and named WNC-2, WNC-6, and WNC-9 source sections to make the assigned gap map before implementation.

## Coverage

- Requirements: all eight P31 requirements are not_started.
- Acceptance cases: all eight P31 acceptance cases are not_started.

## Changed files and migrations

- `ops/v2.1-execution/runtime/P31/TASK-STATE.yaml`
- `ops/v2.1-execution/runtime/P31/HANDOFF.md`
- `ops/v2.1-execution/runtime/P31/NEXT-PROMPT.md`
- No migrations.

## Verification

Verified remote branch absence, authoritative control head, authorized start SHA, P31 task/context blob digests, and F01 dependency data from the ready queue. Product verification has not started.

## External effects

Authority: none. Attempted: 0. Succeeded: 0. Reconciled: 0. No provider or live effects are authorized or performed.

## Security, privacy, and data handling

No secrets, tokens, provider payloads, child data, Zoom/Vimeo bearers, or live sends are included. P31 must retain the adult-only GHL and digest-approval invariants.

## Blockers, deviations, and recovery

No blocker at the seeded claim checkpoint. Do not continue after lease expiry without a C00-issued resume lease.
