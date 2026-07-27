# A10 — Contacts, consent, audience, and communication-authority audit

**Commit target:** `ops/audits/2026-07-26/parallel-control-tower/A10-result.md`  
**Audit packet date:** 2026-07-26  
**Audit performed:** 2026-07-27, Asia/Jerusalem  
**Repository:** `shloimie-beep/onetimev2`  
**Audit checkpoint:** `e986b5e6502b1168b3eb28e200fd49ac8de46477`  
**Canonical deployed product source recorded by the Board:** `a22009f4dce6bae6b0553ea9007ff40eceaffd25`  
**Mode:** Read-only audit  
**Mutations performed:** none  
**GHL contacts imported or changed:** 0  
**Audiences created, selected, or modified:** 0  
**Messages, proof sends, or canaries sent:** 0  

> Sanitization boundary: this report intentionally omits secrets, private destinations,
> customer or Student data, raw source rows, protected provider identifiers, sender
> addresses, and private content.

---

## 1. Executive verdict

**VERDICT: FAIL-CLOSED PRESERVATION IS CORRECT; A BOARD-ASSIGNED CONSENT-RECONCILIATION LANE IS REQUIRED BEFORE ANY FUTURE IMPORT, AUDIENCE, ENROLLMENT, OR SEND WORK.**

The current Parent/Student/household/access architecture is coherent and accepted:

- GHL owns the adult Parent contact, adult customer conversations, business workflows,
  suppression, and payment operations/history.
- One Time owns households, authentication, access, and local-only Student identities.
- One durable adult-to-household/GHL link joins the systems without creating a child
  contact in GHL.
- One Time stores independent current access-source state, not a payment ledger.

The communication-authority state is not equally ready:

1. `event_service_email` is an accepted, exact, event-scoped permission in the One Time
   application database. It does not create general marketing or newsletter consent.
2. General email consent and newsletter status are separately modeled in GHL. The
   checkpoint does not contain an accepted rule binding their exact combinations into a
   newsletter audience.
3. The current OT-C01 invitation campaign has no authorized nonzero audience and must
   remain unsent.
4. OT-E01 is event-only and currently drifted: the immediate confirmation action is
   disabled, its action identity could not be reverified in the editor, and a fresh
   production signup did not receive the exact registration tag.
5. OT-02A and OT-02B remain empty Draft shells with no approved audience, cadence,
   controlled test, publication, enrollment, or send authority.
6. The historical “approximately 88 adults” and the 207 provider-email-capable contacts
   are not sendable audience counts.
7. A material historical-consent discrepancy blocks reuse of the old local CRM
   `email_campaign_eligible` result: the older importer default-classified whole source
   files as opted in, while a later field-level readback found only a small explicit-true
   subset and a much larger blank/false population.

The safe next move is not implementation or sending. It is a separately assigned,
read-only consent-source reconciliation that produces a sanitized, replayable authority
manifest and an operator decision separating:

- event-service permission;
- current-subscriber service communication;
- general marketing permission;
- newsletter subscription;
- suppression and deliverability;
- contact storage and identity provenance.

---

## 2. Evidence precedence and audit method

The audit applied this precedence order:

1. `ops/goals/OT-LAUNCH-01/BOARD.yaml` at the checkpoint, because the checkpoint explicitly
   makes the Board the only current status map.
2. `SPEC.yaml`, `DECISIONS.yaml`, accepted track handoffs, migrations, source contracts,
   and accepted test evidence.
3. `integrations/highlevel/registry/workflow-registry.yaml` as the editable desired-state
   automation inventory.
4. Sanitized authenticated GHL result files for observed live state.
5. Historical CRM import reports, PR descriptions, and source exports only as historical
   evidence, never as current authority.

The expected `ops/audits/2026-07-26/parallel-control-tower/` result path was checked at
the exact checkpoint. No prior committed result file was retrievable through that exact
path lookup. That is not proof that no later, uncommitted, or differently located audit
exists; this report therefore does not claim such absence.

No GHL, One Time database, provider, contact, audience, workflow, enrollment, or sender
mutation was performed.

---

## 3. Classification summary

### 3.1 NEW FINDING — A10-N1: historical local CRM campaign eligibility is not defensible current send authority

The historical CRM preflight assigned source-level defaults:

- the large “subscribed audience” export defaulted to `opted_in`;
- the detailed legacy-subscriber export defaulted to `opted_in`;
- the 88-row legacy-subscriber export defaulted to `opted_in`.

That classifier produced 1,357 historical `email_campaign_eligible` rows, and the
production CRM apply inserted 1,555 local One Time contacts while queuing zero sends.

A later read-only GHL closeout inspected the marketing-opt-in field in the large
subscribed export and found:

- 82 explicit `true`;
- 49 explicit `false`;
- 1,180 blank.

This is not a minor counting difference. It proves that the older 1,357 eligibility count
was derived from source-file classification rather than a consistently explicit,
row-level marketing-permission value. The historical importer also derived local
communication preferences and a consent-recorded timestamp from that classification.

**Execution impact**

- Do not use the historical local CRM `email_campaign_eligible` count, imported reminder
  preference, import-time consent timestamp, legacy-source membership, or source tag as
  current general-marketing or newsletter authority.
- Do not project those historical derived values into GHL as current consent.
- Do not use them to populate OT-02A, OT-02B, OT-C01, or a newsletter audience.
- Preserve them as historical derived data until a Board-assigned reconciliation either
  proves row-level authority or explicitly quarantines/remediates the projection.
- Event-service permission remains unaffected because its accepted contract forbids
  inference and backfill.

### 3.2 NEW FINDING — A10-N2: “approximately 88 adults” is a legacy row count, not a current deduplicated audience

The exact historical source evidence contains:

- `subscribers.csv`: 88 observed rows;
- 85 duplicate-input rows;
- only 3 rows staged as new in the historical dry run;
- all 88 rows default-classified as opted in by the old source-level rule.

A companion detailed export contained 86 rows and also overlapped the broader source set.

**Execution impact**

“Approximately 88 adults” may describe a legacy export size. It does not prove:

