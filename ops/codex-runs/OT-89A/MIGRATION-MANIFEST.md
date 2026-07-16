# OT-89A Migration Manifest

## 2100 Subscriber Support Producer

- Path: `packages/db/migrations/2100_ot89a_subscriber_support_producer.sql`
- SHA-256: `b928f174ff622b380e7ba609d16db90f28a53e304bd6789e013f6024e05960f0`
- Clean apply result: Pass with `createMemoryPool()` + `runMigrations()`; last migration reported `applied`.
- Rollback support: forward-only repository migration; no rollback file created.
- Data-safety notes: creates new OT-89A tables only; does not edit existing migrations or mutate production data.

## Tables Added

- `onetime.support_submissions`
- `onetime.support_attachments`
- `onetime.support_outbox`
- `onetime.support_delivery_attempts`
- `onetime.support_status_projection`
- `onetime.support_audit_events`
- `onetime.support_mock_bna_events`
- `onetime.support_mock_bna_nonces`

## Constraints And Indexes

- Opaque ID uniqueness on source ticket, receipt, event, outbox, attachment, and BNA mock references.
- Account/product/user/idempotency uniqueness for subscriber submissions.
- One support outbox row per source ticket.
- Status and delivery-state check constraints.
- Private attachment storage metadata with private storage class and forced attachment disposition.
- Claim/status/actor indexes for worker and same-account receipt reads.
