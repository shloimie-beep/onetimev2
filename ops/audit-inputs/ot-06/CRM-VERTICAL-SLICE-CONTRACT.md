# CRM-VERTICAL-SLICE-CONTRACT

**Task ID:** OT-03  
**Date:** 2026-07-14  
**Mode:** Read-only architecture and product analysis  
**Inspected repository:** `shloimie-beep/bnei-neviim-academy`  
**Inspected revision:** `cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c`  
**Status:** Proposed first-release implementation contract

Normative terms such as **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are intentional.

---

## Executive decision

The first release shall be a **standalone One Time CRM application surface** with its own entry document, client runtime, route bundle, state model, responsive layout, and screen-oriented API façade.

Proposed canonical route:

```text
/one-time/app/crm
```

The standalone surface shall:

- share the current authenticated session, One Time account scope, canonical first-party contact data, identity deduplication, communication records, task records, server-side authorization, tracing, and database;
- **not** load or execute `operations-shell.js`, Operations deferred renderers, Operations CSS, global Operations data loaders, queue/fleet/admin probes, or the current Operations CRM workbench;
- **not** embed the current full `provider.html` runtime as the CRM shell;
- **not** create a second CRM database, duplicate contact model, separate inbox, or browser-side union of legacy sources;
- present Shloimie as **One Time Account Administrator**, regardless of any separate platform-level super-admin identity;
- never show a “View as Rabbi” control merely because Shloimie has another global role;
- shape Rabbi-facing sessions as One Time account roles only, with no BNA super-admin diagnostics or Operations navigation.

The current dedicated provider route-module pattern is useful evidence that One Time routes can avoid Operations assets. Its current CRM renderer is only a static summary and is not the product to ship. The complete contact list/detail behavior must be rebuilt in the standalone CRM client.

### Explicit non-goal

The old CRM “light-pass” patch inside the shared Operations runtime is **not** an implementation path for this contract. Its only reusable contribution is the performance-test methodology: repeated cold/warm journeys, meaningful usable-state markers, request waterfalls, API timings, main-thread evidence, and fail-closed timeout accounting.

---

# 1. Exact first-release screens

## 1.1 Route and screen inventory

| ID | Route or state | Screen | Initial data | Required actions |
|---|---|---|---|---|
| S1 | `/one-time/app/crm` | CRM contact list | One paginated contact-list response, filter options, capabilities | Open row, add contact, search, filter, sort, load more, retry |
| S2 | S1 with filter drawer/popover open | Search and filters | No additional request until a filter/search value is applied | Apply, clear one, clear all, close, restore previous values |
| S3 | `/one-time/app/crm/contacts/new` | Create contact | Form schema/options may come from the already-loaded list response; otherwise one bounded schema request | Save, cancel, resolve duplicate conflict |
| S4 | `/one-time/app/crm/contacts/:contactKey` | Contact detail — Overview | One contact-detail response | Back, edit, add note, set/change/clear follow-up, change owner, change lifecycle, add/remove tag, archive where permitted |
| S5 | `/one-time/app/crm/contacts/:contactKey/edit` | Edit contact | Reuses S4 data; direct navigation loads one detail response | Save, cancel, recover from version conflict |
| S6 | `/one-time/app/crm/contacts/:contactKey/relationships` | Relationships | Loaded only when selected | View, add link, edit relationship label/type, unlink where permitted |
| S7 | `/one-time/app/crm/contacts/:contactKey/communications` | Read-only communication history | Loaded only when selected | Open/close message detail, paginate, filter channel, retry |
| S8 | `/one-time/app/crm/contacts/:contactKey/tasks` | Contact tasks | Loaded only when selected | Create task, complete, reopen, edit due date/owner/title, paginate, retry |

There is no separate “Contacts” subsection destination underneath a top-level “CRM” destination. The top-level account navigation contains **CRM** once. Within a selected contact, the only subsection destinations are:

```text
Overview | Relationships | Communications | Tasks
```

“Search and filters” is a state of S1, not a duplicate navigation destination.

## 1.2 CRM list screen

The list screen contains, in order:

1. One Time account header and account-role label.
2. Page title: **CRM**.
3. Search input.
4. Filter control and active-filter chips.
5. Sort control.
6. Primary action: **Add contact**, only for roles allowed to create.
7. Paginated contact rows/cards.
8. A single **Load more** control when another page exists.

The screen MUST NOT show:

- BNA Operations branding;
- workspace/project keys;
- global super-admin controls;
- “View as Rabbi”;
- queue, agent fleet, support diagnostics, billing, access controls, or unrelated counters;
- exact full-result totals that require an unbounded count query;
- nonfunctional summary cards posing as contacts.

## 1.3 Contact-detail screen

The default contact-detail screen is **Overview**. It contains:

- readable display name;
- contact type and Family/School classification;
- lifecycle stage;
- primary email and phone, when present;
- assigned owner;
- next follow-up;
- last activity;
- tags;
- human-readable source;
- communication preference, consent state, and suppression state as read-only safety context;
- compact relationship, communication, and open-task counts;
- class/member/access context only when already linked and authorized;
- internal notes preview and a functional **Add note** action.

The default detail response MUST NOT contain full communication history or task rows. Summary counts and latest-safe summaries may be included.

## 1.4 Relationships screen

The relationships screen shows durable links between the selected contact and:

- another CRM contact;
- a parent or child contact;
- a student record;
- a member record;
- a signup record;
- a school or household context;
- another approved relationship type.

Each row shows:

- related person/entity name;
- relationship label;
- entity type;
- active/inactive state;
- source/provenance;
- created or linked date;
- functional row-open behavior when the target is accessible.

Adding or removing a relationship MUST NOT grant portal access, create a payment entitlement, send a message, or mutate an unrelated source record.

## 1.5 Read-only communication-history screen

This screen is strictly read-only in release one.

It shows:

- channel;
- direction;
- human-readable source;
- subject or safe summary;
- body text where the current authorization permits it;
- occurred time;
- delivery/receipt state;
- thread indicator;
- suppression or failed-delivery status when relevant.

It MUST NOT show:

- Reply, Send, Draft, Resend, Bulk Send, or Compose controls;
- raw provider payloads;
- raw headers;
- credentials, tokens, access links, or unredacted source metadata;
- task, signup, membership, attendance, or support events presented as ordinary message rows.

Those non-message events may remain available in the broader legacy timeline, but they are outside this first-release communication-history screen.

## 1.6 Task screen

The task screen is contact-scoped, not the global Operations task board.

It supports:

- list open and completed contact tasks;
- create a manual contact task;
- edit title, owner, due date, and concise notes;
- complete and reopen;
- pagination;
- read-only provenance.

Contact edits MUST NOT create a task automatically. A user must explicitly choose **Create task**.

## 1.7 Loading states

Every route has a deterministic loading state.

- Shell/header renders immediately.
- The first visible response to navigation or click occurs within 100 ms.
- Skeletons match the final layout closely enough to avoid major movement.
- Search, Back, and Cancel remain usable when the action is local.
- Loading text is specific: “Loading contacts,” “Loading relationships,” “Loading communication history,” or “Loading tasks.”
- A skeleton alone never sets a performance journey to “usable.”

## 1.8 Empty states

| Context | Exact behavior |
|---|---|
| Account has no contacts | “No contacts yet.” Show **Add contact** only when allowed. |
| Search/filter returns no rows | “No contacts match these filters.” Show **Clear filters**. Do not show Add Contact as the primary recovery unless no filters are active. |
| No relationships | “No relationships linked.” Show **Add relationship** only when allowed. |
| No communications | “No communication history for this contact.” No send CTA. |
| No tasks | “No tasks for this contact.” Show **Create task** only when allowed. |
| Archived contact opened directly | Show archived status and permitted read-only actions; do not silently redirect to the list. |

## 1.9 Error states

- Errors replace only the failed data region where possible.
- Every error includes a human-readable message, **Retry**, and a privacy-safe request ID.
- A failed optional tab does not erase an already-loaded contact header.
- A failed list request preserves the current search/filter controls.
- A failed mutation restores the control to a retryable state and does not optimistically claim success.
- A stale response from an aborted request may not overwrite a newer search, filter, contact, or tab state.

## 1.10 Permission and authentication states

| HTTP condition | UI contract |
|---|---|
| 401 | Full-screen session-expired state with **Sign in**. No contact data remains visible after logout/session invalidation. |
| 403 | “You do not have permission to use this One Time CRM.” No partial data, global-role hint, or workspace identifiers. |
| Privacy-safe 404 | “Contact not found or unavailable.” Cross-workspace and nonexistent contacts are indistinguishable. |
| Action denied | The action is omitted. A disabled control is allowed only when an adjacent reason is useful and `aria-disabled` is set. |

---

# 2. Field-level behavior and required user actions

## 2.1 Contact-list row

