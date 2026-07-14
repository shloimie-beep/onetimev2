# OT-47 Architecture Decision

Status: blocked before implementation by `STOP_REAL_POSTGRESQL_UNAVAILABLE`.

## Decision If Unblocked

Select the prompt default:

- signed BNA content-outcome events
- local PostgreSQL persistence
- asynchronous processing through the existing One Time worker process
- provider-neutral read interface
- sink/mock provider adapter by default
- no polling
- local screen-oriented list/detail APIs
- protected playback resolution only after explicit authorization

## Rationale

BNA continues to own source media, Drive intake, Studio, transcription, editing,
metadata generation, and provider operations. One Time should receive only
approved asynchronous outcomes, validate them, and persist safe local library
state. This keeps ordinary One Time routes independent of BNA and Vimeo.

A new raw-media worker is rejected because it would duplicate BNA-owned intake
and provider responsibilities and would violate the OT-47 boundary.

## Polling Decision

Polling implemented: no.

Provider readiness is `NOT_PROVEN`, so polling is not allowed. No polling code
was written.
