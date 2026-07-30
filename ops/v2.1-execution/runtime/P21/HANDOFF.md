# P21 Publication Scope Correction — Final Handoff

## Exact identity

- Branch: `codex/v21-p21-publication-scope-correction`
- Exact start: `7185d45b2dbcf157aa9e4f7cbcea02cc516ecf7d`
- Pushed containing control: `a58965e989a9dab81d079a8d02afe23aab146fb8`
- Controller authorization/state basis:
  `4ea98556cd03ccc0df1a5286d61ee3cfdbfb82b4`
- Claim: `00402ed6-57b7-4aed-92fa-a558ae11aef1`
- Implementation commit: `7b51bae186728351ff1cf93b1c02fcba893b1051`
- Lease expiry: `2026-07-30T14:23:56Z`
- Authorized scope: six source paths and the three P21 runtime files.

## Completed correction

Publication receipts now require and persist exact `contentVersionId`,
`publicationGeneration`, and `approvalProjectionDigest`. Replay checks all
three against the current record; pre-approval attachment retains the exact
content-version digest fallback, while approved and published operations use
the P20 projection digest.

Student resume now requires, persists, and queries the exact
`contentVersionId`. Content publication outbox, assignments, library
projections, and protected notices use composite account/product/identifier
conflict targets. Existing provider completion correlation remains composite
and unchanged. Request bytes and provider/effect paths were not changed.

Verification passed:

- five focused files and 17 tests;
- workspace typecheck;
- focused ESLint and Prettier;
- secret scan across 3,087 text files;
- diff, exact-scope, and immutable-request checks.

The six-source-artifact aggregate SHA-256 is
`1ddfb7f2ddee9b25af0dc1b2352bb440ccf22e4ecfe347b4d67c48bad93d8a7c`.

## Immutable request evidence

- `P21-MIGRATION-002`: raw SHA-256
  `aab270cb40f12885ea89acbdc4308e0d1ffa9cf89ae48d7e0cca6c5445985a45`
- `P21-registration-001`: raw SHA-256
  `fb372a6d329ddde76952f5637e351ba2990e15589e9c37f957e06e4eedf9bdf3`

Both remain byte-identical. No request was applied and no migration, provider,
deployment, send, or other external effect occurred. Effects are `0/0/0`.

## Exact next action

C00 independently audits the pushed final for authorized ancestry, exact
nine-path scope, source and immutable-request hashes, focused gates, normal
remote equality, and zero effects. C00 must also reconcile the claim and
lease; this handoff does not claim that the active lease was released.
