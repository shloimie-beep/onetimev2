# P21 Composite Projection Correction — Final Handoff

## Exact identity

- Branch: `codex/v21-p21-content-publication`
- Adopted integration and correction parent:
  `99fd8c33ea023e838d8ee9c993b5de52f4763e7f`
- Reconciled atomic claim:
  `d3ee9a2ba7933663544af2bc22f6873794162986`
- Implementation commit:
  `7e2a269e564507b560fa07d826169ff670dfba36`
- Integrated P20 projection authority:
  `75137bf476b4a1773f29bb41a6a149148df2623d`
- Substantive control:
  `246990489b99575c3ded7af18ab22571d2fcb3a6`
- Claim:
  `9e38d9dd-8293-451d-9335-ddb466e7234e`
- Released `CONTENT_PUBLICATION` lease:
  `eb2c3340-baa7-493c-afc1-bcb050911bb4`
- Authorized 14-path inventory:
  `92698702ddafb76e5ea660ae0ce7fa1314b02dba86b5fe35be839b76003f5c61`

## Completed correction

P21 now consumes P20 `ApprovedForPublicationProjection` only through the
server-injected typed repository and exact server-derived `accountKey`,
`productKey`, and current `contentVersionId`. Approval evidence and composite
scope are not accepted from public command bodies. The projection structure,
seven required approved artifacts, participant snapshot, Admin identity/time,
and P20 projection digest are verified before approval.

Canonical request hashes bind scope, content/version, exact projection
evidence, expected version, and semantic payload. Exact replay converges;
changed evidence or request semantics conflicts. Composite scope and immutable
approval evidence or its digest are preserved through receipts, publication
outbox, F05/F06 accepted-operation correlation, atomic materialization,
assignments, library projections, protected notices, playback facts/grants, and
Student resume. Cross-scope, missing, stale, malformed, non-approved,
Admin-mismatched, readback-mismatched, and partial-transaction states fail
closed.

The exact five focused files pass all 15 tests. Workspace typecheck, focused
ESLint/Prettier, YAML, parameterized composite SQL, scope, provider-reference,
secret, hash, and diff gates pass. The 17-artifact aggregate is
`fabbd6499db0639f130c6ba7385d0e9b2b9b0b2d995e498b72a74f60cddff04c`.

## Immutable steward proposals

P21 published exactly:

- `P21-MIGRATION-002`, raw SHA-256
  `aab270cb40f12885ea89acbdc4308e0d1ffa9cf89ae48d7e0cca6c5445985a45`
- `P21-registration-002`, raw SHA-256
  `af851f718e99945fed2d9b805a93fa20a0cea815a42ce33f2c22fda8c52ac45d`

Immutable mixed `P21-registration-001` remains byte-identical, unapplied,
superseded, and withheld at raw SHA-256
`fb372a6d329ddde76952f5637e351ba2990e15589e9c37f957e06e4eedf9bdf3`
and canonical SHA-256
`b47894b8827ba9e098725355215dda28b408f8668ab5cc3ad8d0a47019d3b61a`.
The three-request aggregate is
`7fb0017a549a560c119550d42386ad30f64b6a791a9f7a5ac42721e3dfdeb6f1`.
No request was applied and no migration ordinal was allocated.

## External effects

Authority was `none`; attempted `0`, succeeded `0`, reconciled `0`. No
provider was inspected or mutated, no deployment or send occurred, and no
effect lock was held.

## Exact next action

C00 independently audits the pushed final for exact ancestry, 14-path scope,
artifact and request hashes, focused gates, released lease, preserved P20 and
`P21-registration-001` bytes, remote equality, and zero effects. F02 and I36
may independently disposition the two corrected proposals only under later
authority; nothing in this handoff applies them.
