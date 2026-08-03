# OT-LAUNCH-01 — Parent, Student, Access, and Adult GHL Link

## Assignment

- Task: `OT-LAUNCH-01-CONTACT-OPS-01`
- Repository: `shloimie-beep/onetimev2`
- Governed base: use the exact current `codex/full-app-staging-live` head recorded by the conductor at dispatch
- Branch: `codex/parent-student-contact-operations`
- Status source: `ops/goals/OT-LAUNCH-01/BOARD.yaml`
- Result handoff: `ops/goals/OT-LAUNCH-01/handoffs/parent-student-contact-operations--OT-LAUNCH-01-CONTACT-OPS-01.json`

Read the complete goal intake order, this packet, and `AGENTS.md`. Verify the
assignment and do not edit `BOARD.yaml`.

## Authority boundary

- One Time owns authentication, households, guardian relationships, all
  Students, credentials, portal state, complimentary access, administrative
  suspension, and the effective learning-access decision.
- GHL owns the adult Parent contact, customer conversation/campaign state, and
  payment/subscription history.
- Resend owns activation and password-reset security messages.
- A Student never becomes a GHL contact and never appears in an outbound GHL
  payload.
- One Time must not add invoices, charges, amounts, cards, refunds, subscription
  mutation, or payment-event history.

## Domain correction

Replace the single precedence-winning access source with independent current
source slots:

- `highlevel_payment_state`
- `complimentary`
- `admin_suspension`

Derive the existing effective access projection: suspension denies; otherwise
current paid or complimentary grants; otherwise paused. Revoking complimentary
access removes only that slot and cannot erase paid truth. Suspending a
household never cancels billing and must say so.

Parents authenticate independently of commercial access. A paused Parent sees
only identity/profile, a protected configured recovery action, and Support.
Students and learning routes fail closed, and Student sessions/security versions
are revoked when effective access disappears.

## Contacts operation

Add durable adult↔household and adult↔GHL-contact links. Provide one atomic,
idempotent enrollment command that can:

1. find or create one adult contact, failing closed on ambiguous identity;
2. find or create its household and durable link;
3. create the pending guardian/Parent activation through Resend;
4. optionally create local-only Students and one-time credentials;
5. optionally grant complimentary access;
6. queue one adult-only GHL projection through the existing outbox;
7. return local success with `sync_pending` if GHL is unavailable.

Parent and Rabbi may create any positive number of Students. Every Student must
have a Parent. Do not auto-create three Students outside the fictional seed.

Admin/Rabbi actions:

- invite Parent;
- create Student;
- grant/revoke complimentary access;
- suspend/release household;
- send Parent reset link (never view/set Parent password);
- reset Student credential through a secure one-time flow, revoking sessions
  and auditing the change;
- read GHL sync state, `Open in GHL`, and `Reconcile this parent`.

Persist the provider contact ID and registered `one_time_household_id` projection.
Never poll or synchronize the entire contact database. Use new event-driven,
coalesced, allowlisted projections and an operator-triggered single-Parent
reconcile action.

## GHL safety

Signed paid-state intake must prove an exact local adult-contact↔household link
and matching configured GHL location; it must not require an already activated
Parent and must never auto-create a household from an unmatched webhook.

Preserve HMAC, nonce, idempotency, revision, lease, retry, and audit controls.
Do not activate GHL Draft shells or weaken authentication. The GHL Custom
Webhook signer remains a separate provider proof.

## Migration and role safety

Choose the next globally free forward-only migration only after fetching all
active integration heads and the ledger. Never assume `2225` and never edit an
applied migration.

Do not silently swap the repository’s Owner/Admin labels. Implement explicit
capabilities for operator-supervision and school-Rabbi administration, then
return any remaining naming change as a narrow decision.

## Acceptance

- No child GHL operation for Student create/reset/update.
- Paid + complimentary + suspension truth table and replay pass.
- Parent can log in to a paused shell; Student login/session and learning routes
  are denied.
- Activation to a paused Parent is safe.
- Local Parent/Student enrollment succeeds while GHL is unavailable and later
  reconciles exactly once.
- Adult link, household field, GHL deep link, and single-parent reconcile read
  back without payment data.
- Parent reset and Student reset are secret-safe, CSRF/idempotency protected,
  recent-assurance gated where required, and audited.
- Cross-account, cross-household, sibling, ambiguous identity, stale revision,
  and replay attempts fail closed.
- Existing Experience Preview and fictional household remain intact.

Run focused unit/integration/PostgreSQL tests, portal/auth E2E, scoped
format/lint, typecheck, build, secret scan, migration safety/checksum proof, and
`git diff --check`. Push a clean draft PR; do not mutate GHL, send customer
messages, or deploy production.
