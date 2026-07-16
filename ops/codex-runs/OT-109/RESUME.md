# OT-109 Resume

Worktree: `C:/Users/User/.onetime-worktrees/OT-109`

Branch: `codex/ot109-rabbi-content-publisher`

Draft PR: https://github.com/webcraft-media/onetimev2/pull/48

Implementation commit: `e24431e9dc436bf3cea11dca6902c67b31848693`

Implemented:

- OT-109 content publisher contracts.
- Additive migration `2190_ot109_rabbi_content_publisher.sql`.
- Domain service and feature-local worker step in `packages/domain/src/content/publisher.ts`.
- Exports from contract/domain indexes.
- Integration delta for OPS-04 shared wiring.
- Focused integration spec covering private intake, Vimeo status/text-track import, transcription fallback, transcript approval, derivatives, artifact review, publish/replay, helper retrieval, revoke, URL rejection, idempotency, and storage scope.

Verified:

- `npm run typecheck`
- `npx vitest run --config vitest.integration.config.ts tests/integration/content/ot109-rabbi-content-publisher.test.ts`
- `npm run lint`
- `npm run secret:scan`
- `git diff --check`
- Touched-file Prettier check for OT-109 TS/MD/JSON files

Known baseline:

- `npm run format` reports 596 pre-existing unrelated repo formatting warnings. OT-109 touched-file Prettier check passed.

Remaining gates:

- Real private Vimeo canary.
- Real protected Drive canary.
- Real transcription provider canary.
- Production database migration/app smoke after a deploy target is approved.
