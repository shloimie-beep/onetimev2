# Content Media Specification

## Purpose

Define the protected learning library boundary and defer non-launch media work.

## Requirements

### Requirement: Protected library entitlement

One Time SHALL own library entitlement and protected playback authorization. Vimeo
SHALL remain a media provider rather than an identity authority.

#### Scenario: A learner opens a library item

- **WHEN** an entitled Parent or Student requests protected content
- **THEN** One Time verifies entitlement before exposing the protected playback path.

### Requirement: Deferred library expansion

Library migration and content intelligence SHALL remain later than the current
live-class launch path.

#### Scenario: A library expansion is proposed

- **WHEN** migration, transcription, or content intelligence is proposed
- **THEN** it is planned as later work and does not block the live-class path.

### Requirement: Truthful library migration state

Normal Parent and Student Library states SHALL state that class-library migration
is in progress when no real approved material is available.

#### Scenario: No production material is published

- **WHEN** an entitled learner opens Library without published material
- **THEN** the page says that recordings and review materials will begin appearing
  soon and does not claim that a provider library is live.
