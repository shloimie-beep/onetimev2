## ADDED Requirements

### Requirement: Current Student class action

The Student portal SHALL remove the live Join class action after the host closes One Time access,
including while the occurrence remains inside its scheduled time window.

#### Scenario: The host ends class

- **WHEN** the host-ended live receipt close succeeds
- **THEN** the Student's existing dashboard refresh removes the live Join class presentation.

### Requirement: Swipeable Learning subcategories

The Student Learning subcategory strip SHALL remain horizontally swipeable on narrow Android
viewports and SHALL reveal its selected subcategory.

#### Scenario: Learning subcategories overflow the viewport

- **WHEN** Classroom, Library, Progress, and Questions do not fit in the available width
- **THEN** the Student can pan the strip horizontally without widening the page.

#### Scenario: A Student opens an off-screen subcategory directly

- **WHEN** the selected Learning subcategory starts outside the visible portion of the strip
- **THEN** the strip scroll position adjusts to reveal it without scrolling the page vertically.
