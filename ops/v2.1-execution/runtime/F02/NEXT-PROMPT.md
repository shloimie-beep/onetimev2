MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Audit the exact F02 migration 2250–2252 runtime acknowledgment checkpoint.

Require canonical control `c44656d40769b28f2d55e6e1041d716175129f4a`,
controller authorization `98e7b05c7d256d55fd8a4dbd829230e42303e67e`,
authorized integration parent `8634b2ab15df624576a88b31182ebdc68553ff74`,
prior remote F02 head `26234c47e5bc92f4d3392d77d98bc3a758d25189`,
READY digest `d8303358cef529777a0ced6ef7463261d0c622fca1ecb12dcd39b552dddf3841`,
claim `c6e15ead-7f47-46f0-aaea-6fe00cd4338b`, and MIGRATION_AUTHORITY lease
`203f8836-7958-4791-afb0-764a289a9ac0`.

Require an exact sole-parent child of `8634b2ab` with only the F02
`TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md` changed. Verify three
separate acknowledgments for `P17-MIGRATION-002`, `P18-migration-003`, and
`P21-MIGRATION-002`, including their exact canonical request digests, producer
source heads, migration paths, Git blobs and checksums, native proof `39cacd4a`,
evaluated target `dd944eee`, and merge/release `526f0384`.

Confirm immutable request and migration bytes, YAML, formatting, diff hygiene,
secret scan, lease release before `2026-07-30T21:30:53Z`, clean remote equality,
and effects `0/0/0`. Derive the exact state/handoff and runtime-triplet digests
from the pushed bytes for independent C00 disposition.

Do not claim or mark a central steward result applied. Stop for independent C00
audit. Do not edit migrations, allocation proposals, product or control files,
merge, inspect providers, deploy, backfill, send, charge, or perform external
effects.

# Audit the Migration 2251 Checksum-Metadata Correction

Audit the exact successor of held terminal
`bd17fd6fc11cc122ea452b131e1107dd0bb88fcc` under authorization-containing
control `4be94c1697b86d0fab8066590be5e62a926798f7`, READY
`d2e9a20bb40a9df079193425dbbcd3d8ab1acc6b3b66e21a9d41e1d001013c82`,
claim `07870f1c-ed37-4637-a92f-708f80fb36df`, and MIGRATION_AUTHORITY lease
`35b6ed2e-7863-493c-8d5e-dee6850f5110`.

Require exactly four changed paths: the F02 allocation proposal and runtime
triplet. Recompute migration 2251's repository-runner checksum as
`ee0f961687e25ccd60e700d8a58cd9e11e71de1187e68fe517d684992eccdf36`
from immutable Git blob `4bd4afdc152dd47977d7ab0aaeee246d5f75a16f` using the
`packages/db` runner transform. Confirm all three current metadata occurrences
are corrected and no stale `fd4cdaa3...` value remains except explicitly
labeled historical evidence.

Confirm the prior malformed 62-hex P17 value is recorded only as historical
evidence and the active authoritative request digest is the immutable
64-character value
`e4aed5ae31c5143deb230aa3a9e76f6bca0fd6857d22a4bec7e815f3b78624ca`.
Verify immutable request and migration bytes, YAML, formatting, diff hygiene,
secret scan, timely lease release, clean local/tracking/live remote equality,
and effects `0/0/0`.

Require the separate 2250-2252 acknowledgments, proof `39cacd4a...`,
merge/release `526f0384...`, and
`central_steward_results_applied: false` to remain exact. Do not apply a
central result, merge, execute a migration, inspect providers, deploy, send,
charge, or perform any external effect. Stop for C00 admission.