| Field | Display contract | Interaction |
|---|---|---|
| Display name | Primary text; never reduced-opacity text; two-line maximum with accessible full name | Entire row opens S4; nested controls stop propagation |
| Contact type | Human-readable label | Filterable |
| Family/School classification | `Family` or `School` | Filterable |
| Lifecycle | Human-readable canonical state | Filterable; color is not the only signal |
| Primary contact method | Email or formatted phone; never raw normalized digits only | Copy action may be offered; no compose/send action |
| Owner | Display name, not internal user ID | Filterable |
| Next follow-up | Localized date/time; overdue state includes text | Sort/filter |
| Last activity | Relative plus accessible absolute timestamp | Default sort |
| Tags | At most two visible tags plus “+N” | Expands accessibly; removable only in detail |
| Source | Human label such as “Signup form” or “WhatsApp” | Filterable; no table names |

Rows MUST have a minimum 44 px interactive height. A row without a valid contact destination must not render.

## 2.2 Search behavior

- Search is server-side.
- Requests are debounced 250 ms.
- A changed query aborts the prior request.
- All query lengths are accepted; the UI does not silently ignore one-character searches.
- Search covers display name, normalized email, normalized phone, tags, source label, school/family classification, and safe summary fields.
- Free-text search is stored in in-memory route/history state, not written to server logs as a raw URL query when avoidable.
- Filter and sort selections may be encoded in the URL because they are non-PII.
- Browser Back restores search text, applied filters, sort, loaded-page cursor stack, selected contact, and list scroll position.

## 2.3 Filters

Initial filter dimensions:

```text
Classification: All | Family | School
Contact type: server-provided first-release values
Lifecycle: server-provided canonical values
Owner: active One Time account CRM users
Source: human-readable source values
Tag: existing One Time tags
Follow-up: All | Overdue | Today | Next 7 days | None
```

Rules:

- Filter options come in the list response; no separate facet request is required.
- Exact facet counts are deferred unless they can be produced by the same bounded query without a material cost.
- Unknown legacy states remain displayable as `Legacy: <label>` but cannot be selected for new writes until mapped.
- Applying filters resets pagination but preserves sort.
- **Clear all** resets all filters and search in one action.
- On 360 px and 390 px, filters use a full-height accessible drawer.
- Active-filter chips may use an intentional horizontal scroller with visible edge affordance and keyboard access.
- There is no accidental body-level horizontal overflow.

## 2.4 Sort behavior

Allowed values:

```text
last_activity_desc   default
name_asc
next_follow_up_asc
created_desc
```

Sort is server-side and encoded into the cursor. Changing sort invalidates all loaded pages.

## 2.5 Create/edit contact fields

| Field | Requirement | Validation and mutation behavior |
|---|---|---|
| `display_name` | Required | Trimmed; 1–120 characters |
| `primary_email` | Optional | Lowercase normalized; valid email; blank stored as null |
| `primary_phone` | Optional | Normalized to E.164-compatible form; display formatting is separate |
| `classification` | Required | `family` or `school` |
| `contact_type` | Required | Initial selectable values: `parent`, `student`, `school_interest`, `general_contact`; server may add approved values |
| `lifecycle_stage` | Required | Initial canonical values: `new`, `contacted`, `follow_up`, `qualified`, `active`, `not_interested`, `archived` |
| `assigned_owner` | Optional | Must be an active authorized One Time account CRM user |
| `next_follow_up_at` | Optional | Stored in UTC; entered/displayed in account timezone, initially `Asia/Jerusalem` |
| `tags` | Optional | Maximum 20; each 1–40 characters; normalized comparison; original display case retained |
| `internal_note` | Optional | Maximum 5,000 characters; creates an append-only note event, not an overwrite of prior history |
| `source` | Read-only after creation | Server-owned human source |
| Consent/suppression fields | Read-only in release one | Must not be reset by ordinary contact edits |

A contact may be name-only. When neither email nor phone is present, the form shows a warning that automatic identity matching will be limited; it does not invent an identity.

### Duplicate behavior

Before inserting, the server checks normalized email and phone inside the authenticated One Time workspace.

- Same-workspace identity match: return `409 duplicate_contact` with the existing contact key and a functional **Open existing contact** action.
- Email and phone resolve to two different records: return `409 identity_conflict_requires_review`; do not merge automatically.
- Same email or phone in another workspace is allowed and must not be exposed.
- Concurrent identical creates are serialized by the workspace-scoped unique identity constraint and idempotency key.
- Refresh, double-click, or client retry may not create a second contact.

## 2.6 Overview actions

All visible actions must work:

- **Edit contact**
- **Add note**
- **Set follow-up**
- **Change follow-up**
- **Clear follow-up**
- **Change owner**
- **Change lifecycle**
- **Add tag**
- **Remove tag**
- **Archive contact**, only for One Time Account Administrator
- **Back to CRM**
- tab selection: Overview, Relationships, Communications, Tasks

Mutation rules:

- Controls show immediate pressed/loading feedback within 100 ms.
- Submit controls are disabled only while the same mutation is in flight.
- Every write carries an idempotency key.
- Contact edits use optimistic concurrency with `If-Match` or an equivalent row version.
- Every mutation writes an account-scoped audit/pipeline event with actor, action, target, previous safe values, new safe values, request ID, and timestamp.
- No contact action sends a message, grants access, creates checkout, or changes payment state.

## 2.7 Relationship behavior

Initial relationship types:

```text
parent_of
child_of
spouse_or_partner_of
household_member
school_contact_for
student_record
member_record
signup_record
other
```

- The server validates that the target belongs to the same One Time workspace or is an explicitly permitted linked entity.
- An inverse label is derived for display; a second inverse database row is not required.
- Duplicate active links are rejected with `409 duplicate_relationship`.
- Unlink is a soft end (`ended_at`), not a hard delete.
- Rabbi CRM Admin may add/edit links but may not unlink a member/access-sensitive link.
- One Time Account Administrator may unlink after confirmation.
- Relationship writes never create or grant member access.

## 2.8 Communication-history behavior

- Default page size: 25.
- Channel filters: `All`, `Email`, `WhatsApp`, `Internal note`.
- Message body can be expanded/collapsed.
- Long body text is selectable and wraps without horizontal overflow.
- HTML is sanitized and rendered as text or a restricted safe subset.
- Full raw provider payload, recipient secrets, headers, outbox payloads, and dead-letter reasons remain server-side.
- Internal notes may appear because they are part of contact communication context; they are visibly labeled **Internal note**.
- There is no browser-side union of multiple APIs.

## 2.9 Task behavior

Create/edit fields:

| Field | Requirement |
|---|---|
| Title | Required, 1–160 characters |
| Notes | Optional, maximum 5,000 characters |
| Owner | Optional authorized One Time CRM user |
| Due date/time | Optional, account timezone |
| Status | `open` or `complete` in this screen; server maps legacy task stages |
| Provenance | Read-only |

Actions:

- Create task
- Edit
- Complete
- Reopen
- Load more

Deferred from this slice: task comments, dependencies, global task categories, agent jobs, Codex queue, and task-to-calendar automation.

## 2.10 Archive behavior

Archive is non-destructive.

- The default list excludes archived contacts.
- An explicit `Archived` filter may be added only when the archive screen is implemented; it is not required for the first release.
- Direct links to archived contacts remain readable to authorized users.
- Archive does not delete identities, communications, tasks, relationships, signups, students, or members.
- Restore is deferred unless the current product already has a safe audited restore operation.

---

# 3. Role and permission matrix

The API derives One Time account membership and role server-side. The client cannot request another workspace or elevate its role.

| Capability | One Time Account Administrator — Shloimie | One Time CRM Administrator — Rabbi | One Time CRM Viewer | Global platform super-admin without One Time account membership | Logged out |
|---|---:|---:|---:|---:|---:|
| Enter standalone CRM | Yes | Yes | Yes | No implicit access | No |
| See role label | `One Time Account Administrator` | `One Time CRM Administrator` | `One Time CRM Viewer` | N/A | N/A |
| See global super-admin chrome | No | No | No | No | No |
| See “View as Rabbi” | No | No | No | No | No |
| List/search/filter contacts | Yes | Yes | Yes | No | No |
| View contact detail | Yes | Yes | Yes | No | No |
| View relationships | Yes | Yes | Yes | No | No |
| View communication history | Yes | Yes | Yes | No | No |
| View contact tasks | Yes | Yes | Yes | No | No |
| Create contact | Yes | Yes | No | No | No |
| Edit contact fields | Yes | Yes | No | No | No |
| Add note/follow-up/tags | Yes | Yes | No | No | No |
| Create/edit/complete contact task | Yes | Yes | No | No | No |
| Add relationship | Yes | Yes | No | No | No |
| Unlink ordinary relationship | Yes | Yes | No | No | No |
| Unlink member/access-sensitive relationship | Yes, with confirmation | No | No | No | No |
| Archive contact | Yes, with confirmation | No | No | No | No |
| Send email/WhatsApp | Not in this slice | Not in this slice | No | No | No |
| Grant portal/class/member access | No | No | No | No | No |
| Manage One Time CRM roles | Deferred | No | No | No | No |

