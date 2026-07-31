MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: REVIEW

Review the pushed P12 two-parent terminal merge on
`codex/v21-p12-parent-household-concrete`.

Authority is containing control
`48f27d399d4ed714f6219487629c406af1fbb49f`, state basis
`cc03a0c8f73339c05e3fbe0179661882169b32d9`, READY digest
`3be08e42202e106064ba7b1c092615117ca3b7de60e4b4e07f8f872d7c1d9c61`,
claim `77d55d69-8496-4f7e-b441-6bed1e83f819`, and writer
`codex-p12-concrete-correction-77d55d69`. The sole PARENT_HOUSEHOLD_UI lease
`302b8602-ec7c-4e81-9562-f792c6fb6e4c` was task-locally released at
`2026-07-31T15:08:37Z`; effect locks are empty and effects are `0/0/0`.

Require exact ordered parents:

1. `ae3ced8a9daa11044d4278968c14cb6baa12a480`
2. `9ada912c3238421e661f89e590c07c042dd6424b`

The original merge tree before correction was
`4e920e58567de5cdd18e8515e30edc0699c74315`. Require clean
local/tracking/live equality and derive the exact terminal commit/tree from the
remote. Verify exactly 19 authored authorized paths plus byte-identical carried
`P12-migration-001`; reject history rewrite or squash.

Review the concrete PostgreSQL repository, authenticated Parent router,
same-origin client API, and persisted forms. Preserve server-derived
adult/role/session/household scope, CSRF, status-only inactive overview,
inactive replay denial, optimistic revision, concurrent three-seat cap,
required actual name and optional display name, globally unique username,
Argon2id credential hashing, server-keyed password fingerprinting for receipt
hashes, atomic enrollment/audit/revocation/readback/receipt persistence, exact
replay versus mismatch, no replayed credential handoff, wrong-household
concealment, and full rollback.

Semantic interface `1.1.0` digest is
`778488b8ed4f8db8dacb24788ac88e44c2084e1f2b4523dc6370f1664c967c20`.
Record the terminal merge SHA as both interface implementation and metadata
checkpoint in control.

I36 should admit and disposition exactly:

- `P12-server-registration-002` —
  `7613a0c268faca7cb1fac830b3f4f97f502677e0fe2254360f9342820cc1c00f`
- `P12-client-route-002` —
  `0731b9cc4dad55f26d26d9080b3eeba2b6e18739954de49b6a1d6c87d0e163c8`
- `P12-barrel-export-002` —
  `2a82d0963bff76d05e9290f8648c232468fb1d9f0078c958657bb44e1621322d`

`P12-registration-001` is immutable superseded evidence only and must never be
edited or applied. `P12-migration-001` is immutable fulfilled evidence carried
byte-for-byte from the second parent. Migration 2255 is already integrated and
must not be edited.

After central P08/P12 composition, I36 runs the full mounted Parent
refresh/logout/re-login persistence journey. Do not broaden P12 to edit central
composer, app, root barrel, migration, package, global style, control, queue,
provider, candidate, or integration files, and perform no external effect.
