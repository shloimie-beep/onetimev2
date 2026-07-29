MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Reconcile the F02 Migration Lease B atomic claim.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-f02-schema-state-migrations
Parent before claim: e156003b243221f97f938a0aca16164c1dd86d2d
Containing control: 7d8b9ea0b2a297e445a2efa3a3934695a33445cf
Sole acquisition: 0d6b35ed4247aa857cc540efeefbceebe421a687
Authorized integration: 1798f31b5f698c80ee2babbd6414e9934745a178
READY digest: fe2adafd933c848fa9e4b2efb4809f9edc733e42c8f43b71f30ec5b5b9a8df6b
Claim: e2a7b9ff-ce58-495e-b164-84d9299250d0
Shared lease: cad3d0dd-59a2-44dd-87fb-6597978daaaf

Require the claim commit to have the sole parent above and change exactly the
F02 runtime triplet. Confirm requester bodies were not read and the proposal,
SQL, product, control, registration, provider, and all other paths are
byte-identical.

Verify the opaque P16/P32/P10/P23/P24/P27 producer heads, request IDs, Git
blobs and digests, ordinals and filenames `2239` through `2244`, next ordinal
`2239`, forbidden ordinal `2231`, zero collisions, the live shared lease, no
effect locks, and effects `0/0/0`.

Stop for C00 reconciliation. Do not resume F02 to read requester content or
edit the proposal or SQL until C00 has reconciled this exact claim head.