Important account-shaping rule:

> Shloimie’s separate global super-admin status must not be returned as a visible One Time CRM capability. When he uses this application, the session is shaped as One Time Account Administrator. Global platform access is a separate product surface and does not create a view-as affordance here.

A global super-admin may enter only after an explicit audited One Time account assignment or a separately approved support-access workflow. That workflow is outside this slice.

---

# 4. Screen-oriented API contracts

## 4.1 API boundary

Proposed base path:

```text
/api/one-time/crm/v1
```

The route derives:

```text
account = One Time
workspace = rabbi_sheller_provider
project = one_time_mishnah_class
account role and capabilities = authenticated server session
```

The browser MUST NOT submit `workspace_key`, `project_key`, `tenant`, or a global role to select scope. If supplied, these parameters are rejected or ignored and recorded as a suspicious request.

The initial HTML response embeds only a safe account bootstrap:

```json
{
  "account_display_name": "One Time",
  "account_role": "one_time_account_admin",
  "capabilities": {
    "contact_create": true,
    "contact_edit": true,
    "contact_archive": true,
    "relationship_write": true,
    "communication_read": true,
    "task_write": true
  },
  "account_timezone": "Asia/Jerusalem",
  "csrf_or_write_nonce": "<short-lived value>"
}
```

No contact data is embedded in the HTML.

## 4.2 Standard response envelope

Success:

```json
{
  "data": {},
  "meta": {
    "request_id": "req_...",
    "generated_at": "2026-07-14T00:00:00.000Z",
    "api_version": "one_time_crm_v1"
  }
}
```

Error:

```json
{
  "error": {
    "code": "duplicate_contact",
    "message": "A contact with this email or phone already exists.",
    "field_errors": {},
    "existing_contact_key": "optional",
    "retryable": false,
    "request_id": "req_..."
  }
}
```

Raw SQL errors, table names, stack traces, workspace IDs, tokens, and provider payloads are never returned.

## 4.3 Contact list

```http
GET /api/one-time/crm/v1/contacts
```

Allowed query parameters:

```text
classification
contact_type
lifecycle
owner
source
tag
follow_up
sort
cursor
limit
```

Free-text search SHOULD be submitted in a request body through an authenticated idempotent search endpoint when log redaction cannot be guaranteed:

```http
POST /api/one-time/crm/v1/contacts/search
```

```json
{
  "query": "cohen",
  "filters": {
    "classification": "family",
    "lifecycle": "follow_up"
  },
  "sort": "last_activity_desc",
  "cursor": null,
  "limit": 50
}
```

The POST is read-only and may use a request hash for deduplication. If the implementation safely redacts query strings from access logs, `GET ?q=` is acceptable.

List response:

```json
{
  "data": {
    "contacts": [
      {
        "contact_key": "opaque-or-server-issued-key",
        "display_name": "Example Parent",
        "contact_type": "parent",
        "classification": "family",
        "lifecycle_stage": "follow_up",
        "primary_email": "parent@example.test",
        "primary_phone": "+15550101010",
        "assigned_owner": {
          "id": "actor_...",
          "display_name": "Rabbi Scheller"
        },
        "next_follow_up_at": "2026-07-20T09:00:00.000Z",
        "last_activity_at": "2026-07-13T12:00:00.000Z",
        "tags": ["trial"],
        "source_label": "Signup form",
        "communication_preference": "email",
        "consent_status": "consented",
        "suppression_status": "none_recorded",
        "relationship_count": 1,
        "open_task_count": 1,
        "communication_count": 3,
        "version": "v7"
      }
    ],
    "filter_options": {
      "contact_types": [],
      "lifecycle_stages": [],
      "owners": [],
      "sources": [],
      "tags": []
    },
    "page": {
      "limit": 50,
      "has_more": true,
      "next_cursor": "opaque-v2-cursor",
      "snapshot_at": "2026-07-14T00:00:00.000Z"
    },
    "capabilities": {}
  },
  "meta": {}
}
```

The response omits exact full-result totals in release one.

## 4.4 Create contact

```http
POST /api/one-time/crm/v1/contacts
Idempotency-Key: <uuid>
```

The transaction:

1. derives scope and actor;
2. validates fields;
3. normalizes email/phone;
4. checks workspace-scoped identities;
5. inserts or resolves canonical `bna_contacts`;
6. inserts identities with workspace-scoped conflict handling;
7. writes a contact pipeline/audit event;
8. commits once;
9. returns `201` with the canonical contact key.

No external send, checkout, access grant, or task creation occurs.

## 4.5 Contact detail

```http
GET /api/one-time/crm/v1/contacts/:contactKey
```

Response contains:

- editable overview fields;
- read-only source/consent/suppression/class/access context;
- safe note preview;
- relationship, communication, and task summary counts;
- capabilities;
- row version/ETag.

It does not contain communication pages or task pages.

## 4.6 Update contact

```http
PATCH /api/one-time/crm/v1/contacts/:contactKey
If-Match: "contact-version"
Idempotency-Key: <uuid>
```

- Partial updates are accepted only for an allowlist.
- `412` or `409 version_conflict` returns the latest safe version and changed field names.
- The UI offers **Review latest** and does not overwrite silently.
- A note is created through a distinct endpoint so history remains append-only.

```http
POST /api/one-time/crm/v1/contacts/:contactKey/notes
```

## 4.7 Archive

```http
POST /api/one-time/crm/v1/contacts/:contactKey/archive
Idempotency-Key: <uuid>
```

Returns the archived detail representation. No hard delete endpoint exists in this version.

## 4.8 Relationships

```http
GET    /api/one-time/crm/v1/contacts/:contactKey/relationships?cursor=&limit=25
POST   /api/one-time/crm/v1/contacts/:contactKey/relationships
PATCH  /api/one-time/crm/v1/contacts/:contactKey/relationships/:relationshipId
DELETE /api/one-time/crm/v1/contacts/:contactKey/relationships/:relationshipId
```

`DELETE` means soft unlink/end. The server validates both sides of the relationship inside the One Time scope.

## 4.9 Communication history

```http
GET /api/one-time/crm/v1/contacts/:contactKey/communications?channel=all&cursor=&limit=25
```

Response:

```json
{
  "data": {
    "communications": [
      {
        "communication_key": "comm_...",
        "channel": "email",
        "direction": "inbound",
        "source_label": "Email",
        "subject": "Class question",
        "body_text": "Safe authorized body text",
        "status": "received",
        "thread_key": "safe-thread-key-or-null",
        "occurred_at": "2026-07-13T12:00:00.000Z",
        "no_send": true
      }
    ],
    "page": {
      "has_more": false,
      "next_cursor": null,
      "limit": 25
    }
  },
  "meta": {}
}
```

The server performs the source union and redaction. The browser receives one ordered collection.

No POST/PATCH/send endpoint exists under this communication-history resource in release one.

## 4.10 Contact tasks

```http
GET   /api/one-time/crm/v1/contacts/:contactKey/tasks?status=open&cursor=&limit=25
POST  /api/one-time/crm/v1/contacts/:contactKey/tasks
PATCH /api/one-time/crm/v1/contacts/:contactKey/tasks/:taskId
```

The server translates the two-state contact UI (`open`, `complete`) to current legacy task stages without rewriting unrelated tasks.

## 4.11 Pagination

The new API uses an opaque, signed, versioned **keyset cursor**, not the current offset cursor.

A cursor encodes:

```json
{
  "v": 2,
  "sort": "last_activity_desc",
  "last_sort_value": "2026-07-13T12:00:00.000Z",
  "last_id": 123,
  "snapshot_at": "2026-07-14T00:00:00.000Z"
}
```

Rules:

- default list limit 50, maximum 100;
- default relationship/communication/task limit 25, maximum 100;
- cursor tampering returns 400;
- rows are deterministically ordered by selected sort plus stable ID;
- snapshot boundary prevents duplicate/missing rows as new records arrive;
- a changed filter or sort invalidates the cursor;
- the legacy offset-cursor API remains compatible for Operations but is not used by the standalone client.

## 4.12 Caching and request deduplication

### Server/HTTP

- Static versioned assets: long-lived immutable cache.
- HTML and PII APIs: `Cache-Control: private, no-store`.
- Responses include ETag/version identifiers for explicit conditional requests managed by the app.
- No service worker, shared CDN cache, or browser persistent cache stores contact JSON.

### Client

Session-memory cache only:

