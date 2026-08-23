# One Time Mishnayos — Privacy, Consent, Retention, and Data Rights

**Package:** `ONE-TIME-PRODUCTION-SPEC-v2.1`  
**Document:** `10-PRIVACY-CONSENT-RETENTION-DATA-RIGHTS-v2.1.md`  
**Status:** Normative product and operating contract  
**Effective date:** 2026-07-28

## PCR-001. Purpose

This document defines the launch privacy contract for adult account owners and Students. It covers actual names, Student accounts, live classroom participation, Student audio/video recording, questions, attendance, progress, badges, support, Drive/Vimeo processing, transcript and worksheet generation, communications, retention, export, correction, deletion, and consent withdrawal.

This is a product specification. Before `production_broad`, the release bundle must contain these exact external legal artifacts:

```text
legal/terms-of-service.html
legal/privacy-notice.html
legal/student-data-and-recording-consent.html
legal/cancellation-policy.html
legal/refund-policy.html
legal/legal-policy-manifest.json
```

`legal-policy-manifest.json` records each file’s SHA-256 digest, immutable policy version, effective date, `product_owner_full_name`, `product_owner_approved_at`, `qualified_legal_reviewer_full_name`, `qualified_legal_reviewer_credential_or_firm`, and `legal_approved_at`. Empty names, role labels without a person, stale hashes, unsigned substitutions, or a Codex-generated approval block fail the `production_broad` gate. Codex may implement only the approved files and cannot draft, approve, infer, or silently weaken their legal text.

## PCR-002. Privacy principles

One Time follows these rules:

1. Collect only information required for the stated product purpose.
2. Store Student learning data in One Time, not GHL.
3. Bind consent to the relationship-authorized adult identity; send email, billing, and service communication only to the adult/account-owner contact.
4. Require current versioned consent before a Student enters a recorded class.
5. Keep private Student questions private from Parents and other Students.
6. Use provider references and protected first-party routes instead of raw Zoom/Vimeo links.
7. Deny by default when identity, household, consent, enrollment, access, or provider state is uncertain.
8. Minimize information in Telegram, logs, traces, screenshots, analytics, and provider metadata.
9. Preserve immutable consent, financial-event, security, and audit evidence only as long as required.
10. Provide verified account-owner and Student-subject export, correction, ownership-transfer, closure, and erasure paths.

## PCR-003. Data subjects and authority

### PCR-003.1 Account owner

Each household has exactly one active Parent/account owner. The account owner:

- supplies one adult email address and optional phone;
- accepts account and billing terms;
- accepts Student and classroom consent for dependent Students; the same legally capable adult may self-manage consent for their `self` Student through the authorized Student privacy route;
- creates and manages Student profiles and credentials;
- receives service email and optional reminders;
- controls the household’s optional communication preferences;
- may request export, correction, deletion, or verified ownership transfer.

### PCR-003.2 Student

A Student:

- has relationship `self` or `dependent` to the household account owner;
- has an actual first name and actual last/family name when available;
- has a local username and password;
- has no required email or phone;
- has no date of birth, numeric age, age band, grade, or Hebrew-specific field;
- is never created as a GHL contact;
- sees only their own learning, questions, support, notifications, and authorized class/content;
- is `dependent` when the account owner attests authority to create/manage that Student;
- is `self` when the legally capable adult account owner uses a separate Student seat for themselves.
- when `self`, may use the authenticated Student privacy route to review policy history and accept, renew, or withdraw their own recording/recognition choices; a dependent Student has no such route.

### PCR-003.3 School account

An approved School uses one adult account manager and separate Student accounts. The School inquiry alone creates no Student, product access, or consent. Before Students are created, the authorized school account manager must affirm that the school has authority to provide the Student data and obtain any required guardian permission. School-specific legal or contractual terms may add restrictions but may not reduce the protections in this document.

## PCR-004. Data inventory and minimization

| Data class | Required fields | Prohibited or minimized fields |
|---|---|---|
| Adult identity | name, normalized email, timezone, account status, verified GHL link | Student learning data, raw password, unnecessary government identifiers |
| Household | owner identity, product context, timezone, seat allowance, access projection | simultaneous co-guardian records at launch |
| Student identity | relationship `self` or `dependent`, actual name, safe display form, local username, credential hash, account state | date of birth, age, age band, grade, Hebrew-specific field, required email/phone, GHL contact, raw password |
| Consent | actor, household, exact Student, separate scope, policy versions, exact choices, accepted/withdrawn time, request metadata | bundled optional choices, full token, unnecessary device fingerprint |
| Classroom | class/occurrence/enrollment, Zoom resource reference, per-Student registration reference, launch/attendance state | raw Zoom join URL in UI, email, GHL, logs, or browser URL |
| Learning | attendance, progress, playback position, fixed badge state, leaderboard projection | open Student-to-Student chat, hidden behavioral advertising profile |
| Questions | Student, class context, question, Rabbi answer, moderation/publication state | Parent visibility, GHL child conversation |
| Support | requester, category, message, status, response, safe provider reference | unnecessary child data in Telegram/GHL |
| Content | source reference, checksum, occurrence match, RecordingParticipantSnapshot, ContentParticipant/redaction state, model/prompt/schema versions, processing outputs, transcript/captions, approval, Vimeo reference | public raw source, unapproved/unredacted publication, raw Vimeo access URL |
| Billing projection | household-scoped Stripe Customer/subscription references, household-keyed GHL record, signed receipt ID, current access state, reconciliation status | shared cross-household Stripe Customer, card number, bank data, fabricated invoice/payment ledger |
| Communications | adult purpose/consent/suppression, template/workflow IDs, provider delivery state | Student contact record, marketing without permission |
| Security/audit | actor, action, target, result, request/correlation ID, redacted context | passwords, setup/reset tokens, raw provider links, unnecessary message bodies |

