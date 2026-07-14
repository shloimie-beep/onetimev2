# LEAD-CAPTURE-CONTRACT

**Task ID:** OT-02  
**Audit role:** One Time lead-capture and CRM data-contract auditor  
**Mode:** Read-only  
**Audit date:** 2026-07-14  
**Canonical implementation repository:** `shloimie-beep/bnei-neviim-academy`  
**Repository snapshot audited:** `master` at `cebbfc5781b92fcd9a5014df67f8ae4ba0b3a61c`  
**Canonical workspace:** `rabbi_sheller_provider`  
**Canonical project/program:** `one_time_mishnah_class`  
**Public form route:** `GET /one-time/signup`  
**Public submission route:** `POST /api/one-time/interest`

> The repository named `sdratler/OneTimeOneTime` was empty at audit time and is not the implementation source. This contract is based on the One Time code, migrations, tests, task records, release evidence, and memory records in `shloimie-beep/bnei-neviim-academy`.

## Status vocabulary

- **OBSERVED** — directly represented by the current repository snapshot or current release evidence.
- **REQUIRED** — a binding invariant for the recovered workflow, including requirements that the implementation is intended to satisfy.
- **GAP** — required behavior that is blocked, ambiguous, stale, or not provably enforced.
- **PROHIBITED** — behavior that must not occur.

## Executive contract

The canonical public workflow is:

```text
/one-time/signup
    -> client validation and normalization
    -> POST /api/one-time/interest
    -> server-side One Time scope resolution
    -> server validation and normalization
    -> canonical contact upsert
    -> signup-interest create/upsert
    -> compatibility CRM lead create/update
    -> one capture audit/timeline event
    -> deterministic delivery-outbox enqueue
    -> database commit
    -> HTTP success or duplicate-success
    -> asynchronous email / WhatsApp / internal notification delivery
```

The first public step supports **Family** and **School** interest only. It does not collect or create a student, school organization, member login, password, checkout, payment, access grant, or portal record.

The public form and CRM capture are implemented and have current matrix and dry-run evidence. The required unrestricted public WhatsApp auto-reply is **not currently active**: the latest release record says it remains fail-closed behind `ONE_TIME_PROVIDER_LEAD_BOT_TELEGRAM_CONFIRM`. Owner-only verification is a separate lane and is blocked by missing protected owner-test aliases. Those two recipient classes must never be conflated.

---

# 1. Form-field contract

## 1.1 Customer-visible controls

| Field / control | Exact label and help text | HTML/input type | Required state | Validation and normalization | Conditional visibility or behavior | Database / CRM destination |
|---|---|---|---|---|---|---|
| `contact_name` | Label: **Parent or contact name**. No separate help text. Error: **Enter the parent or contact name.** | `input[type=text]`; `autocomplete=name` | Always required | Trim and collapse surrounding/extra whitespace. Length must be 2–180 characters. | Always visible. | Canonical contact display/name fields in `bna_contacts`; `bna_product_leads.parent_name`; compatibility lead name in `bna_parent_leads`; capture-event metadata. The request also sends the alias `parent_name`. |
| `audience_type=family` | Label: **Family**. Help: **For a parent or family signup.** | Required radio input | One Family/School option is required | Canonical value `family`; server normalizes to display value `Family`. | Always visible; mouse, touch, Enter, and Space must activate the underlying radio. | `family_school_classification=family`, `audience_type=family`, `signup_as=Family` in lead/contact signup metadata and audit context. |
| `audience_type=school` | Label: **School**. Help: **For a school or class group.** | Required radio input | One Family/School option is required | Canonical value `school`; server normalizes to display value `School`. | Always visible; mouse, touch, Enter, and Space must activate the underlying radio. | `family_school_classification=school`, `audience_type=school`, `signup_as=School` in lead/contact signup metadata and audit context. It does not create a school-organization row at this step. |
| `location` | Label: **Location**. Placeholder: **City, country, ZIP/postal code, or area**. Help: **Type a city, ZIP/postal code, area code, or neighborhood. No city list is required.** Error: **Enter your city or location.** | `input[type=text]`; `autocomplete=address-level2` | Always required | Trimmed free text. A valid resolved IANA time zone must also exist. The current client does not geocode or require a predefined city ID. | Always visible. Input updates hidden city label/name fields. | `bna_product_leads.metadata.city.label/name`; compatibility-lead metadata; canonical-contact signup context; capture-event context. Structured region/country/code remain blank unless supplied or resolved from a legacy known-city mapping. |
| `timezone_fallback` | Label: **Time zone**. Help: **Use an IANA time zone such as America/New_York.** | `input[type=text]` with datalist | Required only when browser time-zone detection fails | Must be a valid IANA time-zone identifier accepted by `Intl.DateTimeFormat` on the client and server. | Hidden and disabled when browser detection succeeds; visible, enabled, and required when it fails. | Canonical `timezone`; city/time-zone metadata; local class-time rendering context. **GAP:** the current inline fallback error copy incorrectly repeats the location error. |
| Local class-time display | Heading: **Class time where you are**. Initial status: **Detecting your time zone...** | Display-only status card | Not submitted by the user | Computes the next daily class instant at 19:00 in `Asia/Jerusalem`, then formats it in the resolved recipient IANA time zone. | Updates after browser detection or manual time-zone input. | The displayed string is not a standalone DB field. The source class schedule and selected time zone are persisted in metadata. |
| `email` | Label: **Email**. Errors: **Enter an email address.** / **Enter a valid email address.** | `input[type=email]`; `autocomplete=email`; `inputmode=email` | Always required | Trim; lowercase; basic address-shape validation on client and server. | Always visible. | Normalized email in `bna_contacts`; `bna_product_leads.parent_email`; compatibility lead email; outbox contact lookup and hashed recipient identity. |
| `phone` | Label: **Phone / WhatsApp**. Conditional help: **Required for WhatsApp reminders.** Error: **Enter a WhatsApp number or choose a different reminder option.** | `input[type=tel]`; `autocomplete=tel`; `inputmode=tel` | Optional for Email or No reminders; required for WhatsApp or Both | Trimmed for storage. Server requires at least one normalized digit sequence when WhatsApp is selected. CRM presentation applies its canonical phone normalizer. | Required marker, help, `required`, and `aria-required` activate only for WhatsApp/Both. Phone errors clear when switching to a non-WhatsApp choice. | `bna_product_leads.parent_phone`; compatibility lead phone; normalized canonical-contact phone. `parent_whatsapp` / top-level `whatsapp` is populated only when a WhatsApp channel is selected. |
| `reminder_preference=email` | Label: **Email reminders**. Help: **Daily class reminders by email.** | Required radio input | One reminder choice is required | Canonical value `email`; recurring channel list is `["email"]`. | Selecting it shows and requires the consent checkbox; it does not require phone. | Reminder preference/channels and consent metadata on contact, signup interest, compatibility lead, and audit event. |
| `reminder_preference=whatsapp` | Label: **WhatsApp reminders**. Help: **Daily class reminders by WhatsApp.** | Required radio input | One reminder choice is required | Canonical value `whatsapp`; recurring channel list is `["whatsapp"]`. | Requires phone and consent. | Same preference destinations; enables the public WhatsApp signup-confirmation outbox event and recurring WhatsApp reminder eligibility. |
| `reminder_preference=both` | Label: **Email and WhatsApp**. Help: **Use both reminder channels.** | Required radio input | One reminder choice is required | Canonical value `both`; recurring channel list is `["email","whatsapp"]`. | Requires phone and consent. | Same preference destinations; enables email and WhatsApp reminder eligibility. |
| `reminder_preference=none` | Label: **No daily reminders**. Help: **Sign up without recurring reminders.** | Required radio input | One reminder choice is required | Canonical value `none`; recurring channel list is empty. | Hides, disables, unchecks, and makes consent non-required. Phone remains optional. | Stores `reminder_preference=none`, empty recurring channel list, no recurring-consent timestamp, and no recurring reminder eligibility. A one-time transactional email acknowledgement is still queued. |
| `reminder_consent` | Exact copy: **Confirm that we may send the selected class information and reminders.** | `input[type=checkbox]` | Required for Email, WhatsApp, or Both; not required for None | Server accepts only explicit truthy values. On acceptance it records a timestamp and policy version `one-time-class-reminders-v1-2026-07-12`. | Hidden and disabled until a recurring reminder choice is selected. Hidden controls must not be validated or submitted as active consent. | `bna_product_leads.consent`; lead/contact metadata including `reminder_consent_at`, `reminder_consent_policy_version`, and `reminder_consent_acknowledged`; audit context. |
| Submit button | **Sign Up Now**. Submitting copy: **Signing you up…** | `button[type=submit]` | N/A | Does not submit until client validation passes. | Disabled during the in-flight request. Re-enabled after an error. | No direct database field; action is registered as `ACTION-ONETIME-DIRECT-SIGNUP-SUBMIT`. |
| Success panel | Heading: **You're signed up.** Copy: **We saved your information and will send the current class details using your selected option.** | Display-only success state | N/A | Uses the normalized reminder method and location/time-zone values. | Replaces the form after successful or duplicate-success response. | No direct database field. |

