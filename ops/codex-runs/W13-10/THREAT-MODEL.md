# W13-10 Threat Model

Assets: account sessions, parent/student scopes, CRM contacts, communication consent, provider secrets, outbox queues, migrations, billing/test billing, support bridge, content/helper context, audit logs.

Actors: anonymous visitors, parents, students, owner/admin users, support operators, provider webhooks, malicious clients, compromised browser context, CI contributor.

Trust boundaries: public web, authenticated app, database, worker, provider adapters, GitHub Actions, deployment environment.

Existing controls audited or extended: server-derived scope, CSRF, safe return paths, CSP/helmet, generic lead responses, durable rate limits, raw-body webhook routes, provider-off defaults, W13-10 activation blockers, consent metadata, sink worker default.

Residual risks: counsel approval, exact production authorization, disposable PostgreSQL 16/18 rehearsal, full W13-09 adversarial coverage, and provider-specific canary proof remain open gates.
