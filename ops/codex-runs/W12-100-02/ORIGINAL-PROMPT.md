# W12-100-02 Original Prompt

Repository: `webcraft-media/onetimev2`

Canonical starting commit:
`0d8d7168f066668f035176d777bdaaa4dcc5accd`

Lane ID: `W12-100-02`

Branch: `codex/w12-100-02-delivery-transport-foundation`

Base branch for draft PR:
`integration/w12-final-convergence-20260717T123715Z`

## Scope

Exclusive ownership:

- `apps/worker/src/delivery/**`
- `packages/contracts/src/delivery/**`
- `packages/domain/src/delivery/**`
- `packages/config/src/index.ts`
- `.env.example`
- directly related delivery tests
- `ops/codex-runs/W12-100-02/**`

Known starting condition:

- the worker is sink-only
- provider activation flags currently fail closed
- `SinkDeliveryRouter` always creates synthetic receipts
- lifecycle delivery has a separate canary-only Resend path

Design and implement a safe transport architecture without making external
calls.

## Requirements

1. Preserve sink as the default in every environment.
2. Introduce explicit environment classification separate from `NODE_ENV`:
   `local`, `test`, `isolated_staging`, `production`.
3. Provider transport must require all of:
   - explicit provider mode
   - exact environment gate
   - staging-isolation proof
   - per-provider authorization flag
   - allowlisted destination or resource
   - bounded canary budget
   - idempotency key
4. Production provider mode must remain disabled unless a later reviewed release
   explicitly authorizes it.
5. No fallback from a failed provider call to silent sink success.
6. Keep provider receipts, errors, destinations, and logs redacted.
7. Enforce timeout-versus-lease safety.
8. Enforce suppression and channel consent before dispatch.
9. Separate provider adapters from routing and persistence.
10. Ensure retries cannot duplicate a provider action.
11. Make unsupported channels fail closed with a typed result.
12. Expose counts/status readiness without exposing secrets.

Implement a mock/in-memory provider adapter for tests. A real Resend adapter may
be wired behind the interface only if it is impossible to invoke during this
lane. Do not make Meta, Telegram, Zoom, Vimeo, Stripe, Buffer, or OpenAI calls.

## Required Tests

- default sink behavior
- staging canary gates
- production rejection
- allowlist enforcement
- budget exhaustion
- idempotency
- suppression
- timeout and lease handling
- redacted logs
- no provider call when any gate is missing

Document the integration contract that lifecycle email, WhatsApp, Telegram, and
future channels must use.

## Safety Contract

- Do not deploy staging or production in this lane.
- Do not connect to or read private rows from the production database.
- Do not send email, WhatsApp, Telegram, provider webhooks, payments, posts,
  Zoom invitations, or external helper requests.
- Do not create, delete, upload, publish, or mutate provider resources.
- Never print, copy, screenshot, serialize, or commit secrets, database URLs,
  private destinations, private links, source rows, raw message bodies,
  student-sensitive data, tokens, or passwords.
- Use hashes, counts, statuses, synthetic fixtures, and redacted summaries for
  evidence.
- Keep BNA code, sessions, data, provider runtime, and branches out of this
  repository lane.
- Do not integrate W12-09 unless the lane explicitly says to assess it.
  This lane did not.
- Do not run repo-wide `prettier --write` or mass-format inherited files.
- Do not merge PRs, mark PRs ready, or alter production configuration.
  External actions and production mutations must both be zero.

