# 03-OT-GHL

Canonical assignment:
`BOARD.yaml#tracks[id=audit_wave_03_ghl_full_inventory]`.

## One-line continuation prompt

Continue 03-OT-GHL from the current Board row `audit_wave_03_ghl_full_inventory`: verify the protected One Time HighLevel location without returning its identifier, perform exactly one exhaustive read-only inventory, write only the sanitized result path, and keep every mutation, save, publication, enrollment, send, contact-change, and deletion counter at zero.

## Assignment

- Window ID: `03-OT-GHL`
- Task ID: `OT-LAUNCH-01-W03-GHL-FULL-INVENTORY-02`
- Repository: `shloimie-beep/onetimev2`
- Branch: `codex/w03-ghl-full-inventory-20260727`
- System: protected One Time HighLevel location, read-only
- Concurrency lock: `GHL-PROVIDER`
- Acceptance IDs: `AUDIT-GHL-INVENTORY-001`
- Result path:
  `ops/execution-windows/2026-07-27/results/03-OT-GHL-result.json`
- Dependencies: accepted A01–A12 audit checkpoint and current Board assignment;
  no second GHL browser writer
- Exact write scope: the sanitized result path only; provider access is
  read-only

## Required inventory

Inspect workflows, Email Marketing campaigns, Conversation AI, knowledge
bases, all visible folders/ancestry, archived/deprecated states, unknowns,
duplicates, and cross-kind collisions. Prove or fail to prove OT-C01
campaign/wrapper separation, OT-E01 disabled-action identity, OT-A1 identity,
canonical/legacy KB attachment, and archived/hidden AI coverage.

If any required surface is unavailable, return
`UNPROVEN_UI_SCOPE_UNAVAILABLE`; do not claim exhaustiveness.

## Forbidden behavior

Do not save, publish, activate, enroll, send, create, rename, move, archive,
restore, delete, or change a contact. Do not return raw provider IDs, the
protected location identifier, private destinations, customer/Student data,
message bodies, screenshots containing private content, or secrets. PR #116
and generated queues are not authority.

## Required proof and stop

Return safe identity digests, full coverage matrix, readback timestamp,
unknowns, and explicit zero counters. Stop before any mutation path, on
location mismatch, unavailable hidden/archived scope, or ambiguous identity.
No repetitive browser smoke or screenshot matrix is required.
