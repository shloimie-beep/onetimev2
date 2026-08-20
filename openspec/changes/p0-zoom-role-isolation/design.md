# Design

## Boundary

The server exposes independent Student, Parent, and Admin/Rabbi routers. A route
checks its expected actor kind before calling the launch service. The service then
checks the returned artifact against the actor-specific role, leave path, and ZAK
contract.

## Session isolation

The production-basic resolver reads both `__Host-onetime-session` (host-only,
root-path adult v2.1 session) and `otcrm_session` (root-path legacy session). It
does not select by cookie order. Two valid sessions with different canonical
principal IDs or roles are a conflict. Both sessions are revoked on a best-effort
bounded path, both browser cookie families are expired, and no service or marker
operation runs. One valid context plus a stale cookie clears only the stale family.

Successful login retains the existing cross-family convergence: adult login
revokes legacy Student context; Student/legacy login revokes adult context.

## Artifact contracts

- Student: role 0, no ZAK, `/app/student`.
- Parent: role 0, no ZAK, `/app/parent`.
- Host: role 1, non-empty ZAK, `/app/live-console`.

Clients validate the whole role-specific envelope before invoking the Meeting SDK.
