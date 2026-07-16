# OT-86A Regression

Packet id: OT-86B<br>
Branch: codex/ot86b-buffer-social<br>
Base SHA: 87a1bb7ffd6a2fa0d016a1831894d430aa2ee065<br>
Current head SHA: pending until final commit/push<br>
Generated UTC: 2026-07-15T17:50:30Z

## Commands

| Command                                                                                                                                                          | Exit | Result                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---: | ----------------------------------------------------------- |
| `npx vitest run --config vitest.integration.config.ts tests/integration/content/ot86-content-pipeline.test.ts tests/integration/content/content-library.test.ts` |    0 | 2 files, 11 tests passed.                                   |
| `npx vitest run --config vitest.integration.config.ts tests/integration/telegram-db-foundation.test.ts`                                                          |    0 | 1 file, 2 tests passed, all migrations apply through OT86B. |
| `npm run build`                                                                                                                                                  |    0 | Build and typecheck passed.                                 |

## Result

- OT86A signed publication intake remains authenticated and raw-byte safe.
- OT86A publish/correct/revoke and local KB retrieval behavior remains covered.
- OT86A social outbox generation remains independent of OT86B Buffer readiness.
- OT86B missing Buffer accounts do not block OT86A publication/library tests.
