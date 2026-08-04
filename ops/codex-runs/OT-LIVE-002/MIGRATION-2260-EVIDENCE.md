# OT-LIVE-002 migration 2260 source evidence

Disposition: `SOURCE_IMPLEMENTED_NATIVE_AND_PGMEM_GREEN_PENDING_EXACT_COMMITTED_SOURCE_CANDIDATE_PROOF`.

## Authority and immutable request

- successor control: `58e0497cbf35cdb456bc7b897523705fc09ca275`
- successor claim: `e4a1f7b4-1015-43e5-9096-069ac267ce89`
- successor claim raw SHA-256:
  `24d7cb9b03517b22c529542c67cd910bafed0751c16a78b926f32db935bb64f5`
- superseded pre-effect claim: `3eeb7ef4-6abd-4e42-809c-04a6d6945196`
- exact source base: `05f8dfc247f87318884db6cf57a42bc75b5c8719`
- base tree: `3acfd7c9fe96cf7aebc4ac066e03701bd82f2d09`
- accepted request source: `e41cea45a4e3fc99c4cf968872992f2992090d18`
- accepted request path: `ops/codex-runs/OT-LIVE-002/MIGRATION-REQUEST.yaml`
- accepted request raw SHA-256:
  `058b22cd1607bef98010083b5e98634bfcc07016928c7ff5ccdb6575ab601846`
- accepted request/interface canonical-object SHA-256:
  `d5f22e833341ced30f3da5688926b69cb856744c79d93c09047aa6ce3c5f9587`

The interface digest is SHA-256 over recursively key-sorted compact UTF-8 JSON
of the exact parsed accepted request. The raw digest is over the exact Git blob.

## Migration identity

- ordinal: `2260`
- file:
  `packages/db/migrations/2260_v21_governed_campaign_audience_decisions.sql`
- raw/repository normalized-LF SHA-256:
  `93e7879ce7861cd37733335ca64e49310af1025fc099e6bce4abadb8f25c3740`
- repository pg-mem SHA-256:
  `cd88696dd38b66615bfe4bc8adcb81f1cadc3d310109f358d14fe5e2d674437c`
- schema-time backfill rows: `0`
- existing-table alterations: `0`
- destructive operations: `0`

The pg-mem digest uses the repository runner's exact CRLF-to-LF normalization
and exact replacement of every `@postgres-only` block with its fixed skip
marker.

## Enforced schema boundary

Migration 2260 creates only the empty
`onetime.governed_campaign_audience_decisions` table, its current partial
indexes, and `onetime.governed_campaign_audience_current` view. It enforces:

- runtime-tier, verification-environment, account, product, campaign, and four
  immutable HighLevel asset dimensions in primary, version, idempotency, and
  current-contact identities;
- a composite `(account_key, product_key, contact_key)` reference to the
  canonical contact scope, with cross-scope binding rejected;
- lowercase 64-hex protected provider-contact hashes only, never a raw
  provider contact identifier;
- exact typed reason codes and a ten-field sanitized source-fact object with no
  arbitrary key, PII, note, message, transcript, Student, credential, cookie,
  token, secret, raw provider reference, or private field;
- immutable/versioned decision bodies and delete rejection;
- only one existing-row change: `superseded_at` from NULL to a timestamp not
  before `created_at`;
- a current projection containing only `superseded_at IS NULL` rows.

No application repository, runtime registration, provider adapter, contact
mutation, tagging, or send implementation is introduced.

## Proofs completed before source checkpoint

- pg-mem focused suite: `4/4` passed
  - complete fresh 91-migration apply;
  - ledger replay through exact 2260 with the known pg-mem ledger-DDL replay
    limitation isolated by a no-op wrapper only after the ledger exists;
  - exact runtime/environment isolation, protected-hash rejection, composite
    cross-scope contact rejection, current-view readback, and isolated snapshot
    rollback;
  - static native trigger, sanitized-envelope, exact-provider, zero-backfill,
    and nondestructive boundary.
- disposable PostgreSQL `18.4`, server version number `180004`: passed
  - fresh 91/91 apply and 91/91 ledger replay;
  - exact table, view, trigger, provider, hash, and current-projection readback;
  - body-update/delete rejection, one-way supersession, repeat rejection;
  - PII/free-form source-fact, invalid reason, uppercase hash, and cross-scope
    contact rejection;
  - runtime/environment isolation;
  - maximum-affected-row, mismatch, and unknown-result rollback.
- repository TypeScript typecheck: passed.

The final candidate-builder derivation and candidate PostgreSQL 18 proof must
bind the exact committed source SHA. They are intentionally recorded only
after this eleven-path source checkpoint becomes a Git object.

## Effects and cleanup

- source files created/edited: only the successor claim's eleven exact paths
- live/production/staging database connections: `0`
- live/production/staging database rows or schema effects: `0`
- provider/contact/tag/send/deploy/DNS/billing/Customer/Student effects: `0`
- local WSL PostgreSQL 18.4 toolchain installation: `1`
- exact loopback proof cluster created and removed: `1/1`
- disposable proof databases created and removed before this checkpoint: `3/3`
- unresolved disposable database or cluster effects: `0`

No allocation beyond 2260 is implied. Ordinal 2261 is recorded only as next
available and is not allocated or reserved. The historically rejected
OT-LIVE-003 proposal remains rejected, unallocated, and default-off.
