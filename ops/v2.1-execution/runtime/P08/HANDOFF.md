# P08 Bounded Correction — Ready for Review

## Exact identity

- Branch: `codex/v21-p08-family-signup`
- Correction claim: `e9148002-e9ff-4b7c-ab6e-63080c66bd00`
- Atomic claim head: `53e1ef74fc988aab22d12d6716f30cb841130fde`
- C00 reconciliation: `398bc9b1e502652ac0af5700fdedd8cc57c92d91`
- Reconciliation sole parent: `382ea5193b1de8fc8cd2844dde362106a8a0f57f`
- Correction implementation: `c903d1df6a0c3ee94a700fe62b4e1c0b3c3eeb72`
- Correction verification/steward request head:
  `3f030e734e31da548ace6ca619f38eb27968f3a4`
- FAMILY_SIGNUP lease: `23274fa2-66cc-4cfd-8d6c-ba659d70a323`
- Lease released: `2026-07-29T01:49:19Z`
- External effects: authority none; attempted 0; succeeded 0; reconciled 0

## Corrected behavior

Public Family signup now treats every existing local HumanAccount identity and
every existing Family household lifecycle—active, expired, archived, or
inactive—the same way: it returns the generic `existing_account` /
`sign_in_or_reset` result and performs no household, access, credential,
receipt, outbox, or session write. Creating another household for an existing
account remains a separate authenticated operation.

GHL-only matches remain distinct and may create a fresh local account while
linking the verified adult CRM contact.

The server rejects caller request hashes, short or structurally weak keys, and
invalid scope. It computes the semantic digest from canonical name, normalized
email, timezone, legal acceptance, and a server-keyed password fingerprint.
Request locking, local-state reads, GHL evidence, recovery, receipts, commits,
and outbox intents bind to exact scope plus `public_family_signup`. Recovery is
allowed only for an exact scope, operation, key, and digest match; cross-scope
or changed-payload replay returns only `idempotency_conflict`.

## Superseding interface

- Contract version: `1.1.0`
- Contract implementation:
  `c903d1df6a0c3ee94a700fe62b4e1c0b3c3eeb72`
- Metadata checkpoint:
  `ca06599ffbe62d7c617235f9e54f5ded57e4b6c7`
- Contract digest:
  `922f9624679581868b598f4b89c94a5d2e53d650a2cd32e87a0ce88945002b0c`
- Export artifact SHA-256:
  `3fa2d6280baa0725de15fe277b77affd1dcce0dc46c5c8eeb83c6612382ab9a5`
- Supersedes checkpoint:
  `b7601c002d2c37d0ef7760c328015f9a8d590893`
- Supersedes contract digest:
  `f54e4381b53aa83522a2b15561a51a03319272a439afa8657c13655776c0d23c`

P09 must consume only the superseding interface after C00 integration.

## Verification

- Focused P08 Vitest: 4 files, 16 assertions passed.
- Targeted ESLint: passed.
- Repository TypeScript typecheck: passed.
- Focused Prettier and `git diff --check`: passed.
- Secret scan: passed across 2720 repository text files.
- Full unit suite: 566 passed, 1 inherited out-of-scope failure.

The sole full-suite failure is
`tests/unit/highlevel/sender-registry-v1-1.test.ts`, which expects 19 automation
assets while the integrated registry contains 22. P08 owns neither file.

## Steward requests

- Migration request SHA-256:
  `df97bdacc1ca40b7ad438304f96f6d78dd160786daf0a29de838654dc7599d8e`
- Registration request SHA-256:
  `f23ed447b12d7728ebd57f5e13888cda54536927364fff8725c20ce95c8c98a0`

No migration, route, barrel, composer, shared registry, manifest, lockfile, or
provider state was edited.

## C00 action

Review the exact pushed ready-for-review head, reconcile the lease release, and
admit the corrected P08 implementation and superseding interface checkpoint if
accepted.