- 88 unique adults;
- 88 current GHL contacts;
- 88 current Parents;
- 88 Parent-household links;
- 88 general-marketing subscribers;
- 88 newsletter subscribers;
- 88 OT-02A members;
- 88 OT-C01 invitees;
- 88 event registrants.

The number must not appear in an execution prompt as an expected send count or import
count.

### 3.3 NEW FINDING — A10-N3: newsletter authority is separately modeled but not fully contracted

The canonical GHL schema has separate facts for:

- general email consent;
- suppression;
- consent policy/version and capture time;
- newsletter status;
- a weekly-newsletter audience marker.

The checkpoint does not contain an accepted decision specifying the exact required
combination of general email consent, newsletter status, newsletter marker, provenance,
and deny gates for a newsletter send.

**Execution impact**

Newsletter eligibility is **UNPROVEN** until a Board decision defines the exact gate.
Neither event registration, `event_service_email`, general lead status, legacy subscriber
status, source tags, attendance, the 207 provider-capable count, nor the mere presence of
the newsletter field/tag authorizes a newsletter.

### 3.4 NEW FINDING — A10-N4: legacy tags and attendance are provenance/segmentation evidence, not permission

The canonical taxonomy distinguishes:

- lifecycle tags;
- migration tags;
- consent/suppression tags;
- source tags;
- event registration tags;
- billing and operational tags.

The historical importer stores source tags and source/header signals as provenance and
segmentation facts. Its recognized signal map does not establish attendance as a
permission class, and the canonical GHL registry contains no attendance-based permission
contract.

**Execution impact**

Legacy tags or attendance may be preserved as historical facts after exact identity
matching. They do not independently permit:

- contact creation in GHL;
- Parent-household linkage;
- Student creation;
- access;
- payment-state inference;
- event-service email;
- general marketing;
- newsletter;
- workflow enrollment;
- a campaign send.

The exact source, meaning, timestamp, and adult identity for any legacy attendance fact
remain **UNPROVEN** unless separately supplied and reconciled.

### 3.5 NEW FINDING — A10-N5: sender readiness and transport readiness are not communication authority

The sender registry defines which identity and provider are appropriate for a message
class. It does not grant permission to contact a person.

A valid send requires all independent gates:

1. exact adult identity;
2. exact message class;
3. exact permission scope;
4. current suppression/DND/unsubscribe/complaint/hard-bounce eligibility;
5. valid address/deliverability;
6. approved audience or event registration;
7. sender authorized for that message class;
8. transport authorized for that message class;
9. workflow/action identity and current state verified;
10. explicit Board/operator send or bounded-canary authority.

**Execution impact**

An active sender, verified domain, valid address, provider-capable contact, Draft
campaign, Published workflow, or transport-ready flag never substitutes for consent,
audience authority, or send authority.

### 3.6 CONFIRMED CURRENT TRUTH — A10-C1: adult Parent is the sole GHL person boundary

- GHL contains adult/Parent contacts and adult customer conversations.
- Student identities stay in One Time.
- No child placeholder, child contact, child marketing record, or Student transcript is
  permitted in GHL.
- Student questions remain local-only unless an approved adult-facing response projection
  is produced through the separate communication contract.

### 3.7 CONFIRMED CURRENT TRUTH — A10-C2: one durable adult-household link joins the systems

The accepted contact-operations migration and implementation provide one durable link
among:

- the One Time adult contact;
- one One Time household;
- the Parent guardian identity;
- the adult GHL contact projection and sync state.

Provider outage may leave the local operation successful with `sync_pending`. That state
does not authorize guessing, creating a Student contact, or inventing a provider match.

### 3.8 CONFIRMED CURRENT TRUTH — A10-C3: payment history and access are intentionally separated

- GHL owns transactions, invoices, subscriptions, refunds, and payment operations/history.
- One Time stores only independent current access-source facts and an effective access
  projection.
- Paid, complimentary, and administrative-suspension facts are independent.
- Suspension denies; otherwise valid paid or complimentary state may grant access.
- Free pilot is an explicit source.
- Access state does not establish payment history or communication permission.
- Payment status does not establish marketing or newsletter consent.

### 3.9 CONFIRMED CURRENT TRUTH — A10-C4: `event_service_email` is exact, contact-scoped, event-scoped permission

The One Time application database is authoritative for append-only and current
event-service permission.

Eligibility requires:

- exact account/product/event;
- exact registration;
- exact adult contact;
- verified registration identity;
- matching normalized email;
- active registration;
- active granted permission with disclosure version and grant time;
- no higher-priority denial.

It permits only the exact event’s registration confirmation and time-bounded reminders.
It does not create:

- general marketing permission;
- newsletter permission;
- another event’s permission;
- WhatsApp permission;
- a public invitation audience;
- Student communication authority.

Existing contacts receive no inferred or backfilled event permission.

### 3.10 CONFIRMED CURRENT TRUTH — A10-C5: denial precedence is fail-closed and overrides positive permission

The accepted evaluator applies denial gates in this order:

1. complaint;
2. hard bounce;
3. global suppression;
4. global DND;
5. global unsubscribe;
6. event withdrawal;
7. event cancellation;
8. missing, archived, ambiguous, invalid, or mismatched identity;
9. missing or inactive event permission.

A positive permission, source tag, sender, event registration, valid address, or workflow
state cannot override a higher-priority denial.

### 3.11 CONFIRMED CURRENT TRUTH — A10-C6: current workflow states remain non-sendable except for the constrained event contract, which is drifted

- OT-02A: empty Draft shell; no approved audience/cadence/test/enrollment/publication.
- OT-02B: empty Draft shell; no approved audience/cadence/content/test/enrollment/publication.
- OT-C01: Draft, unscheduled, zero recipients/sends, no selected audience, zero eligible
  under the exact saved selector, invitation send authority withdrawn.
- OT-E01: exact event-only contract exists, but current live state is DRIFTED because the
  immediate confirmation action is disabled and could not be reverified. A fresh signup
  did not receive the exact registration tag and created no new enrollment.

