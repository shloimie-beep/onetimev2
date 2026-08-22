## Why

The launch product has one recurring class, but its Admin surfaces still present a generic CRM and class-series workflow. Admins and Rabbis need a truthful daily class path, while account-email history needs a bounded, read-only home.

## What Changes

- Converge Admin and Rabbi navigation on a stable role-correct shell.
- Present the one canonical Sunday–Thursday 7:00 PM Asia/Jerusalem class as Today.
- Add governed host start, confirmed end, reconciliation, and local cleanup behavior.
- Bind each host lifecycle to the exact authenticated browser session and accept only
  verified exact-instance Zoom provider proof for meeting end.
- Present One Time People rather than a duplicate adult CRM.
- Restrict Communications to read-only info@ account-email history and move workflow readback to technical Operations.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `product`: Admin/Rabbi daily class workflow.
- `ui-shell`: Admin/Rabbi role shell and navigation grammar.
- `classroom-zoom`: host lifecycle and automatic canonical access.
- `communications`: account-email history boundary.
- `identity-access`: People privacy and membership projection.
- `billing-access`: Admin access presentation.
- `operations-control-plane`: One Time technical workflow readback placement.

## Impact

Admin/Rabbi client routes, production-basic host lifecycle, class/access projection, communications contracts and route, brand styles, governed action registry, and focused verification. Revised migration `2288_production_basic_host_lifecycle.sql` stores only account/product/occurrence-scoped lifecycle state plus hashed meeting, exact session, actor, opaque-context, and provider-instance references, together with narrow verified event evidence. No provider, production data, GHL, email, billing, or deployment mutation is in scope.
