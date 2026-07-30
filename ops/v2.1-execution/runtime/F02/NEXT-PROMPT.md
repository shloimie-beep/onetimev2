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