Historical OT-E01 canary success does not override current drift.

### 3.12 SUPERSEDED/HISTORICAL

The following may be retained as evidence but must not drive current execution:

- the earlier 1,357 local CRM `email_campaign_eligible` result;
- the source-level default that classified whole subscriber files as opted in;
- the 88-row and 86-row legacy subscriber export sizes;
- the interpretation of 207 provider-email-capable contacts as a sendable audience;
- earlier OT-C01 invitation send authorization;
- campaign-seed or migration-send expectations from historical PR descriptions;
- historical OT-E01 canary success without current action-identity readback;
- legacy source, lifecycle, subscriber, attendance, or event tags used as consent;
- historical local CRM contact creation used as proof of a current Parent-household link.

### 3.13 UNPROVEN

At the checkpoint, the following are unproven:

- any nonzero current OT-C01 invitation audience;
- any current newsletter audience;
- any exact current set of “approximately 88 adults”;
- whether historical local CRM derived consent fields were later remediated row by row;
- any attendance-based permission;
- an exact OT-02A rule for when `service_only_current_subscriber` may receive migration
  communication;
- OT-02A cadence, content acceptance, controlled test, enrollment, publication, or send
  authority;
- OT-02B exact audience snapshot, cadence, content acceptance, controlled test,
  enrollment, publication, or send authority;
- current OT-E01 immediate-action identity and enablement;
- a working production application-to-GHL exact registration-tag projection;
- any permission inferred from the 207 provider-capable count;
- any Student identity in GHL.

---

## 4. Canonical fact-to-authority matrix

### 4.1 Identity, household, payment, and access

| Fact | Authoritative system | Classification | What it permits | What it explicitly does **not** permit |
|---|---|---|---|---|
| Adult Parent contact | GHL for adult CRM/conversations; One Time for the local contact and durable link | CONFIRMED CURRENT TRUTH | Adult identity, adult customer conversation, support/business routing, adult-only provider projection | Student identity, household membership by itself, access, payment history reconstruction, event permission, marketing, newsletter, workflow enrollment, send |
| Local Student identity | One Time only | CONFIRMED CURRENT TRUTH | Student authentication, sibling-scoped portal/content/progress/questions, secure adult-authorized recovery | GHL contact, child placeholder, child marketing record, GHL conversation transcript, payment record, direct campaign audience |
| Household | One Time only | CONFIRMED CURRENT TRUTH | Parent/Student relationship and household-scoped access | Consent, payment history, marketing audience, GHL child records |
| Adult-household-GHL link | One Time durable link plus GHL adult projection | CONFIRMED CURRENT TRUTH | Exact adult-to-household association, authorized “Open in GHL,” sync state, bounded reconciliation | Guessing a provider identity, full contact polling, Student projection, consent, access, payment, send |
| Payment history | GHL | CONFIRMED CURRENT TRUTH | Billing operations, transaction/invoice/subscription/refund truth, source input to current access | One Time payment ledger, Student contact, marketing/newsletter consent, event permission |
| Current access-source state and effective projection | One Time | CONFIRMED CURRENT TRUTH | Parent/Student application authorization according to paid/complimentary/suspension precedence | Payment-history reconstruction, invoice/charge/refund truth, GHL audience, email permission |
| Historical local CRM contact | One Time historical CRM import | SUPERSEDED/HISTORICAL for communication authority | Contact storage, provenance, manual review, possible future adult identity reconciliation | Automatic Parent role, household link, access, payment, event permission, general marketing, newsletter, GHL import, send |
| Provider-email-capable contact | GHL/provider readback | CONFIRMED deliverability fact only | Indicates an address/provider can technically attempt email after all other gates | Consent, valid current permission, audience membership, newsletter, event permission, send authority |

### 4.2 Permission, suppression, source, and attendance

| Fact | Authority/state | Classification | What it permits | What it explicitly does **not** permit |
|---|---|---|---|---|
| `event_service_email` | One Time application DB, exact event/registration/contact | CONFIRMED CURRENT TRUTH | Exact event registration confirmation and time-bounded reminders, subject to deny recheck | General marketing, newsletter, invitation campaign, another event, WhatsApp, Student email |
| General email consent | Shared canonical GHL/One Time projection with provenance required | CONFIRMED schema; current audience UNPROVEN | Only Board-approved general-marketing message classes after exact provenance and deny gates | Newsletter by itself, event-service permission, security tokens, Student contact, send authority by itself |
| `service_only_current_subscriber` | Canonical email-consent value | CONFIRMED schema; OT-02A use UNPROVEN | Only a specifically approved service message after an explicit decision defines scope | General nurture, newsletter, broad invitation, promotional sequence by default |
| Newsletter status | Separate canonical field plus newsletter marker | CONFIRMED schema; exact gate UNPROVEN | Nothing executable until an accepted rule defines required state, consent, provenance, and deny gates | Newsletter from event registration, lead status, legacy subscription, attendance, source tag, general consent alone |
| Suppression | Shared current fact; higher priority than marketing | CONFIRMED CURRENT TRUTH | Blocks the affected channel or all marketing according to scope | It never grants communication |
| DND | Current provider/contact preference | CONFIRMED CURRENT TRUTH | Blocks email when active | It never grants communication |
| Unsubscribe | Current global/channel denial | CONFIRMED CURRENT TRUTH | Blocks the governed email scope | It never grants communication |
| Complaint | Highest-priority denial | CONFIRMED CURRENT TRUTH | Blocks email | Positive consent, sender state, or event registration cannot override it |
| Hard bounce | Highest-priority deliverability denial | CONFIRMED CURRENT TRUTH | Blocks email | A different campaign, sender, or workflow cannot override it without a governed clear event |
| Valid email/address capability | Provider/contact fact | CONFIRMED CURRENT TRUTH | Satisfies one deliverability prerequisite | Consent, audience, Parent status, newsletter, send |
| Source tag | Provenance/segmentation | CONFIRMED CURRENT TRUTH | Records where the adult record came from | Consent, Parent-household link, Student creation, access, payment, audience, send |
| Lifecycle tag/status | Routing/segmentation | CONFIRMED CURRENT TRUTH | Supports exact workflow stop/route conditions when contractually defined | Consent, newsletter, event permission, payment history, access by tag alone |
| Event registered tag | GHL projection of exact One Time event registration | CONFIRMED contract; current production handoff DRIFTED | Triggers OT-E01 only when exact event permission and deny gates also pass | General marketing, newsletter, OT-C01, manual fallback send |
| Legacy subscriber/member tag | Historical provenance | SUPERSEDED/HISTORICAL for permission | May support manual identity review or future migration classification | Current consent, newsletter, OT-02A enrollment, OT-C01 audience, send |
| Attendance | No accepted current permission contract | UNPROVEN | At most a historical activity fact after exact source/identity proof | Any communication permission, GHL contact creation, household/access/payment inference, workflow enrollment, send |
| Sender active/ready | Sender registry | CONFIRMED operational fact | Allows an already authorized message class to use that sender | Audience, consent, suppression override, workflow activation, send authorization |
| Transport ready | Resend or GHL capability | CONFIRMED operational fact | Allows an already authorized message to use the correct transport | Person-level permission, audience, sender authority, send authorization |