## PCR-005. Versioned authorized-adult consent

### PCR-005.1 Timing

The relationship-authorized adult must accept the current required policies by scope:

1. `service_account` acceptance is required during Parent setup and for each exact Student before activation/restoration;
2. `recording_participation` consent is required for each exact Student before a live-class launch grant;
3. `member_recognition` is an optional, separate choice for each exact Student;
4. `playback_authorization` is derived from active Student, enrollment, access, published assignment, and revocation state; it is not a consent checkbox;
5. materially changed versions require renewed acceptance only for the affected scope.

There is no card during free signup. Service/account acceptance therefore occurs during account/Student activation, not only at Checkout. A Student without recording consent may use otherwise authorized non-live Student surfaces but cannot join the recorded class.

The actor is exact:

- for `dependent`, only the current verified Parent/account owner may accept, renew, or withdraw the Student scopes; the dependent Student has no privacy/consent route;
- for `self`, the same legally capable adult owner records initial `service_account` acceptance during Student creation and, after activation, may review, accept/renew, or withdraw their own `recording_participation` and `member_recognition` from the authenticated self-managed Student privacy route;
- a self-managed adult Student missing current `recording_participation` may see the disclosure/control and non-live authorized surfaces, but receives no join bootstrap until the acceptance commits and join rechecks it.

### PCR-005.2 Required consent contents

The service/account and recording notices, taken together without bundling optional choices, must state in plain English that:

- the account owner is authorized to create the Student;
- the applicable actual-name instruction depends on `self|dependent`;
- One Time stores Student login, attendance, progress, questions, support, badges, and playback data;
- the Student participates through an embedded Zoom classroom;
- OBS is the sole launch recording source and may capture Student voice/video transmitted during class;
- Zoom cloud recording is disabled;
- the OBS recording is transferred through the direct-upload or dedicated Drive path into approved S3 storage and may be processed by the approved OpenAI transcription/draft services and Vimeo;
- automated processing may create a transcript, captions, review/worksheet draft, and future knowledge artifact;
- all generated learning materials require human approval before publication;
- approved recordings and materials are available only through protected member access;
- a moderated question or recognition item may be shared with authenticated class members using the approved safe display form;
- the relationship-authorized adult may withdraw future consent and submit the role-authorized export, correction, or deletion request;
- required operational, legal, suppression, and security records may be retained after account closure.

### PCR-005.3 Stored consent record

Each acceptance stores:

- immutable consent record ID;
- actor kind `parent_account_owner` or `adult_self_student`, actor account/credential reference, and linked adult identity;
- household ID;
- exact Student ID;
- relationship `self` or `dependent` and Parent authority attestation when dependent;
- scope `service_account`, `recording_participation`, or `member_recognition`;
- Privacy Notice version;
- Terms version;
- Student Data and Classroom Consent version applicable to the recorded scope;
- Cancellation/Refund Policy version when applicable;
- exact grant/decline choice for the stored scope;
- accepted timestamp in UTC;
- request/correlation ID;
- redacted IP/user-agent evidence;
- superseded or withdrawn timestamp and reason.

Consent evidence is append-only. A new policy acceptance does not overwrite the old record.

### PCR-005.4 Required checkbox behavior

- Required and optional choices are visually separate.
- Required `service_account` and `recording_participation` choices are separate and unchecked by default.
- `member_recognition` is optional, separate, and unchecked by default.
- Newsletter, marketing, and future WhatsApp choices are optional and unchecked by default unless an approved lawful basis requires a different presentation.
- The page links to the exact policy versions.
- A failed `service_account` save creates no active Student. A failed/missing `recording_participation` save creates no live-class launch authorization. A failed recognition save grants no identifying member-visible attribution; the stable class-scoped nonidentifying alias remains the peer display.
- Double submit is idempotent.
- A dependent Student session cannot accept or withdraw consent. A verified `self` Student session may change only that exact Student’s eligible scopes through the self-managed privacy route; relationship/adult linkage and recent authorization are checked server-side.

## PCR-006. Actual-name and display-name policy

### PCR-006.1 Actual name

For relationship `dependent`, the form displays exactly:

> Please use the Student’s actual name so Rabbi Eli can identify them during class.

For relationship `self`, the form displays exactly:

> Please use your actual name so Rabbi Eli can identify you during class.

Names accept Unicode. The product collects neither a date of birth nor an age/grade proxy.

The full actual name may be visible to:

- the household account owner;
- the Student themselves;
- authorized Admins/Rabbi;
- the authenticated live class roster and approved Zoom participant identity;
- audited support/safety personnel when necessary.

### PCR-006.2 Member-visible recognition

With current `member_recognition`, leaderboards, badges shown to class members, and approved-question attribution use:

- first name plus last initial; or
- a separately approved safe display name.

They never show adult email, username, household contact, billing information, attendance minutes, private question text, or full legal/family name to other households.

