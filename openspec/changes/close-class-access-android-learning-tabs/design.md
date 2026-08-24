## Context

The production-basic classroom stores a digest-only live receipt after the host Meeting SDK join
resolves. The Student portal polls its dashboard while a class is upcoming, but clearing that
receipt alone is insufficient because the base schedule can still label the occurrence `live`
from wall-clock time. The shared section-tab primitive already allows overflow but does not bound
its own width, declare touch panning, or reveal the active item.

## Decisions

- A Zoom Meeting SDK status-3 callback requests an app-only, body-less `host-ended` mutation.
  Host session authorization and CSRF verification remain mandatory; the callback is not itself
  authority.
- The mutation clears only the exact account, product, Jerusalem class date, and recurring-meeting
  digest live receipt. It is idempotent and never calls Zoom.
- If the status-3 callback arrives before the SDK join promise resolves, the client does not
  confirm the class live afterward. This prevents the end/start race from reopening access.
- A failed app-access close is shown to the host and can be retried. The UI does not claim that
  access closed until the server acknowledges it.
- For a production-basic Student, a scheduled occurrence is projected as live only when the exact
  current receipt is present. A wall-clock-only `live` result is demoted to `upcoming` and cannot
  drive the Join class banner.
- Section tabs are width-bounded, allow horizontal and vertical touch panning, contain horizontal
  overscroll, and move the selected item into view without moving the page vertically.

## Acceptance

After an Admin or Rabbi uses Zoom's native End Meeting for All control, the live console reports
that One Time access is closed and the Student portal removes Join class on its next existing poll.
On a narrow Android viewport, a Student can swipe between Classroom, Library, Progress, and
Questions, and a directly opened subcategory is visible in the strip.

## Non-Goals

No provider-side End command, webhook ingestion, meeting reconciliation, custom Zoom controls,
new polling channel, forced Android orientation, or navigation redesign.
