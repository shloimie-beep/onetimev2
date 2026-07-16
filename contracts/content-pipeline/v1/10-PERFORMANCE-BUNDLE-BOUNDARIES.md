# Performance, availability, and bundle boundaries

Use repository-native load and bundle tooling. Record fixture size, machine/runtime context, command, sample count, median, p95, and maximum in `PERFORMANCE.md`. Provider/model network time is excluded only when explicitly identified.

## One Time serving boundaries

With BNA network access blocked and a local fixture corpus of at least 1,000 content items, 10,000 sections, and 50,000 search documents:

- library list API/server render local processing p95 ≤ 250 ms;
- content detail API/server render local processing p95 ≤ 250 ms;
- citation deep-link resolution p95 ≤ 150 ms;
- authorization plus local retrieval/ranking p95 ≤ 750 ms, excluding model generation;
- publish endpoint authentication/validation/durable inbox acknowledgement p95 ≤ 500 ms for a manifest up to 2 MiB, excluding background projection;
- duplicate publish acknowledgement p95 ≤ 250 ms;
- no serving path performs a synchronous request to BNA.

Queries use bounded pagination, tenant/visibility indexes, and no unbounded table scan detectable by the database query plan on the fixture corpus.

## Projection and revocation boundaries

- A normal publish/correct manifest becomes locally visible within 60 seconds p95 under healthy workers.
- Revoke/retire removes content from new retrieval and library responses within 60 seconds p95 and 5 minutes maximum under healthy workers.
- Index rebuild work is queued and checkpointed; it is not performed in an HTTP request.

## Frontend/server bundle boundaries

- No Vimeo SDK, transcription SDK, BNA admin/studio module, provider secret helper, or raw prompt tooling enters a One Time client bundle.
- Added route-specific compressed JavaScript for the Rabbi library/status and student helper surfaces is ≤ 50 KiB per route, or no more than a 5% regression when an existing stricter repository budget applies.
- No new individual client dependency contributes more than 30 KiB compressed without an evidence-backed report and existing approval convention.
- Server-only provider adapters are protected by existing server-only import boundaries or an equivalent build-time assertion.

## Failure and degradation behavior

A down Vimeo, transcription provider, queue, or BNA publish source may delay new content but must not break already published One Time pages. Search uncertainty after a revocation signal fails closed for affected content. Readiness endpoints are cheap, cached briefly, and do not call a provider on every page view.
