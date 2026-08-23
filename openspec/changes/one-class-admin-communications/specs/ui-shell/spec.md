## ADDED Requirements

### Requirement: Admin and Rabbi shell convergence

Admin and Rabbi SHALL use the established role shell grammar with primary navigation in the rail/drawer and contextual navigation in a horizontal strip.

#### Scenario: A Rabbi opens a protected route

- **WHEN** a Rabbi opens or refreshes a direct URL
- **THEN** the Rabbi shell shows only Today, Learning, Live Console, and Account without an Admin flash.

#### Scenario: An operator starts class from a narrow viewport

- **WHEN** an authorized Admin or Rabbi opens the primary mobile navigation
- **THEN** Live Console is directly reachable and opens its canonical Zoom section.
