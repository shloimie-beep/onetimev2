## ADDED Requirements

### Requirement: Fullscreen Student classroom viewport

The Student classroom SHALL use the entire dynamic mobile viewport while browser fullscreen is
active and SHALL preserve safe behavior when fullscreen is unavailable.

#### Scenario: Android landscape fullscreen

- **WHEN** a Student's supported Android browser is fullscreen and the device is landscape
- **THEN** the classroom occupies the full viewport without the authenticated One Time shell
  constraining or cropping the Meeting SDK surface.
