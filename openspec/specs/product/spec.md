# Product Specification

## Purpose

Define One Time's independent product boundary and the minimal recurring learning path.

## Requirements

### Requirement: Standalone product boundary

One Time SHALL remain a standalone application. BNA SHALL remain a separate
workspace/application, and Platform Console SHALL remain a later separate control
plane.

#### Scenario: A new capability is planned

- **WHEN** a capability is proposed for One Time
- **THEN** its behavior, identity, and data boundaries are specified in One Time
  rather than copied from BNA or assigned to Platform Console.

### Requirement: Recurring learning path

One Time SHALL present one recurring Sunday–Thursday 7:00 PM Asia/Jerusalem class as
Next Class rather than a launch-month calendar grid.

#### Scenario: A learner opens the class area

- **WHEN** an entitled Parent or Student opens the class area
- **THEN** the next eligible occurrence is the primary class representation.
