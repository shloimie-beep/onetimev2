## ADDED Requirements

### Requirement: Truthful library migration state

Normal Parent and Student Library states SHALL state that class-library migration
is in progress when no real approved material is available.

#### Scenario: No production material is published

- **WHEN** an entitled learner opens Library without published material
- **THEN** the page says that recordings and review materials will begin appearing
  soon and does not claim that a provider library is live.
