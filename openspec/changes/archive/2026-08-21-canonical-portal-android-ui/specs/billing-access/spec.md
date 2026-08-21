## ADDED Requirements

### Requirement: Capability-gated Parent billing navigation

Parent Billing navigation SHALL be visible only when the existing billing/access
capability permits it. Student Billing navigation SHALL never be visible.

#### Scenario: Billing is disabled

- **WHEN** the active environment has billing disabled
- **THEN** neither the Parent Billing link nor Billing heading is rendered.
