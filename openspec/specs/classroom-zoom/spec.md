# Classroom Zoom Specification

## Purpose

Define the recurring classroom while preserving One Time as the access authority.

## Requirements

### Requirement: Single recurring meeting

One Time SHALL bind one pre-created recurring Zoom meeting for the recurring class.
It SHALL NOT create per-occurrence meetings or per-Student registrants.

#### Scenario: A next class occurrence is resolved

- **WHEN** One Time determines the next class occurrence
- **THEN** it applies occurrence-scoped authorization, questions, attendance,
  recordings, and audit without changing meeting identity.

### Requirement: Provider boundary

Zoom SHALL be a provider, not the identity or entitlement authority.

#### Scenario: A learner requests classroom entry

- **WHEN** an entitled learner requests entry
- **THEN** One Time authorizes the occurrence before presenting the protected
  classroom action.
