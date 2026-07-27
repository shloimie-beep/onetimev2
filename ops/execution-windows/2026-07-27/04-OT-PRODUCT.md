# 04-OT-PRODUCT

Canonical assignment:
`BOARD.yaml#tracks[id=audit_wave_04_runtime_classification]`.

## One-line continuation prompt

Continue 04-OT-PRODUCT from the current Board row `audit_wave_04_runtime_classification`: implement only A11-T01’s canonical fail-closed runtime classification on `codex/w04-canonical-runtime-classification-20260727`, run focused tuple/auth/startup tests plus typecheck/build/secret/format/diff checks, and perform zero provider, deployment, production, database, customer, or Board mutation.

## Assignment

- Window ID: `04-OT-PRODUCT`
- Task ID: `OT-LAUNCH-01-W04-CANONICAL-RUNTIME-CLASSIFICATION`
- Repository: `shloimie-beep/onetimev2`
- Branch: `codex/w04-canonical-runtime-classification-20260727`
- System: One Time runtime/config/auth startup boundary
- Concurrency lock: `OT-PRODUCT`
- Acceptance IDs: `SEC-RUNTIME-001`
- Result path:
  `ops/execution-windows/2026-07-27/results/04-OT-PRODUCT-result.md`
- Dependencies: accepted audit checkpoint, current Board assignment, and no
  other OT-PRODUCT writer
- Exact write scope:
  - `packages/config/src/index.ts`
  - runtime/cookie/startup classification helpers in
    `apps/web/src/server/app.ts`
  - focused tests under `tests/unit/config/`
  - `tests/integration/runtime-version-proof.test.ts`

## Required behavior

Create one allowed runtime/deployment tuple model and route Secure-cookie,
mandatory production-secret, startup migration, mock/demo, and provider gates
through it. Reject incoherent combinations. Do not include actual environment
values in code, tests, logs, or evidence.

## Verification

Require focused unit/integration tests for every allowed and forbidden tuple,
Secure-cookie behavior, production secret requirements, startup migration,
mock/demo, and provider gates. Run typecheck, build, scoped Prettier, secret
scan, and `git diff --check`.

Operator manual-smoke checklist:

1. Start a disposable isolated-staging instance with sinks/providers off.
2. Confirm authenticated cookie flags and health/readiness remain correct.
3. Confirm an incoherent production tuple fails before listening.
4. Confirm no provider or database migration action ran.

Do not prescribe full repository E2E or screenshot matrices unless focused
tests reveal a shared auth/routing regression.

## Forbidden behavior and stop

Do not open providers, deploy, touch production, apply migrations, edit the
Board, or broaden into other A11 repairs. Stop if a real secret is needed, a
second writer owns either source, production behavior requires an unresolved
decision, or the repair would activate a provider.
