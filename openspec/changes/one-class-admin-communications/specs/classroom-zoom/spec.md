## ADDED Requirements

### Requirement: Launch-first host class operation

Only an authorized Admin or Rabbi SHALL start the canonical class through a role-1 host artifact with a non-empty ZAK. The host SHALL use Zoom’s native End Meeting for All control; One Time SHALL not issue a provider End command or claim provider-confirmed closure.

#### Scenario: Zoom ends in the current host browser

- **WHEN** the Meeting SDK reports status 3
- **THEN** One Time may close its own live-access receipt through the authorized host boundary and SHALL not issue a provider End command or claim provider-confirmed closure.

#### Scenario: Bounded access expiry

- **WHEN** the current valid live marker reaches its existing two-hour safety TTL
- **THEN** Parent and Student launch access is unavailable without provider mutation or a host cleanup action.

#### Scenario: The canonical date already has a historical occurrence identifier

- **WHEN** Live Console resolves the current class without an explicit occurrence identifier
- **THEN** it reuses the occurrence already stored for the canonical series and local class date.

### LATER

Verified Zoom `meeting.started`/`meeting.ended` ingestion, exact meeting-instance proof, exact host-session-bound lifecycle, and server-authoritative reconciliation are later work.

### Requirement: Automatic canonical membership

The canonical class SHALL include active entitled Parent and Student learning identities while excluding suspended, archived, and revoked identities.

#### Scenario: Entitlement changes

- **WHEN** an identity gains or loses active entitlement
- **THEN** canonical class access converges without manual enrollment or cross-household leakage.
