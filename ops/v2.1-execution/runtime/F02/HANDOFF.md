# F02 Migration Lease B Semantic Renewal Atomic Claim

- Claim parent: `6a5e359c0a7dae56542741126974a571af5da5a9`
- Containing control: `4c15cb1af043727ac9eed01dd7996f6a6a6c0997`
- Sole control authorization parent: `cc71835caf5f73a9642adf135efd25d21528f83f`
- READY digest: `635c8923ed3aa11f3dbcf11b1195a22235ce150e43284de265b48f1b0f7da8bd`
- Renewal claim: `2002fc61-531d-4b4c-b0c0-c65b3468b8c5`
- Shared MIGRATION_AUTHORITY/SCHEMA_CONTRACT lease: `4d52c050-fd00-4240-a029-48d4f27f6820`
- Lease expiry: `2026-07-30T00:39:23Z`
- Effects: `0/0/0`

The first implementation attempt stopped without commit or push after a semantic
audit found material blockers: P27 classification/complimentary compatibility;
P16 occurrence schedule columns, evidence-preserving state reconciliation, and
exact create-capable canonical backfill; P24 exact kind/category, author
identity, structured redacted intent, and false invariants; P32 scoped lifecycle
enums and lowercase digest enforcement; P10 complete composite scope, exact
credential validation, and append-only audit; P23 exact semantic dedupe; and
final checksum regeneration after SQL stabilization.

This commit claims only `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`.
The six untracked SQL drafts and dirty allocation proposal remain byte-identical
to the stopped draft. No semantic correction or checksum regeneration occurred.

Stop for C00 reconciliation. Do not edit SQL or the proposal, register, inspect
providers, deploy, send, integrate, or perform external effects beforehand.
