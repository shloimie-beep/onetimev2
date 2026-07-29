# P23 Next Prompt

REVIEW_OR_INTEGRATE the superseding P23 PostgreSQL-safe-dedupe final on
`codex/v21-p23-student-notifications`.

Verify its final metadata has sole parent implementation
`2961e4a457be6dd1381a98c81258d7a3fb648b69`, and that implementation has sole
parent reconciled claim `102c75c257dda033750d38e95b84ab05b8781507`.

Confirm:

- exact **Open schedule** copy with canonical `/app/student/calendar`;
- NUL-free, injective, versioned exact-tuple dedupe persistence and advisory
  serialization;
- artifact digest
  `14ab3136df7262cc2656f35402e193786985bb5266e7adddc4f34ba44abb8a36`;
- unchanged request aggregate
  `f984e5ee374f4612bdc7e7f500791545acb7b98acef74703018a13b086596c4f`;
- status `ready_for_review`;
- released lease `471de353-37c6-4e38-a6da-d2db92c4b207`;
- 4 focused files / 22 tests plus typecheck, lint, format, scope, diff, and
  secret-scan evidence;
- external effects `none / 0 / 0 / 0`.

Migration and central registration remain unapplied.
