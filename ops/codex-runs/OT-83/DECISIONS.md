# OT-83 Decisions

## D-001 Reuse Accepted Portal Stack

OT52/OT71 already provide household, learner, parent/student actors, mounted parent/student app shells, account lifecycle activation/reset, and portal repositories. OT83 extends that stack instead of creating a second portal, auth, session, audit, or design-system implementation.

## D-002 Add Session Revocation As Student-Access Operation

The prompt explicitly requires parents to revoke learner sessions. The accepted flow supported setup/reset/suspend/restore, but not status-preserving session revocation. OT83 adds `revoke_sessions`, preserving student access status while invalidating sessions through account security version/session revocation.

## D-003 CI Real PostgreSQL Proof

No explicit safe local PostgreSQL target was configured. OT83 therefore adds `tests/ot-83/real-postgres-concurrency.ts` and `.github/workflows/ot83-postgres-concurrency.yml` so CI can run the real PostgreSQL 16 learner-seat proof without using production data or providers.

## D-004 No Provider Activation

No Stripe, Zoom, Vimeo, Telegram, WhatsApp, OpenAI helper, Railway, DNS, deployment, payment, live send, or production migration was activated.
