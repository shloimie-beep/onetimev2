# OT-35 Backend Gaps

OT-35 is frontend-only. The authenticated shell and CRM clarity work does not add
backend features, mutate production data, or invent fields.

## Durable Tag Backend

- Current CRM API responses expose classification, status, source, assigned
  team member, contact methods, last activity, consent, and suppression state.
- Durable custom tags are not present in the current standalone One Time CRM
  contracts or frontend-owned API responses.
- The OT-35 frontend therefore renders only semantic chips for API-backed
  classification, status, and source.
- A later backend/API packet is required before visible custom tags, tag filters,
  tag editing, or imported legacy tag language can ship.
