# F01 Handoff

## Identity

- Branch: `codex/v21-f01-foundation-seams`
- Start SHA: `ae02b193f67bf9ef04887a7b0aebb449d3fb8bc0`
- Implementation SHA before this handoff metadata commit: `a7bc348b98e79f57618c911c440d3d8713a63d5f`
- Current handoff commit: derive with `git rev-parse HEAD` after checkout; C00 records the observed remote head in `TASK-REGISTRY.yaml`
- Task packet digest: `1b857371d8d55752dca73bf129870058095306a5e50d5539d7e37d0a74124bda`
- Context digest: `5145b39c8f6ce31519ce9c23f188387a0abdfee141132deb4e4713974a1c3372`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim: `f5bc9b67-9a49-432f-9ce4-6ebd99d856d9`, held by `codex-f01-worker-4aafff01`
- Lease expiry: `2026-07-28T16:56:52Z`
- Containing control head: `af76c4e990f954794de72db639576b3c9dc73ff4`
- Ready payload digest: `913ff78ed729865e7d554e2f407afe7b48f7d8451f09907330c91a42fcf050a2`
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
The focused direct-access harness proved 29 retired routes and emitted assets
return 404 and that login HTML contains no challenge/trusted-device controls.
Routine challenge delivery is absent from the owned worker loop. Retired event
and HighLevel event-sync environment keys are ignored and forced unavailable.
Three schema-valid immutable steward requests now describe the remaining
out-of-scope domain-auth, production-client, and compatibility-config cleanup.

## Remaining work

Have C00 record and assign the three pushed steward requests, acknowledge the
exact applied result heads, rerun the exact inventory and direct-access checks,
and publish `ready_for_review`.

## Exact next action

Wait for C00 to record and assign `F01-retired-auth-001`,
`F01-retired-client-002`, and `F01-config-retirement-003`; then verify and
acknowledge their exact applied result heads before `ready_for_review`.

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
- F01 direct-access absence harness: 29 retired routes/assets returned 404.
- Login HTML absence assertions: no challenge, one-time-code, six-digit, or
  trusted-device controls.
- Retired event configuration smoke: supplied legacy keys were ignored and
  compatibility values remained unavailable.
- Three request YAML documents validated against the F01 steward-request
  schema.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security, privacy, and data handling

No provider call, live effect, secret, customer data, child data, private
question, or bearer URL was read or recorded.

## Blockers, deviations, and recovery

The renewed F01 lease is active. C00 must record and assign three immutable
steward requests before F01 can acknowledge result heads and finish:

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
