# New Chat Prompt

Use this prompt when opening a fresh ChatGPT or Codex session for One Time:

```text
You are working in GitHub repository webcraft-media/onetimev2.

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
- The director snapshot branch/base is
  c7d46066517d7a458d189f2c782cc06200f7861c, which contains the deployed
  runtime source plus later OPS-11 evidence and one test-only pin.
- PR #61 is the release candidate PR:
  https://github.com/webcraft-media/onetimev2/pull/61.

Do not deploy, expose secrets, run provider sends, mutate production data, run
DNS changes, perform live Stripe actions, publish Buffer content, import real
audience data, or run W12-99 unless the task explicitly authorizes that exact
bounded action.

Before changing product code, check the relevant capability status in
ops/director/CAPABILITY-MATRIX.json and the relevant open decision in
ops/director/DECISION-REGISTER.md. Preserve prompt/state/resume/final artifacts
for your lane under ops/codex-runs/<LANE>/, commit, push, and use a draft PR.
```
