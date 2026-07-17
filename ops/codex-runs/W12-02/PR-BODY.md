## Summary

W12-02 builds a provider-independent communication history workspace for One
Time. It expands the communications contract, repository projection, and UI so
the screen can show canonical history events, local outbox intent, reply
drafts, stored WhatsApp inbound webhooks, stored delivery events, and explicit
provider-history-unavailable rows without claiming live provider truth that is
not available.

## What changed

- Added forward-only communication history migrations for import batches,
  canonical threads, and canonical history events.
- Expanded Communications DTOs with source/provenance, direction, thread IDs,
  contact and household links, redacted preview, provider reference digest,
  import batch, idempotency, and draft-only transport state.
- Reworked the server repository projection to merge canonical history, local
  outbox intent, draft replies, stored WhatsApp inbound webhooks, and stored
  WhatsApp status events.
- Added provider-independent dry-run backfill utilities and CLI output for
  redacted fixtures or unavailable Resend/WhatsApp history.
- Updated the authenticated Communications UI with source, direction, and status
  filters; thread previews; clear draft-only language; and One Time black,
  yellow, and ice-blue styling.
- Preserved W12-02 state, source-truth, hotspot, prompt, test, and final-report
  artifacts under `ops/codex-runs/W12-02/`.

## Safety notes

- No live sends, provider mutations, production database reads or writes,
  production backfill, broad export, deploy, or provider canary were run.
- The reply workflow remains draft-only with `transport_available=false`.
- Dry-run import output hashes provider references and does not emit raw message
  bodies or subjects.

## Validation

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run brand:check`
- `npm run secret:scan`
- `npx vitest run --config vitest.unit.config.ts tests/unit/communications/communications-contract.test.ts`
- `npx vitest run --config vitest.integration.config.ts tests/integration/communications/api.test.ts tests/integration/communications/repository.test.ts`
- `npx playwright test tests/accessibility/ot-44/communications-accessibility.spec.ts`
- `npx playwright test tests/e2e/ot-44/communications-descriptor.spec.ts`
- `npx playwright test tests/performance/ot-44/communications-performance.spec.ts`
- `npx tsx scripts/w12-02-communication-backfill-dry-run.ts --provider resend`
- `npx tsx scripts/w12-02-communication-backfill-dry-run.ts`
- migration run against pg-mem through `runMigrations`
