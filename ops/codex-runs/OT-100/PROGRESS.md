# OT-100 Progress

## 2026-07-16

- Created clean isolated worktree `C:/Users/User/onetimev2-ot100-whatsapp-public-provider-activation`.
- Created branch `codex/ot100-whatsapp-public-provider-activation` at exact base SHA `fb3c397ce8ece100cf7873fdddcd940a1552ea9b`.
- Preserved the operator prompt at `ops/codex-runs/OT-100/ORIGINAL-PROMPT.md`.
- Initialized resumability files before code edits.
- Verified current official Meta documentation targets: Graph API latest `v25.0`, Cloud API sends through Graph/HTTPS, webhook `X-Hub-Signature-256`, messages/status webhooks, and service/non-template replies inside the 24-hour customer-service window.
- Added WhatsApp provider activation migration, guarded Meta sender, lease-safe outbox processing, encrypted provider-ref persistence, status dedupe, feature-local runtime script, integration delta, and focused tests.

## Next

- Run focused unit/integration tests, typecheck/lint/secret scan/diff check, then update final evidence and PR body.
