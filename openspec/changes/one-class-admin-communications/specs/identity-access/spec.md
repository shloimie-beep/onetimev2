## ADDED Requirements

### Requirement: People boundary

One Time SHALL present Families, Parents, Students, Access, and Audit as app-owned identity information and SHALL not present Students as GHL contacts.

#### Scenario: An operator reviews a Student

- **WHEN** an authorized operator opens People / Students
- **THEN** the view shows only One Time identity, household, and access facts without CRM actions or GHL identity.

### Requirement: Exact authenticated host session remains server-bound

One Time SHALL derive the host lifecycle session reference from the authenticated
v2.1 session ID or legacy session key and SHALL keep that reference out of client
responses, logs, and persisted plaintext.

#### Scenario: A host lifecycle is created

- **WHEN** an authorized Admin or Rabbi starts the production classroom
- **THEN** One Time persists only a domain-separated SHA-256 digest of the exact
  authenticated session reference and returns a separate opaque lifecycle context.
