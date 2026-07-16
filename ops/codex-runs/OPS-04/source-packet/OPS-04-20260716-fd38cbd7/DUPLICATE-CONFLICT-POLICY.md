# OPS-04 — Duplicate, Identity Conflict, and Quarantine Policy

## 1. Core rule

OPS-04 does not “dedupe a list.” It reconciles source observations against canonical people, organizations, households, contact points, legacy identities, and current product records. A repeated destination is evidence to analyze, not proof that two rows are one person.

No ambiguous person, household, school, or organization is silently merged. A merge is a separately audited human decision with survivor, loser, reason, evidence, and rollback implications.

## 2. Deterministic matching hierarchy

The matcher evaluates all candidates inside the One Time account/product scope and returns the complete candidate set.

| Rank | Evidence | Auto-link condition | Otherwise |
|---:|---|---|---|
| 1 | Prior verified source-row link | Same source row identity and compatible row version | Version comparison or review |
| 2 | Exact old-system external ID | Unique scoped ID/object type; no ownership conflict | Quarantine |
| 3 | Existing verified crosswalk | Crosswalk target active or safe survivor | Quarantine |
| 4 | Verified unshared contact point | Exactly one owner, same subject role, no contradiction | Quarantine |
| 5 | Exact email + exact phone/WhatsApp | Both point to same contact; neither shared incompatibly | Quarantine |
| 6 | One exact contact point | Unique, unshared, sufficiently authoritative, no role/household/archive conflict | Stage new or review |
| 7 | Explicit relationship + corroboration | Household/organization relation already exists and another identity signal agrees | Quarantine |
| 8 | New identity | Sufficient identity to create; no candidate conflict | Stage new contact |
| 9 | Insufficient identity | No stable ID and no reliable contact point | Reject or manual review |

Name, location, plan, tag, lead state, legacy state, and file membership are never auto-link keys. Fuzzy values are review aids only.

## 3. Shared contact points

A contact point may have multiple owners. Required distinctions:

- `exclusive_verified` — one verified owner;
- `exclusive_declared` — one source-declared owner, not independently verified;
- `shared_household` — multiple owners with explicit household relation;
- `shared_organization` — organization-owned point used by multiple people;
- `shared_unresolved` — multiple owners without adequate relation;
- `disputed` — contradictory ownership evidence;
- `invalid` — unusable destination.

Rules:

- Shared household email does not collapse guardians, learners, or spouses into one contact.
- A school office email does not collapse the school, administrator, and teacher.
- A phone shared by family members remains one contact point with multiple owners and channel state evidence.
- Contact-point suppression may apply to the destination while contact-level preference remains separately auditable.
- Import never reassigns an existing point owner on uniqueness conflict.
- Existing legacy identity tables that enforce one owner must not be used as the import merge mechanism. Add a compatible ownership layer and project only safe primary points.

## 4. Duplicate classifications

| Classification | Definition | Action |
|---|---|---|
| `exact_occurrence_duplicate` | Same immutable file, sheet, source row key, and row version appears twice | Record occurrence; one logical row version; no duplicate action |
| `cross_file_same_row_version` | Same source-system object and normalized row version in multiple exports | Preserve both provenance links; one semantic action |
| `newer_row_version` | Same source row identity with changed canonical content | Append row version; compare chronology and authority |
| `same_person_corroborated` | Stable ID or verified points prove one person | Link to same contact; preserve all provenance |
| `shared_point_not_duplicate` | Same destination belongs to distinct related or unrelated subjects | Preserve separate contacts; shared ownership/review |
| `source_system_duplicate` | Source declares duplicate object IDs or an authoritative duplicate mapping | Link only according to source duplicate evidence |
| `possible_duplicate` | Fuzzy or partial evidence suggests one subject | Manual review; no auto-merge |
| `identity_conflict` | Strong signals disagree | Conflict quarantine |

## 5. Mandatory quarantine reason codes

Use stable machine reason codes with human explanations. At minimum:

- `multiple_top_rank_candidates`;
- `email_phone_target_conflict`;
- `stable_external_id_target_conflict`;
- `shared_email_without_relationship`;
- `shared_phone_without_relationship`;
- `contact_point_disputed`;
- `cross_scope_candidate`;
- `person_organization_role_conflict`;
- `adult_learner_role_conflict`;
- `school_family_role_conflict`;
- `archived_target_requires_review`;
- `merged_target_survivor_unresolved`;
- `contradictory_current_entitlement`;
- `ambiguous_local_phone`;
- `source_timestamp_ambiguous`;
- `source_authority_unknown`;
- `cleaned_provider_semantics_unknown`;
- `newer_canonical_value_protected`;
- `stale_preview`;
- `invalid_destination_with_no_stable_identity`;
- `insufficient_identity`;
- `row_access_not_authorized`;
- `source_scope_unclassified`.

