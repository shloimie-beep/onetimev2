# OPS-04 — Canonical Field, Tag, and Status Mapping

## 1. Governing model

OPS-04 models identity, lead lifecycle, legacy membership, current subscription, relationship type, consent, suppression, migration, and outreach as separate facts. No single overloaded “status” column may replace them.

A canonical contact may simultaneously be:

- an active contact record;
- a follow-up lead;
- an old-system contact;
- an active old-app user;
- not a current subscriber;
- a family contact;
- opted in for email reminders;
- stopped on WhatsApp;
- verified as migrated;
- suppressed for WhatsApp and migration-invitation eligible for email.

Tags mirror selected facts for display. They never establish identity, entitlement, consent, suppression, or state.

## 2. Canonical entities and ownership

| Entity or projection | Purpose | Mutability rule | OPS-04 ownership |
|---|---|---|---|
| Canonical contact | Person or organization identity | Versioned; field-level provenance | May create in non-production rehearsal; may append provenance; cannot overwrite newer values |
| Contact point | Email, phone, or WhatsApp destination | Append/version; many-to-many ownership | May add verified or source-declared points; cannot transfer ownership silently |
| Lead event/current lead projection | Interest lifecycle | Append-only events; current projection | Preserve existing; source mapping only when independent lead evidence exists |
| External identity | Exact old-system object ID | Append/link; unique within scope | May create/link after deterministic match |
| Legacy membership event | Old-app status history | Append-only | May append authoritative observations; grants no current access |
| Current subscriber projection | Standalone membership/billing/access truth | Read-only in OPS-04 | Report and segment only |
| Household/organization relation | Explicit person-family-school relationship | Versioned and audited | May link only with explicit evidence; shared point alone is insufficient |
| Channel state event | Consent/suppression evidence | Append-only; precedence projection | May preserve/import evidence; cannot clear stronger canonical suppression |
| Migration batch/action | Processing and audit truth | Append-only state machine | Full OPS-04 ownership |
| Outreach disposition | Mutually exclusive computed state | Recomputed snapshot | OPS-04 projection; never send authorization |
| Tag assignment | Display/filter aid with provenance | Additive; batch-removable | May add namespaced assignments only |

## 3. Universal source normalization

| Source class | Canonical destination | Rule |
|---|---|---|
| Email | Contact point, type `email` | Trim; normalize Unicode/domain safely; lowercase; validate syntax; preserve plus tags and dots; private raw value only; HMAC fingerprint in evidence |
| Phone | Contact point, type `phone` | Region-aware parse; E.164 only when country context is reliable; ambiguous local number becomes manual review |
| WhatsApp | Contact point/channel capability | Same destination normalization as phone, but channel consent and STOP state remain separate |
| Display name | Contact field candidate | Unicode NFC, collapse whitespace, preserve spelling; never derive a person name from email |
| Family or school name | Organization/household label candidate | Do not infer person identity; preserve relationship uncertainty |
| Old user/account/subscription ID | External identity | Exact text, including leading zeros and punctuation; indexed; never numeric coercion |
| Generic status | Adapter-owned raw status | No direct mapping without source contract |
| Plan | Legacy membership `plan_raw` | Never maps directly to current tier, price, entitlement, or access |
| Joined/start/end date | Legacy membership chronology | Parse only with source format/time zone; preserve raw and ambiguity |
| Lead flag/status | Lead event candidate | Apply only through approved source-specific mapping; legacy status cannot set lead state |
| Consent | Channel-state evidence | Requires channel, purpose, source, effective time, authority, and evidence type |
| Suppression | Channel/global state evidence | Preserve exact reason and precedence; cannot be cleared by lower-authority input |
| Notes/message text | Approved private note lane | Never identity evidence; omitted from Git/evidence |
| Empty cell | No observation | Does not erase canonical data unless approved deletion semantics own the field |
| Tags | Provenance-aware tag assignment | Normalize namespace/case; set-union only; do not delete human tags |
| File/sheet/row | Source provenance | Always bind row version to immutable file manifest and adapter version |

## 4. Independent status taxonomies

### 4.1 Contact record status

| Status | Meaning | Automatic transitions allowed |
|---|---|---|
| `active` | Valid canonical record | To `review_required` on conflict; archive/merge require controlled decision |
| `review_required` | Identity or integrity conflict | Back to `active` after resolution; archive by reviewer |
| `archived` | Reversibly inactive record | Restore by reviewer only |
| `merged` | Historical non-survivor | Terminal for automation; survivor link required |

### 4.2 Lead state

