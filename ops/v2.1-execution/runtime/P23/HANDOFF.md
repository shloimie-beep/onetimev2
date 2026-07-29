# P23 Ready-for-Review Handoff

## Identity

- Branch: `codex/v21-p23-student-notifications`
- Authorized start:
  `cecc1c0dc6ff57562e5d89dd731289d860086bf7`
- Atomic claim:
  `05ef606022d260d11d56d31985a051d7b9013010`
- C00 reconciliation:
  `8172f8cd9b5a13697d928a5c3e5c7fa4bc826a84`
- Implementation and request checkpoint:
  `c1dc94bedac647dab9e1136bd0971cb3d6c57456`
- Final ready-for-review head: derive with `git rev-parse HEAD`; C00 records
  the exact observed remote head.
- Claim: `68340416-7e06-4986-a125-59d81b500a0b`
- STUDENT_NOTIFICATIONS lease:
  `45041adc-a69f-4065-a179-b94473967c94`
- Lease released: `2026-07-29T06:58:11Z`, before
  `2026-07-29T07:26:07Z`.

## Implemented behavior

- All eight WNC-8 Student categories render the locked titles, bodies, action
  labels, and category lifetimes.
- The exact event type, source entity, recipient Student, and source version
  tuple produces the stable dedupe key and notification identity. Exact retry
  replays; a later version supersedes the prior action; cancellation
  supersedes reminders and schedule changes.
- Active notices support Unread, Read, and All. Mark-one and mark-all-read are
  persistent and idempotent. Expired notices remain only under All for 30 days
  with disabled actions and `No longer available`, then archive.
- All actions are internal Student routes. The server rechecks recipient
  ownership, current lifetime, supersession, and source authorization at open
  time and returns the same neutral unavailable decision after revocation.
- Private question/support bodies, provider URLs, markup, cross-Student scope,
  unsafe routes, and announcement lifetimes over 90 days fail closed.
- Sound preference is persisted and defaults off. The cue gate permits only a
  newly created unread notice while the portal is foregrounded, browser
  interaction permits audio, and the visual notice is already rendered.
- The accessible controlled notification center exposes polite unread status,
  filter state, read controls, disabled stale actions, and the explicit
  default-off sound preference without background push or provider behavior.

## Immutable digests

- Implementation head:
  `c1dc94bedac647dab9e1136bd0971cb3d6c57456`
- Thirteen-artifact raw Git-blob aggregate:
  `804943c420d2a64e569620642c15d51ce239988bb5104cefbd6f317b51490580`
- `P23-migration-001`:
  `ef08dd14bca405a89b180d1d3dcedd5b97f75d8eec76584fbc2c890c5ca23aa3`
- `P23-registration-001`:
  `2b3336ee8ac935344d9bd1d561cb35a1013ee9fb40766e23ebfd19b8a9ac9131`
- Steward-request aggregate:
  `144e8ebba8926bb2bb3bc8c64f5923829cda17e3cf1f0816fdbe685e0afc7511`

The artifact aggregate is SHA-256 over sorted UTF-8
`path=raw-Git-blob-SHA-256` lines joined by LF with no final newline. The
request aggregate uses the same path/payload-digest construction.

## Verification

- Focused Vitest: 3 files and 13 tests passed.
- Workspace TypeScript typecheck: passed.
- Focused ESLint and Prettier: passed.
- Exact owned-path audit and diff hygiene: passed.
- Secret scan: passed across 2876 repository text files.
- The prescribed pre-UI brand check reached only the inherited out-of-scope
  raw-color failure in `scripts/ops/validate-ot-launch-governance.ts`; P23
  adds no color, style, token, or brand primitive.

## Steward boundary

`P23-migration-001` asks F02 to allocate the forward-only schema migration.
`P23-registration-001` asks I36 to export and mount the isolated roots. Neither
request was applied. No migration, central composer, registration, root barrel,
package file, provider, sender, or external effect was changed.

## Exact next action

C00 and I36 should independently verify the final remote head, exact
implementation ancestry, 18-path scope, 13 artifact hashes, two immutable
request hashes, focused checks, released lease, and zero effects before
integration. P23 must not resume without new exact authority.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.
