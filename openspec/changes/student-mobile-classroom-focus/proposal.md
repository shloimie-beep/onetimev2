## Why

On an Android Student device, browser and Zoom chrome reduce the usable classroom area in
landscape and can cover the top and bottom of the lesson. The protected Zoom classroom should
use the available screen while keeping Zoom's native meeting controls recoverable by touch.

## What Changes

- Request browser-native fullscreen from the Student's existing Join gesture on mobile/tablet.
- Hide Zoom's meeting header, unlock the bottom toolbar so Zoom minimizes it after inactivity,
  and keep shared lesson content free of Zoom overlays.
- Fill the dynamic landscape viewport while fullscreen is active.
- Continue joining safely when the browser declines or does not support fullscreen.

## Capabilities

### Modified Capabilities

- `classroom-zoom`: Student mobile Client View focus behavior.
- `ui-shell`: fullscreen Student classroom viewport behavior.

## Impact

Student browser presentation and Meeting SDK initialization only. No meeting, registrant,
identity, entitlement, attendance, provider configuration, or Zoom mutation changes.