When `member_recognition` is declined or withdrawn:

- the Student remains in the same underlying rank and keeps all learning and badge facts;
- the Student’s own authenticated row is labeled exactly `You`;
- peers see a stable class-scoped nonidentifying alias such as `Anonymous Student • A7` on the leaderboard, member-visible badges, and approved questions;
- named-attribution caches are invalidated immediately, and existing published material enters privacy review when its attribution exceeds the alias;
- withdrawal changes display only and does not delete, decrement, reorder, or fabricate the underlying facts.

The alias is opaque, unique within the class, stable across that class’s recognition surfaces, and not reusable across classes or derived from a name, username, email, household, rank, or public hash. Admins may resolve it to the actual Student only through authorized first-party views.

### PCR-006.3 Public use

No Student name, image, voice, question, badge, leaderboard result, or testimonial becomes publicly accessible through the public site or campaign without a separate explicit public-release approval and applicable consent. The launch consent for authenticated class use is not public-marketing consent.

## PCR-007. Classroom recording and provider controls

### PCR-007.1 Recorded content

OBS is the sole launch recording source. Zoom cloud recording is disabled in the registered Zoom configuration and cannot be used as fallback. Student audio and video transmitted during class may be captured by OBS only after current `recording_participation` consent from the relationship-authorized adult actor. The product must clearly indicate that the class is recorded before the Student selects **Join Class**. For a `self` Student, the authenticated adult Student may manage their own recording choice on the self privacy route; missing/withdrawn consent returns to that control and no join grant is issued. For a `dependent` Student, only the Parent/account owner may change consent.

The Join confirmation shows:

- class title and occurrence;
- “This class may be recorded, including Student voice and video”;
- current consent state;
- camera/microphone guidance;
- a link to the applicable notice.

The recording Admin must:

1. verify the consent-gated roster and current RecordingParticipantSnapshot readiness;
2. give a visible and verbal recording notice before starting OBS;
3. start and stop OBS manually and record those timestamps;
4. retain the source only on the controlled, encrypted operator device;
5. upload it through direct app upload or place it in the dedicated Drive tree within 24 hours;
6. confirm S3 object-version, byte-count, and SHA-256 readback;
7. delete the local operator copy only after that durable readback succeeds.

If OBS fails, no recording is claimed and no Zoom-cloud fallback starts. The occurrence remains a valid live class, but the recording/content status is truthfully unavailable and any content workflow requires a separately supplied valid OBS source.

### PCR-007.2 Classroom privacy settings

For the canonical class:

- embedded Zoom only;
- per-Student launch authorization;
- waiting room disabled;
- participant rename disabled;
- participant chat disabled;
- participant screen sharing disabled;
- participant file transfer disabled;
- Students muted on join;
- one concurrent live session per Student;
- Zoom cloud recording disabled;
- no raw Zoom URL or durable bearer in the browser URL, email, GHL, logs, or ordinary UI.

### PCR-007.3 Publication

A captured recording is not member-visible merely because the class ended. It must pass:

1. source validation;
2. occurrence-ID/filename correlation plus Admin confirmation;
3. complete RecordingParticipantSnapshot and ContentParticipant set;
4. compression/processing;
5. transcript/caption/review draft;
6. mandatory media and text redaction;
7. Admin human review and redaction attestation;
8. explicit approval;
9. private Vimeo upload/readback;
10. protected One Time publication.

Before approval, the Admin must cut, mute, blur, or redact as applicable:

- full Student names beyond a consented safe attribution;
- usernames, adult contact data, provider aliases, and household identifiers;
- sensitive personal information;
- private or unapproved remarks and questions;
- every segment marked for redaction by a ContentParticipant record.

Automation may identify candidate segments, but only the human Admin may mark redaction complete. A missing participant snapshot, unresolved possible participant, or incomplete media/transcript/caption/worksheet redaction blocks approval and publication.

### PCR-007.4 Participant evidence

For every potentially recorded Student, `RecordingParticipantSnapshot` records the Student, occurrence, conservative participation intervals, `service_account` and `recording_participation` consent type/version/time, `member_recognition` state, OBS capture interval, evidence source, and recognition/redaction state. Each immutable content version then has `ContentParticipant` rows identifying possible media/text intervals, required `cut|mute|blur|transcript_redaction|worksheet_redaction` actions, reviewer, and completion/restriction state.

These records are access-controlled Student data. They are not exposed to Parents, other Students, GHL, Telegram, search, or ordinary logs. Missing or unresolved evidence fails closed for publication.

## PCR-008. Questions, answers, support, and safety

### PCR-008.1 Private questions

- A Student question is private by default.
- The Parent cannot see the question, Rabbi answer, private status, or private question history.
- Another Student cannot see it.
- Rabbi/Admin may answer privately.
- Rabbi/Admin may approve a question for class/member publication.
- Member publication uses the same current class-member attribution as PCR-006.2: consented first name plus last initial/safe display name, or the stable class-scoped nonidentifying alias.
- Decline/closure is visible only to the submitting Student and authorized Admins.

### PCR-008.2 Student support

Student technical support remains in One Time. Telegram may receive a minimized notification with ticket category, safe Student reference, severity, and protected One Time link. It does not receive a raw password, full transcript, provider bearer, or unnecessary question/support body.