## 1.2 Hidden HTML controls

| Field | Type | Source / normalization | Required behavior | Destination |
|---|---|---|---|---|
| `signup_as` | Hidden | Synchronized from Family/School radio; `Family` or `School`. | Must never be trusted over the canonical radio/server normalization. | Signup/contact metadata and compatibility fields. |
| `city_label` | Hidden | Current free-text location. | Blank only before location entry. | City metadata. |
| `city_id` | Hidden | Empty for the current free-text client. Server can still resolve legacy known-city IDs from other callers. | Optional. | City metadata. |
| `city_name` | Hidden | Current free-text location. | Optional only before location entry. | City metadata. |
| `city_region` | Hidden | Empty in the current client. | Optional. | City metadata. |
| `city_country` | Hidden | Empty in the current client. | Optional. | City metadata. |
| `city_country_code` | Hidden | Empty in the current client. | Optional. | City metadata and potential region derivation. |
| `timezone` | Hidden | Browser-detected or manual valid IANA time zone. | Required by the combined location/time-zone contract. | `bna_product_leads.timezone` plus signup/contact metadata. |
| `browser_timezone` | Hidden | Browser-resolved IANA time zone; falls back to the manually entered zone in the payload. | Optional only when detection fails; effective time zone remains required. | Signup/contact metadata and time-zone-source audit context. |

## 1.3 Generated request fields

These are not separately editable controls, but they are part of the public data contract.

| Generated field | Value/source | Destination and rule |
|---|---|---|
| `parent_name` | Alias of normalized `contact_name` | Compatibility with the product-lead and legacy CRM schema. |
| `whatsapp` | Submitted phone only when reminder preference includes WhatsApp; otherwise empty | Product lead WhatsApp field and contact channel context. |
| `audience` | Constant `parents` | Product lead audience. Family and School are classifications inside the parent/contact intake, not separate product audiences. |
| `family_school_classification` | `family` or `school` | Canonical classification metadata and CRM card projection. |
| `region` | Client sends `worldwide`; server can derive a country-code region when available | Product lead region. |
| `source` | `one_time_public_signup` | Source attribution metadata. |
| `idempotency_key` | One browser-page UUID, with a local fallback generator | Signup replay key. It is reused for manual retry during the same page lifetime. |
| `source_landing_page` | `/one-time/signup` | Signup interest and attribution metadata. |
| `signup_mode` | `one_time_class_signup` | Workflow metadata. |
| `signup_acknowledgement` | Mirrors reminder consent in the current client | Accepted by the server as one of several legacy consent aliases. For `none`, it is false. |
| `reminder_consent_ack` | Mirrors reminder consent | Canonical server consent input alias. |
| `location_time_acknowledgement` | `true` | Metadata indicating the local-time display context was presented. |
| `consent` | Mirrors reminder consent | `bna_product_leads.consent` and compatibility input. |
| `notes` | Synthetic Family/School signup description generated by the client | Signup interest notes and CRM context. |
| `metadata.raw_intake_id` | `RAW-20260713-002` | Requirement lineage. |
| `metadata.requirement_id` | `REQ-20260713-901` | Requirement lineage. |
| `metadata.form_version` | `one-time-direct-signup-v3` | Form-version audit. |
| `metadata.class_schedule` | Source zone `Asia/Jerusalem`, class time `19:00`, reminder time `18:30` | Schedule audit only. The server recalculates the actual next instant. |
| `metadata.referrer` | `document.referrer` or empty | Attribution metadata, truncated server-side. |
| `metadata.utm` | Query keys beginning with `utm_`, plus click-ID keys captured by the browser | Attribution metadata. **GAP:** canonical server normalization explicitly enumerates the five standard UTM keys; exact durable treatment of click IDs is not proven. |
| `metadata.timezone_source` | `browser` or `manual_fallback` | Time-zone audit metadata. |

## 1.4 Explicitly excluded fields

The first-step form must not collect or create:

- student name, age, grade, or student account;
- school legal/entity details, roster, administrator account, or organization membership;
- password, magic-link credential, portal login, member record, or access grant;
- product tier selection, checkout, payment method, charge, invoice, or payment link;
- class-link secret or provider credentials;
- internal owner destination;
- internal task assignment.

---

# 2. Family, School, and other lead types

## 2.1 Publicly supported classifications

| Public option | Canonical values | Meaning | First-step records | Records not created |
|---|---|---|---|---|
| Family | `signup_as=Family`; `audience_type=family`; `family_school_classification=family` | A parent/family contact expressing interest in the daily class. | Canonical contact, product signup interest, compatibility CRM lead, audit event, delivery intents. | No student, family household, member, portal, payment, or access record. |
| School | `signup_as=School`; `audience_type=school`; `family_school_classification=school` | A school or class-group contact expressing interest. | The same contact/interest/CRM/audit/outbox model with school classification. | No school-organization entity, roster, student, administrator login, portal, payment, or access record. |

Both options currently set product `audience=parents`. The Family/School distinction is a classification carried in signup metadata and CRM projections.

## 2.2 Broader CRM types that are not public form choices

