MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: AUDIT_ONLY

Audit the completed F04 ownership-transfer revocation correction.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-f04-household-identity
Authoritative control ref: origin/codex/v21-control
Canonical control: c44656d40769b28f2d55e6e1041d716175129f4a
Authorized integration start: 8634b2ab15df624576a88b31182ebdc68553ff74
Product commit: 2834f79b9e45f7c310de037adf07c8ffc7ed50b7
Task packet: ops/v2.1-execution/tasks/F04.yaml
Task state: ops/v2.1-execution/runtime/F04/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/F04/HANDOFF.md
Interface: ops/v2.1-execution/runtime/F04/INTERFACE-CHECKPOINT.yaml

Verify the exact pushed terminal head and its product-commit ancestry; only the
four authorized product/test files, interface checkpoint, and runtime triplet
may differ from integration 8634b2ab. Reproduce the repository pair
`a7db7cafefe1202100574dbe88cc82fb4f6b9f0f262d32d5374bdf06e3d4cc91`,
domain pair
`8d15fa7d8e9516ac42105a34b5f6f5ba654336b4c674a0ed735710da11ea46be`,
four-file product
`c87d04c097ca12496b602a765634017902994568428af9fc6110d50d245b0a85`,
interface contract
`79176042f6fef736e27c9280e89d116146c515bf3ab275360f31784fed587e33`,
and terminal runtime-triplet digest.

Confirm exact transferred-household Parent-session selection, sibling-session
preservation, fixed migration-2235-compatible revocation SQL, unique exact
row-count enforcement, stale-version failure, native PostgreSQL positive and
late-failure rollback evidence, immutable contract/migration/request bytes,
public F03-consumed repository signatures, released claim/lease, normal remote
equality, and external effects `0/0/0`.

If all checks pass, admit the exact terminal head through I36. Do not continue
F04 implementation or perform provider/candidate effects without a new exact
READY authorization.
