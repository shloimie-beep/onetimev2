# OT-72 Decisions

## DEC-OT72-001 - Branch Point After Candidate SHA Mismatch

- Prompt requested the recorded canonical candidate SHA to match the fetched remote head.
- Fetched `origin/codex/ot60r-recovery-convergence` resolved to `dfef7de2035e08f1ee72e0133ccf656fe7a74444`.
- `ops/execution/control/CANONICAL-CANDIDATE.json` recorded candidate code SHA `9e275e28a80cc8bf7fa82ade1092cd8cc21510d4`.
- The recorded candidate SHA is an ancestor of the fetched source branch head.
- The post-candidate source diff contains control/evidence/format files only, not provider or app runtime code.
- Decision: branch from fetched source branch head to preserve remote checkpoint/control files, and record `9e275e28a80cc8bf7fa82ade1092cd8cc21510d4` as the canonical candidate code SHA.

## DEC-OT72-002 - External Action Default

- No provider-readiness work happens before the initial packet is committed and pushed.
- No live charge, live send, deployment, DNS change, production database mutation, webhook registration, or provider mutation is authorized in this branch.
- Test/sandbox provider calls require exact protected config gates and must be checkpointed before and after execution.