The first-party CRM model can project broader contact types such as `parent`, `student`, `provider`, `school_interest`, `content_interest`, `group_member`, `accountability_interest`, `friend_non_lead`, `spam_irrelevant`, and `general_contact`. These are supported by the CRM model generally, but the public One Time signup form exposes only **Family** and **School**.

A downstream continuation workflow may later request:

- Family: student identity and family relationship;
- School: school organization, role, and group details.

Those later relationships must link to the existing canonical contact and signup interest. They must not be silently inferred or created during this first step.

---

# 3. Location, time zone, class time, email, and WhatsApp

## 3.1 Location and time zone

1. The customer supplies free-text `location`.
2. The browser attempts to resolve an IANA time zone.
3. When detection succeeds, the manual fallback is hidden and disabled.
4. When detection fails, the manual IANA field becomes visible, enabled, and required.
5. Client validation requires both non-empty location and a valid effective IANA time zone.
6. Server validation independently requires the same.
7. Server resolution order is submitted time zone, browser time zone, then a legacy known-city mapping.
8. The current client does not geocode. For free-text submissions, city region, country, country code, and city ID are normally blank.
9. The current server reports no time-zone mismatch review; `timezone_mismatch` is effectively false in the recovered workflow.

## 3.2 Class-time contract

- Source time zone: `Asia/Jerusalem`.
- Class wall time: 19:00 daily.
- Reminder wall time: 18:30 daily.
- Schedule version: `daily-1900-asia-jerusalem-v1`.
- The server computes one next worldwide class instant and formats it in the recipient's IANA zone.
- Formatting must be daylight-saving-time safe.
- The class join link is server-side only. It must not be submitted by the browser or stored raw in the signup outbox payload.

## 3.3 Email behavior

- Email is required for every public signup.
- Email is trimmed and lowercased.
- A one-time transactional acknowledgement is queued for every valid signup, including `reminder_preference=none`.
- Recurring email reminders are permitted only for `email` or `both` with recorded consent and no suppression.
- An email provider outage must not roll back the lead after the database transaction has committed.
- Sender and reply-to identities are sensitive operational configuration. The current message builder contains literal sender values; the binding contract is that dispatch must resolve the approved sender identity from protected configuration and must not expose it in public request data or audit output.

## 3.4 Optional WhatsApp behavior

- A phone/WhatsApp value is optional for `email` and `none`.
- It is required for `whatsapp` and `both`.
- A submitted phone value does not itself authorize WhatsApp delivery; reminder choice and consent must also permit the channel.
- The public form's immediate WhatsApp confirmation is a public-recipient event.
- Recurring WhatsApp reminders are separate events scheduled for the class reminder instant.
- The public WhatsApp lead-agent auto-reply is a separate interactive bot workflow.
- Internal owner notification is not WhatsApp and must never use the submitter's phone as an internal destination.

---

# 4. Consent and communication preferences

## 4.1 Preference matrix

| Reminder preference | Phone required | Reminder consent required | Immediate email acknowledgement | Immediate WhatsApp confirmation | Recurring email reminder | Recurring WhatsApp reminder |
|---|---:|---:|---:|---:|---:|---:|
| Email | No | Yes | Yes | No | Yes | No |
| WhatsApp | Yes | Yes | Yes | Yes | No | Yes |
| Both | Yes | Yes | Yes | Yes | Yes | Yes |
| No daily reminders | No | No | Yes | No | No | No |

## 4.2 Consent scope

The exact public consent copy is:

> Confirm that we may send the selected class information and reminders.

The recorded consent contract is:

- channel-specific through the selected reminder preference;
- versioned by `one-time-class-reminders-v1-2026-07-12`;
- timestamped only when recurring consent is required and explicitly given;
- not required for `none`;
- independent from internal operational notification;
- subject to later suppression such as unsubscribe, stop, invalid address, bounced address, wrong number, or do-not-contact.

Transactional acknowledgement of the requested signup is distinct from recurring reminder consent. The implementation must not reinterpret reminder consent as consent for marketing, unrelated programs, portal creation, payment, or cross-workspace communication.

## 4.3 Suppression precedence

A channel must not be dispatched when the canonical contact or signup context indicates a blocking state, including:

- email unsubscribed, suppressed, invalid, or bounced;
- WhatsApp stop, suppressed, invalid, or wrong number;
- contact-level do-not-contact;
- archived/suppressed contact;
- paused or canceled class for scheduled reminders.

Suppression wins over an earlier reminder selection.

---

# 5. Submission state machine

```text
idle
  |
  | submit
  v
validating
  |---------------- invalid ----------------> idle_with_errors
  |
  | valid
  v
submitting
  |---------------- success, new -----------> success
  |---------------- success, duplicate -----> duplicate_success
  |---------------- HTTP 400 field errors --> idle_with_errors
  |---------------- network / 5xx ----------> error_retryable
  |
error_retryable
  | manual resubmit using same page key
  v
validating

success and duplicate_success are terminal for the current page.
```

## 5.1 State details

| State | Required behavior |
|---|---|
| `idle` | Form is editable; submit button enabled; no request in flight. |
| `validating` | Clear stale status; run client rules; update conditional fields; render all field errors; scroll and focus the first visible invalid control. No HTTP request may be made when invalid. |
| `submitting` | Set `isSubmitting`; disable submit; show **Signing you up…**; send exactly one JSON request. Concurrent click/touch/keyboard submissions are ignored. |
| `success` | Set `signupSucceeded`; hide form; show and focus success panel; render normalized reminder method and location/time zone. |
| `duplicate_success` | Same terminal presentation as success in the current UI. The API must set `duplicate_submission=true` and return the original canonical keys. **GAP:** the current browser does not distinguish duplicate success visually. |
| `idle_with_errors` | Preserve all user entries; render server or client field errors; focus the first invalid field; allow correction and retry. |
| `error_retryable` | Show a non-sensitive error; restore button and original label; preserve fields; allow manual retry with the same page-lifetime idempotency key. |
| `retry` | There is no automatic browser retry or backoff. The customer initiates retry. Provider delivery retries occur asynchronously in the outbox worker, not in the browser. |

The page creates one idempotency key per page lifetime. Reloading the page creates a new key, so server-side canonical-contact and normalized-identity deduplication must also protect against cross-session duplicate submission.

---

# 6. API contract

## 6.1 Endpoint and scope

```http
POST /api/one-time/interest
Content-Type: application/json
```

- Public and unauthenticated by design.
- The server, not the request, resolves `rabbi_sheller_provider` / `one_time_mishnah_class`.
- The internal alias handler `/api/bna/product-leads` exists for compatibility, but the public form contract is `/api/one-time/interest`.
- The API must not depend on an Operations page, CRM workbench, or browser session being loaded.
- **GAP:** no explicit route-specific rate-limit policy or threshold was found in the inspected contract evidence. Rate limiting must not be claimed as active until a documented middleware/configuration and test exist.

## 6.2 Canonical request example

All values below are synthetic placeholders.

