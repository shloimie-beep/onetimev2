# OT-111 Decisions

- Used the existing OT-74 `audience-reconciliation` model as the base rather than creating a second audience import stack.
- Added `new_system_activated` as an independent fact, not a destructive replacement for lead, legacy, school, consent, or suppression facts.
- Kept campaign snapshots counts-only for normal API evidence. The repository may persist opaque row keys, but router responses omit full recipient row lists.
- Kept WhatsApp disabled by default. Canary/batch queueing blocks unless an explicit policy enables it.
- Added a narrow lifecycle port for OPS-03B parent activation. Campaign code can call the port for protected canary activation without duplicating token generation or email transport.
- Broad batch queueing remains blocked because no real audience import/destination ingest or operator authorization is present in this lane.
