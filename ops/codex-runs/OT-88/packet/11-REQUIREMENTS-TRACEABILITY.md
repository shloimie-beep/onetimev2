# OT-88 Requirements Traceability

| Source requirement | Primary packet coverage | Verification hook |
|---|---|---|
| Downloadable packet named `OT88-zoom-classroom-codex-packet.zip` | ZIP artifact and `MANIFEST.json` | ZIP filename and external SHA-256 companion |
| Do not edit GitHub during packet generation | `README.md` | Packet contains files only; no repository/GitHub action performed |
| Direct Codex prompt | `01-DIRECT-CODEX-PROMPT.md` | Paste-ready prompt starts with preflight gates |
| Run only after remote `codex/ot84-telegram-action-gateway` | Direct prompt: source/branch gate | `git ls-remote --heads`, explicit fetch, blocked state |
| Resolve branch dynamically; no placeholder SHAs | Direct prompt: remote resolution | Actual `sourceCommit` required in `STATE.json`/final |
| Confirm OT-83 portal foundation | Direct prompt: two-part OT-83 proof | Provenance plus functional evidence paths |
| Create `codex/ot88-zoom-learner-classroom` | Direct prompt: clean worktree/target | Branch and PR head evidence |
| Locate One Time repo and use clean worktree | Direct prompt: repository discovery/worktree | Recorded path and clean pre-edit status |
| Persist prompt/state/resume/final under `ops/codex-runs/OT-88/` before edits | Direct prompt and `10-EVIDENCE-RESUME-CONTRACT.md` | Four files and initial checkpoint |
| $67 plan has up to three named learners, not three URLs | README, data model, prompt | Transactional 3-seat/fourth denial tests |
| Separate learner profile/login/device | Data model, authorization matrix, security | Sibling/wrong-session tests |
| Daily 19:00 `Asia/Jerusalem` | Data model, prompt | DST recurrence tests |
| Optional T-30 at 18:30 | Data model, reminder sequence, tests | Timezone + idempotency tests |
| Household entitlement, occurrence, enrollment, provider/registrant, grants, events, reminders, readiness | `02-DOMAIN-DATA-MODEL.md` | Migration/domain test coverage |
| Never expose raw Zoom URL/passcode/secrets/tokens in ordinary surfaces | Zoom findings, security, blueprint | Sentinel leakage suite |
| Resolve/generate launch material only after full checks | Prompt, authorization matrix, join sequence | Issue and consume-time policy tests |
| Meeting SDK embedded experience | Zoom findings, blueprint | Provider-off integration + canary |
| Client view mobile/tablet | Zoom findings, prompt, view algorithm | Device selection tests/canary |
| Component view desktop only when supported; fallback | Zoom findings, blueprint | Capability/privacy gate and forced fallback tests |
| Next-class card and one Join action | Prompt, blueprint | Browser e2e |
| Waiting, host-not-started, permission, network, full, provider-down, expired, ended, reconnect | `06-FAILURE-STATE-MATRIX.md` | Injected state mapping tests |
| Leave/return without credential leakage | Join/replay sequence, security | New-grant rejoin and cleanup tests |
| Attendance privacy minimization | Data model, security, blueprint | Event schema rejection/minimization tests |
| Official Zoom sources | `SOURCES.md`, `03-ZOOM-CAPABILITY-FINDINGS.md` | Source access date/version recorded in run |
| V1 questions are One Time queue, not Zoom chat | Prompt, data model, blueprint | Chat disabled and no Zoom call tests |
| Store learner/occurrence, rate, moderation, audit, idempotency | Data model and question tests | Submission/concurrency/idempotency suite |
| OT-84 alerts authorized Rabbi with redacted preview/opaque ID | Question sequence, auth matrix, security | Authorized recipient and sentinel redaction tests |
| Rabbi actions: Feature next, Answered, Dismiss, moderation link | Prompt, sequence, auth matrix | Moderation transition tests |
| Deep link never opens child session | Auth matrix, security | Separate moderator-grant/session test |
| Learner sees safe own state only | Auth matrix, data model | Sibling/other-question IDOR tests |
| No automatic pin/spotlight promise | Zoom findings, prompt | Disabled port and zero Zoom-call assertion |
| `ZoomFeatureParticipantPort` disabled; future canary only after proof | Findings, blueprint | `UnsupportedDisabled` test |
| Feature next guides ordinary host controls | Prompt and moderation sequence | Rabbi confirmation content test |
| Do not send child free text to Zoom chat | Security and question tests | No provider/chat adapter call; leakage scan |
| Meeting SDK is human use, not AI notetaker | Findings and prompt | No bot/media-capture code review/test |
| Provider-off/sink tests | Test plan | Network isolation + outbound counts |
| Zoom sandbox/test canary if credentials exist | Test plan | Prerequisites report and canary evidence |
| Test three learners/fourth denial | Test plan | Domain and canary cases |
| Cross-household/sibling/school denial | Auth matrix and test plan | IDOR/eligibility cases |
| Replay/expired grants | Failure matrix and test plan | No Zoom call on replay/expiry |
| Reminder idempotency | Data model/test plan | Unique intent and retry tests |
| No raw-link leakage | Security/test plan | Normal-surface scan and bootstrap exception test |
| Mobile join/desktop fallback | Test plan | Browser profiles/canary |
| Questions/privacy/Telegram retry/provider failure | Test plan | Dedicated suites |
| 30-sample join-shell performance | Test plan/evidence contract | 10+10+10 raw samples, p50/p95/max |
| Accessibility, keyboard, RTL, reduced motion | Test plan | Automated/manual evidence |
| No BNA fanout | Prompt/test plan | Discover repo definition; outbound-count assertions |
| No production Zoom mutation or broad reminders | Prompt/security/test plan | Flags off, network/allowlist evidence |
| Finish safe code at `READY_FOR_ZOOM_CANARY` if missing settings | Prompt/evidence contract | Exact status and missing prerequisite checklist |
| Clean push/draft PR and exact evidence/resume report | Direct prompt and evidence contract | Base/head/URL, clean status, final template |
| Checksums | `MANIFEST.json`, `SHA256SUMS`, `VERIFY-CHECKSUMS.sh` | `./VERIFY-CHECKSUMS.sh` and ZIP companion hash |
