## ADDED Requirements

### Requirement: Role-bound production classroom launch

One Time SHALL expose distinct Student, Parent, and Admin/Rabbi production launch
boundaries. It SHALL derive actor, participant, scope, display name, role, and
entitlement on the server.

#### Scenario: A Student launches the recurring classroom

- **WHEN** an entitled active Student requests the Student production launch route
- **THEN** One Time returns only a role-0 artifact without ZAK and with the Student
  leave path.

#### Scenario: A Parent launches the recurring classroom

- **WHEN** an entitled active Parent requests the Parent production launch route
- **THEN** One Time returns only a role-0 artifact without ZAK and with the Parent
  leave path.

#### Scenario: An authorized Admin or Rabbi launches as host

- **WHEN** an authorized Admin or Rabbi requests the Admin production launch route
- **THEN** One Time returns only a role-1 artifact with a non-empty ZAK and the live
  console leave path.

#### Scenario: A stale client calls the retired generic mutations

- **WHEN** a client calls generic launch, host-live, or host-ended
- **THEN** the route is not found and no artifact or live-marker mutation occurs.

### Requirement: Conflicting browser sessions fail closed

One Time SHALL evaluate adult v2.1 and legacy browser sessions before selecting a
production classroom principal.

#### Scenario: Valid sessions disagree

- **WHEN** simultaneously valid sessions resolve to different principals or roles
- **THEN** One Time returns a neutral session-context-conflict result, revokes and
  clears both browser contexts, and performs no artifact, ZAK, provider, or
  live-marker operation.

#### Scenario: One session is stale

- **WHEN** one presented session is valid and the other session family is stale
- **THEN** One Time uses the valid role-bound context and clears only the stale
  browser cookie family.
