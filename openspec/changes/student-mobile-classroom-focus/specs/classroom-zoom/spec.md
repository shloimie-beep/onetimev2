## ADDED Requirements

### Requirement: Mobile Student classroom focus

One Time SHALL present the Student's Zoom Client View as a mobile fullscreen enhancement without
changing Zoom's role as provider or One Time's role as access authority.

#### Scenario: A Student joins from a supported mobile browser

- **WHEN** the entitled Student invokes the protected Join action on a supported mobile browser
- **THEN** One Time requests browser-native fullscreen from that gesture, hides the Zoom meeting
  header, unlocks the Zoom bottom controls for idle minimization, and prevents Zoom chrome from
  covering shared lesson content.

#### Scenario: The Student rotates to landscape

- **WHEN** fullscreen is active and the Student rotates the device to landscape
- **THEN** the Meeting SDK root fills the dynamic viewport without One Time shell chrome.

#### Scenario: Fullscreen is unavailable

- **WHEN** the browser does not support or declines the fullscreen request
- **THEN** One Time continues the authorized classroom join and performs no provider, identity,
  entitlement, attendance, or meeting mutation as a fallback.
