# F04 Ownership-Transfer Revocation Correction — Final Handoff

## Exact identity

- Branch: `codex/v21-f04-household-identity`
- Canonical control: `c44656d40769b28f2d55e6e1041d716175129f4a`
- READY parent: `98e7b05c7d256d55fd8a4dbd829230e42303e67e`
- READY digest: `1c8541d27f0e96522bc877ef7b74023b8861168088cbd5457b4ca980e7e07a06`
- Expected pre-correction task head: `a5868a9503d1037890f5f8e250c2afe5131c4331`
- Authorized integration start: `8634b2ab15df624576a88b31182ebdc68553ff74`
- Product commit: `2834f79b9e45f7c310de037adf07c8ffc7ed50b7`
- Terminal runtime commit: derive with `git rev-parse HEAD`; C00 records the exact pushed remote head.
- Claim: `dba6e4fc-04d0-4245-94e8-cc722e73b013`
- Released `ACCOUNT_HOUSEHOLD_IDENTITY` lease:
  `9e8691f9-a6c3-4386-9c1e-7aeef8db6578`

## Completed correction

Outgoing Parent sessions are now selected only when their
`activeHouseholdId` is the transferred household. The regression inventory
contains a second active Parent session for a sibling household and proves it
is not revoked.

Transfer persistence now uses fixed migration-2235-compatible SQL:

- adult sessions set `revoked_at`, canonical `revoke_reason`, `updated_at`, and
  increment `version`;
- issued, unused billing sessions set `state = 'revoked'`, `revoked_at`, and
  increment `version`;
- unused action tokens use canonical `action_token_id`, set `revoked_at`, and
  increment `version`.

Each nonempty inventory must contain unique identifiers and update exactly its
requested count. Missing, stale, used, or already-revoked rows produce
`stale_version`; the caller transaction therefore rolls back household,
transfer, session, billing, token, intent, and audit mutations together.
Public repository symbols and signatures used by F03 are unchanged.

## Evidence

- Focused contract/domain/service/repository suite: 25 passed; the three native
  tests were intentionally skipped without the disposable opt-in.
- Native PostgreSQL 16.14 repository suite: 14 passed after applying exact,
  unchanged migrations 2234 and 2235.
- The native proof covered the successful mixed revocation, exact version and
  state readbacks, sibling-session preservation, and a late used-action-token
  failure after earlier writes that fully rolled back.
- The exact disposable native database and role were removed.
- TypeScript, focused ESLint, focused Prettier, Git diff hygiene, YAML,
  interface/digest/immutability checks, and the 3,104-file secret scan passed.

Artifact digests:

- repository pair:
  `a7db7cafefe1202100574dbe88cc82fb4f6b9f0f262d32d5374bdf06e3d4cc91`
- domain pair:
  `8d15fa7d8e9516ac42105a34b5f6f5ba654336b4c674a0ed735710da11ea46be`
- four-file product:
  `c87d04c097ca12496b602a765634017902994568428af9fc6110d50d245b0a85`
- interface contract 1.0.1:
  `79176042f6fef736e27c9280e89d116146c515bf3ab275360f31784fed587e33`
- runtime triplet: reproduced from the terminal commit and reported to C00.

## Remaining action

C00 independently verifies the exact pushed terminal head, authorized
eight-path diff, product ancestry, artifact and runtime digests, interface
checkpoint 1.0.1, native rollback proof, released lease, and effects `0/0/0`,
then admits F04 through I36. No additional F04 implementation or any provider
effect is authorized by this completed source correction.