---

## 5. Workflow and audience authority matrix

| Asset | Current state | Required audience/permission | What it permits now | What it explicitly does **not** permit now |
|---|---|---|---|---|
| OT-02A — Existing Subscriber Migration 2026 v1 | `DRAFT_SHELL`; empty; no enrollment; no publication | Explicitly approved existing-subscriber migration segment; exact decision on service versus marketing eligibility; deny recheck before every message | Preservation and read-only contract review | Import, audience creation, enrollment, cadence invention, content invention, proof send, publication, customer send |
| OT-02B — New Lead Nurture v1 | `DRAFT_SHELL`; empty; no enrollment; no publication | Canonical new leads with explicit general email consent, no suppression/DND/unsubscribe/complaint/hard bounce, exact content/cadence | Preservation and read-only contract review | Using existing subscribers, event registrants, provider-capable contacts, newsletter-only contacts, Students, proof send, publication, customer send |
| OT-C01 — Tisha B’Av Warm Invitation | Draft, unscheduled, zero selected recipients, zero sends; exact selector returns zero; send authority withdrawn | Independently permissioned deduplicated adults; valid email; explicit general email opt-in with provenance; all deny gates clear; no Students; registered-event exclusions as applicable | Read-only classification and preservation | Selecting the saved selector, creating a substitute audience, using 88/207/file-union counts, proof send, schedule, campaign send, WhatsApp |
| OT-E01 — Registered Event Confirmation and Reminders | Published but `DRIFTED`; immediate action disabled; fresh signup not tagged/enrolled | Exact active event registration plus active `event_service_email`, verified identity, deny gates clear, idempotent active run | Read-only reconciliation; preservation of the accepted event-only contract | General marketing/newsletter inference, manual tag/enrollment, fallback email, action re-enable without identity proof, duplicate registration, WhatsApp, broad send |

---

## 6. Sender and transport matrix

No sender address or protected provider identifier is reproduced here.

| Sender key | Provider | Authorized message classes | Current operational state | Explicitly not authorized |
|---|---|---|---|---|
| `office` | GHL | Support, billing/access help, complaints, cancellations/refunds, Parent administration | Active | Warm campaigns, Torah newsletter, Rabbi-personal answer, account-security token, permission inference |
| `brand` | GHL | Neutral signup/program/portal/event/class/content/receipt/support notices | Active | Account-security token, Rabbi-personal answer, audience or consent creation |
| `rabbi_campaign` | GHL | Approved warm enrollment, migration, nurture, Torah newsletter, Rabbi-authored teaching/event invitation | Active phase-one identity; preferred identity still gated | Any send without exact audience/permission/deny gates and separate send authority; account-security token; support/billing reply |
| `rabbi_personal` | GHL | Rabbi-authored Torah answer and follow-up | Pending mailbox/reply acceptance | General support, billing/access operations, broad campaign, account security |
| `account_security` | Resend | Activation/setup, password reset, verification, administrator login challenge, security notice | Runtime sender exists; preferred address still gated | Marketing, newsletter, event invitation/reminder, GHL customer conversation |

### Transport boundary

**Resend**

- owns token-bearing authentication and security delivery;
- may not be used to bypass GHL audience, suppression, or campaign governance;
- may not send marketing, newsletter, or event campaign messages.

**GHL**

- owns adult customer communications, replies, business workflows, support, and governed
  campaign/service messages;
- may not send account-security tokens;
- may not contain Student identities or child transcripts;
- may not infer permission from provider capability, tags, attendance, or sender readiness.

---

## 7. Historical counts and their permitted interpretation

| Historical/current count | Supported meaning | Not supported |
|---|---|---|
| 88 legacy subscriber rows | One historical source file contained 88 rows | 88 unique/current adults, Parents, GHL contacts, household links, or sendable subscribers |
| 85 duplicate rows within that 88-row source’s cross-source classification | The 88-row source substantially overlapped other approved sources | Treating the source as a standalone audience |
| 3 staged-new rows from the 88-row source | Historical dry-run result after dedupe | Current GHL import count or current permission |
| 86 detailed subscriber rows | Companion historical export | A separate 86-person audience without identity reconciliation |
| 1,555 local CRM contacts inserted | Historical One Time CRM import applied; zero sends queued | GHL contact creation, Parent-household linkage, access, current consent, audience |
| 1,357 historical `email_campaign_eligible` | Result of the older source-default classifier | Defensible current marketing/newsletter authority |
| 82 explicit marketing-opt-in true / 49 false / 1,180 blank in the later field-level readback | File-level evidence that explicit values differ materially from the old source default | A deduplicated, suppression-cleared, live GHL audience |
| 207 provider-email-capable contacts | Address/provider delivery capability only | Consent, invitation authority, newsletter, OT-02A/OT-02B membership |
| 1,415 historical source-union identities and 1,312 file-only candidates after downloaded exclusions | Historical file reconciliation counts | Imported/current GHL contacts, live eligibility, send authorization |
| 0 OT-C01 exact-selector eligible contacts | Current read-only saved-selector result | Permission to loosen gates or substitute a broader source |
| 1 active / 2 historical OT-E01 enrollments | Historical/live workflow counters for the exact asset | A working current signup handoff or enabled immediate confirmation |

