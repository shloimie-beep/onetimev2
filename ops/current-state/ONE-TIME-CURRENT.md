# One Time Current State

Generated from the operator packet at SHA-256
`08d341bb4f6d9a51ad14824d5e9640feeb65de5db8f774eccf62740297309c53`.
The canonical repository is `shloimie-beep/onetimev2`;
`webcraft-media/onetimev2` is explicitly excluded.

## Runtime Readback

| Surface            | Verified source                            | Latest migration                              | Health | Tisha B'Av |
| ------------------ | ------------------------------------------ | --------------------------------------------- | ------ | ---------- |
| Production         | `0a85f4f8e8683bc19ac26fbdf1f6b8e91211429d` | `2211_tisha_bav_provider_event_scope`         | Pass   | Live       |
| Persistent staging | `68b4d075c85f4023177b9363e04e23763f01d4f5` | `2213_learning_delivery_autotrim_transcripts` | Pass   | Live       |
| PR #102 preview    | `999eb7c86ddadaa19009cb9a232fa65deeec11a4` | `2211_tisha_bav_provider_event_scope`         | Pass   | Live       |

Production contains only the narrow Tisha B'Av release. The complete application
remains undeployed in production. Persistent staging includes the Tisha funnel,
HighLevel reconciliation assets, Vimeo autotrim/transcription, and the Rabbi Live
Console.

## HighLevel Readback

| Asset                     | ID                                     | Actual status                      |
| ------------------------- | -------------------------------------- | ---------------------------------- |
| OT-E01                    | `a34ea513-4612-4f53-8bd8-49e89e6610f9` | Published; one operator enrollment |
| OT-C01                    | `f28d8b8a-c26a-4a4f-a9f2-d2a8e94af1ae` | Draft; zero recipients; zero sends |
| Other canonical workflows | n/a                                    | 17 missing                         |
| OT-A1 Conversation AI     | n/a                                    | Missing                            |

The protected operator contact is represented only by fingerprint
`fab156df2719852d`. No private destination is committed.

## Staging Access

The protected handoff is outside Git at
`C:\Users\User\.onetime-full-app-preview\FULL-APP-HANDOFF.private.json`.
It contains the fictional Admin, Parent, and three Student credentials. The
Admin path requires the expected email challenge. Parent and all three Students
passed live portal and role-specific dashboard checks.

## Release State

The narrow production branch is `release/tisha-bav-2026-live` at
`0a85f4f8e8683bc19ac26fbdf1f6b8e91211429d`, tracked by draft PR #106.
The persistent staging integration branch is `codex/full-app-staging-live`;
semantic integration was recorded in `7888306`, with the verified application
head at `68b4d075c85f4023177b9363e04e23763f01d4f5` before this evidence-only update.

OT-C01 remains draft. Broad messages sent: zero. Charges created: zero.
