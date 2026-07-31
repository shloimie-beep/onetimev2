MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: REVIEW

Perform exactly one independent correction review of the pushed terminal on
`codex/v21-p12-parent-household-concrete`.

Authority is live control
`f8d9059b53d0e62cefa0bdb3bced312f3d2e3dd5`, READY basis
`321fd3482d5ee54bbad19d97205b54845d0d0aac`, READY digest
`538a416e944278120e5e490b3e3e102134ae01c205478e177047a509fc8aabe0`,
claim `c2fee1f8-2f7f-4cc7-bec9-cc0695ec3cb4`, writer
`codex-p12-replay-concealment-c2fee1f8`, and released lease
`1d841d45-043c-4e33-8f3d-0c635faa68d0`. Effects are `0/0/0`.

Require clean local/tracking/live equality and exact preservation of the
existing ordered parents:

1. `ae3ced8a9daa11044d4278968c14cb6baa12a480`
2. `9ada912c3238421e661f89e590c07c042dd6424b`

Review exactly the ten authorized paths with inventory digest
`c816e5a6cc91f4326ee8552142e747b196b4ec3c454a4cee424c4ad16bc1dcee`.
Reject any other authored path, history rewrite, external effect, or mutation of
an existing immutable steward request.

Verify the three held P2s are closed:

1. `password_hash_factory` is lazy across the exported repository contract,
   service, and PostgreSQL repository. It executes exactly once only after the
   advisory lock, authenticated scope/read-only/inactive gates, locked receipt
   miss, mutation validation, and normalized username availability. Racing or
   sequential exact replay hashes and writes zero times and returns no
   credential handoff.
2. Mismatched create/reset confirmation fails before any receipt lookup,
   household load, hash, ID allocation, write, or credential response, including
   when a matching receipt exists.
3. Update constructs and validates its owned target before username
   availability and queries only the normalized validated target. A
   wrong-household target remains uniformly concealed regardless of global
   username state or attacker-supplied Student ID.

Require the focused 31-test result, disposable native PostgreSQL 18.4 eight-test
race/rollback result, focused lint/format, exact interface preimage, immutable
request bytes, scope, and diff hygiene.

Semantic interface `1.2.0` digest is
`f9c323080c32925864f780fb05981850644ba3a91a2303fa3f282bc7461378d9`.
Record the new terminal commit as its implementation and metadata checkpoint.

Steward disposition after PASS:

- retain and apply `P12-server-registration-002` raw SHA-256
  `7613a0c268faca7cb1fac830b3f4f97f502677e0fe2254360f9342820cc1c00f`;
- retain and apply `P12-client-route-002` raw SHA-256
  `0731b9cc4dad55f26d26d9080b3eeba2b6e18739954de49b6a1d6c87d0e163c8`;
- reject and withhold immutable stale `P12-barrel-export-002` raw SHA-256
  `2a82d0963bff76d05e9290f8648c232468fb1d9f0078c958657bb44e1621322d`;
- admit and apply only `P12-barrel-export-003` raw SHA-256
  `d3a72cb8cd794e548d06e1602582370f1aeda2889431dd7104e02d7adc5e40b6`.

On PASS, C00 dispatches one ordered P12-then-P09 I36 source microbatch. Do not
begin I36 integration from this P12 branch. Do not edit control, integration,
central composers/barrels, migrations, providers, candidate, deployment, DNS,
send, charge, or customer state, and perform no external effect.
