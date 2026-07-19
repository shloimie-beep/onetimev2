# Resume: ONE-TIME-FINISH-NOW

Current state: safe core runtime is live on production and staging at
`rabbi-day-one-crm-ed77a04` / `ed77a04dd24391d5b79be7f839d7f5752a57e0f9`.
CRM approval raw, corrected counts-only real-source preflight, guarded local CRM
apply code, protected transactional email inputs, staging delivered
transactional email proof, production transactional email deployment/smoke
proof, and current production read-only launch-spine route proof are recorded.
`CRM_REAL_DATA` remains `PREVIEW_READY`. The full release claim remains blocked
by protected-input gates, CRM production apply gates, final production admin
access, provider canary authorization, diagnostics token, and the consuming
parts of production launch-spine proof.

## Start Here

1. Read `AGENTS.md`.
2. Read `ops/director/START-HERE.md`.
3. Read `ops/codex-runs/ONE-TIME-FINISH-NOW/STATE.json`.
4. Read `ops/codex-runs/ONE-TIME-FINISH-NOW/CAPABILITY-MATRIX.json`.
5. Read `ops/codex-runs/ONE-TIME-FINISH-NOW/FINAL-REPORT.md`.
6. Run `npm run director:truth:live` before relying on the director as current
   production truth.

## Current Truth

- Production URL: `https://join.onetimeonetime.com`
- Staging URL: `https://ot99-web-staging.up.railway.app`
- Production and staging version: `rabbi-day-one-crm-ed77a04`
- Production and staging runtime SHA:
  `ed77a04dd24391d5b79be7f839d7f5752a57e0f9`
- Canonical draft PR: `https://github.com/webcraft-media/onetimev2/pull/91`
- PR #92 pushed evidence head inspected before this handoff refresh:
  `92e17cedba4e0ad5a99cd132772ff7a4acadb409`
- PR #92 checks at that pushed head showed the same GitHub-side pre-step
  failure pattern as earlier: all five jobs completed as failure with
  `steps:null` and `logs_url:null`; local gates and live smokes passed. Read
  the PR or `git rev-parse HEAD` for the current branch head after later
  handoff commits.
- Current staging web deployment:
  `0bf927dd-bab7-407b-afd2-35983d8c7351`
- Current staging worker deployment:
  `385e3b5b-41f4-417d-996b-09e3b1a1f8e3`
- Current production web deployment:
  `a3a9328c-3fb5-41c6-b8d4-cf402f400ca7`
- Current production worker deployment:
  `37ce9edf-d7aa-40fc-a013-87dde0f29e72`
- Isolated worktree:
  `C:/Users/User/.onetime-worktrees/ONE-TIME-FINISH-NOW`

## What Is Accepted

- Current production and staging `/version`, `/health`, and `/ready` readbacks
  at `rabbi-day-one-crm-ed77a04`.
- Current production and staging web/worker Railway deployments are successful.
- W13-104 fresh PG18 backup/restore proof passed before production deployment.
- W13-103 production protected browser acceptance passed for administrator,
  parent, and student identities.
- OPS-13A CRM source inventory and counts-only preview are available as
  preflight input.
- CRM operator approval raw is preserved in
  `ops/codex-runs/ONE-TIME-FINISH-NOW/CRM-IMPORT-APPROVAL-RAW.md`.
- Corrected CRM-first counts-only dry-run passed with status `done`; report
  SHA-256 is
  `93be5a0837d3d90f8995e873c2ea302987f45e0e52de79f08170f01a6223f1d8`. It found
  1,559 CRM-importable contacts, 1,357 email-campaign-eligible contacts, 0
  WhatsApp-campaign-eligible contacts, and 848 manual-review rows.
- Guarded real-source CRM apply writer is implemented locally and accepted with
  synthetic integration evidence; production apply performed zero writes.
- CRM production apply readiness preflight is recorded in
  `ops/codex-runs/RABBI-DAY-ONE-CRM/crm-apply-readiness-preflight.json`. It
  confirms source packet, corrected dry-run proof, private authorization,
  operator authorization, idempotency, manual-review handling, and production DB
  configuration are present, and blocks before any write, send, or provider
  mutation.
- Sanitized email-inputs preflight verifies protected Resend/domain/sender/
  reply-to/canary/private-manifest inputs are present and policy-matching.
  Staging controlled transactional lifecycle email was provider-delivered to
  the protected operator inbox; no private destination, secret, or raw token was
  committed.
- Production transactional email code/config is deployed and smoked. Production
  controlled send and final admin access remain blocked because production has
  zero active owner/admin users; fresh bootstrap or role-access authorization is
  required before creating or refreshing the administrator access message.
- A protected private CRM checkpoint manifest exists with production apply
  authorization present; contents are not committed or printed.