---

## 8. Required execution order

1. **Preserve current fail-closed state.**
   - OT-02A and OT-02B remain empty Drafts.
   - OT-C01 remains Draft, unselected, unscheduled, and unsent.
   - OT-E01 remains untouched until exact action identity and upstream tag projection are
     separately proven.
   - No historical contact or audience count is promoted into current authority.

2. **Assign one consent-source reconciliation track on the Board.**
   - It must be read-only against production systems.
   - It may use protected inputs but commit only sanitized hashes, counts, classifications,
     and proof.
   - It must not modify historical contact rows while determining truth.

3. **Obtain an operator decision for communication scopes.**
   - Define current-subscriber service communication.
   - Define general marketing.
   - Define newsletter subscription.
   - Define whether and how a service-only subscriber may enter OT-02A.
   - Preserve event-service permission as a separate exact scope.

4. **Produce a no-write adult-contact import/link manifest.**
   - Adult-only.
   - No Student GHL records.
   - No access/payment/consent inference.
   - Source tags and attendance remain provenance only.
   - Every ambiguous identity or permission goes to manual review.

5. **Produce read-only audience classifications.**
   - Separate OT-02A, OT-02B, newsletter, and OT-C01.
   - No saved audience, contact tag, workflow enrollment, or campaign selection.
   - Zero is a valid result and must not be “fixed” by loosening gates.

6. **Handle OT-E01 in a separate source-and-GHL repair lane.**
   - First prove the application produces the exact event tag from exact permission.
   - Then reverify the disabled action identity.
   - Only a separately authorized operator-owned canary may follow.
   - No broad/customer send is part of this audit’s recommendation.

7. **Require a new explicit Board/operator authorization before any mutation or send.**
   - A completed audit or nonzero count is not send authority.

---

## 9. Recommended task packets

| Task | Dependency | Owner / writer slot | Exact write scope | Stop condition | Required proof | Board assignment required |
|---|---|---|---|---|---|---|
| A10-T0 — Preserve fail-closed GHL state | None | Conductor oversight; no GHL writer action unless unexpected mutation is observed | No write. Preserve OT-02A/B empty Drafts, OT-C01 Draft/unsent, OT-E01 untouched | Stop immediately if live state differs from recorded exact assets; return drift only | Sanitized exact-name/kind/status/count readback; zero mutation/send | No new assignment for no-op preservation; Board update only if drift appears |
| A10-T1 — Consent-source authority reconciliation | Immutable approved source hashes; checkpoint evidence; protected access to source fields | New One Time data-governance source lane; not the GHL sole writer | Read-only parser/report. Explicit row-level channel/scope/provenance/timestamp/policy classification; sanitized output only | Any missing source hash, ambiguous adult identity, Student/minor signal, conflicting consent/suppression, missing original permission evidence, or raw-data leakage | Replay-stable hashes and counts; explicit true/false/blank buckets; dedupe; deny reasons; zero DB/GHL/provider writes; zero sends | Yes |
| A10-T2 — Communication-scope operator decision | Accepted A10-T1 report | Operator decision; Conductor is sole Board/DECISIONS writer | `DECISIONS.yaml`, `SPEC.yaml`, and acceptance language only. Define service-only, general marketing, newsletter, and event-service scopes | No explicit decision or any attempt to treat source membership/attendance as permission | One immutable decision ID; validators; no contact/provider mutation | Yes |
| A10-T3 — Historical-consent quarantine/remediation design | A10-T1 and A10-T2 | Assigned One Time data writer, design/read-only first | Exact migration/remediation plan only; identify derived historical fields, preserve audit history, define append-only corrections; no production apply in the same task | Cannot prove affected rows from immutable batch/fingerprints; remediation would erase history; rollback/replay proof absent | Counts-only impact manifest, migration safety review, idempotency design, rollback proof plan, zero apply/send | Yes |
| A10-T4 — Adult-only import and link dry run | A10-T1 accepted; A10-T2 decision; current contact/household snapshot | Assigned import-preflight writer | Sanitized no-write manifest for adult contact storage, dedupe, optional exact Parent-household link, provider sync state, provenance, suppression | Student/child record, ambiguous guardian, provider identity guess, payment/access/consent inference, identity conflict | `would_create/link/update/skip/manual_review` counts; stable fingerprints; no raw PII; zero writes/sends | Yes |
| A10-T5 — Read-only GHL audience classifications | A10-T1/T2/T4; exact current fields and asset inventory | Sole GHL writer in read-only mode | Preview/classify OT-02A, OT-02B, newsletter, and OT-C01 separately; do not save/select/enroll | Missing exact field/tag readback, any Student, unknown consent, suppression ambiguity, nonzero audience produced by inferred source defaults | Exact ALL/ANY logic, per-gate counts, dedupe, exclusions, zero GHL mutations/sends | Yes |
| A10-T6 — OT-E01 application handoff and action-identity repair | Accepted event-permission source; exact app-to-GHL projection task; action controls render; operator canary authorization | One app source writer, then one sole GHL writer; non-overlapping scopes | App source/test first. GHL action re-enable only after exact identity readback. One operator-owned canary maximum in a later authorized subtask | Exact tag not produced; permission mismatch; action subject/sender/body/link cannot be rendered; duplicate active run; deny gate; canary authorization absent | Source tests, exact tag/outbox readback, action identity, save/reopen, one idempotent operator canary, no marketing permission created, zero broad sends | Yes |

No task above authorizes a production import, audience creation, enrollment, campaign selection,
workflow publication, proof send, customer send, or historical-data rewrite.

---

## 10. Exact future prompts — fail-closed and no-send

### Prompt A10-P1 — Consent-source authority reconciliation

