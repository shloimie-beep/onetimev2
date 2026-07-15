# Phase 2 Ledger: Provider-Neutral Content And Library

Status: completed

## Scope

- Versioned asynchronous content outcomes, lifecycle states, class/content linkage, transcript/source/review-sheet metadata, review/publish workflow, entitled library access, protected playback interface, sink/mock behavior, audit/redaction/retention, and bounded APIs.

## Evidence

- Migration `packages/db/migrations/1400_ot71_content_library.sql` adds provider-neutral content item, revision, entitlement, idempotency, audit, redaction, and retention tables.
- Contracts in `packages/contracts/src/content/index.ts` define lifecycle states, content outcome payloads, bounded library queries, detail responses, and admission responses.
- Domain service in `packages/domain/src/content/service.ts` admits local asynchronous outcomes idempotently, handles stale revisions and supersession, redacts provider metadata recursively, stores provider refs as digests, records audit/redaction evidence, and exposes a portal content adapter.
- `apps/web/src/server/app.ts` exposes owner/admin content list/detail APIs and a CSRF-protected local outcome sink; viewer sessions are denied.
- Tests added in `tests/unit/content/redaction.test.ts` and `tests/integration/content/content-library.test.ts`.
- Verification passed: focused content tests, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run secret:scan`, `git diff --check`, and `npm run test`.

## Notes

- No Vimeo/provider calls, live polling, webhook activation, deployment, real sends, credential delivery, or production database writes were performed.
- Portal content actions are app-relative protected descriptors only; raw provider URLs and provider refs are not returned.
