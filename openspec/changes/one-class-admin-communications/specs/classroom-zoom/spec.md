## ADDED Requirements

### Requirement: Governed host class lifecycle

Only an authorized Admin or Rabbi SHALL start or end the canonical class through role-1 host artifacts; provider confirmation SHALL precede local access cleanup.

#### Scenario: Provider end is ambiguous

- **WHEN** host end is interrupted, rejected, or times out
- **THEN** the durable live receipt remains and the UI offers reconciliation without a blind second provider end.

### Requirement: Automatic canonical membership

The canonical class SHALL include active entitled Parent and Student learning identities while excluding suspended, archived, and revoked identities.

#### Scenario: Entitlement changes

- **WHEN** an identity gains or loses active entitlement
- **THEN** canonical class access converges without manual enrollment or cross-household leakage.
