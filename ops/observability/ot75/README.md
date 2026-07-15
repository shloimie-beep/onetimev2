# OT-75 Observability Contract

This folder prepares release observability without wiring a vendor, creating a
dashboard, deploying an agent, or sending telemetry from local execution.

Evidence must be redacted and count-based. It may include status booleans,
counts, rates, latency buckets, source SHA matches, release IDs, and opaque
service names. It must not include raw message bodies, email addresses, phone
numbers, chat IDs, payment identifiers, database URLs, provider tokens, cookies,
authorization headers, or full personal records.
