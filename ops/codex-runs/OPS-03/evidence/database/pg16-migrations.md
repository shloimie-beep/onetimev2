# OPS-03 PostgreSQL 16 Evidence

Railway service:

- Service: `ot99-pg16`
- Service ID: `7dc5b2ec-03ff-4c22-821d-8df925fe63ee`
- Volume: `ot99-pg16-volume`
- Volume ID: `29268b58-df5a-442a-836c-6d98d82d2de3`
- TCP proxy ID: `e7d6f00a-68b3-4210-98d5-d755c553c98e`
- TCP proxy endpoint: `tokaido.proxy.rlwy.net:55404`

Version proof:

- `16.14 (Debian 16.14-1.pgdg13+1)`

Migration proof:

- `npm run db:migrate`: applied 22 migrations.
- `npm run db:verify`: verified 22 migrations as `already_applied`.

Sanitized row counts after fictional staging seed:

| Table                                 | Count |
| ------------------------------------- | ----: |
| `onetime.schema_migrations`           |    22 |
| `onetime.account_users`               |     6 |
| `onetime.portal_households`           |     2 |
| `onetime.portal_learners`             |     3 |
| `onetime.portal_student_access_state` |     3 |
| `onetime.content_items`               |     3 |
| `onetime.class_occurrences`           |     1 |
| `onetime.outbox_events`               |     1 |

No row contents or secrets were printed.
