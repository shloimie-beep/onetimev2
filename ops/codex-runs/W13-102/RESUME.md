# W13-102 Resume

Last updated: 2026-07-19T00:00:00+03:00

Worktree:

```powershell
cd C:\Users\User\OneTimeOneTime-w13-100-final-launch
git status --short --branch
git rev-parse HEAD
Get-ChildItem ops\codex-runs\W13-102
```

Current state:

- Branch: `release/w13-100-controlled-day-one-20260717T182046Z`
- Evidence head: `36c20fb62c7097b896a31c57e50860eb9f2339ef`
- Preserved production runtime source: `466d8489bb8c7a3a57f7590929b58e7857420e86`
- Production URL: `https://join.onetimeonetime.com`
- Current phase: runtime-change candidate validation for Phase 5/Phase 9

Safety notes:

- Do not use the dirty BNA checkout for this task.
- Do not print secrets, PII, raw activation/reset URLs, credentials, private paths containing user data, or source rows.
- Keep the W13-101 runtime live until a replacement passes staging and rollback gates.
- Missing optional credentials block only their lane.

Next actions:

1. Continue validation/deployment gates for the Resend webhook runtime candidate; keep production on W13-101 runtime until staging and rollback pass.
2. Fill the private identity authorization manifest with exact current recipient authorization, valid expiry, and the ephemeral apply phrase hash before any production identity apply.
3. Fill/approve the private CRM source acceptance manifest before any dry-run/rehearsal/import apply.
4. Add protected provider credentials/config per lane before any canary.
5. Do not apply production identity, email, CRM, or provider operations until their gate files are complete and sanitized.

Phase 1 evidence:

- Live HTTP smoke: `ops/codex-runs/W13-102/evidence/http-smoke.json`
- Production safe core audit: `ops/codex-runs/W13-102/evidence/production-safe-core-audit.json`
- Counts-only inventory: `ops/codex-runs/W13-102/evidence/production-counts-only.json`
- Railway deployment readback: `ops/codex-runs/W13-102/evidence/railway-deployment-readback.json`
- Fresh PG18 backup/restore proof: `ops/codex-runs/W13-102/evidence/production-pg18-backup-restore-summary.json`
- Production identity dry-run: `ops/codex-runs/W13-102/evidence/identity-activation-dry-run.json`
- Provider readiness snapshot: `ops/codex-runs/W13-102/evidence/provider-readiness-snapshot.json`
- CRM source discovery: `ops/codex-runs/W13-102/evidence/crm-source-discovery.json`
- Final public HTTP smoke: `ops/codex-runs/W13-102/evidence/final-http-smoke.json`

Phase 2 notes:

- Production identity command: `scripts/w13-102/identity/production-identity-activation.ts`
- Focused identity test: `tests/integration/accounts/w13-102-production-identity-activation.test.ts`
- Dry-run status: `dry_run_blocked`
- Apply blocker scope: production identity handoff only; missing private recipient fields and valid expiry are required before any production identity mutation.

Phase 5 continuation:

- Resend webhook runtime candidate: `apps/web/src/server/features/delivery/resend-webhook-router.ts`
- Route: `/api/v1/delivery/resend/webhook`
- Safety: mounted before `express.json`, raw-body only, Svix signature/timestamp required, durable redacted `provider_event_ledger` write before ACK, digest mismatch guarded, disabled unless `ONE_TIME_RESEND_WEBHOOK_ENABLED` and `RESEND_WEBHOOK_SECRET` are configured.
- Focused route test: `tests/integration/delivery/resend-webhook-route.test.ts`
- Real-send blocker scope: transactional email only; missing protected Resend API key, webhook secret, sender, reply-to evidence, and enablement remain required before any real send/canary.

Current terminal classification if stopped now:

- `CORE_LIVE_IDENTITY_HANDOFF_BLOCKED`
- Core remains live and healthy on runtime source `466d8489bb8c7a3a57f7590929b58e7857420e86`.
- Production login/role acceptance could not safely complete because identity apply is blocked on the private manifest and transactional email is blocked on missing protected Resend/sender runtime material.
- CRM source hashes are verified, but production import is blocked until the private acceptance manifest and tag-map approval are completed.
- Optional providers remain safely off or not configured; no canaries were executed.

Last local checks:

- Targeted Prettier check passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run secret:scan` passed.
- Focused W13-102 identity integration test passed.
- Provider control-center and delivery provider unit tests passed.
- Resend webhook route integration test passed.
