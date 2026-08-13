# Transactional email history reconciliation

- Lane: `OT-P1 — Transactional Email`
- Date: 2026-08-13 (Asia/Jerusalem)
- Branch: `codex/ot-p1-transactional-email-20260813`
- Integration base: `5b733f00875e7e49a9ca853e275503a5eb780c79`
- Production source read from the canonical launch status: `06c67372e0735c9f997550db1bd72670fea33b6a`
- External effects: none

## Reconciled capability state

| Capability                                                                                                                      | Current state                                                                 | Evidence and boundary                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Password-reset request, durable outbox, Resend acceptance, signed final-state webhook, single-use token, and session revocation | DEPLOYED; prior operator journey accepted on an earlier exact deployed source | The current integration retains the merged Resend recovery. The 2026-08-09 operator journey created one reset intent, one claim, one Resend message, a delivered webhook, and one consumed token without a duplicate. The current production source is a later descendant and has not received another live reset journey in this lane. |
| Adult account setup delivery                                                                                                    | DEPLOYED                                                                      | The source enforces a seven-day, single-use setup link and invalidates an older unused link. No new operator setup journey was run.                                                                                                                                                                                                     |
| Fresh Family signup that already set a password                                                                                 | DEPLOYED                                                                      | No setup email is issued.                                                                                                                                                                                                                                                                                                               |
| Student setup email                                                                                                             | OFF                                                                           | The focused current-integration test proves Student setup delivery is suppressed without an outbox row.                                                                                                                                                                                                                                 |
| Transactional sender and reply address                                                                                          | DEPLOYED                                                                      | Source and focused tests require `info@onetimeonetime.com` for account-security delivery. The earlier production provider readback proved the same address. This repository-only lane did not read or change current provider configuration.                                                                                            |
| Public Rabbi identity                                                                                                           | DECIDED / MERGED                                                              | `Rabbi Eli Scheller <rabbielischeller@onetimeonetime.com>` remains the public Rabbi/GHL identity. It is separate from the transactional app sender. A personal mailbox is not an application or conversation source of truth.                                                                                                           |
| Admin-visible reset/setup delivery history                                                                                      | BUILT on this branch                                                          | Before this branch, Communications did not query `account_lifecycle_delivery_outbox`. This branch adds a read-only, redacted projection and exact filters for reset, setup, Student PIN setup/reset, and lifecycle delivery states. It is not merged or deployed.                                                                       |

## Bounded implementation

- Adds the existing account-lifecycle outbox to the Admin/Rabbi Communications read model.
- Shows exact redacted intent and state labels for queued, retrying, unknown, provider accepted, delivered, bounced, complained, failed, expired, superseded, provider-off, cleared, and sink-only processing.
- Keeps contact-local history from projecting unlinked lifecycle rows.
- Returns no recipient address, secure link, token or token hash, message body, provider reference, or lifecycle idempotency value.
- Adds no write route, resend action, template editor, provider control, or configuration control.

## Verification

- Current Resend recovery integration: 4/4 passed.
- Communications contract: 10/10 passed.
- Communications protected HTTP and database projection: 16/16 passed.
- TypeScript typecheck passed.
- Changed-file ESLint passed.
- Changed-file Prettier check passed.
- Git whitespace check passed.

## Acceptance boundary

The cheapest valid next acceptance is read-only: after controller review, merge, and deployment, an authorized Admin opens Communications, filters Source to **Account security delivery**, and confirms an existing historical reset/setup row shows its redacted final state. No live email, reset issuance, provider action, database write, or credential handling is required.