```text
TASK: A10-CONSENT-SOURCE-AUTHORITY-RECONCILIATION
MODE: READ-ONLY / NO IMPORT / NO AUDIENCE / NO SEND

First resolve the current canonical Board through ops/goals/CURRENT.yaml and pin the
immutable repository commit used for this run. Compare it with A10 checkpoint
e986b5e6502b1168b3eb28e200fd49ac8de46477. Do not use copied status from a historical
report or PR description.

Inspect only operator-approved, immutable-hash-matched source files and read-only current
One Time/GHL projections. Produce no raw names, emails, phones, notes, message bodies,
private destinations, provider IDs, or Student data.

For each deduplicated ADULT identity, classify these scopes independently:
1. contact_storage_only
2. event_service_email for one exact event/registration/contact
3. current_subscriber_service_only
4. general_email_marketing
5. newsletter
6. suppressed_or_denied
7. manual_review

Rules:
- Never default consent from a filename, list membership, “subscriber,” “member,”
  “follower,” attendance, legacy tag, lifecycle tag, valid address, provider capability,
  payment status, access, event registration, or prior campaign eligibility.
- Explicit positive permission requires an exact source field/value, original capture
  timestamp, permission scope/channel, policy or disclosure version, source owner, and
  exact adult identity.
- Missing or blank evidence means unknown, not opted in.
- Conflicting evidence means manual_review and no communication eligibility.
- Apply denial precedence before any positive eligibility:
  complaint; hard bounce; global suppression; global DND; global unsubscribe; then
  event withdrawal/cancellation and identity/permission checks for event mail.
- Preserve event_service_email as event-only. It must never become marketing or
  newsletter consent.
- Exclude every Student/minor identity from GHL and audience outputs.
- Treat the historical 88-row source, the historical 1,357 campaign-eligible result,
  the 207 provider-capable count, source tags, and attendance only as evidence inputs,
  never expected output counts.

Return:
- immutable input fingerprints;
- deduplicated counts by source and permission scope;
- explicit true / explicit false / blank / conflict counts;
- suppression and denial counts by reason;
- identity-conflict/manual-review counts;
- a sanitized authority-manifest hash;
- replay comparison against a second run;
- confirmation: database_writes=0, ghl_mutations=0, audiences_created=0,
  contacts_enrolled=0, messages_sent=0.

STOP if any source hash differs, source ownership is unclear, raw data would enter Git,
an adult identity is ambiguous, a Student/minor signal appears, or explicit permission
cannot be proven.
```

### Prompt A10-P2 — Adult-only import and household-link dry run

```text
TASK: A10-ADULT-CONTACT-IMPORT-AND-LINK-DRY-RUN
MODE: DRY RUN ONLY / NO DATABASE APPLY / NO GHL MUTATION / NO SEND

Dependencies:
- accepted A10 consent-source reconciliation manifest;
- accepted Board decision defining service-only, general marketing, newsletter, and
  event-service scopes;
- immutable current One Time contact/household/link snapshot;
- immutable current GHL adult-contact snapshot.

Build a sanitized, replayable would-change manifest only.

For each exact deduplicated adult:
- classify would_create_local_contact, would_match_local_contact, would_match_ghl_adult,
  would_create_parent_household_link, would_update_provenance_only, would_skip,
  identity_conflict, or manual_review;
- require an exact adult identity match before linking a household or GHL contact;
- allow local success with sync_pending only as a proposed state when a provider match is
  absent; never guess or create a provider identity in this task;
- preserve source tags and attendance only as historical provenance;
- do not infer Parent role from contact existence alone;
- do not create a Student, child placeholder, child GHL contact, child marketing record,
  payment record, access grant, complimentary grant, event permission, marketing
  permission, newsletter permission, or workflow enrollment;
- do not overwrite a current suppression or denial;
- do not change payment or access state.

Return counts, stable fingerprints, collision reasons, and a second-run replay comparison.
Include confirmation: local_writes=0, ghl_mutations=0, student_contacts=0,
access_changes=0, payment_changes=0, audiences_created=0, messages_sent=0.

STOP on any ambiguous identity, guardian mismatch, Student/minor row, source-hash drift,
permission conflict, provider-ID guess, private-content field, or nonzero mutation.
```

### Prompt A10-P3 — OT-02A migration audience classification

```text
TASK: A10-OT-02A-MIGRATION-AUDIENCE-CLASSIFICATION
MODE: READ-ONLY / DO NOT SAVE AUDIENCE / DO NOT ENROLL / DO NOT SEND

Resolve the current Board and exact OT-02A asset by canonical key and kind. Confirm that
the workflow remains the unique empty Draft shell before classification.

Require an explicit Board decision ID defining whether the approved migration message
class is:
A. current-subscriber service-only; or
B. general marketing.

If the decision is absent, STOP with PERMISSION_MODE_UNDEFINED.

Classify only exact deduplicated ADULT existing subscribers whose identity and current
subscriber status are proven.

For mode A:
- require the exact approved service-only scope and message/cadence contract;
- do not reuse that authority for nurture, newsletter, invitation, or other marketing.

For mode B:
- require explicit general_email_marketing permission with source, original timestamp,
  policy/version, and no denial.

For both modes:
- apply complaint, hard-bounce, suppression, DND, and unsubscribe exclusions before
  inclusion;
- exclude Students/minors, identity conflicts, unknown permission, activated/current
  accounts when the approved migration contract says to exit, operator/test contacts,
  duplicates, and every source-tag-only or attendance-only candidate;
- do not use the historical 88, 207, 1,357, 1,415, or 1,312 counts as targets.

Return sanitized included/excluded counts by exact reason and a manifest hash.
Do not create or select a GHL audience, apply a tag, enroll a contact, configure cadence
or content, publish, run a canary, or send.

STOP if the asset is not the exact Draft shell, permission mode is undefined, source
provenance is incomplete, or any denial/identity state is unavailable.
```

### Prompt A10-P4 — OT-02B new-lead nurture audience classification

