# F02 Migration Lease A Handoff

## Released result

- Atomic claim head: `0708a09e7d979a10cfe3c0875cebeecca64a2847`
- Implementation commit: `7132cd81ea260558777859cd4c7485a357e8f5fb`
- Containing control: `fa1330ff11955fe03ac9c1dfba8d29407cac11a8`
- Sole control acquisition: `3143e8d0c93bfff3925edcd61500345bd92c621d`
- Claim: `dc6ba41d-f01a-43f5-b8d7-e43c6b8a7e54`
- Shared lease: `59450be9-031a-4db8-aec1-9a584ba04f2f`
- Released: `2026-07-29T18:44:30Z`, before expiry `2026-07-29T18:51:43Z`
- External effects: attempted `0`, succeeded `0`, reconciled `0`

Lease A allocated only:

- `2235_v21_household_identity.sql` — `abec96358e5b7b35d253ed8314625ad6a7829fd0230fd5a2763ccb29b8c496b3`
- `2236_v21_job_foundation.sql` — `4a9b04d9b6b822448b7a188fa1afd0d4e84b522efd4b9f7e2a3e3c46015e7fdd`
- `2237_v21_calendar_recurrence.sql` — `6ad635c575ded4d57949e2f2f95b8fef2048b19e7153a3e87bd4bb1b4f8179ea`
- `2238_v21_provider_core.sql` — `58122d190463e293f2554fffca26feda7e755351b464c416bd89a8afbfd9e367`

The allocation proposal advances the next ordinal to `2239`. Ordinal `2231`
remains forbidden. No applied migration, registration, package/barrel,
provider, deployment, send, or other task path changed.

## Verification

The four immutable requests were read in exact F04, F05, P15, F06 order and
matched their admitted task heads, Git blobs, IDs, and raw or canonical
digests. A disposable pg-mem first application completed the full
69-migration inventory through `2238` with harness-only registrations for
missing built-ins `btrim`, `length`, and `cardinality`.

The subsequent replay reached a known pg-mem planner/AST limitation on the
pre-existing `CREATE TABLE IF NOT EXISTS onetime.schema_migrations` statement;
the failure did not originate in migrations `2235` through `2238`. Independent
audit must reproduce the clean first apply and assess replay using an isolated
native PostgreSQL harness if one is safely available.

## Exact next action

Stop. Independent audit and C00 must verify the final remote head, exact
eight-path delta, checksums, request semantics, disposable database result,
static gates, released lease, and effects `0/0/0`. I36 integration requires a
fresh C00 admission and atomic claim reconciliation.
