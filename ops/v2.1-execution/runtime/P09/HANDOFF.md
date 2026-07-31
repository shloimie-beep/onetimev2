# P09 Concrete School Authority Correction — Ready for Review

## Authority and topology

- Branch: `codex/v21-p09-school-inquiry-concrete`
- First parent / authorized integration: `ae3ced8a9daa11044d4278968c14cb6baa12a480`
- Required second parent / P09 source: `d9a4ce8082a028be81e234999deb43f659072a6d`
- Verified pre-edit merge tree: `b97677a9e48bb299db59c83ae12df269a7b18e22`
- Live amended control: `321fd3482d5ee54bbad19d97205b54845d0d0aac`
- READY state basis: `48f27d399d4ed714f6219487629c406af1fbb49f`
- Amended READY digest: `6c1e0bd137ee03d0d816ee21cf2a23322a71ed485373b9b1e165533aee3a1be1`
- Claim: `b7495ee7-55e6-4311-b31a-39d699643e50`
- SCHOOL_INQUIRY lease: `af63b680-b00d-437e-aded-fdbe14e8686f`, released at `2026-07-31T15:23:08Z`
- Effect locks and external effects: none; `0/0/0`

This terminal is one substantive merge commit. The source merge was opened with
`--no-ff --no-commit` before any correction, so the branch tip must retain the
two exact parents above.

## Completed implementation

The existing public `POST /api/v2.1/signup/school-inquiry` router and its test
remain byte-identical. The signed-out `/school` model now publishes its exact
strict POST binding while retaining exactly four required and two optional
fields and no account, credentials, Student, access, subscription, consent,
nurture, provider, School-role, portal, or roster surface.

The new dependency-injected Admin router derives scope and Admin identity from
trusted server dependencies, requires CSRF for mutations, derives authorization
time and a stable audit reference server-side, rejects body-controlled authority
fields, denies `production_read_only` before the service, and provides
Admin-only canonical readback.

Contracts, policy, service, and PostgreSQL repository now implement migration
2256's explicit contract and authorization evidence, durable exact idempotency
replay versus hash mismatch, optimistic create/update, exact readback, and zero
inline effects. Writes target only
`onetime.approved_school_configuration_authority_v21`. The amended authority
permits an exact product/runtime/environment/idempotency SELECT from the
append-only history table solely for superseded committed replay, joined to
current authority only for immutable `created_at`. Production repository code
never inserts, updates, or deletes history directly, and both prohibited legacy
table names are absent.

The repository intentionally relies on migration 2256's database guards for an
active exact-scope School household, its active Parent account manager, active
scoped Admin authorization, unresolved-quarantine denial, immutable household
and contract identity, optimistic versioning, and append-only history.

## Verification

- Exact focused Vitest: 7 files, 36 tests, all passed.
- Exact TypeScript product-file compile probe: passed.
- Exact-file ESLint and Prettier: passed.
- Three successor request schemas and traceability: passed, 3/3.
- Exact 18 authored-path ceiling plus the required byte-identical carried
  migration request, immutable request/public-router checks, history mutation
  absence, legacy SQL absence, `git diff --check`, YAML parsing, and secret
  scan: passed.
- Secret scan covered 3,126 repository text files.
- Native PostgreSQL and broad suites were not repeated in this lane, as the
  READY directs.

## Immutable and successor requests

- `P09-migration-002` is carried byte-identically from the required source
  parent; Git blob `75cd8bb242eaaa59d7ebb215ea4d8881fb5354e1`.
- `P09-registration-001` remains unchanged; Git blob
  `042bb0b080703002a1743e725daa9deb3b590796`.
- New exact successors pending I36 disposition:
  `P09-server-registration-002`, `P09-client-route-002`, and
  `P09-barrel-export-002`.

## Next action

I36 should independently disposition the three exact `-002` successors, apply
only those accepted shared registrations, and run its touched-graph
typecheck/build/static signed-out `/school` composition test. C00 should review
and admit this two-parent terminal. P09 must stop.
