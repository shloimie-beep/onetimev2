# Change: Isolate production Zoom launch by role and browser session context

## Why

The generic production-basic resolver can prefer a valid adult cookie while a
Student shell is authenticated by the separate legacy Student cookie. That allows
one browser context to cross the participant/host boundary.

## What Changes

- Replace the generic mutation surface with Student, Parent, and Admin/Rabbi routes.
- Bind each route to one strict artifact shape and reject hostile HTTP-200 payloads.
- Resolve both browser session families before choosing a principal; conflicting
  valid contexts are revoked, cleared, and denied with a neutral recovery result.
- Derive the Student Zoom display name from the exact active learner projection.

## Impact

- Affected capability: `classroom-zoom`
- Affected runtime: authenticated web server and Student/Parent/Admin clients
- Provider or deployment mutation: none
