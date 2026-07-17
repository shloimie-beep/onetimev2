# OPS-13A Final Report

Status: prepared with no external mutations.

OPS-13A created the real-data/provider preflight packet only. It did not deploy, import, send, create meetings, upload videos, mutate providers, read production private rows, or change production state.

## Dynamic State

- Current live source: `https://join.onetimeonetime.com/version` returned `ops11-1197673`, commit `1197673fa409bfc4c649c2683f782e86775caa5e`.
- Live readiness: `/health` and `/ready` returned 200. `/ready` reported database ok and schema latest `2190_ot109_rabbi_content_publisher`.
- `/api/deploy-info` returned 404, so `/version` remains the current deploy source proof.
- PR #61 is open, draft, clean, and green: `release/ops10-full-staged-production-launch-20260717T050800Z` at `c7d46066517d7a458d189f2c782cc06200f7861c`.
- Active W12 PRs #62-#71 were refreshed. #69 and #70 are unstable from failing Node 24 verify checks; the rest are clean/green.
- Railway production identity is `one-time-production`; staging identity is `one-time-ot99-staging-96b42905`. Values are recorded in `STATE.json` without secrets.
- Production DB state from OPS-11: PostgreSQL 18.4, 35 migrations applied/idempotent, latest `2190_ot109_rabbi_content_publisher`, native backup/restore proof passed.

## Real Sources

The exact sanitized source inventory is in `SOURCE-INVENTORY.json`.

- Primary One Time/Rabbi candidate: `Rabbi Scheller Followers.xlsx`, 812 estimated rows, 2 columns, SHA-256 recorded.
- Email audience sources: 5 files, 1,697 estimated rows, sanitized header signals for email/name/phone/address/subscription status.
- Combined primary One Time/email preview: 6 files, 2,509 naive source rows before dedupe.
- Legacy CRM/pipeline candidates: 29 files, 125,914 naive rows. These are candidate-only; no GHL runtime is active.
- Communication exports: 13 files, 3,551 rows, reference-only. No message bodies are imported or printed.
- Contact-list candidates, external lead lists, and unknown spreadsheets remain excluded until source ownership and consent basis are explicitly confirmed.
- No canonical old Replit database export was identified in scanned metadata. Only related prompt bundles, JSON configs, migration files, and repo artifacts were found.
- Existing production contacts/leads/households/members/learners/consent/suppression/signup counts were not read because this repo's guardrail forbids production private-data reads for this task.

## CRM Map

`IMPORT-PREVIEW.json` records the exact field and tag plan.

- Identity: email and phone normalize privately for matching; artifacts record only counts and fingerprints.
- Contact fields: display name, family/school classification, source, lead status, reminder preference, consent policy/version, and suppression state map to `onetime.contacts`.
- Signup rows map to `onetime.signup_leads`.
- Provenance and legacy activity map to `onetime.crm_contact_facts` and source tags.
- Household/learner signals are gated to `portal_households`, `portal_guardian_relationships`, `portal_learners`, and consent records only after manual review.
- Communication exports stay reference-only unless a later prompt authorizes a redacted communication-history import.

## Import Preview

- No dry-run batch or import write was created in OPS-13A.
- The first OPS-13B import action must be a dry-run only preview using the `legacy_audience_import_*` tables.
- Manual-review blockers include identity splits, conflicting consent/suppression, household ambiguity, minor/student safety uncertainty, unclear source ownership, and any private-message/note content.
- Suppression precedence is strict: manual/legal suppression, complaint, hard bounce, STOP, unsubscribe, or provider suppression beats any subscribed/import-eligible signal.

## Rollback Plan

- Before any OPS-13B write, refresh backup freshness or create a new protected backup outside Git.
- Record only counts and affected-record summaries.
- Use `legacy_audience_rollback_records` for approved import batches.
- Rollback remains forward-only after merge; do not replace or delete the production DB service.

## Provider Readiness

`PROVIDER-READINESS.json` records the full matrix and canary plan.

- Email/Resend: live readiness says transport ok; controlled activation/reset canaries only.
- WhatsApp: runtime exists but live transport is disabled; one allowlisted recipient only after protected canary config.
- Telegram: implementation verified; live canary blocked until protected bot/identity mapping exists.
- Zoom: implementation verified; one real meeting and two registrants maximum only after fresh explicit approval/config.
- Vimeo: implementation verified; one owned private test video inspection only, upload count zero unless explicitly enabled.
- Stripe test: implementation verified; one test-mode checkout/webhook canary only.
- OpenAI/helper: approved class content only, no private data queries.
- Buffer: blocked until a Buffer account is connected.
- BNA bridge: OT-89A ready for later gate, but live support bridge is disabled.

## OPS-13B Prompt

`OPS-13B-CODEX-PROMPT.md` is executable and contains no unresolved placeholders. It instructs the next run to refresh external state, preserve privacy, perform dry-run counts first, and stop on any missing protected canary gate.
