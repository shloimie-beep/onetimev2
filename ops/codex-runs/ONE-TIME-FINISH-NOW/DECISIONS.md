# ONE-TIME-FINISH-NOW Decisions

Generated: 2026-07-19T17:12:49.678+03:00

## DEC-OT-FINISH-001 - Use the standalone One Time repo

Work was performed in the isolated worktree
`C:/Users/User/.onetime-worktrees/ONE-TIME-FINISH-NOW` on branch
`codex/one-time-finish-now-20260719`, based on
`origin/release/w13-100-controlled-day-one-20260717T182046Z`.

Reason: the prompt explicitly forbids modifying the dirty BNA checkout, and
One Time is a standalone repo at `webcraft-media/onetimev2`.

## DEC-OT-FINISH-002 - Treat live readback as newer truth than old director snapshots

The old director snapshot still referenced OPS-11/W12 runtime
`1197673fa409bfc4c649c2683f782e86775caa5e`. This run first refreshed director
truth to W13-104, then the CRM-first slice advanced live production and staging
to `rabbi-day-one-crm-ed77a04` /
`ed77a04dd24391d5b79be7f839d7f5752a57e0f9`.

Decision: keep director current-state, capability matrix, deployment snapshot,
and run handoff files aligned with live `/version`, `/health`, and `/ready`
readback, not stale historical snapshots.

## DEC-OT-FINISH-003 - Do not overclaim full release

The core runtime is live and healthy, and PR #92 staging rollback/roll-forward
is accepted for the staging candidate. The attached release definition still
requires current production launch-spine acceptance, diagnostics, and authorized
provider/import lanes. Those are blocked by missing protected inputs or stale
current production proof.

Decision: report `CORE_RELEASE: BLOCKED_BY_CORE_SAFETY_GATE`.

## DEC-OT-FINISH-004 - Accept W13-103 role access baseline without consuming links

W13-103 proved administrator, parent, and student production access in clean
browser sessions through a protected local handoff. W13-104 intentionally did
not rerun the consuming links because doing so could invalidate the operator
handoff.

Decision: report administrator, parent, and student access as `ACCEPTED`, with
the caveat that transactional email delivery remains a separate blocked lane.

## DEC-OT-FINISH-005 - Keep external lanes fail-closed

No provider canary, production CRM apply, production email send, Stripe charge,
Zoom/Vimeo mutation, WhatsApp/Telegram send, DNS change, or BNA bridge call is
allowed without the exact protected manifest required by the prompt.

Decision: record missing manifests as lane-specific blockers and leave the core
app/read-only surfaces usable.

## DEC-OT-FINISH-006 - Treat CRM real data as preview-ready, not accepted

OPS-13A gives sanitized source inventory and counts-only preflight evidence, but
there is no protected apply authorization manifest.

Decision: report `CRM_REAL_DATA: PREVIEW_READY` and block real apply.

## DEC-OT-FINISH-007 - Accept CRM chat approval only up to dry-run checkpoint

The operator wrote `autorization for crm impot aproved` in Codex chat. The raw
wording is preserved exactly in
`ops/codex-runs/ONE-TIME-FINISH-NOW/CRM-IMPORT-APPROVAL-RAW.md`.

Decision: treat the statement as authorization to create the protected CRM
checkpoint manifest and run the OPS-13A six-source counts-only dry-run. Do not
treat it as production import apply approval. Later CRM-first pivot work
corrected the CRM counts and implemented a guarded local apply writer, but
production apply still requires the exact dry-run SHA/count authorization,
fresh backup proof JSON, DATABASE_URL, idempotency key, created-by user key,
`RABBI-DAY-ONE-CRM-PRODUCTION-APPLY-OK`, and exclusion/terminal handling for
manual-review rows. The later CRM-first readiness refresh satisfied
DATABASE_URL, idempotency, exact operator authorization, private manifest
authorization, and manual-review handling; production apply is now narrowed to
fresh backup proof JSON, created-by user key, and
`RABBI-DAY-ONE-CRM-PRODUCTION-APPLY-OK`.

## DEC-OT-FINISH-008 - Treat read-only launch-spine proof as partial evidence

Current production read-only route proof passed for public, account lifecycle,
readiness, missing-route, and anonymous private-route denial checks. The proof
performed no form submit, setup/reset-link consumption, production write,
provider mutation, deployment, or external send.

Decision: accept the read-only production route proof as current partial
launch-spine evidence. Do not treat it as full launch-spine acceptance because
administrator, parent, and student consuming browser journeys and production
signup submit still require exact protected authorization and cleanup
instructions.

## DEC-OT-FINISH-009 - Accept the CRM-first pivot as current release evidence

The same-window CRM-first pivot delivered corrected CRM counts, a guarded local
real-source CRM apply writer, transactional lifecycle email gating, signup/CRM
and WhatsApp lead-capture proof, and a sanitized email-inputs preflight. The
current compact source of truth is `ops/codex-runs/RABBI-DAY-ONE-CRM/`.

Decision: keep `CRM_REAL_DATA` as `PREVIEW_READY`, but treat the corrected
counts and guarded apply writer as newer evidence than the older broad
counts-only report. Treat transactional email code/config as deployed: staging
controlled lifecycle email was provider-delivered and production was
deployed/smoked. Final production controlled send and administrator access are
blocked only by missing active production owner/admin actor and fresh
bootstrap/role-access authorization.
