# One Time — Codex Master Handoff for Consent + Launch-Month Marketing

Run **two separate Codex windows**. Do not combine product-consent code and bulk media processing in one worktree.

## Window A — Product consent/source of truth

Read:

- `ops/v2.1-execution/source-spec/00-OPERATOR-DECISION-OVERRIDE-20260813-ONE-CHECKBOX.md`
- `ops/marketing/prompts/2026-08-13-consent-source-of-truth-correction-codex.md`

Execute the second file exactly. This lane updates the decision register, related source specs, PR #141 implementation, legal content, signup UI/backend, and tests. It does not deploy.

## Window B — Marketing media and Drive

Read:

- `ops/marketing/2026-08-13-30-day-launch-marketing-source-of-truth-v2.md`
- `ops/v2.1-execution/source-spec/00-OPERATOR-DECISION-OVERRIDE-20260813-ONE-CHECKBOX.md`
- `ops/marketing/prompts/2026-08-13-launch-month-media-library-codex-v2.md`

Execute the third file exactly. This lane inventories `Mishnayos New`, cuts and labels the atomic library, creates the simple Rabbi-facing Drive workspace, builds twelve anchor packs, and returns scheduling-ready handoffs. It does not edit product code or publish anything.

## Order

Start both windows in parallel after each one reads current PR #131 authority.

- Window A is required before consent-flow deployment.
- Window B can complete media preparation while legal review/product implementation remains pending.
- The final landing-page creative/copy handoff from Window B goes to PR #131 only after the product lane confirms the exact current CTA and form behavior.