Student support never creates a child GHL contact or GHL conversation.

### PCR-008.3 Adult support

Adult Parent/public support may create or link one GHL conversation. One Time remains the authoritative ticket/status record. Only information required to resolve the adult request is synchronized.

### PCR-008.4 Safety escalation

When a Student message indicates an immediate safety or privacy concern, an authorized Admin may apply the documented safety/privacy escalation, preserve relevant evidence, and notify the account owner or appropriate responsible person where permitted and appropriate. Automated systems do not make a final safeguarding determination or send the Student’s message to a broad audience.

## PCR-009. Parent visibility

Parent sessions may see:

- their household and Student names;
- Student credential-management state;
- calendar and schedule;
- attendance/progress summaries;
- earned badge summaries;
- access/billing state;
- Parent notices, newsletter, reminders, and support.

Parent sessions may not see or launch:

- Student Join Class;
- Student recordings or library playback;
- Student private questions or Rabbi answers;
- Student support message contents unless the Parent was the requester;
- Student-to-Student comparison details beyond an approved Parent-safe summary;
- another household.

An adult who wants Student learning access uses a separate Student seat and separate Student credentials.

## PCR-010. Communications privacy

1. Resend security/setup/reset messages contain only adult account data and an opaque one-time token.
2. Setup/reset pages load no third-party advertising or analytics capable of receiving the token/referrer.
3. GHL contains one adult contact per AdultPerson and no Student contact.
4. Each household has a separate household-keyed GHL opportunity/account record; household service preference, lifecycle, plan, billing, and access fields do not overwrite another household owned by the same adult.
5. Adult consent, unsubscribe, complaint, and suppression are contact-scoped and override every household send; reminder/service preference is household-scoped and can further suppress only that household.
6. An ambiguous GHL link enters `identity_review` without rolling back the submitted local email/password login, household, pre-expiry free product access, or Resend security delivery. Fresh public Family signup sets its password directly and requires no setup email. Until Admin resolution, all GHL create/update/workflow and GHL-hosted billing effects are blocked.
7. Service/account/class messages remain separate from marketing withdrawal. The single Family-signup agreement records adult marketing/newsletter email consent as opted in, while unsubscribe, DND, complaint, bounce, and suppression precedence remain enforceable.
8. WhatsApp remains non-executing until provider, templates, sender, consent, webhook, STOP/DND, and canary are approved.
9. Disabled WhatsApp steps may store adult preference intent but send nothing and do not delay email.
10. A School inquiry receives one acknowledgment and no automated nurture.
11. Suppression, unsubscribe, complaint, and hard-bounce state is checked at send time.
12. Minimal suppression tombstones survive deletion so a person is not accidentally resubscribed.

## PCR-011. Analytics, logs, screenshots, and telemetry

### PCR-011.1 Public/adult analytics

Privacy-safe public and adult funnel metrics may record page/event identifiers, coarse device information, referral source, and conversion state without storing form values in URLs.

### PCR-011.2 Student tracking

Student surfaces do not load behavioral-advertising trackers. Product analytics are limited to operational events required for:

- authentication and security;
- class join and attendance;
- playback/resume;
- progress and badges;
- question/support status;
- reliability and error diagnosis.

### PCR-011.3 Redaction

Logs, traces, screenshots, exception tools, and acceptance evidence redact:

- passwords;
- setup/reset tokens;
- session cookies;
- raw Zoom/Vimeo URLs or secrets;
- payment credentials;
- full private question/support text unless the evidence is specifically access-controlled for that case;
- unnecessary full Student names.

Correlation IDs are permitted. Browser/query-string search must not contain private CRM or Student free text.

### PCR-011.4 Storage and processor controls

- Confirmed uploads live in a private, versioned AWS S3 bucket in `eu-central-1`, with Block Public Access, SSE-KMS, multipart checksum validation, least-privilege roles, and multi-AZ durability.
- A direct upload is not “confirmed” until S3 returns the completed object version and a readback proves expected byte count and SHA-256. Multipart parts alone are not confirmed data.
- English transcription uses OpenAI Audio Transcriptions API model `gpt-4o-transcribe` with versioned English-language and glossary/context prompts.
- Worksheet, review, and knowledge-base drafts use the OpenAI Responses API pinned snapshot `gpt-4.1-mini-2025-04-14` with versioned prompts and Structured Output schemas.
- Every ContentVersion stores provider, model, prompt, glossary/context, schema, and processing-policy versions.
- Processor inputs contain only the source and context required for that job. Provider configuration must prohibit training on One Time inputs/outputs and must meet the approved processor-retention and deletion terms in the legal/provider registry; unavailable or contradictory controls block production processing.
- Processor output is always an unapproved draft. Human review, participant reconciliation, and mandatory redaction remain required.

## PCR-012. Retention schedule

Closure and erasure are different:

- **ordinary closure** revokes access and begins the default post-closure periods below;
- **verified erasure** overrides ordinary retention and deletes or irreversibly anonymizes eligible subject data within 30 days;
- erasure retains only the explicitly named financial, consent, suppression, material-security/audit, legal-hold, and hash-only purge evidence below;
- a scoped legal hold records approving authority, exact categories/subjects, basis, start, review date at least every 90 days, and release; it does not suspend unrelated deletion.