```text
TASK: A10-OT-02B-NEW-LEAD-AUDIENCE-CLASSIFICATION
MODE: READ-ONLY / DO NOT SAVE AUDIENCE / DO NOT ENROLL / DO NOT SEND

Resolve the current Board and exact OT-02B asset by canonical key and kind. Confirm the
workflow remains the unique empty Draft shell.

Include only deduplicated ADULT new leads with:
- exact adult identity;
- canonical new-lead source and lifecycle state;
- explicit general_email_marketing permission;
- original capture timestamp and policy/version;
- active suppression state;
- email DND off;
- no unsubscribe, complaint, or hard bounce;
- valid current email.

Exclude:
- Students/minors;
- existing-subscriber migration members;
- event_service_email-only registrants;
- newsletter-only records;
- source-tag-only, attendance-only, legacy-member-only, or provider-capable-only records;
- checkout_started, Active, opted-out, suppressed, identity-conflict, operator/test, and
  duplicate records.

Return sanitized included/excluded counts by gate and a manifest hash.
Do not create/save an audience, mutate contacts/tags/fields, configure content/cadence,
enroll, publish, run a canary, or send.

STOP if exact content/cadence permission is absent, any gate cannot be read, or the result
requires inferred consent.
```

### Prompt A10-P5 — Newsletter audience contract and classification

```text
TASK: A10-NEWSLETTER-CONTRACT-AND-READ-ONLY-CLASSIFICATION
MODE: DECISION + READ-ONLY CLASSIFICATION / NO AUDIENCE SAVE / NO SEND

Dependency: accepted operator/Board decision defining the exact newsletter gate.

The decision must specify:
- required one_time_email_consent value;
- required one_time_newsletter_status value;
- whether the weekly-newsletter marker is required, projected, or informational;
- required permission source, capture timestamp, and policy/version;
- treatment of service_only_current_subscriber;
- deny precedence;
- re-subscription and suppression-clear rules;
- sender key and message class;
- unsubscribe behavior.

After the decision exists, classify only deduplicated adults satisfying every required
gate. Exclude Students/minors, event-only contacts, general-marketing-only contacts when
the decision requires separate newsletter subscription, source-tag-only and
attendance-only records, unknown permission, suppression/DND/unsubscribe/complaint/
hard-bounce, identity conflicts, operator/test contacts, and duplicates.

Return a sanitized manifest and per-gate counts.
Do not save/select an audience, mutate newsletter fields/tags, enroll, publish, test, or
send.

STOP if the decision is missing, internally inconsistent, or would infer newsletter
permission from event registration, source membership, attendance, provider capability,
or historical derived campaign eligibility.
```

### Prompt A10-P6 — OT-C01 invitation audience readback

```text
TASK: A10-OT-C01-INVITATION-AUDIENCE-READBACK
MODE: READ-ONLY / CAMPAIGN MUST REMAIN DRAFT / NO AUDIENCE SELECTION / NO SEND

Resolve the current Board and distinguish the OT-C01 Email Marketing campaign from the
same-name workflow wrapper. Verify the campaign is Draft, unscheduled, with zero selected
recipients and zero sends. Do not touch the wrapper.

Classify eligibility only from independently proven adult general-email invitation
authority:
- exact adult identity;
- explicit opted-in general email permission with source, original timestamp, and
  policy/version;
- active suppression state;
- built-in email DND off;
- valid current email;
- explicit opt-in marker consistent with the field;
- consent-unknown marker absent;
- marketing-suppressed marker absent;
- unsubscribe, complaint, and hard bounce absent;
- Student/minor excluded;
- deduplicated;
- operator/test excluded;
- already-registered excluded when the current invitation contract requires it.

Do not infer eligibility from event_service_email, event registration, provider email
capability, sender readiness, source tag, legacy subscriber/member status, attendance,
payment, access, or historical local CRM campaign eligibility.

Return exact sanitized counts for eligible, unknown-permission, denied by each reason,
duplicate, Student/minor, operator/test, already registered, and identity conflict.
A zero result is valid.

Do not save or select an audience, loosen a gate, schedule, seed, proof-send, customer-send,
apply a tag, enroll, or use WhatsApp.

STOP if campaign kind/identity is ambiguous, any gate cannot be read, or current send
authority remains withdrawn.
```

### Prompt A10-P7 — OT-E01 event-registration projection reconciliation

```text
TASK: A10-OT-E01-EVENT-PROJECTION-RECONCILIATION
MODE: READ-ONLY / NO MANUAL TAG / NO ENROLLMENT / NO REPROCESS / NO SEND

Resolve the current Board, the exact OT-E01 workflow, and the accepted
event_service_email source contract.

For one operator-owned synthetic or operator registration only, read back:
- exact One Time adult contact;
- exact event registration;
- verified identity and matching normalized email;
- active event_service_email permission, disclosure version, source, and grant time;
- active denial state for complaint, hard bounce, suppression, DND, unsubscribe,
  event withdrawal, and event cancellation;
- exact outbox projection and idempotency key;
- exact GHL registered-event tag projection;
- OT-E01 enrollment state;
- current immediate-action enabled/disabled state and whether subject, sender, body, and
  link controls render for exact identity verification.

Do not grant/backfill permission, add a tag, enroll a contact, resend/reprocess an outbox
event, re-enable or save an action, duplicate the registration, send a fallback email, or
create newsletter/general-marketing consent.

Return a sanitized causal chain showing the first failing gate.
STOP if action identity does not render, exact permission or identity does not match,
a denial is active, the tag projection is absent, a duplicate active run exists, or a
separate operator-owned canary authorization is absent.

Confirm: ghl_mutations=0, manual_tags=0, enrollments_created=0, reprocesses=0,
messages_sent=0.
```

---

## 11. Acceptance conditions for any later mutable task

A later import, audience, workflow, or send task is not executable unless all applicable
conditions are present in one reviewed Board assignment:

- exact repository and immutable source commit;
- exact asset kind and canonical key;
- exact adult-only population;
- exact identity and dedupe rules;
- exact permission scope and provenance;
- exact newsletter/service/general-marketing distinction;
- exact deny precedence and current readback;
- exact source of contact, household, payment, and access truth;
- exact write scope and sole writer;
- exact stop conditions;
- exact rollback/idempotency behavior;
- exact sanitized proof output;
- bounded operator-owned canary authority, when applicable;
- explicit publication/enrollment/send authority;
- explicit confirmation that Student contacts, raw private content, and protected provider
  values remain excluded.