| Resource | Fresh window | Back/return retention |
|---|---:|---:|
| Contact-list query | 30 seconds | Up to 5 minutes |
| Contact detail | 60 seconds | Up to 5 minutes |
| Relationships | 60 seconds | Up to 5 minutes |
| Communications | 30 seconds | Up to 5 minutes |
| Tasks | 30 seconds | Up to 5 minutes |

- Identical in-flight requests are deduplicated.
- Stale searches and route requests are aborted.
- Cache keys include account identity, account role, filters, sort, cursor, contact key, and tab.
- Memory cache is cleared on logout, account-role change, or 401.
- No contact data or free-text search is written to localStorage or IndexedDB.
- Cached real rows may satisfy the warm-return usable marker if they match the exact route/query and are no older than five minutes.

## 4.13 Targeted invalidation

| Mutation | Invalidates |
|---|---|
| Create contact | First list pages and relevant filter options |
| Edit name/email/phone/classification/lifecycle/owner/tags | Contact detail and every cached list containing the contact |
| Add note | Detail summary, last-activity-sorted list, communications/internal-note page |
| Set/clear follow-up | Detail, relevant list row, follow-up filters/sort |
| Add/edit/unlink relationship | Relationship pages and detail relationship count |
| Create/edit/complete task | Task pages, detail task count, relevant list row |
| Archive | Remove from non-archived list caches; retain archived detail |

No mutation clears the entire application cache unless account scope changes.

## 4.14 Error behavior

| Status | Code | Contract |
|---|---|---|
| 400 | `invalid_request` | Field/filter/cursor errors, no retry |
| 401 | `session_expired` | Clear PII memory, show Sign in |
| 403 | `permission_denied` | No data; no global-role hint |
| 404 | `not_found` | Same for absent and cross-workspace |
| 409 | `duplicate_contact`, `duplicate_relationship`, `identity_conflict_requires_review` | Return safe resolution action |
| 409/412 | `version_conflict` | Return latest version metadata |
| 422 | `validation_failed` | Inline field errors |
| 429 | `rate_limited` | Honor `Retry-After` |
| 502/503/504 | `temporarily_unavailable` | Retryable; preserve cached state |
| Network failure | `network_error` | Show retry; do not erase prior valid content |

GET requests may retry once only when prior valid cached content remains visible. Mutations never retry automatically after an unknown outcome; the idempotency key is reused when the user retries.

---

# 5. Required database entities, relationships, indexes, and compatibility

## 5.1 Existing entities to preserve

The standalone slice continues using these first-party entities or their current equivalents:

| Entity | Use in slice |
|---|---|
| `bna_workspace_settings` | One Time workspace scope |
| `bna_projects` | One Time project compatibility and legacy joins |
| Current account/session/user-role tables | Account role and owner options |
| `bna_contacts` | Canonical contact record |
| `bna_contact_identities` | Normalized email/phone identities and deduplication |
| `bna_parent_leads` | Legacy lead projection when no canonical contact exists |
| `bna_contact_pipeline_events` | Contact lifecycle/audit events |
| `bna_contact_communications` | Internal notes/contact timeline records |
| `bna_communications` | Canonical inbound/outbound communication records |
| `bna_tasks` | Contact-scoped task records |
| `signups` and/or `bna_product_leads` | Signup relationships/context |
| `bna_students` | Student relationship target |
| `bna_members` | Member/access relationship target |
| Support/outbox/dead-letter sources | Server-side detail context only; not eagerly loaded as CRM messages |

The browser does not query these tables independently. A screen-oriented server repository performs the joins, scope enforcement, deduplication, ordering, and redaction.

## 5.2 Additive relationship entity

Add a non-destructive table if an equivalent durable relationship table does not already exist:

```sql
CREATE TABLE IF NOT EXISTS bna_contact_relationships (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES bna_workspace_settings(id),
  source_contact_id BIGINT NOT NULL REFERENCES bna_contacts(id),
  target_contact_id BIGINT NULL REFERENCES bna_contacts(id),
  target_entity_type TEXT NULL,
  target_entity_id BIGINT NULL,
  relationship_type TEXT NOT NULL,
  display_label TEXT,
  source TEXT NOT NULL DEFAULT 'manual_crm',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_actor_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ NULL,
  CHECK (
    (target_contact_id IS NOT NULL AND target_entity_type IS NULL AND target_entity_id IS NULL)
    OR
    (target_contact_id IS NULL AND target_entity_type IS NOT NULL AND target_entity_id IS NOT NULL)
  )
);
```

The application validates polymorphic targets against allowed One Time tables and workspace ownership before insert.

## 5.3 Additive contact concurrency/archive fields

If absent, add:

```sql
ALTER TABLE bna_contacts
  ADD COLUMN IF NOT EXISTS row_version BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by_actor_key TEXT;
```

Existing `status='archived'` records remain valid through a compatibility mapping. No destructive backfill is required before read access.

If `bna_tasks.contact_id` is absent, add it as nullable and retain `related_contact_email`:

```sql
ALTER TABLE bna_tasks
  ADD COLUMN IF NOT EXISTS contact_id BIGINT REFERENCES bna_contacts(id);
```

Backfill only unambiguous same-workspace matches. Ambiguous rows remain on the legacy lookup path and are reported, not guessed.

## 5.4 Required indexes

Existing identity isolation must remain:

```sql
UNIQUE (workspace_id, identity_type, normalized_value)
```

Required or equivalent indexes:

```text
bna_contact_identities:
  unique workspace identity index
  workspace lookup index

bna_contacts:
  (workspace_id, archived_at, updated_at DESC, id DESC)
  (workspace_id, lower(full_name), id)
  GIN(tags) when tags are array/jsonb and supported

bna_parent_leads:
  (project_id, updated_at DESC, id DESC)
  normalized email/phone lookup indexes where columns exist

bna_communications:
  (workspace_id, contact_id, occurred_at DESC, id DESC)

bna_contact_communications:
  (contact_id, created_at DESC, id DESC)
  include workspace scope where the table supports it

bna_contact_pipeline_events:
  (workspace_id, contact_id, created_at DESC, id DESC)

bna_tasks:
  (project_id, contact_id, stage, due_date, id)
  legacy related-contact lookup index until backfill is complete

bna_contact_relationships:
  (workspace_id, source_contact_id, ended_at, created_at DESC, id DESC)
  (workspace_id, target_contact_id, ended_at, created_at DESC, id DESC)
  partial unique active source/target/type indexes
```

For contact-to-contact links:

```sql
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  idx_bna_contact_relationships_active_contact_unique
ON bna_contact_relationships (
  workspace_id,
  source_contact_id,
  target_contact_id,
  relationship_type
)
WHERE ended_at IS NULL AND target_contact_id IS NOT NULL;
```

An analogous partial unique index applies to polymorphic entity targets.

Index creation should use `CONCURRENTLY` where production PostgreSQL and the migration runner permit it.

## 5.5 Query contract

Before release:

- capture `EXPLAIN (ANALYZE, BUFFERS)` or safe production-equivalent plans for list, search, detail, relationship, communication, and task queries;
- prove each first page is bounded by the requested limit plus one;
- prove no N+1 query per displayed row;
- prove no full unbounded source fetch followed by browser or service-layer filtering;
- prove no disk-spilling sort on the expected account data volume;
- record handler, pool-wait, database, serialization, and response-byte timings.

A sequential scan on a genuinely small table is not automatically a failure; an unbounded scan/sort that violates latency or row-read budgets is.

## 5.6 Compatibility rules

1. **No destructive migration.** Do not drop, rename, truncate, or rebuild current CRM, lead, task, communication, signup, student, or member tables.
2. The destructive legacy `migrate-railway.sql` path is legacy-only and must not be run for this product.
3. Existing `bna_contacts:<id>` and `bna_parent_leads:<id>` references remain resolvable internally.
4. The new API returns a client contact key and does not expose source-table names as UI labels.
5. Canonical `bna_contacts` wins when a legacy lead and contact resolve to the same workspace identity.
6. Legacy-only leads remain visible. On the first permitted edit, the server may transactionally create/resolve a canonical contact and link the legacy source; it may not delete the lead.
7. Same email/phone may coexist in BNA and One Time. Deduplication is workspace-scoped.
8. Current Operations endpoints remain available to the legacy Operations product during migration, but the standalone browser never calls them.
9. Current communication redaction, no-send metadata, suppression context, and identity-isolation rules are preserved.
10. Relationship backfill is idempotent and limited to unambiguous existing links.
11. Unknown legacy lifecycle/task values are mapped for display, not rewritten silently.

---

# 6. Browser-request budget

## 6.1 Counting rule

The gate counts every same-origin `/api/**` request initiated from navigation/click start through the relevant usable marker, including session refresh and performance beacons. Static HTML/JS/CSS/image requests are reported separately and do not count as application API calls.

## 6.2 Initial CRM list