A quarantined row is never migration-invitation eligible and never writes an outreach outbox event.

## 6. Candidate evidence record

Each candidate record stores:

- batch, source row version, and match decision key;
- opaque candidate contact ID;
- match rank and reason code;
- evidence types, authority ranks, and effective times;
- whether each contact point is shared or disputed;
- role/household/organization compatibility;
- canonical target version and relevant field versions;
- candidate score for ordering only;
- auto-link eligibility boolean and exact failed predicates;
- reviewer state.

Do not store raw destinations in report/evidence records. The private database may reference encrypted values or canonical contact-point IDs.

## 7. Conflict quarantine lifecycle

Statuses:

- `open`;
- `assigned`;
- `resolved_link_existing`;
- `resolved_stage_new`;
- `resolved_shared_point`;
- `resolved_reject`;
- `superseded`;
- `reopened_stale`.

A review decision binds the exact row version, candidate set hash, target versions, reviewer identity, reason, and timestamp. If any bound target version changes before apply, the resolution becomes `reopened_stale`.

The UI must present reason codes and redacted candidate facts. It must not reveal raw source rows in screenshots or evidence. Owner/admin roles may access canonical CRM details through existing protected routes, not through a broad raw-import payload.

## 8. Merge policy

OPS-04 import automation does not execute person merges. It may:

- link a source row to a uniquely resolved existing contact;
- create a new contact when identity is sufficient and conflict-free;
- create a shared contact-point ownership relation when an explicit relationship and reviewer approval exist;
- record a merge recommendation for later human action.

A human merge workflow must verify:

- survivor and loser IDs;
- no conflicting current subscriptions, access, payments, portal identities, communications, or legal holds;
- contact-point ownership after merge;
- household and learner relationships;
- field-level winner policy;
- source provenance preservation;
- audit and potential unmerge/rollback plan.

No tag or import status can authorize a merge.

## 9. Newer canonical data and chronology conflicts

For each candidate field, compare:

1. source authority for that field domain;
2. effective timestamp;
3. source/provider event ID ordering;
4. canonical field version;
5. observed/ingested timestamp only as a final tie-breaker.

An older legacy export may append a legacy membership event but cannot replace a newer CRM name, destination, relationship, lead state, current subscription, or suppression. A later public signup cannot transfer a shared destination without review. A lower-authority subscribed file cannot override a later provider unsubscribe.

## 10. Idempotency and concurrency

- Candidate-set identity is deterministic.
- One row version has one current decision for a database snapshot.
- Unique action keys prevent duplicate links, facts, tags, notes, or audits.
- Batch advisory locks serialize conflicting apply/rollback operations.
- Chunk claims use row locks and safe skipping.
- Two concurrent workers applying the same batch produce one committed action and one idempotent no-op, not two writes.
- A retry after partial failure resumes verified action keys.
- Audit keys for replayable transitions are deterministic; no random UUID is part of the uniqueness key.

## 11. Synthetic acceptance scenarios

1. Same email and phone point to one active contact: safe corroborated match.
2. Email points to contact A and phone to contact B: quarantine.
3. One household email belongs to two explicit guardians: two contacts, shared point, no merge.
4. One phone appears on unrelated contacts: quarantine.
5. Exact old user ID points to contact A while current email points to B: quarantine.
6. Current subscriber has same old ID and newer canonical email: link legacy identity, preserve newer email.
7. Cancelled old user is an active lead: legacy becomes cancelled; lead remains active.
8. School office address matches an existing family contact: role conflict; quarantine.
9. Archived target matches by email: review, no automatic reactivation.
10. Exact row rerun: no-op with same counts.
11. Same filename, changed bytes: new file and manifest.
12. Human edits contact after preview: stale-preview quarantine.
13. Rollback after later edit: preserve later edit and create rollback conflict.
14. Ambiguous local phone without country: manual review, no `+972` guess.
15. Invalid destination with stable old ID: legacy identity may be preserved according to mapping, but no-send.
16. Invalid destination without stable identity: reject or manual review; no contact creation.
