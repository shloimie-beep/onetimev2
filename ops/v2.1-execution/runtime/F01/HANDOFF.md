# F01 Handoff

## Identity

- Branch: `codex/v21-f01-foundation-seams`
- Start SHA: `ae02b193f67bf9ef04887a7b0aebb449d3fb8bc0`
- Implementation SHA before this handoff metadata commit: `d7dd4aa9accb951447c184d210f024860201b9e1`
- Current handoff commit: derive with `git rev-parse HEAD` after checkout; C00 records the observed remote head in `TASK-REGISTRY.yaml`
- Task packet digest: `1b857371d8d55752dca73bf129870058095306a5e50d5539d7e37d0a74124bda`
- Context digest: `5145b39c8f6ce31519ce9c23f188387a0abdfee141132deb4e4713974a1c3372`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim: `c18310c8-3975-4816-badd-1fa9079edc33`, held by `codex-f01-worker-4aafff01`
- Lease expiry: `2026-07-28T16:09:35Z`
- Containing control head: `e7bd7e0ab5062f8fccd78db2a4b38de03e3080ce`
- Ready payload digest: `02778740dc1c287edf20b08699ab1d83d4b1dd131026737c4a75759d90c30af2`
- Interface contract digest: `2cce2c949811016c8e59b315830a454398d6b73d43380944fa2a76eb79bb8713`

## Completed behavior

Verified the exact repository, fetched control authority, missing registered
remote branch, authorized start SHA, claim, unexpired leases, package and source
locks, F01 task/context digests, canonical ready-entry digest, and C00
operational dependency. Read the execution contract, F01 packet and locked
context, the current remote C00 handoff, and required runtime templates.
Implemented versioned, fail-closed server feature-router, client route/root,
worker runner, and steward-request interfaces. The server and worker composers
consume their registries, and the Parent and Student portal entry now composes
separate feature roots through the client router. The exact stable interface
contract remains at implementation head
`bb7664c44444bf1704d9f63e5c19a15381f2f0b0` and unlocks F02, F07, P31, and
P35 after I36 integration.

At implementation head `d7dd4aa9accb951447c184d210f024860201b9e1`,
removed current mounts and controls for the WhatsApp assistant/meta webhook,
social publishing, experience preview, product test/demo lanes, Zoom test
resources, Class Helper, Parent-created goals, MFA/email challenge, and the
retired Tisha event funnel. Current client session roles are only Admin, Parent,
and Student; legacy owner and rabbi identities normalize to Admin while retired
roles fail closed. Worker content processing now permits only the Vimeo mode,
and retired environment switches are no longer accepted as runtime flags.

## Remaining work

Renew the F01 lease, run the focused direct-access absence harness and exact
inventory scan, reconcile the out-of-scope domain/public-build references
listed below through the steward mechanism, and publish `ready_for_review`.

## Exact next action

After C00 grants a fresh matching F01 lease, verify direct access fails closed
and reconcile the recorded out-of-scope retired-surface references without
crossing owned-path authority.

## Coverage

- Requirements: the owned runtime closure for the three absence cases is
  implemented and pending verification; candidate deployment/runtime cases
  remain pending.
- Acceptance cases: the direct-access absence harness remains; deployment
  runtime cases require later candidate-bound verification.

## Changed files and migrations

Added the four required interface roots, integrated them through the assigned
server/client/worker composers, added the config role/surface seam, published
`INTERFACE-CHECKPOINT.yaml`, and changed only F01-owned server, client, worker,
config, and runtime-metadata paths for the retirement pass. No migration was
created, deleted, or edited.

## Verification

- Remote identity and exact control head matched.
- The remote F01 branch was absent before claim.
- `LOCKED-SHA256SUMS.txt`: 200/200 Git blobs passed.
- Canonical ready-entry digest matched.
- C00 operational control-state digest and task/context digests matched.
- `npm run typecheck`: passed.
- Focused client/server/worker seam smoke: passed positive, authorization
  rejection, duplicate-rejection, and deterministic execution branches.
- Steward-request JSON schema parsed successfully.
- `npm run typecheck` after retired-surface closure: passed.
- `npm run build:client` after retired-surface closure: passed.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security, privacy, and data handling

No provider call, live effect, secret, customer data, child data, private
question, or bearer URL was read or recorded.

## Blockers, deviations, and recovery

Lease renewal is required before more work. Three out-of-scope closure items
remain:

- `packages/domain/src/auth/service.ts` still creates a routine email challenge
  for internal Admin identities after a valid password. The owned server no
  longer exposes challenge endpoints or controls, so the domain implementation
  must be changed by its steward to restore direct email-plus-password Admin
  login.
- `apps/web/vite.app.config.ts` still emits the retired experience-preview
  client entry, and `apps/web/src/client/public.ts` retains dormant challenge
  code. Both are outside F01 ownership. The owned server denies the emitted
  preview asset and no longer renders challenge controls.
- Out-of-scope domain modules still consume compatibility AppConfig properties
  carrying historical MFA/Buffer/demo names. The environment schema and runtime
  switches are removed or forced unavailable; deleting those compatibility
  properties requires coordinated consumer migration.
