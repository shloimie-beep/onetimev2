# OPS-13B - One Time Real-Data and Provider Acceptance

Target repository: `webcraft-media/onetimev2`.

Start from branch `codex/ops13a-real-data-provider-preflight` or the branch/PR that contains the OPS-13A artifacts. The OPS-13A base was `origin/release/ops10-full-staged-production-launch-20260717T050800Z` at `c7d46066517d7a458d189f2c782cc06200f7861c`.

OPS-13B may perform bounded acceptance canaries only after the exact gates below pass. Do not deploy, import, send, create meetings, upload videos, mutate providers, or change production unless the matching bounded canary step explicitly allows that one action. Never print contact rows, email addresses, phone numbers, message bodies, passwords, tokens, private links, provider credentials, raw join links, upload tickets, webhook payloads, or database URLs.

## Required First Reads

Read these files before any action:

- `ops/codex-runs/OPS-13A/ORIGINAL-PROMPT.md`
- `ops/codex-runs/OPS-13A/STATE.json`
- `ops/codex-runs/OPS-13A/SOURCE-INVENTORY.json`
- `ops/codex-runs/OPS-13A/IMPORT-PREVIEW.json`
- `ops/codex-runs/OPS-13A/PROVIDER-READINESS.json`
- `ops/codex-runs/OPS-13A/FINAL-REPORT.md`
- `ops/codex-runs/OPS-13A/RESUME.md`

Also read repo `AGENTS.md`.

## Dynamic Refresh

Before changing or calling anything, refresh and record counts/status only:

1. `git status --short --branch`
2. `git fetch --all --prune`
3. PR #61 state, merge state, head SHA, and checks.
4. Open W12 PRs against `release/ops10-full-staged-production-launch-20260717T050800Z`.
5. Live endpoints:
   - `https://join.onetimeonetime.com/version`
   - `https://join.onetimeonetime.com/health`
   - `https://join.onetimeonetime.com/ready`
6. Railway production and staging identities, without printing env values.
7. Migration ledger and backup freshness. Production latest migration must be `2190_ot109_rabbi_content_publisher`.
8. The sanitized spreadsheet inventory identified by SHA-256 `EB3879DCFE361EBD65331214EF44D6F6F644CEAC1A130ED7080B80FD784E0296`. If it cannot be located, record `BLOCKED_SANITIZED_INVENTORY_NOT_FOUND` and stop data import work.

If `/version` no longer reports commit `1197673fa409bfc4c649c2683f782e86775caa5e`, record the new value and decide whether OPS-13B can still proceed from the new release state. Do not assume.

## Data Acceptance

Use the OPS-13A source inventory as the only approved source list unless the operator supplies a new sanitized inventory packet.

Approved dry-run source groups:

- `Rabbi Scheller Followers.xlsx`: 812 estimated rows, SHA-256 `e17bbb32c8b2e642b8a6c5041ee36e720467fc4e666b0b5d59de1bb7f688a405`.
- Email audience exports: 5 files, 1,697 estimated rows.
- Combined primary One Time/email dry-run scope: 6 files, 2,509 naive rows.

Default exclusions:

- Legacy CRM/pipeline exports: 29 files, 125,914 rows, excluded from write import until the operator selects exactly one canonical export group.
- Communication exports: 13 files, 3,551 rows, reference-only; do not import message bodies.
- Contact-list candidates, external lead lists, and unknown spreadsheets: excluded until explicit source ownership and consent basis are recorded.
- Old Replit export: blocked unless a canonical export is found and identified with sanitized metadata.

Run data work in this order:

1. Produce a dry-run only legacy audience preview.
2. Store only sanitized batch metadata, row counts, row fingerprints, match-candidate counts, disposition counts, segment counts, and manual-review category counts.
3. Do not create contacts, leads, households, learners, portal access, activation campaigns, outbox sends, or provider events during the dry run.
4. Stop if production private rows would need to be printed or exported.
5. Stop write-stage import until every manual-review category is `Done`, `Already satisfied`, `Blocked`, or `Needs operator decision`.

Required disposition categories:

- `matched_existing_contact`
- `stage_new_contact`
- `duplicate_input`
- `manual_review`

Required manual-review categories:

- `missing_email_and_missing_phone`
- `duplicate_input_same_identity`
- `email_match_phone_conflict`
- `phone_match_email_conflict`
- `same_name_different_identity`
- `conflicting_consent_or_suppression`
- `legacy_member_without_current_consent`
- `pipeline_stage_ambiguous`
- `school_vs_family_classification_ambiguous`
- `household_guardian_role_ambiguous`
- `learner_without_guardian`
- `minor_or_student_safety_unclear`
- `source_ownership_unclear`
- `external_lead_source_requires_operator_approval`
- `existing_production_record_conflict`
- `private_message_or_note_requires_exclusion`

Consent precedence:

