# OT-89A Resume

Worktree: `C:/Users/User/.onetime-worktrees/OT-89A`

Remote: `https://github.com/webcraft-media/onetimev2.git`

Base branch: `codex/ot84-telegram-action-gateway`

Base commit: `f98103ecc3660dbda871a91485656e17580940a8`

Feature branch: `codex/ot89a-subscriber-support-producer`

Audited remote HEAD: `50b3a9c6790ee4befd457e16c4ac01674dc264ae`

Current status: `READY_FOR_OT99`

Clean-state check:

```bash
git status --short --branch
```

Completed in this readiness-repair pass:

- Reopened OT-89A after the remote-head audit and set STATE back to `in_progress`.
- Fetched and verified the authoritative branch/PR head at `50b3a9c6790ee4befd457e16c4ac01674dc264ae`.
- Replaced attachment byte filtering with true image decode/re-encode through `sharp`; supported PNG/JPEG/WebP uploads now strip metadata and reject malformed, trailing-byte/polyglot, dimension, pixel-count, and decoded-size violations.
- Raised the support JSON parser cap so base64 transport can carry the documented 10 MiB decoded attachment aggregate while decoded per-file and aggregate limits remain strict.
- Made support fail closed behind `OT89_SUPPORT_ENABLED`: unconfigured production defaults off, production mock BNA is forbidden, known test HMAC defaults are forbidden, and disabled support never renders a black-hole form.
- Added focused unit/integration/browser/a11y coverage for anonymous, non-subscriber, active subscriber, 360/390 mobile, keyboard/focus, successful receipt, duplicate submission, server failure, network failure, and file-read failure paths.
- Added a Playwright `PORT` override so local CI-mode browser verification can isolate its server from stale desktop processes while preserving default port 3100.
- Local Node/browser gates are green except for the repo-wide Windows CRLF `npm run format` caveat documented in `TEST-RESULTS.md`.
- Pushed repair commit `fed9c715da231bfb8cb31e534828ed3a4dbfc386` to the existing branch.
- Observed remote checks green on repair commit `fed9c715da231bfb8cb31e534828ed3a4dbfc386`: `Node 24 verify`, `PostgreSQL 16 assurance harness`, and `PostgreSQL 16 learner-seat proof`.

Local caveat:

- PostgreSQL service-backed verification cannot run on this machine: there is no listener on `127.0.0.1:5432`, `pg_isready`/`psql`/`initdb` are absent, Docker is absent, `npm run db:verify` fails because `DATABASE_URL` is unset, and OT-37/OT-83 workflow commands fail with `ECONNREFUSED 127.0.0.1:5432`.

Next exact commands:

```bash
git status --short --branch
gh pr checks 36 --repo webcraft-media/onetimev2
```

READY_FOR_OT99 was restored only after the repaired remote head went green, including the PostgreSQL service-backed GitHub checks.

Recovery steps:

- Do not create another branch or PR.
- Do not deploy, contact BNA, or contact providers.
- Do not reset or force-push the shared branch.
- If interrupted after this ready-doc update, resume from this worktree, run `git status --short --branch`, and review `ops/codex-runs/OT-89A/TEST-RESULTS.md`.
- Preserve the frozen contract file; do not regenerate or reformat `ops/codex-runs/OT-89A/SUPPORT-EVENT-CONTRACT.json`.
