# Vimeo Mishnayos Catalog Adoption

## Scope and safety

This lane inventories Rabbi Eli Scheller's already-existing canonical Vimeo account by read-only
API calls and adopts references to genuine Mishnayos videos. It never downloads video bytes and
has no Vimeo upload, replace, privacy, caption-write, thumbnail-write, or delete operation.

The command is dry-run by default. Its raw inventory, canonical provider identities, caption text
read transiently for classification, and resumability checkpoint stay under ignored `.runtime/`.
Only a count-only aggregate may be written to a committed evidence path.

## Architecture

1. `scripts/media/vimeo-mishnayos-catalog.ts` reads every `/me/videos` page, reconciles the
   provider total, resumes from a protected checkpoint, and deduplicates by canonical resource
   identity.
2. The deterministic classifier applies strong Gemara/Daf/Amud and unrelated-content exclusions,
   then requires explicit Mishnah evidence, a trusted Mishnayos collection, or explicit
   Seder/Masechta/Perek structure. A bare Masechta remains quarantined.
3. The versioned taxonomy covers all six Sedarim and all 63 Masechtos, including the required
   Nezikin spellings.
4. Canonical provider identities are HMAC-digested for idempotency and AES-256-GCM encrypted for
   storage. Review/API projections omit both the digest and protected reference. The Student path
   receives only the existing first-party playback bootstrap route.
5. Migration `2259_vimeo_mishnayos_catalog_adoption.sql` stores append-only revisions, a current
   pointer, and included-only `needs_review` rows. That queue is an intake bridge to the current
   P19/P20/P21 review/publication path; it does not create a second publication system, fake class
   occurrences, assignments, accounts, attendance, or customer-visible content.
6. Exact replay creates no new revision or review row. Any metadata change after approval creates
   a new quarantined revision and cannot silently rewrite approved content.

## Commands

Read-only inventory and dry-run classification:

```text
npm run vimeo:mishnayos:catalog
```

Write a safe aggregate after a successful complete inventory:

```text
npm run vimeo:mishnayos:catalog -- --write-safe-evidence=ops/codex-runs/VIMEO-MISHNAYOS-CATALOG-ADOPTION/SAFE-AGGREGATE.json
```

Adopt into a disposable, migrated PostgreSQL database only after reviewing the aggregate:

```text
npm run vimeo:mishnayos:catalog -- --apply
```

The apply command requires protected `DATABASE_URL`, `ONE_TIME_ACCOUNT_KEY`, and a base64-encoded
32-byte `VIMEO_CATALOG_REFERENCE_KEY`. It refuses to apply when `DELIVERY_ENVIRONMENT=production`.

## Current provider checkpoint

The 2026-08-03 worker environment did not contain an already-authorized `VIMEO_ACCESS_TOKEN`.
The command stopped before its first provider request with `VIMEO_READ_AUTH_UNAVAILABLE`.
Accordingly, this branch makes no claim about actual provider totals or actual inclusion,
exclusion, quarantine, Seder, Masechta, or Nezikin counts.
