# OPS-03 Raw Request

Source: Codex chat, 2026-07-16.

Task: OPS-03 - repair and certify OT-99 staging for `webcraft-media/onetimev2`.

Starting SHA: `96b429053d13a139595ed3bd0ea3c854cc2500e8`

Existing staging URL: `https://ot99-web-staging.up.railway.app`

Existing Railway project ID: `7c8eee26-7a6a-4684-826d-9f4377d67d46`

Authorization:

- Isolated staging code, database, service, and deployment changes: yes.
- Production deployment: no.
- join/root DNS changes: no.
- Live sends, charges, provider canaries, Buffer publication, or production imports: no.
- BNA production/runtime mutation: no.

Goal:

Repair every OPS-02 certification blocker, redeploy the repaired candidate to the existing isolated staging project, and return a genuinely usable staging login for visual and functional acceptance.

Required repairs:

- Parent learner access generic error.
- Staging metadata canonical/Open Graph origin.
- Railway Docker build dependency on `tests/`.
- PostgreSQL 16 isolated staging database.
- Native backup/restore proof.
- Recertification with health checks, role logins, CRM/dashboard/portals/classes/content/billing-disabled state, required viewports, accessibility, bundle, performance, secret-scan, migration, and browser gates.

Safety:

- Do not print or commit operator handoff credentials or protected variables.
- Keep providers in sink/test/off mode.
- Do not configure or resend Stripe webhook.
- Push branch and open draft PR.