| State | Meaning | Import rule |
|---|---|---|
| `unreviewed` | Lead evidence exists but lifecycle not assessed | Safe default for approved lead-only sources |
| `new` | New lead | Preserve when current/newer |
| `contacted` | Contact attempt recorded | Not inferred from source membership |
| `follow_up` | Human follow-up needed | Preserve; may map from a clear lead follow-up source |
| `qualified` | Human-qualified lead | Never inferred from legacy active |
| `active` | Actively engaged lead | Independent from legacy/current subscription |
| `not_interested` | Explicit lead outcome | Never inferred from cancellation, expiry, or unsubscribe alone |
| `archived` | Lead episode archived | Human or approved lifecycle action only |

Legacy label aliases are preview-only until approved:

| Historical label | Proposed lead mapping |
|---|---|
| `lead_candidate` | `unreviewed` |
| `interested` | `active` only with independent engagement evidence; otherwise `unreviewed` |
| `follow_up` | `follow_up` |
| `not_now` | `follow_up` or `unreviewed`; never automatic `not_interested` |
| `new` | `new` |
| `archived` | `archived` |

### 4.3 Legacy old-app membership state

| Raw family | Normalized state | Lead effect | Current subscription/access effect |
|---|---|---|---|
| Unknown/unmapped | `unknown` | None | None |
| Trial | `trial` | None unless separate lead evidence | None |
| Active | `active` | Preserve existing lead independently | None |
| Paused | `paused` | None | None |
| Cancelled/canceled | `cancelled` | Never `not_interested` automatically | None |
| Expired | `expired` | None | None |
| Former | `former` | None | None |
| Deleted | `deleted` | None; may require review | None |

The latest authoritative effective event determines the projection. Missing from a later export is not cancellation unless the adapter contract proves a complete snapshot with deletion semantics.

### 4.4 Current subscriber state

Current subscriber state is derived only from canonical standalone membership, subscription, billing, account, and entitlement records. OPS-04 reports at least:

- `none`;
- `trial`;
- `active`;
- `past_due`;
- `paused`;
- `cancelled`;
- `expired`;
- `unknown`.

Use the repository’s canonical vocabulary when it is more specific. Never write this state from a legacy import.

### 4.5 Migration state

| State | Required condition |
|---|---|
| `discovered` | Source file inventoried |
| `parsed` | Authorized rows normalized and versioned |
| `previewed` | Dry-run decision/report persisted |
| `review_required` | One or more unresolved rows or approval blockers |
| `approved` | Exact approval receipt validated |
| `applying` | Non-production or later authorized production apply in progress |
| `applied` | Planned actions committed |
| `verified` | Post-apply reconciliation and integrity checks pass |
| `failed` | Apply failed with resumable ledger |
| `rejected` | Source/batch deliberately rejected |
| `rolled_back` | Batch-owned changes safely reversed or conflicts explicitly recorded |

### 4.6 Consent state

- `unknown` — no adequate purpose-specific proof;
- `opted_in` — verified opt-in for the stated channel and purpose;
- `transactional_only` — transactional use allowed, marketing/migration outreach not implied;
- `opted_out` — explicit opt-out.

### 4.7 Suppression state

- `none`;
- `unsubscribed`;
- `hard_bounce`;
- `invalid_address`;
- `stop`;
- `wrong_number`;
- `do_not_contact`;
- `legal_hold`.

Consent and suppression coexist. Historical opt-in evidence remains auditable while effective suppression blocks eligibility.

## 5. Source adapter mapping

### 5.1 Legacy subscriber or old-app export

| Source evidence | Canonical action |
|---|---|
| Stable old user ID | Create/link exact external identity after match policy |
| Stable subscription/account ID | Separate external identity/object type; do not collapse with user ID |
| Raw membership status | Append legacy membership event |
| Raw plan | Preserve `plan_raw` only |
| Effective/joined/ended times | Append chronology with source semantics |
| Email/phone | Contact-point candidate; not a sole merge key when shared/conflicting |
| Active status | Set legacy projection `active`; no current entitlement |
| Cancelled status | Set legacy projection `cancelled`; no lead opt-out |
| Source row | Immutable provenance and row-version link |

### 5.2 General spreadsheet lead export

| Source evidence | Canonical action |
|---|---|
| Explicit lead-purpose declaration | Append lead source/event according to approved mapping |
| Family classification | Add family fact or relationship candidate |
| School classification | Create/preserve school lead; no entitlement |
| Old-system ID/status present | Also create old-system/legacy facts; not “spreadsheet-only” |
| No old-system or current subscriber evidence | May qualify as spreadsheet-only lead |
| Consent claim | Channel evidence only when source authority and purpose are known |

### 5.3 Email audience exports

