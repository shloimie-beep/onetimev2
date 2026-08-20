# Identity and Access Specification

## Purpose

Protect household identity, child privacy, and One Time-owned entitlement boundaries.

## Requirements

### Requirement: One Time owns identity and entitlement

One Time SHALL be the authority for Parent/Student identity, household membership,
child privacy, enrollment, and library/classroom entitlement.

#### Scenario: A provider needs access context

- **WHEN** Zoom, Vimeo, or GHL participates in a flow
- **THEN** One Time retains the identity and entitlement decision.

### Requirement: Adult CRM boundary

GHL SHALL own adult CRM and adult communication operations. Students SHALL NEVER
become GHL contacts.

#### Scenario: An adult household event is projected

- **WHEN** an authorized adult CRM projection is needed
- **THEN** it contains adult-only data and preserves suppression boundaries.