1. Manual/legal suppression, abuse suppression, complaint, hard bounce, or provider suppression blocks all sends.
2. Explicit unsubscribe, STOP, opt-out, or unsubscribed export blocks sends until a later explicit opt-in is recorded.
3. Missing channel-specific consent blocks that channel.
4. Subscribed/opted-in source with no stronger suppression is preview-eligible only.
5. Unknown consent is manual review or non-send CRM only.

## Provider Acceptance

Provider canaries must run one at a time. Record only status, counts, digests, timestamps, and redacted proof. After any failed canary, stop dependent provider work and record rollback/no-mutation evidence.

### Controlled Email

Allowed budget: 1 activation email, 1 reset email, 0 broad sends.

Required gates: protected owner/admin test recipient, explicit provider-mode approval for one canary, unique idempotency keys, and no raw token, URL, or destination logging. If any gate is absent, record `BLOCKED_EMAIL_CANARY_CONFIG` and do not send.

### Telegram

Allowed budget: 1 allowlisted chat, 3 read commands, 1 confirmed local staging write, and 0 provider publish/payment/export/delete/role/provider mutation commands.

Required gates: protected bot token, webhook secret, active bot registry row, active allowlisted operator identity/chat mapping, and confirmation digest verification. If any gate is absent, record `BLOCKED_TELEGRAM_CANARY_CONFIG` and do not call Telegram.

### WhatsApp

Allowed budget: 1 allowlisted recipient, 1 outbound canary message, and counts-only webhook/status readback.

Required gates: protected staging provider config, approved canary environment, staging isolation true, protected recipient, canary authorization, canary budget, and controlled test copy only. If any gate is absent, record `BLOCKED_WHATSAPP_CANARY_CONFIG` and do not call WhatsApp.

### Stripe Test Mode

Allowed budget: 1 test-mode checkout session and bounded webhook projection for `checkout.session.completed`, `invoice.payment_succeeded`, and `customer.subscription.updated`. Live-mode actions are forbidden.

Required gates: protected Stripe TEST config, TEST canary authorization true, every object is test-mode, and product/price/currency/amount/provider scope/principal guardrails pass. If any gate is absent, record `BLOCKED_STRIPE_TEST_CANARY_CONFIG` and do not call Stripe.

### Zoom

Allowed budget: 1 real Zoom meeting, 1 occurrence, up to 2 controlled registrants, 1 learner SDK role check, and counts-only webhook validation.

Required gates: fresh explicit approval for this OPS-13B Zoom canary, protected Zoom account/API/SDK/webhook config, controlled registrants from protected allowlist only, and no host start URL, passcode, ZAK, access token, or raw join URL printed. If any gate is absent, record `BLOCKED_ZOOM_CANARY_CONFIG_OR_APPROVAL` and do not create a meeting.

### Vimeo

Allowed budget: 1 owned private test video inspection, 0 uploads unless explicitly enabled in protected config, and 1 playback projection check.

Required gates: protected Vimeo access token or owned private test video config, owned test video selected or upload-capable token explicitly authorized, private project/folder confirmed without printing private links, and no raw Vimeo URL, upload ticket, download link, token, or webhook payload logged. If any gate is absent, record `BLOCKED_VIMEO_CANARY_CONFIG` and do not call Vimeo.

### OpenAI/helper

Allowed budget: 1 approved One Time class content fixture, 3 helper queries, and 0 private-data queries.

Required gates: approved class content fixture, protected helper configuration verified without printing keys, queries avoid private student/household/contact/payment/provider credential data, and outputs are checked for source grounding and workspace isolation. If any gate is absent, record `BLOCKED_HELPER_CANARY_CONFIG_OR_CONTENT_APPROVAL` and do not call the helper.

### Buffer

Buffer is blocked until a Buffer account is connected. Allowed budget is zero provider drafts and zero scheduled posts. Record `BLOCKED_BUFFER_ACCOUNT_NOT_CONNECTED` and do not call Buffer.

### BNA Bridge

Allowed budget: 1 mock bridge event, 0 live BNA events, and 0 attachments.

Required gates: support bridge enabled in protected config, HMAC keys present without printing values, subscriber-only support route acceptance selected, and exact bridge contract authorizes the event. If any gate is absent, record `BLOCKED_BNA_BRIDGE_CANARY_CONFIG` and do not call the live bridge.

## Required OPS-13B Outputs

Create a new run folder `ops/codex-runs/OPS-13B/` with:

- `ORIGINAL-PROMPT.md`
- `STATE.json`
- `REAL-DATA-DRY-RUN.json`
- `MANUAL-REVIEW.json`
- `PROVIDER-CANARY-RESULTS.json`
- `BACKUP-ROLLBACK-PLAN.md`
- `FINAL-REPORT.md`
- `RESUME.md`

All outputs must be sanitized. If a provider or data gate is missing, mark only that lane blocked and continue with independent safe lanes.

## Completion Criteria

OPS-13B is complete only when dynamic state is refreshed, dry-run counts are recorded or blocked with a precise reason, manual-review categories are recorded, consent/suppression precedence is applied, every provider lane has terminal status, no private data or credentials are committed, relevant checks pass, and changes are committed, pushed, and opened as a draft PR unless the operator tells you not to publish.
