## ADDED Requirements

### Requirement: Technical workflow readback placement

Read-only external workflow diagnostics SHALL remain a capability-gated One Time Operations technical surface and SHALL not appear as normal Communications history.

#### Scenario: An operator opens Communications

- **WHEN** normal Communications is rendered
- **THEN** workflow readback is not displayed or linked as account-email history.

### Requirement: Zoom provider-proof activation is an explicit operator gate

One Time SHALL keep provider proof unavailable until the protected webhook secret is
present and the existing Zoom app is manually subscribed only to the approved lifecycle
events for the canonical endpoint.

#### Scenario: The webhook secret is absent

- **WHEN** a Zoom lifecycle request arrives before protected configuration is present
- **THEN** One Time fails closed without persisting proof or clearing access.

#### Scenario: An operator prepares activation

- **WHEN** the exact reviewed candidate is ready for manual provider setup
- **THEN** the runbook requires protected runtime configuration, endpoint validation,
  only `meeting.started` and `meeting.ended`, one isolated canary, and sanitized
  exact-instance evidence without secret or raw UUID exposure.
