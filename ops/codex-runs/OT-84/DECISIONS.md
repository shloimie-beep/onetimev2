# OT-84 Decisions

## Initial Security Decisions

- Use the verified generated OT-84 packet as implementation authority; do not
  use a PRO factory file as the executable prompt.
- Keep all implementation work inside the standalone
  `webcraft-media/onetimev2` repository.
- Treat Telegram as an alert/action transport only. It must not become a system
  of record or public signup dependency.
- Preserve one production One Time bot model. No second staging bot is created
  by OT-84.
- Fixed One Time scope must be constructed server-side. User text, callback
  data, and parser output cannot choose account, product, role, principal,
  service, SQL, shell, URL, or tool names.
- Missing protected Telegram secrets block only live provider mutation and real
  canary work. They do not block durable implementation, tests, synthetic
  canary, branch push, or draft PR.

## Repository Reconnaissance

Pending. Inspect and record:

- authorization and account/product context;
- One Time owner/admin membership model;
- existing application service boundaries;
- CRM, contacts, tags, classes, content, tasks, support, and audit services;
- migration and database helpers;
- transactional outbox and worker conventions;
- logging/redaction helpers;
- health/deployment process definitions;
- test framework and CI commands.

## Component Mapping

Pending.