Hard requirement:

```text
No more than 5 application API calls before crm:list:usable.
```

Designed request graph:

| Call | Required? |
|---|---|
| Contact-list screen response | Yes — 1 |
| Session refresh | Only when the current session is near expiry — 0 or 1 |
| CSRF/write nonce refresh | Only if not embedded safely — 0 or 1 |
| Privacy-safe RUM beacon | After usable marker — 0 or 1 |
| Other | None |

Target: one business-data call and no more than four total API calls. Five is the absolute failure threshold.

Forbidden before list usable:

```text
global tasks
contact tasks
contact communications
mailbox
support tickets
queue health
agent fleet
automations
integrations
billing
access
workspace directory
project directory
global counts
Operations bootstrap endpoints
```

## 6.3 Contact detail

Hard requirement:

```text
No more than 3 additional application API calls from contact click through
crm:detail:usable.
```

Designed request graph:

| Call | Required? |
|---|---|
| Contact-detail response | Yes — 1 |
| Session/nonce refresh | Normally no; at most 1 |
| Privacy-safe RUM beacon | After usable marker — at most 1 |

Relationships, communications, and tasks are not fetched before their tab is opened.

## 6.4 Lazy tabs

After explicit selection:

```text
Relationships: exactly one first-page API read
Communications: exactly one first-page API read
Tasks: exactly one first-page API read
```

No tab is prefetched on hover, viewport visibility, idle time, or detail load. Pagination adds one request per explicit **Load more** action.

## 6.5 Duplicate-request rule

For a given account, route, filter, sort, cursor, contact, and tab:

- only one in-flight request is permitted;
- rerendering cannot issue the same request again;
- browser Back uses valid memory cache or one conditional/reload request, not a fanout;
- a failed request may be retried only by the documented retry policy.

---

# 7. Starting performance budgets

## 7.1 Required user-journey gates

| Journey | Current evidence | First-release gate | Required improvement |
|---|---:|---:|---:|
| CRM list, throttled mobile cold, usable | 4.149 s p75 | **≤ 2.5 s p75** | At least 1.649 s, or 39.7% |
| Contact detail, throttled mobile cold, usable | 6.515 s p75 | **≤ 3.0 s p75** | At least 3.515 s, or 54.0% |
| Warm return route, usable | Can hang | **≤ 1.5 s p75** | Zero hangs/timeouts |
| Visible click/navigation response | Prior evidence exceeds 100 ms in affected runs | **≤ 100 ms p75 and no sample > 250 ms** | Immediate feedback |
| Communication tab after request | 7.183 s p75 in shared shell | **≤ 2.5 s p75** | Lazy standalone tab |
| Task tab after request | 7.342 s p75 in shared shell | **≤ 2.5 s p75** | Lazy standalone tab |

The communication/task targets are supporting release gates because those screens are included in the slice, but their data must remain outside the list/detail critical path.

## 7.2 API and main-thread guardrails

```text
Common screen read API p95: ≤ 750 ms
No required journey may depend on an API taking > 1.5 s
No long task > 200 ms before usable
Total main-thread long-task time before list/detail usable: ≤ 500 ms
No uncaught console error, page error, or failed required request
No duplicate business-data request
```

## 7.3 Usable-state definitions

`crm:list:usable` fires only when:

- at least one real contact row is visible for a nonempty fixture, or the verified true empty state is visible;
- search and filter controls are enabled;
- the first row is clickable;
- Add Contact is functional when permitted.

`crm:detail:usable` fires only when:

- the real contact name and overview data are visible;
- Back and all permitted overview actions are enabled;
- no unrelated tab data is required.

`crm:return:usable` fires only when:

- the previous list/detail state is restored;
- search/filter/sort/scroll/selection are correct;
- visible controls are interactive.

A skeleton, shell paint, HTTP 200, route URL change, or `networkidle` does not qualify.

## 7.4 Measurement profile

Primary gate profile:

```text
Viewport: 390 × 844
CPU: 4× slowdown
Network: slow-4G-style, approximately 1.6 Mbps down / 750 Kbps up / 150 ms RTT
Cold: new authenticated browser context with HTTP cache cleared
Warm: same authenticated context after one completed visit
```

Supporting responsive checks run at 360 × 800, tablet, and desktop.

Minimum samples:

- 10 valid cold samples per required list/detail/tab journey;
- 20 warm Back/return transitions;
- no skipped authenticated journey is counted as a pass;
- timeout/failure is included as an infinite/failing sample;
- p50, p75, p95, worst, pass count, request count, API count, bytes, long-task time, and slowest API are reported.

The test harness uses explicit marks and DOM assertions. `waitUntil: "networkidle"` may be used only for diagnostic setup, never as the pass condition.

## 7.5 Feasibility conclusion

The evidence does **not** prove that the 2.5-second list or 3.0-second detail target is infeasible.

The current architecture already has:

- bounded contact DTOs;
- server-side workspace scoping;
- separate contact, communication, and task service methods;
- page-size limits;
- a measured problem dominated by shared route weight, fanout, and hidden-route work rather than a demonstrated unavoidable external dependency.

Therefore the targets remain binding.

They may be declared infeasible only after the standalone screen endpoint and client are measured and all of the following are supplied:

1. route waterfall;
2. server handler, database, and pool timings;
3. query plan;
4. bundle/main-thread profile;
5. controlled experiment isolating the residual dependency;
6. exact residual p75/p95;
7. proof that the dependency cannot be removed from the critical path.

A target is never silently relaxed to make the current implementation pass.

---

# 8. Responsive behavior

## 8.1 Shared rules

- No body-level horizontal overflow.
- Minimum interactive target: 44 × 44 px.
- Focus ring is visible and has at least 3:1 contrast.
- Normal text, names, metadata, and action labels meet at least 4.5:1 contrast.
- Text does not inherit reduced opacity from a parent container.
- Active state is conveyed by text/shape/icon/underline in addition to color.
- Long names wrap to two lines; the full value remains available to assistive technology.
- Search/filter controls remain reachable with the software keyboard open.
- Drawers use `100dvh`, safe-area insets, internal scrolling, and focus trapping.
- Detail tabs use an intentional horizontal scroller where necessary.
- No fixed helper, chatbot, or footer may cover CRM actions.

## 8.2 360 px

- Single-pane list or detail, never a squeezed split view.
- Compact account header; role remains readable.
- Sticky search/filter row.
- Filter button opens a full-height drawer.
- Active filter chips scroll horizontally.
- Contact rows are cards with name, lifecycle, contact method, owner/follow-up, and at most two tags.
- Opening a contact replaces the list pane and shows a sticky **Back to CRM** control.
- Detail tabs scroll horizontally with the active tab brought into view.
- Create/edit uses a full-screen form.
- Primary action remains visible without overlapping the keyboard.

## 8.3 390 px

Same single-pane model as 360 px, with room for:

- name and lifecycle on one row where text permits;
- one additional metadata line;
- a two-control action row only when both controls remain at least 44 px;
- no arbitrary multi-row button wrapping.

## 8.4 Tablet — 768 to 1199 px

- Two-pane layout: list 320–360 px, detail fills remaining width.
- Selecting a contact retains list context.
- Filter drawer or anchored popover; no full desktop filter bar if it crowds the list.
- Create/edit opens as a centered sheet, maximum 640 px, or a full route.
- Relationship/communication/task rows use a single readable column in detail.
- At 768 px portrait, the product may use single-pane mode if the two-pane minimum widths cannot be met without clipping.

## 8.5 Desktop — 1200 px and above

- Stable two-pane CRM workspace.
- List pane 360–420 px.
- Detail pane uses readable maximum line width; it does not stretch message bodies across the whole viewport.
- Search, filter, sort, and Add Contact fit in one intentional toolbar.
- Filter popover or inline controls are keyboard accessible.
- No third permanent pane in release one.
- Main account navigation contains one CRM destination; contact tabs remain within the detail pane.

## 8.6 RTL and localization safety

Even if first-release copy is English, layout primitives must support `dir="rtl"`:

- logical CSS properties;
- icons that do not incorrectly imply direction;
- phone/email remain LTR where appropriate;
- horizontal scrollers and Back behavior are tested in both directions before Hebrew launch.

Hebrew translation itself may be deferred by product decision, but the layout may not make it prohibitively expensive.

---

# 9. Exact acceptance tests

All browser tests run against deterministic scoped fixtures and at least one production-like account-volume fixture. A faster empty shell is a failure.

## 9.1 Architecture and request isolation

**ARCH-01 — Standalone asset graph**  
Open `/one-time/app/crm`; assert no request for `operations-shell.js`, Operations deferred renderers, Operations CSS, or the current Operations bootstrap document.

**ARCH-02 — No Operations fanout**  
Before `crm:list:usable`, assert zero calls to global tasks, communications, queue, fleet, agents, support, automations, integration, billing, access, workspace-directory, or project-directory APIs.

