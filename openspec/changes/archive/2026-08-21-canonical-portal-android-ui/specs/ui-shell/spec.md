## ADDED Requirements

### Requirement: Role-bound portal readiness

One Time SHALL resolve an authenticated Parent or Student role before rendering the
corresponding protected portal shell and SHALL expose a deterministic role-bound
loading, ready, or error state.

#### Scenario: A Parent dashboard is loading

- **WHEN** an authenticated Parent opens a canonical Parent route
- **THEN** the Parent shell remains stable and no legacy, Admin, Student, or stale
  household shell is mounted before the Parent dashboard is ready or errors.

### Requirement: Compact mobile primary navigation

Parent and Student portal primary navigation SHALL use one branded, accessible
drawer on narrow viewports.

#### Scenario: A keyboard user opens the mobile menu

- **WHEN** the menu opens
- **THEN** focus is trapped, Escape closes it, body scrolling is locked, and focus
  returns to the opener after close.
