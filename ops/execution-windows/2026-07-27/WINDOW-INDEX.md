# 2026-07-27 executor window index

This is a pointer-only index. It does not copy status, completion, blockers,
SHAs, PRs, provider truth, or next-action authority. Read the current
[`BOARD.yaml`](../../goals/OT-LAUNCH-01/BOARD.yaml) row before continuing any
window.

| Window             | Canonical Board pointer                          | Packet                                                    |
| ------------------ | ------------------------------------------------ | --------------------------------------------------------- |
| `02-OT-ZOOM`       | `zoom_real_control_operator_change_set`          | Existing provider task; intentionally not duplicated here |
| `03-OT-GHL`        | `audit_wave_03_ghl_full_inventory`               | [`03-OT-GHL.md`](03-OT-GHL.md)                            |
| `04-OT-PRODUCT`    | `audit_wave_04_runtime_classification`           | [`04-OT-PRODUCT.md`](04-OT-PRODUCT.md)                    |
| `05-OT-HYGIENE`    | `audit_wave_05_preservation_census`              | [`05-OT-HYGIENE.md`](05-OT-HYGIENE.md)                    |
| `06-BNA-CONTROL`   | `audit_wave_06_bna_control_pointer`              | [`06-BNA-CONTROL.md`](06-BNA-CONTROL.md)                  |
| `07-OT-PRODUCTION` | `production_pilot` plus the audit dependency DAG | [`07-OT-PRODUCTION.md`](07-OT-PRODUCTION.md)              |

The audit checkpoint and dependency-only evidence are under
[`ops/audits/2026-07-26/parallel-control-tower/`](../../audits/2026-07-26/parallel-control-tower/README.md).
