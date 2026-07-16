# OPS-04 — Read-Only Audit Notes for Codex

## Scope

The packet factory performed a read-only audit of the standalone One Time repositories and saved legacy-audience contract. It did not inspect or print any real audience row and did not edit the product repository.

## Repository resolution

- Empty/initial personal repository discovered: `sdratler/OneTimeOneTime`.
- Active standalone product repository: `webcraft-media/onetimev2`.
- Product `main` audited at `610b585f3d221addd4e7b824c92a5cc256cffcf9`, an initial foundation commit.
- Integrated convergence draft PR: `webcraft-media/onetimev2#23`, head `741af0c08ee1d43be4e220b7c6e4c77a2330adc2`.
- Legacy audience foundation draft PR: `webcraft-media/onetimev2#22`, head `51cd99dc4434f0354ba229620ebe89558efeb120`.
- Brand/household/WhatsApp-compatible branch chain reaches `codex/ot85-whatsapp-lead-assistant` at `fb6b3266e2bb2689fdfc1f751764fd98ecca8f0a`.

The active feature train is unmerged and must be resolved by ancestry and execution registry at Codex runtime. The packet’s preferred compatible base includes the standalone CRM, household foundations, and WhatsApp consent/suppression seams while retaining the integrated audience foundation ancestry.

## Existing repository contracts

The repository uses Node.js 24, TypeScript, Express, Vite, PostgreSQL through `pg`, forward-only sorted SQL migrations, SHA-256 migration checksums, an advisory migration lock, and transactional operations. Public and authenticated bundles are separated. Real provider transports are disabled by default.

The public lead contract exposes family/school classification, reminder preference/consent, and idempotency. The current foundation computes deterministic contact/signup/outbox keys, but the initial email-conflict upsert can replace canonical fields without field-level source freshness protection. The initial phone normalizer also assumes Israel for a leading-zero local number. OPS-04 must protect import and public-signup integrity without breaking the provider-independent public route.

## Existing OT-74 audience foundation

Useful existing parts:

- typed dry-run request/report contracts;
- source row normalization and basic email/phone candidate matching;
- protected router with role/CSRF/no-store behavior;
- dry-run persistence and scope checks;
- aggregate-safe response projection;
- synthetic dry-run evidence and focused tests;
- an audience summary component;
- initial PostgreSQL tables for batches, rows, candidates, segments, rollback requests, and audit events.

Material gaps relative to OPS-04:

1. Batches are dry-run-only and rollback is only a request record.
2. Source identity is derived from normalized row JSON, not exact source bytes.
3. Human idempotency input participates in batch identity.
4. Identity fingerprints use unkeyed SHA-256.
5. Phone normalization assumes `+972` for ambiguous leading-zero values.
6. Input rows lack exact stable old IDs, legacy status history, source event chronology, current subscriber facts, and explicit households.
7. Matching uses only canonical primary email/phone and treats same identity fingerprint as a duplicate occurrence, unsafe for shared points.
8. Email-only or phone-only matching receives high confidence without shared-point ownership analysis.
9. Segment vocabulary omits required `blast_candidate`, `suppressed`, and `already_migrated` primary states.
10. Communication eligibility is a coarse boolean rather than purpose/channel-specific precedence.
11. Existing audit replay insertion uses random material in the event key.
12. Raw rows can be submitted in a multi-megabyte JSON body.
13. The router and UI component are not visibly mounted in the audited convergence application shell.
14. CRM contacts/cards/filters do not expose all independent audience axes.
15. There is no production-grade reversible action ledger, approval binding, or apply engine.

OPS-04 should migrate this foundation forward additively rather than delete its historical tables/evidence.

## Saved legacy-audience contract incorporated

The saved read-only contract establishes these non-negotiable rules:

- audience facts are independent, not one mutually exclusive classification;
- an active or former old-system user may remain a lead;
- legacy active never grants current access or implies consent;
- cancellation never implies lead disinterest or unsubscribe;
- exact old-system IDs, full source checksums, source-row provenance, and status history must be preserved;
- matching must be stricter than ordinary CRM list-card aggregation;
- shared email/phone requires a many-to-many-safe ownership and relationship model;
- consent and suppression are independent and follow strict precedence;
- dry-run approval binds manifest, mapping, database snapshot, report, and counts;
- apply is idempotent, concurrency-safe, and revalidated immediately before mutation;
- rollback restores only batch-owned unchanged state and preserves later edits;
- evidence is hashed/redacted and contains no raw values;
- the historical 88-row subscriber batch is evidence to reconcile, not a template to rerun;
- no communication, account, access, payment, or provider action is authorized.

## Source availability

The audit did not access source binaries or rows. Historical contract references indicate that exact current exports may be absent. OPS-04 therefore requires source-independent implementation and synthetic rehearsal first, followed by a resumable `waiting_for_source_export` state when protected source data is unavailable.

## Packet-factory boundary

The packet factory publishes only this Codex packet to the private queue repository. It does not modify `webcraft-media/onetimev2`, import data, create product branches, run campaigns, or perform provider/database mutations.
