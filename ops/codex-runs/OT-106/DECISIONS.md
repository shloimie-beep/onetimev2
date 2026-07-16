# OT-106 Decisions

- `DEC-OT106-001`: Branch from current `origin/codex/ops03-staging-readiness-repair` so the stacked PR stays clean. The required prompt SHA `fb3c397ce8ece100cf7873fdddcd940a1552ea9b` is recorded and verified as an ancestor because the named PR base advanced after the prompt was created.
- `DEC-OT106-002`: Implement OT-106 as an additive runtime on top of existing OT86B social groundwork, with migration `2160_ot106_buffer_social_publishing.sql` for the stricter manifest, alias, queue, provider-attempt, and audit state required by the prompt.
- `DEC-OT106-003`: Use Buffer's current GraphQL API at `https://api.buffer.com`; do not reuse the legacy Buffer REST canary in `bin/ot86-buffer-canary` for OT-106 evidence.
- `DEC-OT106-004`: Default provider mode remains non-writing (`disabled` or `sink`). Real Buffer drafts require protected config and draft-canary authorization; scheduling additionally requires explicit scheduled mode and per-manifest owner/admin approval.
- `DEC-OT106-005`: Process retries from persisted target states and skip already-successful target aliases, so a partial retry cannot duplicate a successful Buffer draft.
