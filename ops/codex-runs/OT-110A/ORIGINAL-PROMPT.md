# OT-110A - One Time admin Content workspace and versioned prompt registry

## Mission

Build the missing operational Content experience inside the standalone One Time admin application. The Rabbi and authorized One Time admins must be able to see each class video move from private Vimeo source to transcript, approved knowledge, classroom artifacts, worksheets/newsletters, social drafts, and Buffer status. They must also be able to patch and version generation prompts safely. This is Rabbi/One Time content only, never Academy content.

## Source and branch

- Repository: `webcraft-media/onetimev2`
- Exact base: `codex/ops03-staging-readiness-repair` at `fb5f5eebc539afc9e93833e9417ee67524d62c36`
- Read for contract reconciliation: PR #48 `a62d6a73553e175871f6d3124badb96573cdabe7`, PR #46 `4155ee706fce2eabc6db5225b5c8ce41a8c1dfd1`, PR #44 `560a07c66baddc99df38441299f3e57107d02137`, and integrated PR #31/#32 behavior.
- New branch: `codex/ot110a-admin-content-workspace`
- Draft PR base: `codex/ops03-staging-readiness-repair`
- Use an isolated worktree. Do not merge the input PRs wholesale and do not edit BNA.

## Current gap to fix

At the base, `/app/content` is only a read-only list capped at ten items. There is no operational detail route, transcript review, artifact generation/review, prompt registry, newsletter artifact, full worksheet experience, or Buffer operating UI. Build these against typed feature-local ports so missing provider branches do not block the workspace.

## Information architecture

Add a single consistent One Time authenticated Content area with route-local loading:

- `/app/content` - overview and library with search/filter/sort/status, pagination, processing counts, and actionable cards/table;
- `/app/content/processing` - ingest/transcription/indexing queue, failures, retry eligibility;
- `/app/content/create` - start generation from an approved source/transcript;
- `/app/content/social` - social drafts, revisions, approval, schedule/status/retract controls;
- `/app/content/knowledge` - approved knowledge sections, indexing/readiness, entitlement projection;
- `/app/content/prompts` - prompt templates, immutable versions, patch/preview/activate/rollback;
- `/app/content/activity` - audited timeline;
- `/app/content/:sourceKey` - protected player/status, transcript/revisions, generated artifacts, approvals, publish state, and audit history.

Do not duplicate main categories/subcategories. Use the permanent One Time shell/tokens/header/footer behavior, strong contrast, clear type, 44px targets, responsive filters at 360x800 and 390x844, and no faded/disabled-looking names unless actually disabled.

## Content lifecycle

Model and display this state machine:

private source/reference or upload -> Vimeo processing -> transcript received -> transcript human review/approval -> derivative generation -> per-artifact review -> publish to library/knowledge/classroom -> optional exact-revision social approval -> Buffer schedule/publish -> status/retract.

Every step must be idempotent, account/product scoped, audited, recoverable, and show loading/empty/partial/error/retry states. Never claim provider success from a queued or sink result.

## Artifacts

Support versioned drafts and published revisions for lesson summary, review sheet, worksheet, newsletter/email draft, social caption variants by channel, short-clip plan with timestamps, helper-bot knowledge chunks with source timestamps/citations, and classroom resource.

Each generated revision records source ID, transcript revision/hash, prompt-template/version hash, model/provider policy identifier, generation run ID, output hash, creator, timestamps, review decision, and publication targets. Editing creates a new revision; it never silently rewrites an approved/published artifact.

## Prompt patching

- Immutable prompt templates and versions.
- A patch stores parent version, structured diff, reason, author, timestamp, and checksum.
- `Save draft`, `Preview/test`, `Activate`, and `Rollback/reactivate` are separate actions.
- Preview uses fictional or explicitly selected entitled content and cannot publish.
- Activating a prompt never rewrites earlier outputs and never automatically publishes.
- Generation always records exact prompt version and transcript revision.
- `prompt.manage` is an explicit capability. Do not infer it only from a friendly role label.

## Authorization

- Owner: all Content capabilities.
- Admin/Rabbi: view, review transcripts, generate/edit artifacts, and manage content according to explicit capabilities.
- `prompt.manage`, `social.approve`, `social.schedule`, and `content.revoke` are separately checked capabilities.
- Parent/student: only entitled published classroom/library/helper projections; never this admin workspace, raw transcripts, prompt templates, social drafts, provider data, or other learners.
- No impersonation and no `view as Rabbi` button.

## Provider ports

Create/reuse narrow interfaces for Vimeo status/playback/transcript, generation, knowledge indexing, Buffer drafts/status, and Telegram notifications. Ship deterministic adapters and complete UI/domain tests now. Do not add a second implementation of existing OT-86/OT-109 models; reconcile and document the exact delta. The later OPS-04C owner will connect OT-104R, OT-101R, PR #46, PR #48, and PR #44.

## Performance and privacy

- Route-split player/editor/social/calendar/prompt modules.
- Initial app/CRM routes must not fetch video, transcripts, knowledge, or social data.
- Content list fetches bounded summaries only; detail data loads after opening a source/tab.
- No raw private Vimeo/download/provider URLs, tokens, full provider payloads, or unrestricted transcripts in HTML bootstrap, logs, analytics, or browser persistence.
- Mark usable states only after visible actionable UI is painted.

## Verification

Test owner/admin capability matrices and negative cases, parent/student denial, list/detail/create/review/publish/retract flows, prompt patch/version/rollback semantics, exact-revision Buffer approval, transcript revision conflicts, provider-off states, deep links, refresh/back, responsive/mobile/RTL/reduced-motion/200% zoom, accessibility, bundle isolation, bounded requests, warm return, and no BNA/Operations request/source leakage.

Use the next collision-free additive migrations and update checksums/registry. Run lint, typecheck, unit, integration, e2e, accessibility, performance, build, secret scan, and disposable PostgreSQL proof.

## Persistent output

Persist `ops/codex-runs/OT-110A/{ORIGINAL-PROMPT.md,STATE.json,DECISIONS.md,INTEGRATION-DELTA.md,RESUME.md,FINAL-REPORT.md}`. Commit/push/open a draft PR even if all real providers are off. Report exact branch/head, routes/components/models/migrations, screenshots, tests/budgets, adapter boundaries, remaining provider wiring, and confirmation that Academy/BNA, production, DNS, broad sends, Buffer live publication, and charges were untouched.
