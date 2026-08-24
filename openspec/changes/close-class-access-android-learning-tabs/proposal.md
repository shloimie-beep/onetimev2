## Why

Students can still see a Join class action after the host ends the Zoom meeting because One Time
keeps its live-access receipt for a two-hour safety window. On Android, the Student Learning
subcategory strip can also overflow without responding reliably to a horizontal swipe.

## What Changes

- Close One Time's live Student access when the authenticated host browser receives Zoom Meeting
  SDK status 3, with a visible retry if that app-only close fails.
- Treat the current One Time live receipt, rather than the scheduled time window, as authoritative
  for Student live status on the production-basic classroom path.
- Make the Student Learning subcategory strip horizontally swipeable on narrow Android viewports
  and keep the selected subcategory visible.

## Capabilities

### Modified Capabilities

- `classroom-zoom`: host-ended One Time access closure and Student live-state projection.
- `student-experience`: post-class Join state and Learning subcategory navigation.
- `ui-shell`: touch-scrollable narrow-viewport section tabs.

## Impact

Authenticated web server, Admin/Rabbi live console, Student portal projection, and shared section
tabs. No Zoom meeting, registrant, provider configuration, identity, entitlement, attendance, or
deployment mutation is included.
