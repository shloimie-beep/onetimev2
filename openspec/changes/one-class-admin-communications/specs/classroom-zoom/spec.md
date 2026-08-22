## ADDED Requirements

### Requirement: Governed host class lifecycle

Only an authorized Admin or Rabbi SHALL start or end the canonical class through role-1 host artifacts; provider confirmation SHALL precede local access cleanup.

#### Scenario: Provider end is ambiguous

- **WHEN** host end is interrupted, rejected, or times out
- **THEN** the durable live receipt remains and the UI offers reconciliation without a blind second provider end.

#### Scenario: A host reloads during an end

- **WHEN** an authorized host reloads after End was requested or confirmed
- **THEN** the browser reuses its opaque lifecycle context and the server performs a read-only exact-session status read without invoking provider End.

#### Scenario: Cleanup lacks provider proof

- **WHEN** a host calls legacy cleanup without a valid lifecycle context in `provider_ended` or `cleanup_pending`
- **THEN** the request is rejected and the live receipt is not cleared.

### Requirement: Exact host-session lifecycle binding

One Time SHALL authorize every Admin/Rabbi lifecycle read and mutation with account,
product, canonical occurrence, configured meeting digest, canonical actor digest,
exact authenticated session digest, lifecycle-context digest, expiry, and allowed
prior state.

#### Scenario: The same host signs in from a second browser session

- **WHEN** the second session attempts to start over, read, reconcile, end, or clean
  up the first session's active lifecycle
- **THEN** One Time denies the operation and does not transfer, rotate, or replace
  lifecycle ownership.

### Requirement: Verified exact-instance provider proof

One Time SHALL verify Zoom webhook signatures over the exact raw body, reject stale
or unauthorized events, persist only digest-only narrow lifecycle evidence, and bind
one exact provider meeting-instance digest to one canonical occurrence.

#### Scenario: The exact bound instance ends

- **WHEN** a verified `meeting.ended` event matches the configured account, host,
  recurring meeting number, and exact bound meeting-instance digest
- **THEN** One Time records provider end and may perform idempotent local cleanup for
  only that occurrence.

#### Scenario: A different recurring meeting instance ends

- **WHEN** a verified ended event has the same recurring meeting number but a
  different instance digest
- **THEN** One Time retains the current lifecycle state and does not clear access.

#### Scenario: Browser SDK reports status 3

- **WHEN** the host browser observes Zoom SDK status `3`
- **THEN** One Time treats it only as a reconciliation hint and requires server-side
  provider proof before recording provider end or clearing access.

#### Scenario: Provider proof is unavailable

- **WHEN** the webhook secret is absent or exact proof cannot be correlated
- **THEN** One Time preserves the safe lifecycle state and does not infer provider end.

### Requirement: Automatic canonical membership

The canonical class SHALL include active entitled Parent and Student learning identities while excluding suspended, archived, and revoked identities.

#### Scenario: Entitlement changes

- **WHEN** an identity gains or loses active entitlement
- **THEN** canonical class access converges without manual enrollment or cross-household leakage.
