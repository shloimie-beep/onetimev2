# UI Shell Specification

## Purpose

Preserve a coherent, accessible visual and navigation system across One Time roles.

## Requirements

### Requirement: Shared role navigation grammar

Parent and Student SHALL use the same navigation grammar: recognizable header,
primary navigation, contextual horizontal subcategory strip where needed, content
region, and mobile drawer behavior.

#### Scenario: A user changes role or viewport

- **WHEN** a Parent or Student moves between supported routes or desktop and mobile
- **THEN** navigation remains recognizable while role-specific content stays scoped.

### Requirement: Durable design contract

Visible surfaces SHALL follow DESIGN.md and the existing brand manifest: black,
yellow, white, and ice palette; branded controls; responsive accessible states; and
no gray browser-default selects or old-shell flashes.

#### Scenario: A route is loading or unavailable

- **WHEN** a UI route is loading, empty, in error, denied, or offline
- **THEN** it renders the defined accessible state without exposing stale shell UI.

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
