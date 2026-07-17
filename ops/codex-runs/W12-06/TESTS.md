# W12-06 Validation

## Passed

- `npm ci`
- `npx vitest run --config vitest.integration.config.ts tests/integration/whatsapp/ot85-assistant.test.ts tests/integration/whatsapp/ot85-webhook-route.test.ts tests/integration/whatsapp/ot100-provider-runtime.test.ts`
  - 3 files, 16 tests passed.
- `npx vitest run --config vitest.unit.config.ts tests/unit/whatsapp/ot85-intent-contract.test.ts tests/unit/whatsapp/ot100-meta-provider.test.ts`
  - 2 files, 10 tests passed.
- `npm run typecheck`
- `npm run lint`
- `npm run secret:scan`
  - Secret scan passed across 1182 repo text files.
- `npx prettier --check apps/web/src/server/app.ts packages/config/src/index.ts packages/domain/src/index.ts packages/domain/src/whatsapp/service.ts packages/domain/src/whatsapp/copy.ts tests/integration/whatsapp/ot85-assistant.test.ts tests/integration/whatsapp/ot85-webhook-route.test.ts`

## Caveats

- `npm run format` is not green on the current release baseline. It reports 829 pre-existing unformatted files across the repo. The W12-06 TypeScript files touched in this branch pass targeted Prettier check.
- No external WhatsApp provider registration, canary send, broad send, deploy, or production data mutation was performed.
