MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Resume P33 only after C00 has consumed the exact atomic follow-up claim head.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p33-runtime-operations
Task state: ops/v2.1-execution/runtime/P33/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P33/HANDOFF.md

Follow-up correction claim authority binds containing controller
107fdea29e5ba852d3c41740d964bf25d8a1ed46, acquisition
7b1aae190d4bf6eb9b36fc2521345ac976c49ff8, exact parent/rejected final
160299371e203f84a5af3f87bfd5c8e8115a5063, ready digest
06ddf0377b93d940b8f0e1a2e44cb4cb29a43232387f1d86ba99b2497344122c,
claim a3a5253b-019d-4600-aa04-1da9ff1eccea, and OPERATIONS_RUNTIME lease
12ddddaa-2196-47ca-b63a-a20d9b3ad124 expiring 2026-07-29T03:52:01Z.

Before repair, verify C00 consumed the exact remote claim head, local and remote
equal it, and the lease remains valid. The 399aedd5/f05cc7fb/16029937 lineage
is rejected pending correction.

Repair exactly these reproduced defects:

1. `scanOperationalLeakage({street_address:'private-value'})` currently passes.
2. Queue depth `10` / `retry_count` `9` without scheduled/exhausted retry
   evidence currently remains healthy.
3. Active lease age `600000ms` with fencing-token high-watermark `1` currently
   remains healthy.

Add direct negative regressions, update the semantic interface and steward
metadata if their committed artifacts change, run full verification, update
the three runtime files, release the lease, commit, and push. Do not edit shared
composers, manifests, lockfiles, migrations, provider registries,
backup/restore, or canary-budget surfaces. External-effect authority is none.