```json
{
  "parent_name": "<SYNTHETIC_CONTACT_NAME>",
  "contact_name": "<SYNTHETIC_CONTACT_NAME>",
  "email": "<SYNTHETIC_EMAIL>",
  "phone": "<SYNTHETIC_WHATSAPP_E164_OR_EMPTY>",
  "whatsapp": "<SYNTHETIC_WHATSAPP_E164_OR_EMPTY>",
  "audience": "parents",
  "audience_type": "family",
  "family_school_classification": "family",
  "region": "worldwide",
  "location": "<SYNTHETIC_LOCATION>",
  "city_id": "",
  "city_label": "<SYNTHETIC_LOCATION>",
  "city_name": "<SYNTHETIC_LOCATION>",
  "city_region": "",
  "city_country": "",
  "city_country_code": "",
  "timezone": "America/New_York",
  "browser_timezone": "America/New_York",
  "reminder_preference": "email",
  "reminder_consent": true,
  "source": "one_time_public_signup",
  "idempotency_key": "<UUID>",
  "source_landing_page": "/one-time/signup",
  "signup_mode": "one_time_class_signup",
  "signup_acknowledgement": true,
  "reminder_consent_ack": true,
  "location_time_acknowledgement": true,
  "consent": true,
  "notes": "<SYNTHETIC_GENERATED_NOTE>",
  "metadata": {
    "raw_intake_id": "RAW-20260713-002",
    "requirement_id": "REQ-20260713-901",
    "form_version": "one-time-direct-signup-v3",
    "signup_as": "Family",
    "audience_type": "family",
    "family_school_classification": "family",
    "city": {
      "id": "",
      "label": "<SYNTHETIC_LOCATION>",
      "name": "<SYNTHETIC_LOCATION>",
      "region": "",
      "country": "",
      "country_code": "",
      "timezone": "America/New_York"
    },
    "reminder_preference": "email",
    "reminder_consent": true,
    "reminder_consent_acknowledged": true,
    "reminder_consent_at": "<ISO_TIMESTAMP>",
    "reminder_consent_policy_version": "one-time-class-reminders-v1-2026-07-12",
    "signup_acknowledgement": true,
    "location_time_acknowledgement": true,
    "class_schedule": {
      "source_timezone": "Asia/Jerusalem",
      "class_time": "19:00",
      "reminder_time": "18:30"
    },
    "referrer": "<SYNTHETIC_REFERRER_OR_EMPTY>",
    "utm": {
      "utm_source": "<SYNTHETIC_SOURCE>",
      "utm_medium": "<SYNTHETIC_MEDIUM>",
      "utm_campaign": "<SYNTHETIC_CAMPAIGN>"
    },
    "browser_timezone": "America/New_York",
    "timezone_source": "browser"
  }
}
```

## 6.3 Request requirements

| Field | Requirement |
|---|---|
| `contact_name` or accepted name alias | Required; 2–180 normalized characters. |
| `email` or accepted email alias | Required; valid normalized address. |
| `audience_type` / `signup_as` | Required; Family or School only. |
| `location` / city label | Required. |
| Effective IANA time zone | Required. |
| `reminder_preference` | Required; `email`, `whatsapp`, `both`, or `none`, including documented aliases. |
| Phone/WhatsApp | Required only for `whatsapp` or `both`. |
| Explicit reminder consent | Required only for `email`, `whatsapp`, or `both`. |
| `idempotency_key` | Required by the binding public contract, although the exact write-side uniqueness constraint was not recovered from the base product migration. |
| Workspace/project | Must not be accepted as public authority; server resolves them. |

## 6.4 Success response

```json
{
  "success": true,
  "contact_key": "bna_contacts:<ID>",
  "signup_key": "bna_product_leads:<ID>",
  "confirmation_queued": true,
  "reminder_preference": "email",
  "next_path": "/one-time",
  "duplicate_submission": false,
  "lead": {
    "id": "<PRODUCT_LEAD_ID>",
    "crm_lead_id": "<COMPATIBILITY_LEAD_ID>",
    "contact_key": "bna_contacts:<ID>"
  },
  "crm_lead_id": "<COMPATIBILITY_LEAD_ID>",
  "no_checkout": true,
  "no_access_granted": true
}
```

Semantics:

- `contact_key` identifies the canonical first-party contact.
- `signup_key` identifies the One Time signup-interest record.
- `confirmation_queued=true` means the required delivery intents were committed to the outbox; it does not mean a provider delivered them.
- `duplicate_submission=false` means this request created or materially attached a new signup event.
- `next_path` is advisory. The current browser displays the success panel rather than navigating.
- Legacy identifier fields remain for compatibility.

## 6.5 Duplicate response

```json
{
  "success": true,
  "contact_key": "bna_contacts:<SAME_ID>",
  "signup_key": "bna_product_leads:<SAME_ID>",
  "confirmation_queued": true,
  "reminder_preference": "email",
  "next_path": "/one-time",
  "duplicate_submission": true
}
```

A duplicate must not create another canonical contact, signup interest, compatibility lead, capture event, task, or delivery event. It must return the already-associated identifiers.