**ARCH-03 — No full provider runtime dependency**  
Assert the CRM remains functional without loading the current full `provider.html` script/runtime.

**ARCH-04 — One canonical CRM**  
Create/edit through the new API and read the same canonical contact through the current server domain service; assert no duplicate CRM store or browser-side source union.

**ARCH-05 — No old light-pass certification**  
Assert no performance pass depends on the Operations `oneTimeProgramLightPass` or equivalent shared-shell bypass.

## 9.2 Authentication, account shaping, and permissions

**AUTH-01 — Shloimie account role**  
Log in as Shloimie; assert visible role is `One Time Account Administrator`.

**AUTH-02 — No View as Rabbi**  
Search rendered DOM and accessible names; assert no “View as Rabbi,” super-admin bridge, or impersonation control.

**AUTH-03 — Rabbi account isolation**  
Log in as Rabbi; assert only One Time account CRM data and account navigation are available; no BNA/global Operations assets or data.

**AUTH-04 — Viewer read-only**  
Viewer can list/detail/relationships/communications/tasks but cannot invoke or discover create/edit/archive/write endpoints.

**AUTH-05 — Global role is not implicit membership**  
A platform super-admin without explicit One Time account membership receives 403 and no contact data.

**AUTH-06 — Cross-workspace denial**  
Request a BNA contact key from a One Time session; assert privacy-safe 404 and no timing/body disclosure of the foreign record.

**AUTH-07 — Logged-out denial**  
All CRM APIs return 401; standalone HTML shows no cached/private contact data.

**AUTH-08 — Server-owned scope**  
Submit forged workspace/project/global-role parameters; assert they do not alter scope and are rejected or ignored.

## 9.3 Navigation and clickability

Run NAV-01 through NAV-09 at 360 × 800, 390 × 844, 768 × 1024, and 1440 × 900.

**NAV-01 — Every contact row opens**  
Click every fixture row; each opens the matching contact detail and displays the expected name.

**NAV-02 — Every visible control is real**  
Enumerate visible `button`, link, menu item, tab, row action, and chip. Each must produce navigation, state change, mutation, dialog, or a documented disabled reason. Decorative elements may not expose button semantics.

**NAV-03 — Nested row controls**  
Using a nested tag/remove/action control does not also open the row.

**NAV-04 — Main/subnavigation uniqueness**  
Assert one top-level `CRM` destination and no nested `CRM` or `Contacts` destination pointing to the same route.

**NAV-05 — Tab routing**  
Overview, Relationships, Communications, and Tasks update route state, active semantics, and panel content exactly once.

**NAV-06 — Browser Back from detail**  
Back restores list search, filters, sort, loaded pages, selected row, and scroll position.

**NAV-07 — Browser Forward**  
Forward reopens the same contact/tab without duplicate requests.

**NAV-08 — Direct deep links**  
Directly load detail, edit, relationships, communications, and tasks; each reaches a complete state or privacy-safe error.

**NAV-09 — Immediate feedback**  
Every navigation/action displays visible feedback within 100 ms; no sample exceeds 250 ms.

## 9.4 Readability and accessibility

**A11Y-01 — Name contrast**  
For every displayed contact name at all required widths, compute foreground/background contrast ≥ 4.5:1 and effective ancestor opacity = 1.

**A11Y-02 — Action contrast**  
Button/link text meets 4.5:1; focus indicators meet 3:1.

**A11Y-03 — No internal labels**  
Assert no visible `bna_...`, raw workspace key, project key, provider config label, or test fixture wording.

**A11Y-04 — Keyboard list**  
Keyboard users can reach search, filters, Add Contact, rows, Load More, and Back in logical order.

**A11Y-05 — Filter drawer**  
Drawer has dialog semantics, labelled title, focus trap, Escape close, focus return, and internal scrolling.

**A11Y-06 — Tabs**  
Tabs use correct `tablist`, `tab`, `tabpanel`, `aria-selected`, and keyboard arrow behavior.

**A11Y-07 — Errors**  
Errors and mutation outcomes are announced through an appropriate live region without moving focus unexpectedly.

**A11Y-08 — Long content**  
Long names, email addresses, tags, and message bodies wrap or scroll inside the intended component; no page overflow.

## 9.5 Search, filters, and sorting

**FILTER-01 — Search results**  
Search by name, email, formatted phone, normalized phone, tag, and source; assert correct rows and no cross-workspace result.

**FILTER-02 — Stale-request cancellation**  
Delay query A, issue query B, return A last; assert B remains rendered.

**FILTER-03 — Filter dimensions**  
Exercise every filter option and combined filters; result set matches server truth.

**FILTER-04 — Clear one and clear all**  
Each chip removes only its filter; Clear All restores the default query.

**FILTER-05 — Mobile accessibility**  
At 360 and 390, all filters remain reachable through the drawer or intentional chip scroller; no clipped option.

**FILTER-06 — Sort stability**  
Validate each allowed sort and deterministic ID tie-breaker.

**FILTER-07 — Back restoration**  
Search/filter/sort values restore through Back without writing raw PII to logs when the POST-search design is used.

## 9.6 Create, edit, and duplicate prevention

**CONTACT-01 — Create name-only contact**  
Create a valid name-only contact; warning is shown before save; exactly one canonical contact is created.

**CONTACT-02 — Normalize identity**  
Create with mixed-case email and formatted phone; stored identities are normalized, displayed values are readable.

**CONTACT-03 — Same-workspace email duplicate**  
Create again with the normalized same email; receive 409 and functional Open Existing action; no new contact.

**CONTACT-04 — Same-workspace phone duplicate**  
Same as CONTACT-03 for phone.

**CONTACT-05 — Split identity conflict**  
Email resolves to contact A and phone to contact B; receive conflict-review state; no automatic merge/write.

**CONTACT-06 — Cross-workspace coexistence**  
The same normalized email/phone may exist once in BNA and once in One Time; each workspace sees only its own contact.

**CONTACT-07 — Double submit**  
Double-click Save and replay the request with the same idempotency key; exactly one contact and one audit event are created.

**CONTACT-08 — Field validation**  
Exercise required name, invalid email, phone normalization failure, tag limits, note limits, unauthorized owner, and invalid lifecycle.

**CONTACT-09 — Edit and invalidate**  
Edit a visible row field; detail and list update, unrelated list queries remain cached.

**CONTACT-10 — Version conflict**  
Two sessions edit the same contact; stale save receives version conflict and cannot overwrite the newer change silently.

**CONTACT-11 — Add note**  
One note action creates one append-only note event, updates last activity, and does not send or create a task.

**CONTACT-12 — Follow-up actions**  
Set, change, and clear follow-up; list filters/sort and detail state update correctly.

**CONTACT-13 — Tags and owner**  
Add/remove tag and change owner; duplicates are prevented and unauthorized owners are rejected.

**CONTACT-14 — Archive**  
Account Administrator confirms archive; contact disappears from default list but all related data remains. Rabbi Admin cannot archive.

## 9.7 Relationships

**REL-01 — Load on demand**  
Opening detail Overview makes no relationships request. Selecting Relationships makes exactly one first-page request.

**REL-02 — Add link**  
Add an approved same-workspace relationship; one durable row appears with actor/provenance.

**REL-03 — Duplicate link**  
Repeat the same active source/target/type; receive 409 and no duplicate.

**REL-04 — Cross-workspace target**  
Attempt to link a foreign target; receive privacy-safe denial and no row.

**REL-05 — Soft unlink**  
Unlink ordinary relation; `ended_at` is set, history is retained.

**REL-06 — Sensitive unlink permission**  
Rabbi Admin cannot unlink a member/access-sensitive relationship; Account Administrator can after confirmation.

**REL-07 — No access side effect**  
Add/unlink relationships; assert no portal access, member entitlement, payment, send, or login token mutation.

## 9.8 Communications

**COMM-01 — Lazy request**  
No communication endpoint or module loads before the Communications tab is selected.

**COMM-02 — Single ordered collection**  
One endpoint returns correctly ordered email, WhatsApp, and internal-note rows; browser makes no source-specific union calls.

**COMM-03 — Read-only UI**  
Assert no Send, Reply, Draft, Resend, Compose, or Bulk action exists.

**COMM-04 — Redaction**  
Assert raw headers, provider payloads, recipient secrets, credentials, private access links, and unsafe source context are absent.

**COMM-05 — Pagination**  
Load multiple pages; no duplicate/missing row; cursor order remains stable.

**COMM-06 — Error recovery**  
Fail page one and later page requests independently; Retry restores only the failed region and keeps the contact header.

## 9.9 Tasks

**TASK-01 — Lazy request**  
No task endpoint or task module loads before Tasks is selected.

