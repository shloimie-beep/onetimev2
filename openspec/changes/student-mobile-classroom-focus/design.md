## Context

Zoom's Client View is the supported Meeting SDK surface for mobile browsers. Its supported
initialization controls can remove the meeting header, unlock the bottom toolbar so it hides
after idle time, and prevent meeting chrome from covering shared content. Browser-native
fullscreen must be requested during a user gesture.

## Decisions

- Reuse the existing Student Join tap as the fullscreen user gesture; do not add another gate.
- Apply focus options only to Student joins. Parent and host Meeting SDK presentation stays
  unchanged.
- Use `navigationUI: 'hide'` and a `100dvh` landscape root. Natural Android rotation remains
  under the device's accessibility and auto-rotate settings; One Time does not force an
  orientation lock.
- Treat fullscreen as progressive enhancement. Unsupported or rejected fullscreen never blocks
  the protected classroom join.

## Acceptance

On a supported Android browser, tapping Join enters browser fullscreen. After rotating to
landscape, the classroom fills the screen, the Zoom meeting header is absent, and the bottom
meeting controls disappear after inactivity and return when the Student touches the meeting.

## Non-Goals

No custom Zoom toolbar, Meeting SDK Component View migration, native Android application,
provider setting change, meeting mutation, or forced screen-orientation lock.
