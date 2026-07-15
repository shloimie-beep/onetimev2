# Phase 1 Ledger: Canonical Class Occurrence And Fulfillment

Status: completed

## Scope

- Canonical class series, occurrence, access target, fulfillment, acknowledgement, reminder, attendance, delivery, and recording states.
- Daily 19:00 Asia/Jerusalem occurrence timing, T-30 reminder behavior, signup-first flow, server-derived eligibility, idempotency, owner/admin readiness, portal adapter hooks, and provider-unavailable launch descriptors.

## Evidence

- Migration namespace `1100` confirmed free before use.
- Added `1100_ot71_class_occurrence_fulfillment.sql`.
- Added unit schedule coverage for before 18:30, 18:30 immediate dispatch, at/after 19:00 next-day targeting, explicit joinable override, and winter/summer Asia/Jerusalem offsets.
- Added integration coverage for Family signup class reminder scheduling, School lead-only negatives, replay/idempotency, both-channel reminders, owner/admin readiness APIs, portal launch descriptors, and provider URL leak checks.
- Full `npm run test` passed after updating downstream billing and web-independence expectations to account for the new third Family class reminder intent.