**TASK-02 — Contact scope**  
Only tasks linked to the selected One Time contact appear.

**TASK-03 — Explicit create**  
Create one task manually; no contact edit creates a task implicitly.

**TASK-04 — Complete/reopen**  
Complete and reopen update task state, count, and detail summary exactly once.

**TASK-05 — No Operations task fanout**  
The contact task tab calls only the screen-oriented contact-task endpoint, not global `/api/bna/tasks` loaders or child collections.

## 9.10 Pagination and data-volume behavior

**PAGE-01 — 10,000-contact fixture**  
First page returns 50 plus cursor metadata only; payload remains page-sized.

**PAGE-02 — Keyset correctness**  
Walk all pages; every expected contact appears exactly once.

**PAGE-03 — Concurrent insert**  
Insert a new contact after page one; current snapshot pages remain stable; refresh shows the new contact.

**PAGE-04 — Concurrent update**  
Update sort fields after page one; current snapshot does not duplicate/skip the record; refresh reorders correctly.

**PAGE-05 — Cursor tamper**  
Modified/foreign cursor returns 400, no fallback to page one that could hide a client bug.

**PAGE-06 — No full total dependency**  
List usable does not wait for an unbounded exact count.

## 9.11 Error recovery and cache invalidation

**ERR-01 — List timeout**  
Force timeout; it counts as a failed performance sample and shows Retry. It is never classified as pass because shell painted.

**ERR-02 — Detail 500**  
List remains usable; contact region shows Retry and request ID.

**ERR-03 — Session expiry during mutation**  
No optimistic success remains; PII memory clears and Sign in appears.

**ERR-04 — Mutation unknown outcome**  
Retry reuses idempotency key; at most one write exists.

**ERR-05 — Cache invalidation map**  
For every mutation, assert only the documented list/detail/tab queries are invalidated.

**ERR-06 — Logout cache purge**  
After logout, browser Back cannot reveal contact data from memory or DOM.

## 9.12 Browser-request budgets

**REQ-01 — Initial list**  
Count all `/api/**` calls through `crm:list:usable`; pass only when ≤ 5.

**REQ-02 — Contact detail**  
Count additional `/api/**` calls from row click through `crm:detail:usable`; pass only when ≤ 3.

**REQ-03 — No hidden conversations/tasks**  
Assert zero communication/task requests before their explicit tab clicks.

**REQ-04 — No duplicate calls**  
Assert one in-flight request per canonical query key.

**REQ-05 — Failed-sample waterfall**  
Even a failed journey must report request/API counts; approximately 81/60 fanout can never be hidden by dropping the sample.

## 9.13 Performance gates

**PERF-01 — CRM list cold p75**  
10 or more 390 × 844, 4× CPU, slow-4G cold samples; `crm:list:usable` p75 ≤ 2.5 s.

**PERF-02 — Contact detail cold p75**  
10 or more samples; `crm:detail:usable` p75 ≤ 3.0 s.

**PERF-03 — Warm return**  
20 Back/return transitions; p75 ≤ 1.5 s; zero hang/timeout.

**PERF-04 — Communication tab**  
10 samples after explicit tab click; p75 ≤ 2.5 s.

**PERF-05 — Task tab**  
10 samples after explicit tab click; p75 ≤ 2.5 s.

**PERF-06 — API gate**  
Common read API p95 ≤ 750 ms; no required journey depends on an endpoint > 1.5 s.

**PERF-07 — No network-idle pass**  
The harness source and report prove pass/fail is based on explicit usable marks and functional assertions. `networkidle` alone cannot produce a passing sample.

**PERF-08 — Failures included**  
Timeouts, authentication failures, skipped required routes, empty-fixture mistakes, console errors, and failed required requests remain in the denominator and fail the gate.

**PERF-09 — Before/after comparability**  
The same profile, data fixture, journey, marks, and sample count are used before and after. Report p50/p75/p95/worst and absolute/percentage change.

**PERF-10 — Exact revision proof**  
The final report records commit SHA, deployed SHA, target app, request traces, and whether field RUM is sufficient. If not, state `synthetic verified; RUM pending`.

---

# 10. Reuse matrix

| Area | Decision | What to preserve | Required adaptation |
|---|---|---|---|
| Contact normalization | **Extract/adapt** | Email/phone normalization and human source labels | Centralize authoritative phone normalization; remove comments implying temporary fallback |
| Contact DTO | **Extract/adapt** | Canonical card fields, consent/suppression context, linked IDs | Split list vs detail fields; omit raw/internal context |
| Contact deduplication | **Extract/adapt** | Preference for canonical `bna_contacts`; workspace-scoped email/phone matching | Move pagination/filtering into bounded SQL repository; retain model mapping |
| Contact service envelopes | **Extract/adapt** | Separate list, timeline, conversations, and tasks methods; no-send flags | Expose through One Time screen façade; add detail and write contracts |
| Workspace authorization | **Extract/adapt** | Server-derived workspace/project ownership and privacy-safe denial | Shape account roles; reject browser-supplied scope |
| Identity schema | **Extract/adapt** | Workspace-scoped unique identity and lookup indexes | Use for all create/update conflict checks; preserve cross-workspace coexistence |
| Communication union/redaction | **Extract/adapt** | First-party communication sources and server redaction rules | Return one read-only paginated screen collection |
| Task action semantics | **Extract/adapt** | Manual create, complete, reopen, no automatic send | Add direct `contact_id` path where absent; avoid global task endpoint |
| Existing contact actions | **Extract/adapt** | Note, follow-up, tag, owner, lifecycle, archive semantics | Move into concise standalone components and audited mutations |
| Dedicated One Time route isolation | **Extract/adapt** | No Operations CSS/JS and route-specific lazy modules | Use a new standalone entry rather than the current full provider page |
| Auth/session cookie | **Extract/adapt** | Existing secure authenticated session | Return One Time account role/capabilities only |
| Performance instrumentation | **Extract/adapt** | Request IDs, Server-Timing, privacy-safe RUM, repeated journey harness | Replace permissive/network-idle gates with usable-content marks and absolute thresholds |
| Responsive mobile back pattern | **Extract/adapt** | Single-pane mobile list/detail and explicit Back | Raise touch targets to 44 px and preserve full query/scroll state |
| Standalone CRM client | **Rebuild** | N/A | New entry, router, data/query layer, forms, list/detail/tabs, error states |
| Screen-oriented API façade | **Rebuild** | N/A | New `/api/one-time/crm/v1` routes, direct bounded queries, keyset cursors |
| List query implementation | **Rebuild** | Current DTO mapping and source precedence | Eliminate bounded-but-broad source fetch plus in-memory filtering for the new path |
| Relationship persistence | **Rebuild** | Existing linked IDs/provenance as backfill input | Add non-destructive relationship table and scoped APIs |
| Client caching/invalidation | **Rebuild** | N/A | Session-memory query cache, abort/dedupe, targeted invalidation |
| Loading/empty/error/permission components | **Rebuild** | Copy lessons from current tests | One coherent accessible component set |
| Current Operations CRM workbench | **Legacy-only** | Regression reference and fallback during cutover | Never load in the new product |
| `operations.html`, Operations shell/bootstrap/deferred renderers | **Legacy-only** | Test evidence only | No runtime dependency |
| Current static `one-time-provider-crm-route.js` renderer | **Legacy-only** | Route-isolation proof and some brand tokens | Replace summary cards/placeholder detail |
| `provider.html?view_as_rabbi=...` bridge | **Legacy-only** | Transitional compatibility only | No visible path in standalone CRM |
| Current offset cursor | **Legacy-only** | Existing Operations API compatibility | New API uses signed keyset cursor |
| Legacy destructive `migrate-railway.sql` | **Legacy-only** | Historical evidence | Must not run |
| Old CRM light-pass patch | **Legacy-only** | Performance hypothesis/history only | Do not implement or certify |
| Email/WhatsApp compose/send | **Defer** | Existing outbox/agent infrastructure remains intact | Separate approved messaging vertical slice |
| Full mailbox product | **Defer** | Current mailbox remains separate | Link only after a bounded, authorized route exists |
| Global task board/comments/dependencies | **Defer** | Existing Operations product | Contact tasks only in release one |
| Contact merge UI | **Defer** | Conflict detection | Human-reviewed merge slice later |
| Bulk import/export | **Defer** | Existing data remains | Separate privacy/idempotency design |
| Automations and agents | **Defer** | Current backend systems | No ordinary CRM critical-path probes |
| Billing/access grants | **Defer** | Read-only linked status may display | No mutation from CRM |
| Support/outbox/dead-letter diagnostics | **Defer** | Server can preserve timeline context | Not ordinary communication rows |
| CRM role-management screen | **Defer** | Server role model required | Admin assignment handled elsewhere initially |
| Exact-result counts/analytics | **Defer** | Page metadata | Add only with proven bounded queries |
| Hebrew copy | **Defer pending decision** | RTL-safe layout required now | Translation can follow without redesign |

