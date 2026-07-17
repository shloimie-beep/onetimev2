## Summary

- Adds versioned public WhatsApp assistant copy and routes standard assistant replies through it.
- Adds a safe `GET /api/v1/whatsapp/public-assistant` backend contract for landing/widget placement, including approved WhatsApp deep-link handling and provider/canary readiness blockers without exposing raw canary values.
- Adds durable sender/account assistant rate limits and abuse suppression with redacted audit metadata.

## Safety

- No broad sends.
- No real WhatsApp provider registration.
- No canary send.
- No deployment.
- No production contact import.
- Personal canary recipient remains protected runtime config only.

## Validation

- `npm ci`
- `npx vitest run --config vitest.integration.config.ts tests/integration/whatsapp/ot85-assistant.test.ts tests/integration/whatsapp/ot85-webhook-route.test.ts tests/integration/whatsapp/ot100-provider-runtime.test.ts`
- `npx vitest run --config vitest.unit.config.ts tests/unit/whatsapp/ot85-intent-contract.test.ts tests/unit/whatsapp/ot100-meta-provider.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run secret:scan`
- `npx prettier --check apps/web/src/server/app.ts packages/config/src/index.ts packages/domain/src/index.ts packages/domain/src/whatsapp/service.ts packages/domain/src/whatsapp/copy.ts tests/integration/whatsapp/ot85-assistant.test.ts tests/integration/whatsapp/ot85-webhook-route.test.ts`

## Notes

- Full `npm run format` remains blocked by the current release baseline reporting 829 pre-existing unformatted files. The TypeScript files touched by this PR pass targeted Prettier check.
