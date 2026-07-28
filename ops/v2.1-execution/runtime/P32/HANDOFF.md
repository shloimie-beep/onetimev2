# P32 Handoff

## Identity

- Branch: `codex/v21-p32-privacy-data-rights`
- Start SHA: `01cdb992660a1fbc20b204b829d28062fd044679`
- Implementation SHA before this handoff metadata commit: `01cdb992660a1fbc20b204b829d28062fd044679`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the observed remote head.
- Task packet digest: `a34f7c16bda5c68fc269cce7fbbb0eb574de64f4a9db66e272c3b99ff8a639f6`
- Context digest: `62e33c67682a9c6f3e9ce372e920abbdf05090f5a7bf81075aec766594b4f140`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`

## Completed behavior

The exact P32 ready claim and `PRIVACY_DATA_RIGHTS` writer lease were verified against containing control commit `d234126ca7be31def06c939ac1886406936987dc`. The isolated branch starts at integration SHA `01cdb992660a1fbc20b204b829d28062fd044679`, which contains the exact integrated F02/F03/F04/F05/F07 prerequisites.

## Remaining work

Implement current authority and Student-scoped recording consent, privacy actor boundaries, data-rights request lifecycle and downloads, deterministic shared-media treatment, retention/redaction/purge processing, independent purge evidence, and safe Parent/self-managed adult Student/Admin surfaces.

## Exact next action

Read the exact dependency handoffs and named privacy source sections, inspect only P32-owned paths, and implement the stable privacy contract first.

## Coverage

- Requirements: all five assigned requirements are planned.
- Acceptance cases: all eight assigned cases are planned; no candidate-bound proof is claimed.

## Changed files and migrations

Only P32 durable runtime metadata is added in this claim checkpoint. No migration or central registration is changed.

## Verification

Origin identity, control/queue state, canonical ready-entry digest, immutable task inputs, dependency interface heads/digests, branch absence, start SHA, and unexpired lease were verified.

## External effects

Authority `none`; attempted `0`, succeeded `0`, reconciled `0`. No provider or live effect occurred.

## Security, privacy, and data handling

No secrets, real identities, child data, private questions, provider payloads, or bearer material were accessed or recorded.

## Blockers, deviations, and recovery

No blocker or deviation. Resume only under the exact current claim or a new C00-issued resume lease.
