# New Chat Prompt

Use this prompt when opening a fresh ChatGPT or Codex session for One Time:

```text
You are working in GitHub repository shloimie-beep/onetimev2.

First read AGENTS.md, then read:
- ops/director/START-HERE.md
- ops/director/CURRENT-STATE.json
- ops/director/CAPABILITY-MATRIX.json
- ops/director/DEPLOYMENTS.json
- ops/director/WORKSTREAMS.json
- ops/director/BRANCH-FLEET.json
- ops/director/PRODUCT-INVARIANTS.md
- ops/director/DECISION-REGISTER.md

Current release truth:
- Production is live at https://join.onetimeonetime.com.
- Production /version is ops11-1197673 with commit
  1197673fa409bfc4c649c2683f782e86775caa5e.
- Production runtime is distinct from the W12 candidate.
- The release/director base is
  c7d46066517d7a458d189f2c782cc06200f7861c, which contains the deployed
  runtime source plus later OPS-11 evidence and one test-only pin.
- PR #61 is the prior release candidate PR:
  https://github.com/shloimie-beep/onetimev2/pull/61.
- W12-99 candidate branch is
  integration/w12-final-convergence-20260717T123715Z at
  0d8d7168f066668f035176d777bdaaa4dcc5accd.
- W12-99 draft PR #73 is open/draft and had five successful listed checks when
  W12-100-00 inspected it.
- W12-00 through W12-08 are integrated by W12-99.
- W12-09 remains excluded pending explicit decision.
- OPS-13A is available from PR #72 at
  d4f58801ebbb5fe8a41ef33621c7594f0ff6b2b4 as sanitized preflight input only.
  Do not treat it as real import acceptance, provider acceptance, OPS-13B
  execution, or deduplicated people-count proof.
- No W12 staging deployment, real import, provider acceptance, or production
  promotion has been performed.
- W12-100 owns isolated staging and launch proof.
- BNA remains a separate convergence train.

Do not deploy, expose secrets, run provider sends, mutate production data, run
DNS changes, perform live Stripe actions, publish Buffer content, import real
audience data, run OPS-13B, or integrate W12-09 unless the task explicitly
authorizes that exact bounded action.

Before changing product code, check the relevant capability status in
ops/director/CAPABILITY-MATRIX.json and the relevant open decision in
ops/director/DECISION-REGISTER.md. Preserve prompt/state/resume/final artifacts
for your lane under ops/codex-runs/<LANE>/, commit, push, and use a draft PR.
```

## W12-100 Convergence Pickup

Pick up `integration/w12-100-launch-readiness-convergence-20260717` from `ops/codex-runs/W12-100-CONVERGENCE/RESUME.md`. Keep the PR draft, do not deploy, and do not mark ready. Re-run database verification only with approved disposable/staging credentials.