| Data class | Ordinary active/closure retention | Verified-erasure behavior | Final disposition |
|---|---|---|---|
| Adult identity and household | While open; 3 years after ordinary closure | Delete/anonymize eligible profile and household fields within 30 days | Preserve only separately listed exceptions |
| Student identity/profile/relationship | While active or archived household exists; 3 years after ordinary household closure | Delete/anonymize exact Student within 30 days without deleting another Student | Revoke credentials, sessions, grants, registrations |
| Credential hashes | While restorable account/Student exists | Delete within 30 days; reset immediately replaces prior hash | Cryptographic deletion |
| Sessions/setup/reset tokens | Session/token TTL, revocation, or use; redacted event metadata 30 additional days | Revoke immediately; delete token material | Redacted event expires after 30 days |
| Consent/policy acceptance | While account exists; 7 years after supersession or closure | Retain minimized immutable evidence for 7 years | Delete after seven years unless scoped hold |
| Attendance/progress/playback/badges | While account exists; 3 years after ordinary closure | Delete/anonymize exact Student within 30 days | Other Students’ records remain unchanged |
| Private questions and answers | While account exists; 2 years after ordinary closure | Delete exact Student content within 30 days except scoped legal hold | Retain hash-only action tombstone |
| Student support | While active; 3 years after ordinary closure | Delete exact Student message content within 30 days except material-security hold | Retain minimized security action only when explicitly classified |
| Adult support/GHL conversation | 3 years after last support event | Delete/anonymize eligible content within 30 days | Preserve suppression/required audit separately |
| OBS operator-device source | Only until upload/Drive handoff and S3 object-version, byte-count, and SHA-256 readback | Secure-delete after the same readback | Upload must begin within 24 hours; failure opens an incident and no copy is silently abandoned |
| Unmatched, quarantined, or terminal-failure source | 30 days from entering that state | Delete sooner under erasure when subject association is known | Delete every S3 version, Drive/provider copy, and multipart residue |
| Unapproved content draft | While processing/review is active; 90 days after last governed activity | Delete/redact subject data within 30 days | Delete all S3 versions and processor copies |
| Published original source | While corresponding content remains published; 90 days after unpublish/archive | Apply shared-media erasure process within 30 days | Delete all S3 versions, Drive copies, and replication copies after safe replacement/restriction |
| Unpublished/superseded derivative or Vimeo asset | 30 days after unpublish, supersession, terminal failure, or abandoned upload | Delete/redact within 30 days | Delete all provider versions/copies and revoke references |
| Approved transcript/captions/worksheet/knowledge artifact | While published; 3 years after unpublish/archive | Redact/delete exact subject within 30 days | Preserve only a clean shared replacement when needed |
| Zoom meeting/registrant records | Through reconciliation; 90 days after occurrence | Revoke/delete exact Student registrant promptly; shared meeting remains for other participants | Minimized attendance follows its own row |
| OpenAI processor request/output copies | Only for active processing and the approved provider-retention period, which may not exceed 30 days | Issue provider deletion where available and delete local transient copies within 30 days | Approved human-reviewed ContentVersion remains under its content row |
| Billing signed receipts/access projection | While account exists; 7 years after final financial event | Retain only legally required minimized financial evidence for 7 years | Delete after seven years/hold |
| Marketing consent/delivery history | While purpose exists; 7 years after last event | Retain minimized consent/suppression evidence for seven years | Delete after period |
| Suppression/complaint tombstone | Indefinite while needed to prevent prohibited recontact | Never converted back into a marketing profile | Normalized contact hash/provider reference, reason, time only |
| Application logs | 30 days | Same | Automatic deletion |
| Security/audit logs | 1 year online; exactly 7 years for material privileged, consent, financial, erasure, or security actions | Retain only the material minimized record | Delete at seven years unless scoped hold |
| Encrypted export package and download authorization | Package: exactly 7 days after completion; each authorization: one use and exactly 15 minutes after issue | Delete package sooner when the governed request is canceled or subject erasure makes retention ineligible; revoke every grant immediately | Cryptographic/package deletion plus redacted request audit |
| Primary backups | Rolling 35 days | No selective mutation; independent purge ledger reapplied before any restore receives traffic | Automatic/cryptographic expiry |
| Independent deletion/purge ledger | 7 years after erasure completion | Hash-only record remains immutable for replay/evidence | Delete after seven years when no hold remains |
| Acceptance/canary evidence | 1 year after release unless reclassified as material security/financial evidence | Remove subject data within 30 days | Delete or retain redacted material evidence under its row |

Every content/provider deletion enumerates and deletes all S3 object versions and delete markers, incomplete multipart uploads, cross-region replicas when applicable, Drive copies, processor copies, and Vimeo assets. A delete marker alone is not deletion. Jobs are idempotent, audited, provider-reconciled, and remain incomplete while any required copy is unverified.

## PCR-013. Export and correction

Every export, correction, closure, erasure, or consent-withdrawal request is a `DataRightsRequest` with the exact lifecycle:

```text
received -> identity_verified -> approved -> executing
executing -> completed
executing -> provider_pending -> completed
executing -> failed
provider_pending -> failed
```

An authorized privacy Admin may move `identity_verified -> denied` with an exact reason. A terminal first-party execution error may move `executing -> failed`; `provider_pending -> failed` is allowed only after canonical reconciliation proves terminal noncompletion and no effect remains uncertain. The requester may move `received|identity_verified -> canceled`. No other transition is valid. A provider timeout or uncertain effect remains `provider_pending`; it never produces a false completion.