| Source state | Canonical interpretation |
|---|---|
| Subscribed | Lower-authority opt-in evidence unless provider event/time proves stronger authority |
| Unsubscribed | Email suppression `unsubscribed`, subject to event chronology |
| Cleaned | `hard_bounce` or `invalid_address` only when provider semantics prove it; otherwise manual review |
| Missing from export | No state change unless complete-snapshot deletion semantics are explicit |

### 5.4 WhatsApp/provider exports

| Source state | Canonical interpretation |
|---|---|
| Explicit opt-in | WhatsApp consent evidence for stated purpose |
| STOP | WhatsApp suppression `stop`; highest practical channel precedence |
| START/re-consent | Preserve event; canonical consent workflow decides whether suppression changes |
| Wrong number | WhatsApp suppression `wrong_number` |
| Valid phone only | No WhatsApp consent inference |

## 6. Relationship classification

| Fact | Rule |
|---|---|
| Family | Person/household source or explicit relationship; may be a lead and/or current subscriber |
| Household | Explicit relationship model; not created from shared email alone |
| School lead | Organization or school audience with lead evidence; remains lead-only |
| Entitled school | School plus separate canonical current entitlement; import does not create entitlement |
| Old-system contact | Any verified old external identity or legacy provenance |
| Active old-app user | Latest authoritative legacy membership projection is `active` |
| Current subscriber | Canonical standalone subscription/entitlement says active according to product rules |
| Spreadsheet-only lead | Lead evidence with no linked old-system identity/membership and no current subscriber fact |

## 7. Outreach disposition projection

The projection is mutually exclusive and ordered:

| Precedence | Disposition | Rule | Send permission in OPS-04 |
|---:|---|---|---|
| 1 | `manual_review` | Unresolved identity, household, chronology, scope, or stale preview | Disabled |
| 2 | `suppressed` | Global/channel block, invalid destination, or inadequate consent across requested channels | Disabled |
| 3 | `already_migrated` | Verified migration/link already exists | Disabled |
| 4 | `migration_invitation_eligible` | Resolved, not migrated, consent adequate, unsuppressed, no holds | Disabled |
| 5 | `blast_candidate` | Resolved review pool but not strict invitation-eligible | Disabled |

Channel-specific eligibility is stored separately for email and WhatsApp. A subject can be suppressed on WhatsApp and eligible on email, while the primary disposition follows the configured campaign-purpose projection and records channel breakdown.

## 8. Tag keys

| Tag key | Display meaning | Source of truth |
|---|---|---|
| `ops04:source:legacy` | Has old-system provenance | External identity/provenance table |
| `ops04:source:spreadsheet` | Has spreadsheet provenance | Source row links |
| `ops04:legacy:active` | Active old-app user | Legacy membership projection |
| `ops04:legacy:trial` | Legacy trial | Legacy membership projection |
| `ops04:legacy:former` | Paused/cancelled/expired/former/deleted grouping | Legacy membership projection |
| `ops04:contact:family` | Family contact | Relationship/classification fact |
| `ops04:lead:school` | School lead | Lead + organization fact |
| `ops04:subscriber:current` | Current standalone subscriber | Canonical subscription projection |
| `ops04:outreach:blast_candidate` | Broad review candidate | OPS-04 outreach snapshot |
| `ops04:outreach:migration_invitation_eligible` | Strict eligible snapshot | OPS-04 outreach snapshot |
| `ops04:outreach:manual_review` | Review required | Conflict/review table |
| `ops04:outreach:suppressed` | No-send reason exists | Consent/suppression projection |
| `ops04:outreach:already_migrated` | Verified migrated | Migration projection |

Tag assignments carry assignment key, batch key, action key, provenance, applied version, and removal ownership. Existing human tags are never deleted.

## 9. Field authority and overwrite rules

From highest to lowest default authority, with source-specific exceptions recorded in the mapping version:

1. later human-verified canonical edit;
2. authoritative provider event for its own channel state;
3. canonical current subscription/access system for current entitlement;
4. verified old-system stable-ID/status export for legacy facts only;
5. public signup for declared signup fields and consent evidence;
6. approved structured lead spreadsheet for lead facts;
7. lower-confidence audience export;
8. inferred or ambiguous data, which cannot overwrite.

A lower-ranked source may append provenance/history but cannot replace a higher-ranked newer value. Effective time outranks ingestion time when authority is otherwise comparable. Every update carries an optimistic target-version precondition.

## 10. Evidence representation

- File identity: full SHA-256 of bytes.
- Contact-point evidence: HMAC-SHA-256 fingerprint with key-version identifier.
- Source path: HMAC or encrypted private reference; no absolute path in Git.
- Contact/candidate references: opaque public IDs or HMAC references.
- Counts: aggregate only.
- Raw rows, names, destinations, message bodies, and source binaries: never in repository evidence.
