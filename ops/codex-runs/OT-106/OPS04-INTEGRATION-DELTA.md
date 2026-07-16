# OT-106 OPS04 Integration Delta

OT-106 adds a standalone One Time Buffer social-publishing runtime. It does not merge, edit, or depend on OPS-04 legacy audience migration data.

## New Local Surface

- Signed OT-106 social publication manifest contract.
- Additive migration `2160_ot106_buffer_social_publishing.sql`.
- Feature-local domain runtime for Buffer alias mapping, sink mode, GraphQL draft/scheduled post creation, retry/backoff, attempts, and audit evidence.
- `bin/ot106-buffer-canary` for read-only Buffer GraphQL discovery and explicitly authorized draft canary.
- `scripts/ot106-buffer-queue-proof.ts` for 10k synthetic sink queue proof.
- Partial retry handling is target-state aware and does not recreate successful Buffer drafts.

## No Cross-Lane Mutation

- No BNA runtime files are edited.
- No Railway, production database, credentials, public pages, portals, auth, billing, Telegram, Zoom, Vimeo, or OPS-04 audience migration files are edited.
- Buffer account/channel configuration remains protected runtime config.
