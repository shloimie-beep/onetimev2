# OT-47 Collision Map

Status: blocked before implementation by `STOP_REAL_POSTGRESQL_UNAVAILABLE`.

## Git

- Approved base SHA: `a73458d1884b8fcb4843c4852425009577f59ef7`
- Source checkout before worktree creation: clean.
- Worktree path before creation: absent.
- Feature branch before creation: absent locally and on origin.
- Anchor branch before creation: absent locally and on origin.
- Anchor branch after creation: local and origin both resolve to the approved base.

## Migration Namespace

- Existing migration IDs: `0001_onetime_lead_slice`, `0002_crm_auth_core`.
- OT-47 reserved namespace: `1400-1499`.
- Lowest intended migration ID: `1400`.
- Collision found: no.

## File Ownership

Changed files in this stop report are limited to `ops/evidence/ot-47/**`.

No shared composition, app shell, navigation, config, package, lockfile, worker
entrypoint, auth, lead, CRM, provider, BNA, class, portal, communications,
Stripe, Telegram, Railway, DNS, or OT-43 files were edited.

## External Mutation

- Per prompt, `codex/parallel-base-a73458d` was pushed to origin because it was
  absent and needed as the immutable review anchor.
- No provider, production database, deployment, Railway, DNS, BNA runtime,
  Vimeo, payment, email, WhatsApp, Telegram, or webhook mutation was performed.
