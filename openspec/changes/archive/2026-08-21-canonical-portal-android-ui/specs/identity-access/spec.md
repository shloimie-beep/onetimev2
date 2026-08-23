## ADDED Requirements

### Requirement: Role-correct protected shell composition

One Time SHALL not compose a Parent or Student protected shell until the authorized
role is known, and role changes SHALL discard prior portal state.

#### Scenario: A session resolves to a different role

- **WHEN** a route's expected role differs from the authenticated role
- **THEN** the route enters a safe permission state without exposing the other
  role's navigation or household data.
