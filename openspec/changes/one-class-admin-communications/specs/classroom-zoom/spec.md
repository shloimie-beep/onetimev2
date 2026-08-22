## ADDED Requirements

### Requirement: Governed host class lifecycle

Only an authorized Admin or Rabbi SHALL start or end the canonical class through role-1 host artifacts; provider confirmation SHALL precede local access cleanup.

#### Scenario: Provider end is ambiguous

- **WHEN** host end is interrupted, rejected, or times out
- **THEN** the durable live receipt remains and the UI offers reconciliation without a blind second provider end.

#### Scenario: A host reloads during an end

- **WHEN** an authorized host reloads after End was requested or confirmed
- **THEN** the server reads the durable account/product/occurrence lifecycle and returns a fresh opaque actor-bound context without invoking provider End.

#### Scenario: Cleanup lacks provider proof

- **WHEN** a host calls legacy cleanup without a valid lifecycle context in `provider_ended` or `cleanup_pending`
- **THEN** the request is rejected and the live receipt is not cleared.

### Requirement: Automatic canonical membership

The canonical class SHALL include active entitled Parent and Student learning identities while excluding suspended, archived, and revoked identities.

#### Scenario: Entitlement changes

- **WHEN** an identity gains or loses active entitlement
- **THEN** canonical class access converges without manual enrollment or cross-household leakage.
