# OT-51P Integration Manifest

## Direct-Import Hooks

Import from `apps/telegram-bot/src/index.ts`:

- `createTelegramWebhookHandler`
- `normalizeTelegramUpdate`
- `TelegramBotWorkerEngine`
- `TelegramPollingConflictError`
- `acquireConsumerLeaseOrThrow`
- `runMockPollingAdapter`
- `validateTelegramRuntimeTopology`
- `TelegramCommandEngine`
- `TelegramIdentityResolver`
- `DeterministicTestPayloadCodec` (tests only)
- memory/mock fixtures for tests only

Direct contracts live in `packages/contracts/src/telegram/types.ts`.
SQL repositories live in `packages/db/src/telegram/repositories.ts`.

## Required Injected Application Adapter

`OneTimeBotApplicationAdapter` must provide only stable, authorization-safe
operations:

- `supportedCapabilities`
- `resolveActor`
- optional read methods for product status, upcoming classes, content pipeline,
  contact lookup, and task lookup
- optional preview/execute methods for task create and task update

Business actions must go through this adapter. The bot must not query CRM,
class, content, task, payment, access, or provider tables directly.

## Webhook Handler Registration Seam

Future host may mount `createTelegramWebhookHandler` only after providing:

- bot key/environment;
- high-entropy route/secret;
- official secret header value;
- durable inbox repository;
- reviewed protected `SensitivePayloadCodec`;
- startup topology validation;
- no parallel polling mode.

## Worker Startup/Shutdown Seam

Future host may create `TelegramBotWorkerEngine` only after:

- acquiring a single active consumer lease;
- choosing mock-only or reviewed production transport;
- setting handler deadline shorter than lease;
- wiring SIGTERM/SIGINT stop and drain.

## Migration

- Migration: `1600_ot51_telegram_bot_foundation.sql`.
- Checksum:
  `7877626FF08408B4876283DEEE33D70FF39B340B61236EE717E8AB1C691E03E6`.
- Reserved namespace: `1600-1699`.

## Mock-Only Status

- No real Telegram transport exists in this branch.
- No consumer is activated.
- No webhook is registered.
- No polling loop is started.
- Telegram network calls: zero.

## Central Files Intentionally Untouched

- `apps/web/src/server/app.ts`
- `apps/worker/src/main/index.ts`
- root `package.json`
- root `package-lock.json`
- root workflows/config
- package central barrel exports such as `packages/domain/src/index.ts` and
  `packages/contracts/src/index.ts`

## Later Reconciliation

Stable OT-41/42/43 application APIs must be reconciled later before activation.
This branch intentionally uses injected ports because accepted application APIs
are not available at the immutable base.

## Activation Gates

Future activation requires:

- dedicated One Time bot/token distinct from Academy;
- staging token preferred;
- safe secret injection;
- protected payload codec/key source;
- approved owner/admin mappings;
- real PostgreSQL concurrency proof;
- accepted application adapter APIs;
- single-consumer proof;
- staging service;
- exact-SHA deployment;
- webhook registration;
- protected canary;
- audit reconciliation;
- rollback drill.

None of those gates is authorized or completed in OT-51P.
