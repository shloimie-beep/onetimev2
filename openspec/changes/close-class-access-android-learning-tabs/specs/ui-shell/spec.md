## ADDED Requirements

### Requirement: Touch-scrollable section tabs

Shared section tabs SHALL contain horizontal overflow inside the strip, support touch panning, and
keep the active item visible on narrow viewports.

#### Scenario: A section-tab strip overflows on Android

- **WHEN** the tab items are wider than the strip
- **THEN** horizontal touch movement scrolls the strip while ordinary vertical page movement
  remains available.
