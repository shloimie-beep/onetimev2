# OT-60R Migration Ledger

Migration blob checksums are Git blob IDs at each PR head.

| PR | Head | Migration | Blob checksum | Decision |
| --- | --- | --- | --- | --- |
| #2 | `4ac288968ba2` | `packages/db/migrations/0002_crm_auth_core.sql` | `1fd4f7764f059f20112b488778709055d69ec276` | Canonical base, keep. |
| #2 | `4ac288968ba2` | `packages/db/migrations/0003_ot27_security_crm_repair.sql` | `1b8baf1e6ed4f99a5c89aee26257f2b3b2a476cc` | Canonical security/CRM repair, keep. |
| #3 | `87f9b315c54e` | `packages/db/migrations/0003_first_slice_hardening.sql` | `44ba1ea89e71a9e02ed373085de317cc1f6754ba` | Superseded, do not import. |
| #4 | `61d4755fe279` | `packages/db/migrations/0004_delivery_worker_claim_index.sql` | `1541303ca863105c9ccd986699b7dbc35f64bff5` | Delivery lineage, pending integration with PR #8 final version. |
| #8 | `571b18f36cdc` | `packages/db/migrations/0004_delivery_worker_claim_index.sql` | `4f4dfce24a4cc82d4e6d2ad59a1a9d7e77bb900f` | Delivery correction modifies PR #4 migration; use final corrected version when integrating delivery. |
| #9 | `245649523566` | `packages/db/migrations/0005_privileged_mfa_security_completion.sql` | `602e001f43f020f7c51568994ef13a4113eb77b7` | Superseded alternate train, do not import. |
| #11 | `b2c159a060d` | `packages/db/migrations/1000_ot42_crm_module_v1.sql` | `08191d11149f1afd2b046375f02a15fc1375780b` | Applied as additive OT-42 CRM module migration; real PostgreSQL assurance remains pending for PR #6. |
| #12 | `f4e4fb1dc202` | `packages/db/migrations/1300_ot46_billing_foundation.sql` | `aac3c7a977ba29f46e8adeeaa8e62f66309c86d3` | Pending isolated fixture-only billing integration. |
| #15 | `9594c228b9ac` | `packages/db/migrations/1500_ot52_portal_households_learners.sql` | `fc55b59c56e37150205b1ff82bb80c74abc1f076` | Pending isolated portal integration. |
| #13 | `e235af05759f` | `packages/db/migrations/1600_ot51_telegram_bot_foundation.sql` | `e0834959de620a5238d089a6f9240a43624671fd` | Pending isolated Telegram mock/default-off integration. |

No accepted migration was edited in this checkpoint. The HMAC login-CSRF port is config/domain/server/test-only and does not require a migration.
