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
