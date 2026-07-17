# W13-99 Replacement Prompt

Repository: webcraft-media/onetimev2
Authoritative source: integration/w12-final-convergence-20260717T123715Z at 0d8d7168f066668f035176d777bdaaa4dcc5accd
Safety: do not deploy, import real rows, enable providers, send messages, charge cards, upload content, mutate DNS, or call production databases unless the exact sub-lane has an explicit approval artifact.

Required first reads:

- AGENTS.md
- ops/director/START-HERE.md
- ops/codex-runs/W13-10/FINAL-REPORT.md
- ops/codex-runs/W13-10/PRODUCT-DECISION-GATES.json
- ops/codex-runs/W13-10/PROVIDER-ACTIVATION-MATRIX.json
- ops/codex-runs/W13-10/RELEASE-BLOCKERS.json

Execution:

- Use exact immutable SHAs, hashes, counts, budgets, and allowlists.
- Stop only the affected production sub-lane when deployment, import, provider, billing, or legal approval is absent.
- Do not claim production CRM import, provider activation, paid checkout, or legal approval is authorized unless the matching gate is accepted in repo evidence.

Validation:

- Run focused tests for touched contracts and full release gates when preparing convergence.
- Record external effects and production mutations as counts.