Requester-visible active status has exactly these deterministic values:

| Internal state/evidence | Requester-visible status |
|---|---|
| `received`, `identity_verified`, or `approved` | `requested` |
| `executing` | `processing` |
| `provider_pending`, or `completed` with a permitted legal/provider exception | `partially_excepted` |
| `completed` with no remaining exception | `completed` |
| `denied` or `failed` | `failed` |

`canceled` is a requester action outcome outside the active status list; the detail view may show a non-status “Request canceled” confirmation. No internal state name or other requester-visible status token is permitted.

### PCR-013.1 Export

The verified account owner may request a machine-readable and human-readable Parent export containing:

- adult/household information;
- Student profiles;
- consent versions and timestamps;
- enrollment/calendar summary;
- Parent-authorized attendance/progress/badge summaries;
- Parent-visible notices/support;
- billing/access projection and provider-hosted billing references.

The normal Parent export explicitly excludes Student recordings/library assignments and playback, private questions, Rabbi answers, Student technical-support bodies, Student notifications, and Student-to-Student comparison data.

Student-subject export is deterministic:

| Relationship | Authorized requester and verification | Required review | Delivery |
|---|---|---|---|
| `self` | The legally capable adult Student submits from the authenticated Student account and re-enters the Student password | The `self` relationship binds the same adult account owner; ordinary privacy validation applies | Protected download inside that Student account only |
| `dependent` | The verified Parent/account owner selects the exact dependent Student from the Parent privacy route and re-enters the Parent password | A privacy Admin separately reviews subject scope, requester authority, exclusions, delivery, and legal-policy requirements before `approved`; there is no automatic approval | The Parent receives only the normal Parent-visible export. Any legally required private subject package uses the delivery method authorized in the separately reviewed case and is never exposed through ordinary Parent UI |

A dependent Student account exposes no self-service export, correction, closure, erasure, or consent-withdrawal route and cannot initiate a `DataRightsRequest`. A separately binding legal disclosure request follows the named legal-review process and a dedicated audit record, never an ordinary Parent download.

The Student package may contain only that Student’s profile, scoped consent, enrollment/calendar, attendance/progress/badges, playback/resume, notifications, private questions/Rabbi answers, and Student support. It excludes another Student’s identity/data, shared raw recordings, provider secrets, and other participants’ leaderboard details.

The export:

- is prepared asynchronously;
- is stored as an encrypted generated package for seven days after completion, then deleted under the export-artifact retention job;
- is issued only after recent-password reauthentication;
- uses a one-time download authorization that expires exactly 15 minutes after issue;
- is logged;
- completes within 30 days.

### PCR-013.2 Correction

The Parent may correct household and dependent/self Student profile fields permitted by the role matrix and may submit a separately reviewed dependent-Student correction request. A legally capable adult Student with relationship `self` may request correction of their own private question/support or learning record from the Student account. A dependent Student has no self-service privacy correction route. An Admin appends a correction/revocation record rather than rewriting immutable history. Admin-only correction is required for billing evidence, consent evidence, attendance, provider linkage, relationship `self|dependent`, and ownership transfer. Every correction records old/new safe digests, reason, actor, and audit.

## PCR-014. Deletion and account closure

### PCR-014.1 Request

The verified account owner may submit:

- **ordinary household closure**, which revokes product access and starts three-year ordinary retention;
- **verified adult/household erasure**, which overrides ordinary retention for eligible data;
- **verified erasure for an exact dependent Student**, without seeing that Student’s private content.

An adult Student with relationship `self` may request their own Student erasure from the Student account. A dependent Student cannot initiate erasure; only the verified Parent/account owner may submit the exact dependent-Student request, and a privacy Admin must separately review it before approval. Recent-password reauthentication is required for the authorized requester; no MFA enrollment or challenge is introduced.

### PCR-014.2 Effect

Ordinary closure:

- does not equal subscription cancellation and creates no refund;
- revokes household Student credentials, sessions, classroom/playback grants, future provider registrations, and non-required communication;
- preserves records under the ordinary three-year schedule;
- may later be followed by verified erasure.

Verified erasure:

- does not equal subscription cancellation;
- does not create a refund;
- revokes the exact subject’s credentials, sessions, and grants immediately;
- ends future product communication except required closure/security messages;
- writes the independent hash-only purge-ledger record before primary deletion;
- queues exact primary/provider deletion, anonymization, or shared-media redaction;
- preserves only named billing, consent, suppression, material-security/audit, legal-hold, and purge evidence;
- completes eligible deletion/anonymization within 30 days or remains `provider_pending` with a visible exact exception.

### PCR-014.3 Provider cascade

The erasure case tracks separate status for:

- One Time primary data;
- GHL adult contact and each household-keyed record;
- household-scoped Stripe Customer/subscription evidence where deletion is legally permitted;
- exact Student Zoom registrant/session rather than a shared meeting;
- S3 object versions, Drive source, managed derivatives, processor copies, and multipart residue;
- Vimeo source/replacement assets;
- Telegram notification references;
- independent purge ledger and primary backups.

A provider failure produces a visible reconciliation case and retry; it never produces a false “fully deleted” confirmation.

Shared media follows this exact sequence:

1. identify affected assets through RecordingParticipantSnapshot and ContentParticipant;
2. immediately restrict/unpublish the affected published version while erasure work runs;
3. reference-count other Students and content uses; never delete another Student’s record;
4. create a new immutable replacement using cut, mute, blur, transcript/caption/worksheet redaction, as required;
5. require human redaction approval and provider readback before publishing the replacement;
6. delete every superseded S3/Drive/processor/Vimeo copy and version after replacement readback;
7. if safe redaction is infeasible, keep the affected asset permanently restricted and inaccessible rather than republishing it.

Deleting one Student revokes only that Student’s Zoom registrant/session and local assignment unless a shared resource itself must be restricted. Other Students’ attendance, questions, progress, consent, and credentials are never deleted as collateral effect.

Before deletion begins, the hash-only DeletionPurgeRecord is appended to the ledger outside primary backups. The ledger uses S3 Object Lock, versioning, integrity chaining, and cross-region copy. Any restore replays every tombstone newer than the restored point before traffic, executes missing primary/provider purges, and proves the erased subject does not reappear.

## PCR-015. Consent withdrawal

Withdrawal is scope-specific and append-only:

| Scope | Immediate effect | Existing data |
|---|---|---|
| `service_account` | block new Student sessions and begin ordinary closure; erasure remains a separate explicit request | retain under closure schedule unless erasure follows |
| `recording_participation` | block new live-class launch grants for that Student; do not block authorized library playback | immediately restrict affected published versions, create privacy review, and complete redaction/replacement or permanent restriction within 30 days |
| `member_recognition` | replace identifying attribution with the stable class-scoped nonidentifying alias on rankings, member-visible badges, and approved questions; the subject still sees `You` | rank, learning facts, and badge facts remain unchanged; named-attribution caches are invalidated immediately |
| `playback_authorization` | not withdrawable as consent; recomputed from Student/enrollment/access/assignment/revocation | recording/recognition withdrawal alone does not revoke otherwise authorized playback |

Every withdrawal records actor, exact Student, scope, policy/consent version, time, reason, affected grants/projections, and audit. Recording-related existing content enters the shared-media sequence in PCR-014.3 and is reviewed within seven days. Backup copies expire under the 35-day schedule and, if restored, the independent purge/withdrawal ledger is replayed before traffic.

For a dependent Student, only the current verified Parent/account owner may withdraw a scope. A verified adult Student with relationship `self` may withdraw their own `recording_participation` or `member_recognition` from the self-managed Student privacy route; recording withdrawal immediately revokes outstanding live-class launch grants and blocks join, while otherwise authorized playback remains derived and available.

## PCR-016. Ownership transfer and loss of access

Because there is one active account owner:

- the current owner may request a verified transfer;
- an Admin may begin recovery after identity and authority verification;
- the proposed new owner receives a single-use seven-day setup/acceptance link;
- transfer cannot complete while the outgoing owner has an active `self` Student in the household; before acceptance, the outgoing owner or Admin must archive that Student or move it, with identifier and immutable history preserved, to another household the outgoing adult owns with an available seat;
- a `self` Student is never auto-converted to `dependent` and never becomes the replacement owner’s Student;
- dependent Students remain in the household, but transfer completes only after the replacement owner records current authority and current `service_account` plus `recording_participation` acceptance for each exact dependent; prior consent evidence remains immutable, and optional `member_recognition` is not carried forward without the replacement owner’s separate choice;
- the replacement owner accepts current policies;
- the replacement normalized email resolves to the one existing `AdultPerson` and one global `HumanAccount`, or creates that single identity/account when none exists;
- `parent` membership is added idempotently to that `HumanAccount` when absent, including when it already has `admin`; transfer never creates a second login for the same normalized email;
- every prior-owner session that authorizes the transferred household, every outstanding prior-ownership setup/reset token, and every outstanding household billing-portal session is revoked;
- dependent Student accounts and household history remain; an archived or moved `self` Student preserves identity and immutable history under its resulting scope;
- the household’s existing Stripe Customer/subscription references and household-keyed GHL opportunity/account record are reassociated through the approved GHL-hosted billing orchestration; they are not recreated, shared with another household, merged into another household, or stripped of financial history;
- the old owner loses access to this household without losing unrelated Admin membership or another separately owned household;
- the transfer is fully audited.

The final precondition/consent recheck, owner change, membership addition, session/grant revocation, and provider-reassociation enqueue are one atomic first-party transition. A provider failure leaves a visible reconciliation case and never restores the prior owner or creates simultaneous co-owner access.

## PCR-017. Security controls affecting privacy

Required:

- server-derived actor, household, Student, and product scope;
- parameterized data access;
- adult passwords of 12–128 Unicode code points and Student passwords of 8–64 Unicode code points, with no composition rule but rejection of common/compromised values and values normalization-equivalent to the applicable email, name, or username;
- versioned Argon2id password hashing with a unique salt and upgrade-on-success for obsolete valid hashes;
- `Secure`, `HttpOnly`, host-scoped session cookies with an explicit `SameSite` policy, plus same-origin CSRF protection on every state-changing browser request;
- login limits of 5 failures per normalized account-identity/source-IP pair per 15 minutes and 50 failures per source IP per 15 minutes;
- password-reset-request limits of 5 per normalized account identity per hour and 20 per source IP per hour, and setup-link resends limited to 3 per account per hour;
- generic authentication/recovery responses, automatic bucket decay, and no permanent account lock;
- session rotation on login and active-role switch, plus revocation on password reset, username change, ownership transfer, disable, archive, or explicit revoke;
- Admin session idle/absolute expiry of 30 minutes/12 hours, Parent expiry of 24 hours/30 days, and Student expiry of 7 days/30 days, with no remember-me override;
- single-use hashed setup tokens expiring after seven days and reset tokens expiring after 60 minutes; replacement issuance invalidates every earlier unused token for the same subject/purpose;
- single-use, initiating-session/action-bound OAuth and same-origin provider callback state expiring after ten minutes;
- one-use classroom bootstrap grants expiring after 60 seconds and playback grants expiring after five minutes;
- signed provider webhooks with a maximum raw request body of 2 MiB, a five-minute signature timestamp tolerance, replay rejection, and provider-event idempotency;
- replay/idempotency protection;
- encryption of provider secrets and sensitive references;
- cross-household and sibling denial;
- least-privilege provider scopes;
- dependency/secret/PII scanning;
- encrypted backups and restricted restore authority.

MFA is not a launch capability. There is no MFA enrollment, challenge, recovery-code, SMS/email challenge, or optional-MFA preference surface.

## PCR-018. Incident and breach response

A suspected privacy or child-data incident:

1. enters the severity/incident process in `13-OPERATIONS-SLO-DR-INCIDENT-v2.1.md`;
2. preserves relevant redacted evidence;
3. disables affected provider/job/surface through an approved kill switch;
4. does not delete evidence or broadly expose the affected data;
5. identifies affected data subjects, providers, time range, and access;
6. receives product-owner and legal review for required notification;
7. creates corrective acceptance cases before reactivation.

Telegram and GHL are not used to broadcast sensitive incident details.

## PCR-019. Acceptance

Release requires:

1. all six exact `legal/` artifacts exist, every policy digest matches `legal-policy-manifest.json`, and the manifest contains the named product-owner and qualified-legal-reviewer approval evidence required by PCR-001;
2. one required initially unchecked unified agreement control and its precise adult consent facts are proven; no separate marketing checkbox exists;
3. `service_account`, `recording_participation`, and optional `member_recognition` persist as separate exact-Student records with relationship-authorized actor, linked adult/Student, policy/copy version, exact choices, timestamp, and withdrawal evidence; dependent Student sessions cannot manage consent, while a verified `self` adult Student can manage their own eligible recording/recognition scopes; `playback_authorization` is proven derived rather than stored as consent;
4. missing/withdrawn `service_account` blocks Student activation/session use, missing/withdrawn `recording_participation` blocks live-class launch only, and missing/withdrawn `member_recognition` swaps identifying attribution for the stable class alias without changing rank or learning facts;
5. a real consented Student joins the embedded class through a one-use 60-second launch grant, and no unconsented Student can do so;
6. the visible and verbal recording disclosure, consent roster check, OBS start/stop evidence, direct/Drive upload, S3 object-version/byte-count/SHA-256 readback, and operator-device deletion sequence are proven; Zoom cloud recording remains disabled and cannot be fallback;
7. Parent cannot view Student class, library, private questions, or Rabbi answers;
8. no Student GHL contact exists;
9. leaderboard, member-visible badge, and approved-question attribution use first name plus last initial/approved safe display only with current `member_recognition`; otherwise the subject sees `You` and peers see the same stable class-scoped nonidentifying alias, with rank and underlying facts unchanged;
10. `RecordingParticipantSnapshot` and `ContentParticipant` evidence is complete for every potentially recorded Student, and unresolved evidence fails publication closed;
11. `gpt-4o-transcribe` and pinned `gpt-4.1-mini-2025-04-14` outputs remain drafts; model/prompt/glossary/schema/policy versions are stored and human approval plus mandatory name/username/contact/sensitive/private-content redaction is proven before publication;
12. Parent, adult `self` Student, and separately reviewed Parent-initiated dependent-Student export/erasure cases all follow PCR-013 deterministically; dependent Student accounts expose no data-rights route, the UI exposes only `requested|processing|completed|partially_excepted|failed`, and each export uses recent-password reauthentication plus a one-time 15-minute download and contains no sibling, other-participant, provider-secret, or shared-recording data;
13. ordinary closure and verified erasure produce different states and schedules, exact-Student erasure never deletes another Student’s records, and every provider-cascade/shared-media branch reaches verified deletion/replacement or an explicit `provider_pending`/permanently restricted result;
14. retention, all-S3-version/delete-marker/multipart/provider-copy purge, 35-day backup expiry, independent seven-year purge ledger, and pre-traffic restore replay are configured, exercised, and observable;
15. ownership transfer blocks an outgoing-owner active `self` Student until audited archive or same-owner household move, never auto-converts that Student, requires replacement-owner authority and current required consent for every dependent, reuses the one adult identity/account, adds `parent` membership when required, preserves household Stripe/GHL/financial history, and revokes prior household and billing-portal authorization;
16. password, rate-limit, session, setup/reset/callback, launch/playback-grant, webhook-size/tolerance, replay, and cross-household denial cases prove the exact PCR-017 values;
17. logs/screenshots/traces contain no credential, token, raw provider link, or unnecessary private Student content;
18. privacy incident kill switches and escalation are exercised safely.
