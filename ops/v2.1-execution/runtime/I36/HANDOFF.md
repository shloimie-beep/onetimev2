# I36 P09 Full-Integration Atomic Claim

## Identity

- Branch: `codex/v21-integration`
- Exact existing target: `eeac03afdd7a5db493885ef507b7c09478b0454a`
- Containing authorization: `3f2cfad9a004046986be9998ac32f7991b76bb64`
- Sole state-based acquisition parent:
  `7761608fef1c7eb7f6bd77ec87127f0bb4eb45d3`
- READY I36 digest:
  `3be45d6892c86e6fb44fc74f7c99dfe4daa81604f6385a2f8e94b75b0a004037`
- P09 merge item: `3901c87f-82ff-4795-ae69-5f2ac3c02ac4`
- P09 source: `33a21a45005271f1bbe09c8587df1e52fac1a95a`
- P09 merge digest:
  `e6b820e1862fac0a3eaf5ecd76c7fff8c143e61b48b631e64ce571e2d0c85fd0`
- Claim: `26d3ae42-c9c9-4913-9534-1d4c71b55f13`
- RELEASE_INTEGRATOR lease: `495eba01-e9b3-4e71-9e53-4864c9d93bac`
- Lease window: `2026-07-29T11:51:14Z` through
  `2026-07-29T13:06:14Z`
- Phase scope: `P09_full_integration_atomic_claim_only`
- Atomic claim head: derive with `git rev-parse HEAD`; C00 records the observed
  pushed remote head.

## Authority verification

The fetched integration and control refs exactly matched the authorized target
and containing control commit. The control commit has the exact sole
state-based acquisition parent. Its committed READY entry and queued P09 item
bind the exact claim, lease, target, source identity, phase scope, and payload
digests above. The remote P09 branch advertises the exact queued source head.

## Preserved state

This checkpoint changes only `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md` in the I36 runtime directory. P09 source content was not
fetched, inspected, edited, or merged. No product, test, migration,
registration, structured request, steward, provider, send, or external-effect
action was performed. P09 migration/registration and P11 registration requests
remain unapplied.

## Next action

C00 must reconcile the exact pushed atomic claim head. I36 must stop after
reporting that checkpoint; P09 integration requires a subsequent explicit
resume.

## Effects

Authority none; attempted/succeeded/reconciled `0/0/0`.
