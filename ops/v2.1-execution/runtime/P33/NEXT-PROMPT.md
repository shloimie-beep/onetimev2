MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Resume P33 correction only after C00 has consumed the exact pushed correction
claim head and explicitly resumed the task.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p33-runtime-operations
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P33.yaml
Task context: ops/v2.1-execution/contexts/P33-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P33/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P33/HANDOFF.md

Correction authorization uses containing controller
b0aeb1d1ba9ed25b27b7b519b9f06ba6bbbe7dfc, sole parent/acquisition
c743420931244135bcd61578ea1f322851b325a8, exact existing head
122608b516046f9c2b93b18256573232b9958137, ready digest
639b020e9df4dd07e1394aa40a3053d9e7d7cdd6471a7923ef57701d2c009ad6,
claim 9f112031-01ef-4117-986d-27465a06d19e, and OPERATIONS_RUNTIME lease
76b4bb8b-af8b-4fcf-9ed7-4054ed8fe57a expiring
2026-07-29T02:39:10Z.

The preserved 1a5a9c1d/0e674da7 interface with digest 9ac5c08a is pending
correction, not admitted. Before product work, verify C00 consumed the exact
remote correction-claim head, local and remote P33 equal that head, and the
lease remains valid.

Then correct every C00 finding inside P33-owned roots: require truthful nonempty
queue/worker/provider evidence; complete credential-key and final-response
leakage scanning; bind migration inventory truth to the candidate; validate all
runtime artifacts against candidate role expectations; derive worker readiness
from observations; implement exact Admin authorization rather than defer it;
and correct the deploy steward request digest. Republish the exact interface
checkpoint if exported artifacts change.

Do not begin any repair before reconciliation. Do not edit shared composers,
manifests, lockfiles, migrations, provider registries, backup/restore, or
canary-budget paths. External-effect authority is none.