- PR #92 staging runtime proof passed: staging deployed PR #92, rolled back to
  W13-104, and rolled forward to PR #92 with `/version.deployment` matching the
  serving Railway web deployment.
- Current production read-only launch-spine proof passed for 16 of 16 GET-only
  route checks, including public/account lifecycle routes, known 404 behavior,
  and anonymous denial for private app routes.
- Launch-spine consume readiness preflight is recorded in
  `ops/codex-runs/ONE-TIME-FINISH-NOW/launch-spine-consume-readiness-preflight.json`.
  It confirms current read-only route proof and the W13-103 role baseline are
  present, then blocks before any form submit, production write, setup/reset
  link consumption, send, or provider mutation.
- Provider canary readiness preflight is recorded in
  `ops/codex-runs/ONE-TIME-FINISH-NOW/provider-canary-readiness-preflight.json`.
  It covers WhatsApp, Telegram, Zoom, Vimeo, OpenAI helper, BNA support, Stripe
  TEST, and Buffer, then blocks before any provider call, send, write, charge,
  or production DB access.
- Current OPS-06 production synthetic probes passed public/login/readiness and
  private-denial checks; protected diagnostics remains blocked by missing
  `OPERATIONS_PROBE_TOKEN`.

## What Is Blocked

- Normal transactional access email/final admin access: protected One Time
  Resend inputs are present, Railway variables are configured on staging and
  production, staging controlled transactional email was delivered, and
  production is deployed/smoked. Production controlled send and final admin
  access are blocked by missing active production owner/admin actor.
- Real CRM import apply: corrected dry-run and guarded local apply code are
  recorded, but production apply readiness remains blocked by missing fresh
  backup proof JSON, created-by user key, and
  `RABBI-DAY-ONE-CRM-PRODUCTION-APPLY-OK`.
- Provider canaries: W13-104 provider evidence is present, but all eight
  non-email provider lanes remain not ready to run. The protected canary
  manifest, exact operator authorization, and
  `ONE-TIME-PROVIDER-CANARIES-OK` confirmation are missing.
- Protected diagnostics: missing `OPERATIONS_PROBE_TOKEN`.
- Consuming launch-spine proof: current read-only route proof is recorded, but
  readiness remains blocked by missing protected consume plan, cleanup
  instructions, exact operator authorization, production confirmation,
  administrator/parent/student journey inputs, and production signup lead input.
  Either a complete role-journey path or a complete production-signup path must
  be present before any consuming browser action.

## Runtime Proof Caveat

Production and staging `/version` now report `rabbi-day-one-crm-ed77a04` and
`ed77a04dd24391d5b79be7f839d7f5752a57e0f9`. The later evidence commits are
handoff-only; use PR #92 or `git rev-parse HEAD` for the current branch head.

## Next Executable Packets

1. Complete the consuming production launch-spine proof only with exact
   protected authorization and cleanup instructions. The required exact
   authorization statement is
   `APPROVE_ONE_TIME_PRODUCTION_LAUNCH_SPINE_CONSUME:120b0a9129c8937b679cb7016b0be510e855eead26d689561e7781db8988f1e9:7c342640c2ff7bb886e0b79f43ec9f3466283279e7bbfcf3cd65ee39f976e41a:production`,
   and the required production confirmation is
   `ONE-TIME-PRODUCTION-LAUNCH-SPINE-CONSUME-OK`.
2. Provide fresh bootstrap or role-access authorization for an active
   production owner/admin actor, then run exactly one controlled production
   transactional access email proof before refreshing final administrator
   access.
3. Record fresh backup proof JSON, created-by user key, and
   `RABBI-DAY-ONE-CRM-PRODUCTION-APPLY-OK` before any CRM production import
   apply. The source packet, corrected dry-run proof, private/operator
   authorization, idempotency, manual-review handling, and production DB
   configuration are already present.
4. Activate provider canaries independently: Zoom, Vimeo/content, Stripe TEST,
   WhatsApp, Telegram, OpenAI helper, Buffer, and BNA support bridge. Required
   exact authorization:
   `APPROVE_ONE_TIME_PROVIDER_CANARIES:072c4f00a22a7ca406792b55208b827c16c9dc39e651894ba708dc30777524ac:whatsapp,telegram,zoom,vimeo,openai_helper,bna_support,stripe_test,buffer:production`.
   Required confirmation: `ONE-TIME-PROVIDER-CANARIES-OK`.

## Safety Rules

- Do not print or commit private manifests, tokens, emails, phone numbers,
  setup links, reset links, passwords, contact rows, or raw message bodies.
- Do not send broad email, WhatsApp, Telegram, or social messages.
- Do not perform live Stripe charges.
- Do not change DNS.
- Do not perform destructive migrations or production imports without exact
  protected authorization, terminal manual-review decisions, and fresh
  backup/rollback proof.
- Do not use the dirty BNA checkout for One Time product edits.
