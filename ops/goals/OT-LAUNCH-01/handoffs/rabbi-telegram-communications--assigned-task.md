# OT-LAUNCH-01 — Rabbi Telegram Communications

## Assignment

- Task: `OT-LAUNCH-01-RABBI-TELEGRAM-01`
- Repository: `shloimie-beep/onetimev2`
- Governed base: use the exact current `codex/full-app-staging-live` head recorded by the conductor at dispatch
- Branch: `codex/rabbi-telegram-communications`
- Status source: `ops/goals/OT-LAUNCH-01/BOARD.yaml`
- Result handoff: `ops/goals/OT-LAUNCH-01/handoffs/rabbi-telegram-communications--OT-LAUNCH-01-RABBI-TELEGRAM-01.json`

Read the full goal intake order, this packet, `AGENTS.md`, and the canonical
`integrations/highlevel/registry/rabbi-telegram-contract.yaml`. Verify the
assignment. Do not edit `BOARD.yaml`.

## Boundary

Build the distinct One Time Rabbi bot. Do not copy the BNA monolith, share bot
identity/session/cookies/secrets, import BNA runtime/assets/Studio/memory, or
create a second customer transcript.

- GHL stores the Parent’s customer conversation.
- One Time stores only opaque conversation references, safe status/digests,
  idempotency/audit, local Student questions, and internal tasks.
- Students remain local and never become GHL contacts.
- The Rabbi bot is school-scoped; the BNA control-plane bot is separate.

## P0 communication capabilities

- `conversation.parent.list`
- `conversation.parent.read_redacted`
- `conversation.parent.reply.preview`
- `conversation.parent.reply.confirm`
- `student.question.list`
- `student.question.read`
- `student.question.reply.preview`
- `student.question.reply.confirm`
- `student.question.close`
- `internal_task.list`
- `internal_task.create`
- `internal_task.update`

Every write requires a deterministic preview, explicit confirmation, exact
scope, idempotency key, durable audit, and replay-safe worker delivery. A model
may compile natural language only into allowlisted typed actions; it can never
bypass confirmation or scope.

Make `apps/telegram-bot` a real executable worker with one owner, graceful
lease/heartbeat/retry, durable replay rejection, and provider-off startup when
protected prerequisites are absent. Reconcile Student-question persistence so
the confirmed answer appears in the existing Student portal instead of a third
question table.

Create a true One Time internal Rabbi↔operator task aggregate. Do not reuse a
customer CRM task table that requires a contact or expose internal tasks to GHL.

The GHL conversation adapter must reply in the same adult conversation and must
not store a second transcript. Extract/reuse the existing server-side HighLevel
client pattern; do not add a parallel direct provider path. Customer delivery
remains off until exact synthetic-provider proof is separately run.

## Deferred capabilities

After P0 communication proof, the same capability model may add fixed-point
reward award/reversal using the existing gamification ledger. Access grants,
password resets, Zoom controls, voice, social publishing, Studio/OpenArt, BNA
diagnostics, shell/Codex/deploy commands, and production provider mutation are
outside this packet.

## Acceptance

- Worker boots, owns exactly one consumer, heartbeats, drains, retries, and
  rejects replay across restart.
- Fake Parent conversation: Rabbi previews and confirms one reply; provider
  adapter records exactly one synthetic delivery.
- Fake Student question: Rabbi previews/confirms one answer; only the correct
  Student portal receives it.
- Wrong account/household/student and stale confirmation are denied.
- An internal task is visible to operator and Rabbi but never stored in GHL.
- No child GHL contact, second transcript, unconfirmed send, raw secret, private
  destination, or production mutation.
- Missing protected Telegram/GHL prerequisites produces truthful provider_off.

Run worker boot/lease/replay, mocked same-conversation, Student portal,
cross-household, internal-task, and fake-provider E2E tests plus scoped
format/lint, typecheck, build, secret scan, and `git diff --check`. Push a clean
draft PR and one sanitized handoff. Do not run a customer canary.
