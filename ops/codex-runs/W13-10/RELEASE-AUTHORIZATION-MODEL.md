# W13-10 Release Authorization Model

Generated: 2026-07-17T16:17:17.487Z

Separate gates:

1. Code integration authorization.
2. Isolated staging deployment authorization for one immutable source SHA and image digest.
3. Bounded staging provider-canary authorization per provider and allowlisted destination.
4. Production deployment authorization for one exact immutable build.
5. Production data-import authorization for one exact manifest hash and count set.
6. Production provider activation authorization per provider and budget.
7. Broad campaign/publication authorization, which remains out of scope.

A staging canary is not production activation approval. A green test suite is not provider acceptance. W13-10 performed no deployment, no import, no provider send, no charge, and no production mutation.
