## ADDED Requirements

### Requirement: Host-ended One Time access closure

One Time SHALL close the current production-basic live receipt when an authorized Admin or Rabbi
host browser receives Zoom Meeting SDK status 3, without issuing a Zoom provider mutation.

#### Scenario: Zoom reports that the hosted meeting ended

- **WHEN** the authenticated, CSRF-verified host client receives Meeting SDK status 3
- **THEN** it requests an idempotent app-only close for the exact scoped meeting receipt and does
  not confirm or reopen that receipt after the end signal.

#### Scenario: The app-only close fails

- **WHEN** One Time cannot acknowledge the live-receipt close
- **THEN** the host sees that Student access may still be open and can retry the same bounded close.

### Requirement: Receipt-authoritative Student live state

The production-basic Student portal SHALL expose an occurrence as live only while the exact
entitled Student live receipt is current.

#### Scenario: The meeting has ended during its scheduled window

- **WHEN** no exact current live receipt exists but the base schedule still labels the occurrence
  live from wall-clock time
- **THEN** the Student projection demotes it to upcoming and does not expose Join class as live.
