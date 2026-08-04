# F02 migration 2257–2259 semantic-ledger regularization

Disposition: `SOURCE_ONLY_LEDGER_REGULARIZATION_READY_FOR_C00_REVIEW`.

This checkpoint was produced under control
`fb70bd65344513161c240e3ed6dfa30e0ad7fb54`, claim
`c172ba4d-1098-4d72-910f-5048a678e4f9`, and exact base
`27576fa64f0b37095e61ccca932c2e77cbf38844`. It changes only the six
claim-authorized metadata/request paths. No migration SQL byte, database,
provider, contact, send, deployment, DNS, billing, Customer, or Student state
is changed.

## Exact immutable migration evidence

| Ordinal | File                                        | Raw/repository SHA-256                                             | pg-mem SHA-256                                                     | Git blob                                   |
| ------- | ------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------ |
| 2257    | `2257_v21_provider_registry_bindings.sql`   | `04e348e04c4c794147a678d03167df51cd21872d350c73c83b2181b68bc0619e` | `3961d3d0b946ac3e4ae318fa0bd3f275aff6d423cd4d80a1bdd9ea933842b1ef` | `268e0de0c0963b0c1b5970fbdcd645347a61b263` |
| 2258    | `2258_v21_configurable_launch_timing.sql`   | `8a0bf65c9ac8f383a6a0167706e360157664fa5327e7e6855641b326e724e5c7` | `ec63a25f07819b66dba2f70f1609283318a0295c46316861fd67cfacf9de352e` | `459c87c2f8796bf2f180ca306aa35f4b47158af7` |
| 2259    | `2259_vimeo_mishnayos_catalog_adoption.sql` | `fae76e3a62930a099bbbe679e9d0ba6bb977587b5eacfeca50984f26fc851b2b` | `d53756277fac7c7033bc9449cdf58a83dc48d9527834d90d6eff3540bec6a3a9` | `7525345bbe69fcf79e8b7728b0e704ec0f915034` |

The raw/repository digest is SHA-256 of the exact Git bytes after the migration
runner's CRLF-to-LF normalization. These three files already have LF Git bytes,
so their raw and repository digests coincide. The pg-mem digest uses the same
normalization and replaces each exact `@postgres-only` block with the
repository runner's fixed skip marker. Pre- and post-checkpoint identities must
match this table exactly.

## Formal allocation identities and provenance

### 2257

- owner: `F06`
- request: `C00-F06-active-binding-source-001`
- interface digest: `0b7bbb3f2bd5bef88563605de3819fc0a524f9701cbc8b3f18059ffcca78fda4`
- authored source: `701ef6e19d0cb640677c066c2d49fb2f453bb6bc`
- corrected/final integration source: `951c151c28f905ad7458973a750c3887edc38ddc`
- deployed descendant: `27576fa64f0b37095e61ccca932c2e77cbf38844`

The interface digest is SHA-256 of recursively key-sorted compact UTF-8 JSON
containing exactly `ordinal`, `file`, `owner_task_id`, `request_id`, and the
unchanged F02 proposal `purpose`. It therefore binds the already-recorded
semantic identity without substituting a READY payload digest or inventing a
new database interface.

### 2258

- owner: `F02`
- request: `C00-launch-configurable-timing-001`
- interface digest: `7270d64d9fd77c181e021426c628448277639413d54485822b689e5cc794aa93`
- authored source: `80f11d40b394275afde02e73ddf53a4ac7505473`
- source terminal: `0f9422fc3c09d0c19ef91f61058955f5a80b7870`
- F02 integration merge: `411790eb2b2b705f5487e58567dcd72d31f06cea`
- combined integration release: `836340a7db094b5024e25bd3bc31f87f2c9cdbde`
- deployed descendant: `27576fa64f0b37095e61ccca932c2e77cbf38844`

The interface-digest algorithm and exact five input fields are the same as for 2257.

### 2259

- owner: `VIMEO-MISHNAYOS-CATALOG-ADOPTION`
- request: `VIMEO-MISHNAYOS-CATALOG-ADOPTION-migration-001`
- request/interface canonical-object digest:
  `6ae5c19200f871f87ff5954e9471d16ecc5ab9c7cca8e621b17d48afdca7eedf`
- request raw SHA-256:
  `2adf9cd2fcfce3c998317482ea346df1b2dc23aed14e14abd192d24fbf5c33fe`
- authored source: `297615d5196da3547fc1d4a97307aa20f1614942`
- source terminal: `635a94b09f58997b4a17366dc86dde8646aceb26`
- integration merge: `1e1a5ef1fcb5a2b125797c357d14db64b9948b0f`
- deployed descendant: `27576fa64f0b37095e61ccca932c2e77cbf38844`

The canonical-object digest is SHA-256 of recursively key-sorted compact UTF-8
JSON produced from the exact parsed request YAML. The request is supported by
the immutable migration, contract, repository, focused tests, implementation
record, verification record, and Git ancestry. It describes only existing
semantics and explicitly grants no provider, database, publication, or SQL
effect.

## Next ordinal and held proposals

The exact deployed inventory ends at 2259. Ordinal 2260 is therefore recorded
only as the next numerically available ordinal. This is not an allocation or a
reservation.

- OT-LIVE-003 remains `rejected_unallocated_default_off` at parked source
  `a2983da5c332ce752132c6d2264d0b96e70c32ef`.
- OT-LIVE-002 receives no ordinal from this checkpoint. Its decision-store
  migration remains held until a corrected immutable request is published and
  independently accepted.

## Verification and effects

- exact claim/control/base binding: passed
- exact six-path scope: required
- migration 2257/2258/2259 pre/post Git blob and checksum equality: required
- allocation sequence 2234–2259 uniqueness and next ordinal 2260: required
- 2259 request YAML parse and canonical digest: required
- F02 proposal, task state, handoff, prompt, and request YAML parse: required
- formatting, diff hygiene, and secret scan: required
- database connections and SQL executions: `0`
- migration applications or writes: `0`
- provider/contact/send/deploy/DNS/billing/Customer/Student effects: `0`

C00 must independently review and decide whether to mirror these exact records.
No 2260 allocation, integration, candidate freeze, database apply, or external
effect is latent in this source-only checkpoint.
