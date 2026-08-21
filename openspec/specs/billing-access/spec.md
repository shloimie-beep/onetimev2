# Billing Access Specification

## Purpose

Keep billing access policy explicit and prevent unapproved charging.

## Requirements

### Requirement: Deferred Stripe sandbox

Stripe sandbox work SHALL remain later and SHALL be orchestrated through GHL. Live
charging is not authorized by this specification.

#### Scenario: A payment capability is requested

- **WHEN** billing is proposed
- **THEN** it remains later until an explicit authorized change defines the GHL
  orchestration and acceptance evidence.

### Requirement: No live charge by default

One Time SHALL NOT initiate a live charge, subscription change, or billing provider
mutation without separate explicit authorization and reconciliation.

#### Scenario: A billing retry is considered

- **WHEN** an external billing effect is uncertain
- **THEN** the effect is reconciled before any retry.

### Requirement: Capability-gated Parent billing navigation

Parent Billing navigation SHALL be visible only when the existing billing/access
capability permits it. Student Billing navigation SHALL never be visible.

#### Scenario: Billing is disabled

- **WHEN** the active environment has billing disabled
- **THEN** neither the Parent Billing link nor Billing heading is rendered.