---

# 11. Evidence index and unresolved decisions

## 11.1 Evidence index

1. **Accepted One Time shell direction** — `docs/architecture/one-time-app-shell-adr-2026-07-13.md`  
   The accepted direction is a dedicated One Time frontend/shell that shares backend contracts but does not duplicate CRM/contact/inbox infrastructure. The ADR identifies route weight, shared-shell coupling, and DOM work as the primary problem and rejects keeping the Operations monolith as the critical path.  
   Relevant lines: 17–25, 70–83, 85–97.

2. **Current dedicated CRM renderer is not a complete CRM** — `public/js/one-time-provider-crm-route.js`  
   It renders four high-level record cards and a placeholder “Selected CRM view,” not a real paginated contact list/detail application.  
   Relevant lines: 43–165.

3. **Current signed Rabbi shell already proves super-admin chrome can be absent** — `tests/one-time-provider-review-navigation.test.js`  
   Signed Rabbi sessions show a Rabbi account and omit the Super Admin bridge; route modules are loaded on demand and mobile overflow is checked.  
   Relevant lines: 227–295 in the first excerpt; 3–28 and 163–203 in the second excerpt.

4. **Canonical contact fields and editable fields exist** — `src/lib/bna/crm-contact-model.js`  
   The model provides name, type, classification, lifecycle, owner, email, phone, tags, preference/consent/suppression, source, activity/follow-up, linked entities, membership, mailbox, support, task, class, signup, and timeline context.  
   Relevant lines: 240–262 and 260–365.

5. **Canonical deduplication and current pagination behavior are tested** — `tests/crm-contact-model.test.js`  
   Tests cover normalization, rich reconciliation, human source labels, suppression, canonical lead/contact dedupe, 50/100 page limits, a 10,000-contact fixture, and read-only timeline flags.  
   Relevant lines: 21–25, 46–121, 123–162, 164–205, 226–283, 297–305.

6. **List, timeline, conversations, and tasks are already separate domain-service concepts** — `tests/crm-contact-service.test.js`  
   The service returns scoped list/timeline envelopes; conversations exclude non-message timeline events; tasks remain separate; no-send/external-write flags are preserved.  
   Relevant lines: 16–88 and 340–399.

7. **Existing Operations actions prove useful local CRM behavior** — `tests/shared-crm-workbench-contract.test.js`  
   Tests cover explicit local edits, notes, follow-up set/change/clear, tags, owner, lifecycle, Add Contact, tasks, relationship-like links, archive, and lazy tab state.  
   These action semantics can be preserved without preserving the Operations UI/runtime.

8. **Workspace ownership is enforced server-side** — `tests/rabbi-scheller-tenant-isolation-contract.test.js`  
   Contact/timeline queries require explicit workspace/project ownership, avoid broad email matching, derive scope server-side, and keep the list bounded/cursor-paginated.  
   Relevant lines: 58–127.

9. **Workspace-scoped identity uniqueness is live-tested** — `scripts/smoke-crm-identity-isolation-live.mjs`  
   The smoke verifies the unique index on `(workspace_id, identity_type, normalized_value)`, allows the same email/phone in BNA and One Time, blocks same-workspace duplicates, prevents contact-ID leakage, and rolls back synthetic proof data.  
   Relevant lines: 211–236 and 320–468.

10. **Schema tests confirm additive workspace identity compatibility** — `tests/assistant-portal-communications-contract.test.js`  
    Tests require `bna_contacts`, `bna_contact_identities`, additive `workspace_id`, removal of legacy global identity uniqueness, workspace-scoped conflict handling, and scoped communication APIs.  
    Relevant lines: 44–59 and 78–94.

11. **The route registry distinguishes provider/account access from Operations** — `ops/route-registry.json`  
    Provider access is workspace-scoped; Operations remains a separate critical private surface. The old provider-admin entry currently depends on a session created from Operations, which the standalone route must remove.  
    Relevant lines: provider route lines 250–262 and provider-admin/Operations lines 250–305 in the later excerpt.

12. **Legacy destructive migration is unsafe for this slice** — `migrate-railway.sql`  
    The file contains `DROP TABLE` statements for signups, tasks, and payment logs and therefore is explicitly legacy-only.  
    Relevant lines: 21–25.

13. **Current performance baseline supplied for OT-03, 2026-07-14**  
    CRM list 4.149 s p75, contact detail 6.515 s p75, communications 7.183 s p75, tasks 7.342 s p75, return route can hang, and failed samples reached approximately 81 requests/60 API calls. This is the binding before-state for the contract.

14. **Current performance methodology packet, 2026-07-14** — `02-Codex-One-Time-Performance-Root-Cause-And-Repair.md`  
    It requires repeated cold/warm user journeys, explicit usable-state marks, p50/p75/p95/worst, inclusion of timeouts/skips, request/API/main-thread/query evidence, a dedicated same-repo frontend option, one screen-oriented request, lazy tabs, and no network-idle timeout classified as passing.

## 11.2 Resolved decisions in this contract

| Decision | Resolution |
|---|---|
| Reuse shared Operations runtime? | No |
| Build a second CRM/database? | No |
| Standalone route? | Yes; proposed `/one-time/app/crm` |
| Shloimie visible role? | One Time Account Administrator |
| Show View as Rabbi? | No |
| Rabbi sees global Operations? | No |
| Communication write actions? | Deferred; history is read-only |
| Tasks eager on detail? | No; tab-only |
| Relationships persistence? | Additive relationship entity if no equivalent exists |
| Pagination? | Signed keyset cursor |
| Exact totals? | Deferred |
| Contact deletion? | Archive only |
| Performance pass signal? | Explicit functional usable marks, never network idle |
| Old light-pass patch? | Legacy-only; do not implement |

## 11.3 Unresolved decisions requiring confirmation or schema readback

### Blocking before implementation completes

1. **Canonical URL and redirect plan**  
   Confirm `/one-time/app/crm` versus another owned One Time path. The product boundary is fixed; only the path naming remains open.

2. **Exact current production schema**  
   Perform read-only schema/index inspection for `bna_contacts`, `bna_tasks`, communication timestamps, archive/version columns, and any existing relationship table before writing additive migrations.

3. **Owner directory source**  
   Confirm which current account-user table is authoritative for Shloimie, Rabbi, and future CRM viewers. Do not derive owners from arbitrary task strings.

4. **Legacy lifecycle mapping**  
   Inventory current One Time status values and approve the display/write mapping to the first-release canonical values. Unknown values remain read-only until mapped.

5. **Relationship vocabulary**  
   Approve the initial relationship labels and identify which current member/student/signup links are sensitive and cannot be unlinked by Rabbi CRM Admin.

6. **Legacy-only lead edit behavior**  
   Confirm whether editing a `bna_parent_leads`-only record should always materialize a canonical `bna_contacts` row or remain a compatibility adapter until a later backfill.

7. **Production query plans and data volume**  
   Record row counts, index state, and `EXPLAIN` evidence. This determines whether the proposed indexes are sufficient; it does not change the user-facing performance gates.

### Non-blocking product decisions

8. **Hebrew translation timing**  
   Layout is RTL-safe in release one; decide whether Hebrew copy ships in the same release.

9. **Restore archived contact**  
   Archive is required. Restore may remain deferred unless product operations require it immediately.

10. **Copy email/phone actions**  
    Decide whether release one includes clipboard-only copy controls. It still must not include send/compose.

11. **Communication channel filters**  
    Initial contract includes All, Email, WhatsApp, Internal note. Add other channels only when they have real scoped records and readable labels.

12. **Field RUM sufficiency**  
    Synthetic performance can gate release. Production field verification remains `RUM pending` until sample size is adequate.

## 11.4 Release recommendation

Proceed only with a vertical implementation packet that owns:

```text
new standalone CRM entry and assets
new screen-oriented One Time CRM API façade
bounded list/detail/relationship/communication/task repositories
additive relationship/version/archive/task-link migrations as needed
standalone responsive components and account-shaped RBAC
explicit usable-state performance instrumentation
focused contract, browser, API, schema, and performance tests
```

It must not own or modify the old Operations CRM light-pass as the new product solution.

---

## Contract close

The smallest complete first release is therefore:

```text
One standalone One Time CRM list
+ one real contact overview
+ create/edit/local notes/follow-up/tags/owner/lifecycle
+ durable relationships
+ read-only communication history
+ contact-scoped tasks
+ account-shaped roles
+ bounded screen APIs
+ non-destructive compatibility
+ explicit mobile/desktop states
+ strict request and usable-performance gates
```

Anything broader—mailbox sending, automations, global task management, agents, billing, access grants, bulk tools, or Operations diagnostics—is outside the vertical slice and must not enter its critical path.
