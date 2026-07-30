# F06 Handoff

## Identity

- Branch: `codex/v21-f06-provider-core`
- Start SHA: `9782a4164662b8059a557c0969de9c35f54d0cf7`
- Implementation SHA before this handoff metadata commit: `94281de13063203808ecabef8a818762e5ff1e2e`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the observed remote head.
- Task packet digest: `f1a02ca5959cfb9087b68bf4d3bc06d6ace9d07cc0ac8dd464cfc748651f2e66`
- Context digest: `872493646ff10ab4f894b10b61c2125fdf61193bea1d518e0a153ccaa3a47ce3`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Interface contract digest: `7d0e2e360036fa6e3b742053c714b13f442e29c9ff3e83ad7b6bf02c005694a0`

## Completed behavior

F06 now provides a versioned provider-independent contract that extends F05's durable fenced job foundation with exact provider registry/account/environment binding and canonical readback. Stripe mutation is structurally forbidden; signed-event ingestion and readback remain available. Acceptance-unknown operations are reconciliation-only and keep stable idempotency identity through proven acceptance, safe retry, rejection, or bounded unknown disposition.

Adult GHL matching uses verified link, then exact normalized-email evidence, and quarantines disagreement/multiple matches without blocking local login, valid free access, Student work, or Resend security. Governed resolution selects exactly one reviewed contact and returns the original outbox intents for idempotent replay. Household mappings permit one adult contact across multiple isolated household GHL records and Stripe Customers; suppression is contact-scoped, lifecycle/preferences remain household-scoped, and ownership transfer preserves financial identity until exact provider readback completes reassociation.

The worker performs readback only, and the parameterized PostgreSQL repository fences versioned persistence and appends minimized readback evidence transactionally. Schema and activation remain stewarded.

## Remaining work

F06-owned implementation is complete. F02 must adjudicate `F06-migration-001`; I36 must adjudicate `F06-registration-001` and integrate the exact interface checkpoint. Candidate-bound provider sandbox/operator proof remains for verification waves.

## Exact next action

C00/I36 should validate and integrate the exact F06 interface checkpoint, adjudicate `F06-migration-001` and `F06-registration-001`, and authorize downstream tasks from the resulting integration head.

## Coverage

- Requirements: all three implementation-verified.
- Acceptance cases: all three task-owned positive, negative, isolation, concurrency/version, retry/readback, replay, and recovery assertions passed; candidate-bound environment proof is intentionally not claimed.

## Changed files and migrations

Fourteen implementation/request files were added within F06-owned paths plus F06 runtime metadata. No migration, root barrel, worker composer, or canonical provider registry was edited. Two structured steward requests name the exact migration and registration work.

## Verification

- Full TypeScript typecheck: passed.
- Focused Vitest: 3 files, 11 assertions, all passed.
- Focused ESLint: passed.
- Focused Prettier: passed.
- Canonical interface contract and artifact digests: verified.
- Git diff check: passed.

## External effects

Authority `none`; attempted `0`, succeeded `0`, reconciled `0`. No provider or live effect occurred.

## Security, privacy, and data handling

No secrets, provider payloads, customer data, child data, private questions, or bearer material were accessed or recorded.

## Blockers, deviations, and recovery

No F06-owned blocker. Migration and central registration are correctly routed to their stewards and do not weaken the stable direct-import interface.