## 6.6 Validation-error response

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "field_errors": {
    "email": "Enter a valid email address.",
    "phone": "Enter a WhatsApp number or choose a different reminder option."
  }
}
```

- HTTP status: `400`.
- Field keys are limited to public controls such as `contact_name`, `email`, `audience_type`, `location`, `reminder_preference`, `phone`, and `reminder_consent`.
- The browser renders these errors inline and focuses the first invalid control.
- Server validation remains authoritative even when client validation is bypassed.

## 6.7 Generic error contract

For a database, schema, or unexpected server failure:

```json
{
  "success": false,
  "error": "<NON_SENSITIVE_ERROR>"
}
```

- The browser falls back to **Could not save the signup.**
- No secret, token, provider response body, internal SQL, raw destination, or customer record must be returned.
- **GAP:** a more precise, versioned 5xx error-code and retryability schema was not found.

## 6.8 Dry-run contract

```http
POST /api/one-time/interest?dry_run=true
```

or `dry_run=true` in the JSON body.

A successful dry-run returns the normalized/scoped preview and explicit guardrails that no database write, contact/lead mutation, audit-note creation, provider send, checkout, access grant, or meeting creation occurred.

Dry-run must not be treated as an idempotent production submission and must never enqueue deliverable outbox rows.

## 6.9 Authentication and rate limiting

- Public submission authentication: none.
- Workspace authorization: server-enforced static scope.
- Internal delivery and reminder cron routes: authenticated with `CRON_SECRET`.
- Public request data must never contain `CRON_SECRET` or any provider credential.
- **GAP:** route-specific public submission rate limiting was not evidenced. The contract owner must define and test an abuse-control policy before claiming this property.

## 6.10 Idempotency and retry

Idempotency layers:

1. client in-flight guard;
2. client page-lifetime `idempotency_key`;
3. server replay/upsert behavior;
4. workspace/project-scoped normalized contact matching;
5. deterministic outbox `delivery_key` and `idempotency_key`;
6. worker row claiming with `FOR UPDATE SKIP LOCKED`;
7. dead-letter handling after retry exhaustion.

Browser retry:

- manual only;
- same page-lifetime key;
- values preserved;
- no automatic exponential retry;
- no documented `Retry-After`.

Outbox retry:

- maximum attempts: 5;
- retry delay after successive failed attempts: 5, 10, 20, 40, then 60 minutes, capped at 60 minutes;
- retryable failure remains `failed` with `next_attempt_at`;
- exhausted failure becomes `dead_lettered`;
- missing recipient or unsafe payload is non-retryable;
- returned delivery results redact addresses, phone values, URLs, and message bodies.

---

# 7. CRM mapping and data relationships

## 7.1 Required atomic persistence unit

The binding persistence contract is one database transaction containing:

1. resolve One Time workspace/project/program server-side;
2. normalize identity and communication preferences;
3. create or update the canonical `bna_contacts` record;
4. create or upsert the `bna_product_leads` signup-interest record;
5. create or update the compatibility `bna_parent_leads` CRM lead;
6. link the contact, signup, and compatibility lead identifiers;
7. append one capture communication/timeline event;
8. enqueue the applicable deterministic outbox events;
9. commit;
10. only then return success.

Provider delivery must occur after commit in the outbox worker.

The current task and release evidence describe this model. Because `server.js` is a large monolith and the base product migration does not expose a unique signup idempotency index, the exact transaction and uniqueness enforcement remain items for direct SQL-level verification.

## 7.2 Record map

| Record / table | Role | Key / relationship | Main mapped data |
|---|---|---|---|
| `bna_contacts` | Canonical first-party contact | `contact_key = bna_contacts:<ID>` | Name, normalized email, normalized phone, One Time workspace/project scope, classification, communication preference/consent/suppression context, source/signup context. |
| `bna_product_leads` | One Time signup-interest record | `signup_key = bna_product_leads:<ID>`; linked to canonical contact in current route metadata/relationship context | Parent/contact name, email, phone, WhatsApp, region, audience, time zone, preferred class format, source page, consent, notes, metadata, status. Student fields remain null for this workflow. |
| `bna_parent_leads` | Compatibility CRM lead / existing workbench record | `crm_lead_id`; linked to canonical contact and product signup | Follow-up lifecycle, tags, name/contact channels, signup context, notes/metadata. |
| `bna_contact_communications` | Capture communication / timeline evidence | Linked by canonical contact and lead references | One initial public-signup capture event and later communication status events. |
| `bna_contact_pipeline_events` | Lifecycle/audit events | Contact/lead/workspace/project references | Append-only lifecycle changes and delivery/audit context. |
| `assistant_delivery_outbox` | Asynchronous delivery intent | Deterministic `delivery_key` and `idempotency_key`; contact/lead references | Channel key, role/recipient identity hash, redacted template context, status, attempts, next attempt. |
| `assistant_dead_letters` | Exhausted/non-recoverable delivery record | Source outbox reference | Redacted failure context and operator recovery state. |

## 7.3 Contact identifiers and deduplication

Canonical CRM projection prefers, in order:

1. a `bna_contacts` identity;
2. an existing canonical contact key;
3. normalized email within workspace/project;
4. normalized phone within workspace/project;
5. source-specific record identity.

Contacts are considered the same only within the same workspace and project when normalized email, normalized phone, or canonical link matches. A canonical `bna_contacts` card is preferred over a legacy projection.

Required write behavior:

- same idempotency key returns the same signup/contact identifiers;
- same normalized contact submitted from another page session links/upserts rather than creating a duplicate contact;
- a new legitimate signup event for an existing contact may update/link interest context without destroying history;
- merge/upsert is non-destructive;
- legacy rows remain linked for compatibility;
- one duplicate must not cause duplicate outbox delivery.

**GAP:** the base `bna_product_leads` migration provides a non-unique email index but does not show a unique idempotency constraint. Exact database-level atomic uniqueness for the public signup must be verified in current bootstrap SQL or route logic.

## 7.4 Family, student, and school relationships

- Family signup links only a contact and interest at this step.
- No student relationship is created.
- School signup records `school` classification on the contact/lead context.
- No school organization, roster, or administrator relationship is created.
- Any later student or school entity must reference the existing canonical contact and `signup_key`.

## 7.5 Source and campaign attribution

Stored attribution includes:

- `source=one_time_public_signup`;
- `signup_source=one_time_direct_signup_page`;
- `source_landing_page=/one-time/signup`;
- raw intake, requirement, workflow, and form-version identifiers;
- browser referrer, truncated server-side;
- UTM source, medium, campaign, term, and content;
- browser-captured click IDs and other `utm_` keys when present;
- time-zone source.

Attribution is stored primarily in metadata JSON, not a dedicated campaign entity.

**GAP:** exact durable storage and reporting of browser-captured click IDs is not proven by the canonical five-key UTM normalizer.

## 7.6 Audit history

The workflow must append, not overwrite:

- one signup-capture event;
- contact/lead link context;
- duplicate/replay evidence where applicable;
- outbox queued, sent, failed, retried, and dead-letter status;
- suppression decisions;
- operator recovery actions.

The public success response must not include internal audit bodies, message bodies, raw destinations, or class links.

## 7.7 Operations independence

`/api/one-time/interest` writes directly through the server/database workflow. It must not wait for, call, scrape, or require the BNA Operations UI or CRM workbench to load. Operations is a later read/review surface only.

---

# 8. Communication side effects

## 8.1 Channel-event matrix

| Event | Recipient class | Eligibility | Outbox channel | Delivery configuration | Separation rule |
|---|---|---|---|---|---|
| Signup email acknowledgement | Public submitter | Every valid signup with valid email, including No reminders | `email:one_time_signup_confirmation` | Resend; approved sender identity from protected configuration; class link resolved only at dispatch | Must use the canonical contact email, never an owner destination. |
| Signup WhatsApp confirmation | Public submitter | Preference is WhatsApp/Both, phone present, consent recorded, not suppressed | `whatsapp:one_time_signup_confirmation` | One Time WAPI/Whapi configuration; class link resolved at dispatch | Must use the submitter's normalized WhatsApp identity, never an internal owner destination. |
| Owner/internal signup alert | Internal owner/operator | Every valid signup, subject to protected internal-channel readiness | `telegram:one_time_rabbi_operator` | Recipient role alias resolves to protected server configuration | Must never use a public request field as its destination; must not include the class link. |
| Email class reminder | Public submitter | Email/Both, consented, eligible, class active, not suppressed | `email:one_time_class_reminder` | Protected email provider configuration | Separate deterministic key per contact/class/channel/schedule version. |
| WhatsApp class reminder | Public submitter | WhatsApp/Both, consented, eligible, class active, not suppressed | `whatsapp:one_time_class_reminder` | Protected One Time WAPI configuration | Separate deterministic key per contact/class/channel/schedule version. |
| Public lead-agent reply | Public WhatsApp user | Eligible inbound public-agent interaction and explicit runtime approval | `whatsapp:one_time_agent_reply` | Protected One Time WAPI configuration | Separate from form confirmation and internal Telegram; raw class link may be inserted only at final delivery from an approved alias. |

## 8.2 Public WhatsApp auto-reply requirement

**REQUIRED:** every eligible public submitter who selected WhatsApp or Both, supplied a valid destination, and consented must receive the public WhatsApp signup response through the public-recipient outbox path. The public WhatsApp lead agent must also reply to eligible inbound public interactions through its separate agent-reply channel.

**CURRENT STATUS:** blocked. The latest release evidence says unrestricted public WhatsApp auto-reply remains fail-closed until:

```text
ONE_TIME_PROVIDER_LEAD_BOT_TELEGRAM_CONFIRM
```

contains the exact approved activation value expected by the runtime.

This is a release blocker, not a reason to drop or redirect the lead. CRM capture and outbox intent persistence must remain functional while the public send is blocked.

## 8.3 Internal owner notification

The internal recipient must be resolved server-side from protected configuration. Recognized protected destination names include:

```text
TELEGRAM_CHAT_ID_RABBI_ELIE_SCHELLER
RABBI_ELIE_SCHELLER_TELEGRAM_CHAT_ID
ONE_TIME_TELEGRAM_CHAT_ID
```

Associated bot credential names include:

```text
TELEGRAM_BOT_TOKEN_RABBI_ELIE_SCHELLER
TELEGRAM_RABBI_ELIE_SCHELLER_BOT_TOKEN
RABBI_ELIE_SCHELLER_TELEGRAM_BOT_TOKEN
ONE_TIME_TELEGRAM_BOT_TOKEN
```

The implementation may also use a protected secrets directory. Values must never appear in the public request, response, tracked proof, message body returned to the browser, or repository artifact.

The outbox payload carries only `role_alias=one_time_rabbi_operator`; dispatch resolves the actual destination. Public users cannot select or override it.

## 8.4 Recipient-separation invariants

The following are prohibited:

- sending the public acknowledgement to an internal owner destination;
- sending the internal alert to the public submitter;
- deriving an internal destination from `phone`, `email`, referrer, UTM, or any public metadata;
- inserting owner-test aliases into public contact records;
- treating owner-only send proof as public auto-reply activation;
- including the class link in the internal Telegram alert;
- including a raw provider destination or message body in public API responses.

## 8.5 Email acknowledgement and reminders

- Immediate acknowledgement is queued on signup.
- It includes current class details and the server-resolved class link.
- The raw join link is not stored in the signup outbox payload.
- Recurring reminder sends are separate and keyed by class date, contact, channel, reminder window, and schedule version.
- Suppression and class-active gates are evaluated before delivery.

## 8.6 Outbox and retry contract

Canonical One Time channel keys:

```text
email:one_time_signup_confirmation
whatsapp:one_time_signup_confirmation
telegram:one_time_rabbi_operator
email:one_time_class_reminder
whatsapp:one_time_class_reminder
whatsapp:one_time_agent_reply
```

Worker requirements:

- claim due rows transactionally with `FOR UPDATE SKIP LOCKED`;
- resolve recipient and class link at delivery time;
- never persist a raw public class link in the signup/agent outbox payload;
- retry retryable failures up to five attempts;
- cap retry delay at one hour;
- dead-letter exhausted delivery;
- make dead letters visible to authorized operators;
- redact address, phone, URL, provider error, and message-body data from public/diagnostic results;
- never retry a non-retryable missing-recipient or unsafe-payload failure blindly.

---

# 9. Failure-safety contract

| Failure | Required result |
|---|---|
| Double click/tap or concurrent submit | One HTTP request from the page. Server idempotency remains authoritative. |
| Same request replayed | Same `contact_key` and `signup_key`; `duplicate_submission=true`; no new lead, audit, task, or message intent. |
| Same normalized contact from a new page session | Reuse/upsert the canonical contact; link the new request safely; do not duplicate the person. |
| Email provider unavailable | Lead/contact/audit/outbox transaction remains committed; email row becomes failed and retryable; no duplicate lead. |
| WhatsApp provider unavailable | Same; no fallback to owner destination and no synchronous lead rollback. |
| Internal Telegram unavailable | Same; public contact is still captured; internal alert retries or dead-letters separately. |
| One optional channel unavailable | Other eligible channel events remain independently deliverable. |
| Operations UI unavailable or slow | No effect on CRM persistence or outbox enqueue. |
| Delivery worker concurrency | `FOR UPDATE SKIP LOCKED` plus deterministic keys prevent two workers from delivering the same event concurrently. |
| Repeated provider timeout | Retry with recorded attempt count and next-attempt time; dead-letter at the configured maximum. |
| Missing/unsafe recipient or payload | Non-retryable failure; no send; authorized operator review. |
| Core database transaction fails | Return a non-sensitive error and do not claim success. No partial contact/lead/outbox state may be committed. |
| Outbox enqueue fails inside the atomic unit | Roll back the submission transaction rather than return `confirmation_queued=true` falsely. |
| Browser loses response after commit | Manual replay with the same key returns duplicate-success and the same identifiers. |
| Optional integration disabled by approval gate | Store the lead and deterministic intent without silently discarding it; report operational blockage internally, not to the public as a successful send. |

## 9.1 No duplicate leads

The protection set is cumulative, not substitutable:

- browser in-flight guard;
- request idempotency key;
- canonical workspace/project contact match;
- normalized email/phone match;
- signup-interest replay detection;
- deterministic outbox keys;
- worker row lock;
- provider message ID/audit record where available.

## 9.2 No duplicate messages

A message event is unique by deterministic `delivery_key`/`idempotency_key`. Retrying updates the same event's attempts/status. A duplicate form submission must not enqueue a second version of the same signup confirmation or owner alert.

## 9.3 No lost submission during optional-integration outage

The CRM transaction precedes provider delivery. Provider readiness, public-bot approval, email availability, WhatsApp availability, or internal Telegram availability must not be synchronous prerequisites for storing the submission.

## 9.4 No BNA Operations dependency

CRM capture must use direct server/database services. Loading, rendering, or authenticating into BNA Operations is never part of the public write path.

---

# 10. Staging and non-production rules

Staging verification must follow all of these rules:

1. Do not send real email, WhatsApp, Telegram, SMS, or other external messages.
2. Do not invoke production delivery or class-reminder cron routes.
3. Do not use production `CRON_SECRET`.
4. Do not enable public auto-reply approval gates.
5. Do not use production provider tokens, webhook secrets, sender identities, instances, or destinations.
6. Do not create a production payment, checkout session, payment link, invoice, charge, refund, or subscription.
7. Do not create production member access, portal credentials, passwords, or class grants.
8. Use `dry_run=true` for mapping/scope validation when no database write is required.
9. When persistence behavior must be tested, use a staging-only database and synthetic identities, with explicit test tags and verified cleanup.
10. Use mocked/stubbed delivery transports to assert the final provider request without transmitting it.
11. Assert outbox enqueue, deterministic keys, suppression, retry transitions, and dead-letter behavior locally or in staging.
12. Do not load or depend on production BNA Operations.
13. Do not copy production customer records into staging.
14. Do not place raw synthetic recipient values in tracked reports; use hashes or placeholders.
15. Keep all payment modes disabled or test-only.

A staging test passes when it proves the contract without external delivery. A provider's live delivery receipt is not required and is prohibited in staging.

---

# 11. Given / When / Then acceptance tests

All identities are synthetic. No test may display or persist a real customer destination in evidence.

## Scenario 1 — Successful Family email submission

**Given**

- the One Time workspace/project resolves server-side;
- a synthetic contact has no existing canonical record;
- Family is selected;
- a valid location and IANA time zone are present;
- a valid synthetic email is present;
- Email reminders are selected;
- reminder consent is checked;
- no phone is supplied;
- delivery providers are mocked or staging-disabled.

**When**

- the customer submits once.

**Then**

- client validation emits no errors;
- exactly one `POST /api/one-time/interest` occurs;
- HTTP status is `200`;
- `success=true`;
- `duplicate_submission=false`;
- `contact_key`, `signup_key`, and compatibility `crm_lead_id` are present;
- `confirmation_queued=true`;
- exactly one canonical contact exists in the One Time workspace/project;
- exactly one signup-interest record exists;
- exactly one linked compatibility CRM lead exists;
- exactly one initial capture audit/timeline event exists;
- exactly two signup outbox events exist: email confirmation and internal Telegram alert;
- no WhatsApp confirmation exists;
- zero automatic CRM tasks exist;
- zero student, school-organization, member, portal, checkout, payment, or access records are created;
- the browser shows **You're signed up.**

## Scenario 2 — Duplicate submission

**Given**

- Scenario 1 has committed;
- the original idempotency key and normalized identity are known.

**When**

- the same payload is replayed with the same idempotency key.

**Then**

- HTTP status is `200`;
- `success=true`;
- `duplicate_submission=true`;
- the same `contact_key` and `signup_key` are returned;
- canonical contact count remains one;
- signup-interest count remains one;
- compatibility-lead count remains one;
- capture-event count remains one;
- outbox event count and delivery keys remain unchanged;
- no provider receives a second message;
- zero automatic tasks exist.

**And when**

- the same normalized identity is submitted from a new page session with a new request key.

**Then**

- the existing canonical contact is reused;
- no duplicate person is created;
- any legitimate new interest context is linked non-destructively and cannot duplicate the existing confirmation delivery for the same signup/version.

## Scenario 3 — Validation errors

**Given**

- WhatsApp reminders are selected;
- no phone is supplied;
- consent is not checked;
- email is malformed.

**When**

- the browser submit action runs.

**Then**

- no HTTP request occurs;
- the exact email, phone, and consent messages are shown;
- the first invalid visible control receives focus;
- all entered values remain available for correction.

**And when**

- equivalent invalid JSON bypasses the browser and is posted directly.

**Then**

- HTTP status is `400`;
- `success=false`;
- `code=VALIDATION_ERROR`;
- `field_errors` contains only public-safe field messages;
- no contact, lead, audit, task, or outbox record is written.

## Scenario 4 — Optional integration outage

**Given**

- a valid signup transaction can reach the database;
- the email provider is unavailable;
- the WhatsApp provider is unavailable;
- the internal Telegram provider is unavailable;
- worker calls are mocked to fail retryably.

**When**

- the customer submits.

**Then**

- the CRM/contact/signup/audit/outbox transaction commits;
- the API returns success with `confirmation_queued=true`;
- no provider call occurs synchronously inside the public request;
- each applicable outbox row enters failed/retry state independently;
- retry timestamps follow the configured exponential schedule;
- no duplicate contact, signup, audit event, or outbox event is created;
- after the fifth failed attempt, the affected row is dead-lettered;
- the submission remains visible to authorized CRM operators;
- the public user is never redirected to an internal owner destination.

## Scenario 5 — Mobile and accessible use

**Given**

- a viewport width of 390 or 430 CSS pixels;
- the page is loaded with a valid browser time zone.

**When**

- a user completes the form by touch.

**Then**

- controls fit without horizontal overflow;
- Family/School and reminder choices activate correctly;
- conditional phone/consent fields update correctly;
- double tap produces one request;
- success is visible and focusable.

**And when**

- the same flow is completed by keyboard using Enter/Space.

**Then**

- the underlying radio inputs change through the same event path;
- no request is made before final submit;
- one valid request is made after submit.

## Scenario 6 — Family lead

**Given**

- a valid Family submission.

**When**

- the transaction commits.

**Then**

- `signup_as=Family`;
- `audience_type=family`;
- `family_school_classification=family`;
- product `audience=parents`;
- the canonical contact and linked interest are in the One Time workspace/project;
- no student or household entity is created;
- no portal/payment/access behavior occurs.

## Scenario 7 — School lead

**Given**

- a valid School submission.

**When**

- the transaction commits.

**Then**

- `signup_as=School`;
- `audience_type=school`;
- `family_school_classification=school`;
- product `audience=parents`;
- the contact/lead is visibly classifiable as a school interest;
- no student, school organization, roster, or administrator account is created;
- no portal/payment/access behavior occurs.

## Scenario 8 — Public WhatsApp and internal-owner separation

**Given**

- WhatsApp or Both is selected;
- a valid synthetic WhatsApp identity is supplied;
- reminder consent is recorded;
- the public WAPI runtime is enabled and explicitly approved;
- the internal owner Telegram destination is configured through protected environment variables;
- both transports are mocked in staging.

**When**

- the signup commits and the worker dispatches due events.

**Then**

- a public WhatsApp confirmation request is built for the submitter identity;
- an email acknowledgement request is built for the submitter email;
- an internal Telegram alert request is built using only `role_alias=one_time_rabbi_operator`;
- the internal destination is resolved from protected configuration;
- the public request cannot override the owner destination;
- the internal alert does not contain the class link;
- the public and internal recipient hashes differ;
- no public message is sent to the owner destination;
- no internal message is sent to the public destination;
- one event per deterministic delivery key exists.

**Current release expectation:** this test remains red for unrestricted public delivery until the public auto-reply approval gate is explicitly satisfied.

## Scenario 9 — No reminders

**Given**

- Family or School is selected;
- No daily reminders is selected;
- no phone is supplied;
- reminder consent is not checked.

**When**

- the form is submitted.

**Then**

- phone is optional;
- the consent checkbox is hidden, disabled, unchecked, and not validated;
- the API accepts the request;
- recurring reminder channels are empty;
- no recurring email or WhatsApp reminder is scheduled;
- a one-time email acknowledgement is queued;
- an internal Telegram alert intent is queued;
- no WhatsApp confirmation is queued;
- no payment/access/portal behavior occurs.

## Scenario 10 — Staging no-send

**Given**

- staging configuration;
- all external send and payment gates disabled;
- provider clients replaced by mocks;
- no production cron credential available.

**When**

- all Family/School and reminder matrix cases are executed.

**Then**

- validation, normalization, CRM mapping, deterministic outbox keys, suppression, retry, and dead-letter transitions are verified;
- no real message is sent;
- no production cron executes;
- no production database write occurs;
- no production payment or access mutation occurs;
- reports contain no raw destination or secret.

---

# 12. Evidence index and unresolved conflicts

## 12.1 Evidence index

| Repository path | Snapshot / role in contract |
|---|---|
| `public/one-time/signup.html` | Current form HTML, exact labels/help text, conditional fields, local-time display, client validation, payload generation, idempotency key, UTM/referrer capture, submit/success/error UI. Blob `e3709429579384e8fe1dd90cb9eb31b01c1a6760`. |
| `src/lib/bna/one-time-signup-workflow.js` | Server normalization/validation, Family/School classification, city/time-zone resolution, consent policy, schedule calculation, acknowledgement/reminder builders, deterministic signup outbox events. Blob `4248bbc1386de4e8db4f07dfbb45d922b671a3ca`. |
| `src/lib/bna/one-time-delivery-outbox.js` | Channel allowlist, recipient resolution, class-link safety, provider request construction, five-attempt retry, redacted result, dead-letter status. Blob `6858c6c74bd14adfa39c500b62fd333be4e421af`. |
| `server.js` | Current public route, dry-run path, DB transaction/upsert linkage, cron routes, worker dispatch, project resolution, response compatibility. Blob `3a54577f94957e3a5c1ba80dbe6b8991799c5188`. Route behavior is also asserted by the focused static tests below. |
| `src/lib/bna/crm-contact-model.js` | Canonical contact projection, normalization, Family/School derivation, communication preference/suppression model, workspace/project-scoped deduplication, canonical-record precedence. Blob `0a57610c8c3cc54fc3d56f4f720e9fbc5c1917ac`. |
| `railway-migration-2026-06-16-one-time-product-system.sql` | Base `bna_product_leads` schema, schedule/time zone, product/program scope, no-send/external-write fields, current non-unique email index. Blob `c9ab404b1e8a5498c8ebc098c9258e50a9de63d1`. |
| `tests/one-time-signup-form-matrix.test.js` | Current success matrix, field errors, switching behavior, duplicate click protection, mobile widths, keyboard completion, response contract. Blob `6926f4f324fb0a678ced359f846a073b1f312157`. |
| `tests/one-time-signup-reminder-workflow.test.js` | Current direct-signup field contract, server validation, schedule/DST behavior, outbox channel selection, no-reminder behavior, protected cron/static route assertions. Blob `35711619510342f3cceffd29fd799c151a97549f`. |
| `tests/one-time-delivery-outbox.test.js` | Outbox request building, retry, redaction, delivery/dead-letter behavior. |
| `tests/crm-contact-service.test.js` | Canonical contact DTO and CRM mapping/deduplication expectations. |
| `scripts/smoke-one-time-interest-dry-run-live.mjs` | No-write scope/mapping verification for current public endpoint and outbox preview. Blob `2c649f17e2dda4238b3f6ca47e6d32caa9d82ace`. |
| `raw-input/RAW-20260713-002-onetime-signup-bots-ticket-approval.md` | Authoritative Wave 1 form/API/CRM/outbox requirements and separation guardrails. Blob `3b3faf3bf0cd3c2f7013f393edfb00a8acedddc1`. |
| `tasks-pending/2026-07-13-onetime-signup-bots-ticket-approval.md` | Current implementation/deployment evidence, acceptance criteria, public-bot gate, zero-task/no-payment/no-access rules. Blob `3a0b5ae2b791c5b42963989aa2bc5c17c3242d87`. |
| `ops/execution-runs/2026-07-12-shared-crm-communication-agents-addendum/FINAL-REPORT.md` | Latest recorded release status: form deployed, WAPI ready, public auto-reply fail-closed, owner-test aliases missing, no live send or production mutation in proof. Blob `dfdf1af87f6e4e31e93e0803f0a7bb23169efc41`. |
| `src/lib/bna/telegram-notifications.js` | Protected owner token/chat destination resolution and redacted readiness behavior. |
| `.env.example` | Environment-variable names for protected Telegram, cron, WAPI, provider, staging/test, and approval gates. No values are authoritative in source control. |
| `memory-topics/rabbi-scheller-onetime.md` | Workspace isolation, public/private bot separation, historical readiness, and owner-only test constraints. Blob `8a8045829e1611d965f2875f8ac8c6192d1e70c6`. |
| `memory-topics/one-time-rabbi-sheller.md` | First-party CRM requirement, workspace/project isolation, no portal/access claims, owner-only send constraints. Blob `f3d174b203e1ded8b876ab68e13c709235298c73`. |
| `tests/one-time-product-system.test.js` | Legacy product/route assertions that still reference the retired synchronous/blocked follow-up path; evidence of test drift, not the canonical messaging contract. Blob `065d78b4c284216c14f9fe1e7f17104ef1d76861`. |
| `scripts/smoke-one-time-interest-crm-e2e-live.mjs` | Legacy live-smoke shape containing student input and blocked follow-up expectations; superseded for the current public form contract. Blob `fcdf76a0c3d4149b85edcb583a7ea65e29601411`. |

## 12.2 Unresolved conflicts and blockers

1. **Public WhatsApp activation — blocker.** The required public auto-reply/confirmation must work for every eligible public recipient, but the latest release report says unrestricted auto-reply is fail-closed behind `ONE_TIME_PROVIDER_LEAD_BOT_TELEGRAM_CONFIRM`.

2. **Owner-only proof is a different blocker.** Protected owner-test email/WhatsApp aliases are missing. This must not be used to explain, redirect, or substitute for the public-recipient flow.

3. **Legacy follow-up path remains in tests/scripts.** `tests/one-time-product-system.test.js` and `scripts/smoke-one-time-interest-crm-e2e-live.mjs` still assert the older direct Telegram / blocked transactional-follow-up model and, in the smoke script, legacy student input. The canonical contract is the newer contact/signup/outbox workflow.

4. **Validation-source requirement is only partially met.** The task says one frontend/server schema and one validation function for blur, submit, and tests. The current implementation has parallel client and server validation, validates on submit, and clears errors on input/change; no blur-validation path was found.

5. **Rate limiting is unproven.** No route-specific public submission rate-limit middleware, threshold, `429` schema, or test was found.

6. **Write-side uniqueness is not fully evidenced.** Deterministic keys and deduplication behavior are specified/tested, but the base product migration shows no unique signup-idempotency index. Current bootstrap SQL and route transaction logic need direct database-level verification.

7. **Duplicate/retry UX is incomplete.** The API returns `duplicate_submission`, but the browser presents it as ordinary success. There is no automatic retry, `Retry-After`, or versioned 5xx retryability contract.

8. **Location/time-zone and attribution gaps.** Free-text location is not geocoded; structured geography is normally blank; time-zone mismatch review is not performed; the manual time-zone error copy is wrong; durable click-ID attribution is not proven.

9. **Client-side retention and sender configuration.** The success path writes contact and CRM identifiers to `sessionStorage` with no documented retention/cleanup policy. The acknowledgement builder contains literal sender/reply-to values rather than a clearly enforced environment-only sender contract.

---

# Contract disposition

- **Lead capture and Family/School conditional form:** implemented and evidenced.
- **Server validation and current response contract:** implemented and evidenced.
- **Canonical CRM/contact/signup mapping:** implemented by requirement and current route evidence; exact transaction/unique-index enforcement still requires SQL-level confirmation.
- **Asynchronous outbox and retry/dead-letter model:** implemented and evidenced.
- **Email acknowledgement/reminder model:** implemented, subject to provider configuration and suppression.
- **Public WhatsApp for every eligible submitter:** required but currently blocked.
- **Internal owner destination separation:** implemented in design; destination remains protected and server-resolved.
- **No payment, portal, access, or automatic CRM task:** binding and evidenced.
- **Staging no-send/no-production-cron/no-payment:** binding.

**No implementation, redesign, live request, external message, payment action, repository mutation, or production cron execution was performed for this audit.**
