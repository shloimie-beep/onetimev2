# OT-86B performance and bundle boundaries

Record dataset, tool/runtime, command, sample count, p50, p95, max, and pass/fail in `PERFORMANCE.md`.

With fixtures of at least 10,000 accepted social sources, 50,000 draft revisions, 10,000 approvals, and 10,000 scheduled commands:

- authenticated event validation plus durable inbox acknowledgement p95 ≤ 300 ms for payloads up to 512 KiB, excluding async generation;
- social draft list/filter API p95 ≤ 300 ms with bounded pagination;
- draft detail/preview local render p95 ≤ 250 ms, excluding remote media transfer;
- scheduler due-command selection p95 ≤ 500 ms for a 100-command batch with indexed query plan;
- duplicate event/command reconciliation p95 ≤ 250 ms before provider network time;
- no event-receipt request waits for draft generation or Buffer.

Provider operations are queued, bounded, rate-limit aware, and not executed in UI request threads. Scheduler leases prevent duplicate concurrent work and expire safely.

Client boundaries:

- Buffer SDK, access-token logic, raw provider response types, and scheduler code are absent from browser bundles.
- Added compressed JavaScript for social list/detail/preview routes is ≤ 50 KiB per route, or no more than 5% regression when an existing stricter budget applies.
- Preview media uses approved allowlisted URLs/proxies and does not allow arbitrary browser fetch.
- Lists use pagination/virtualization consistent with repository conventions and do not render unbounded histories.

Availability boundaries:

- Buffer outage degrades scheduling/publication only; event intake, drafting, review, and OT-86A content delivery remain available.
- Missing accounts do not trigger repeated provider calls on every page view; readiness is cached briefly and refreshable by an authorized action.
- Provider retries use backpressure and bounded concurrency.