Absent any one of those, the task must return **BLOCKED** without mutation.

---

## 12. Source list

All repository paths below were inspected at
`shloimie-beep/onetimev2@e986b5e6502b1168b3eb28e200fd49ac8de46477`
unless a distinct accepted component head is stated.

### Canonical control plane

- `ops/goals/CURRENT.yaml`
- `ops/goals/OT-LAUNCH-01/GOAL.md`
- `ops/goals/OT-LAUNCH-01/SPEC.yaml`
- `ops/goals/OT-LAUNCH-01/DECISIONS.yaml`
- `ops/goals/OT-LAUNCH-01/BOARD.yaml`
- checkpoint commit `e986b5e6502b1168b3eb28e200fd49ac8de46477`
- Board-recorded deployed product source
  `a22009f4dce6bae6b0553ea9007ff40eceaffd25`

### Accepted contact/access implementation

- accepted Parent/Student contact-operations head
  `e5e52114828401d575ca2baae35db364e608d91a`
- `ops/goals/OT-LAUNCH-01/handoffs/parent-student-contact-operations--OT-LAUNCH-01-CONTACT-OPS-01.json`
- `packages/db/migrations/2225_parent_student_contact_operations.sql`

### Accepted event permission and dispatcher

- accepted HighLevel application-contract head
  `4540861a7f7ad950041e4ae58202537055fe59ad`
- accepted event-permission head
  `37b83461bb1fed8c0f795234e125b5270d5414c0`
- `packages/domain/src/events/event-email-permission.ts`
- `packages/db/migrations/2227_event_service_email_permission_convergence.sql`

### GHL canonical registries and sanitized live evidence

- `integrations/highlevel/registry/workflow-registry.yaml`
- `integrations/highlevel/registry/sender-registry.yaml`
- `integrations/highlevel/registry/custom-fields.yaml`
- `integrations/highlevel/registry/tag-taxonomy.yaml`
- `integrations/highlevel/registry/communications-contract.json`
- `integrations/highlevel/agent-mode/results/GHL-TISHA-BAV-ACTIVATION-20260722.result.json`
- `integrations/highlevel/agent-mode/results/GHL-GOVERNANCE-CLOSEOUT-20260722.result.json`
- `integrations/highlevel/agent-mode/results/GHL-UI-14-18-20260723.result.json`

### Historical CRM/import evidence

- `scripts/w12-100/data/real-source-preflight.ts`
- `ops/codex-runs/RABBI-DAY-ONE-CRM/crm-corrected-dry-run.json`
- `ops/codex-runs/RABBI-DAY-ONE-CRM/crm-production-apply.json`
- `ops/codex-runs/ONE-TIME-FINISH-NOW/CRM-REAL-DATA-PREFLIGHT-REPORT.md`

Historical import evidence is cited only for provenance and discrepancy analysis. It is
not treated as current Board status or communication authority.

---

## 13. CONTROL-TOWER-RETURN

```yaml
CONTROL-TOWER-RETURN:
  audit_id: A10
  repository: shloimie-beep/onetimev2
  checkpoint: e986b5e6502b1168b3eb28e200fd49ac8de46477
  report_path: ops/audits/2026-07-26/parallel-control-tower/A10-result.md
  mode: read_only
  verdict: FAIL_CLOSED_PRESERVE_AND_ASSIGN_CONSENT_RECONCILIATION
  production_changed: false
  ghl_changed: false
  contacts_imported_or_modified: 0
  student_contacts_created: 0
  audiences_created_selected_or_modified: 0
  workflows_published_or_enrolled: 0
  proof_or_customer_messages_sent: 0
  new_findings:
    - A10-N1 historical local CRM campaign eligibility is not defensible current send authority
    - A10-N2 approximately 88 adults is a legacy row count, not a deduplicated current audience
    - A10-N3 newsletter authority is separately modeled but its exact current gate is unproven
    - A10-N4 legacy tags and attendance are provenance only, not permission
    - A10-N5 sender and transport readiness do not create communication authority
  confirmed_current_truth:
    - adult Parent is the sole GHL person boundary
    - Students are local-only in One Time
    - one durable adult-household-GHL link joins the systems
    - GHL owns payment history and One Time owns current access projection
    - event_service_email is exact event-only permission with no inference or backfill
    - denial precedence overrides every positive permission
    - OT-02A and OT-02B remain empty Draft shells
    - OT-C01 remains Draft, zero-eligible, unselected, unscheduled, and unsent
    - OT-E01 remains event-only but currently DRIFTED
    - 207 provider-email-capable contacts are deliverability-only
  superseded_or_historical:
    - historical 1357 email-campaign-eligible classification
    - source-level default opt-in classification
    - 88-row and 86-row legacy subscriber counts
    - prior OT-C01 send authority
    - historical OT-E01 canary as evidence of current readiness
    - legacy tags or attendance as consent
  unproven:
    - any nonzero current OT-C01 audience
    - any current newsletter audience
    - any exact current set of approximately 88 adults
    - remediation of historical derived consent fields
    - OT-02A service-only permission rule and executable sequence
    - OT-02B executable audience, content, and cadence
    - current OT-E01 immediate-action identity and app-to-GHL registration-tag handoff
  execution_order:
    - preserve fail-closed state
    - Board-assign read-only consent-source reconciliation
    - record operator decision separating service, marketing, newsletter, and event scopes
    - produce adult-only no-write import/link manifest
    - produce separate read-only audience classifications
    - repair OT-E01 only in separately assigned source and sole-GHL-writer lanes
    - require a new explicit mutation/send authorization
  board_assignment_required:
    - A10-T1
    - A10-T2
    - A10-T3
    - A10-T4
    - A10-T5
    - A10-T6
  immediate_safe_action: preserve_current_state_and_assign_A10-T1_only
```
