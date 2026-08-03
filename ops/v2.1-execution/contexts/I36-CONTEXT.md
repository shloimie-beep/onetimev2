# I36 — Merge Captain, Shared Registration, and Immutable Candidate — Locked Context

**Outcome:** Integrate every implementation-ready task in dependency order, resolve only authorized central-file mechanics, run merged checks, and publish one immutable candidate manifest for verification.

**Source package lock:** `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e` (digest of source `SHA256SUMS.txt`)  
**Reviewed repository head:** `73dda293079f602c83929d1bbccb8dd5b9d1a455`  
**Primary writer slots:** `RELEASE_INTEGRATOR, SERVER_COMPOSER, CLIENT_COMPOSER, WORKER_COMPOSER, CONFIG_DEPS, BARREL_REGISTRAR, DESIGN_SYSTEM, GHL_REGISTRY`

This file is a generated, checksum-bound subset of the v2.1 source package. It reduces rereading; it does not override the source documents. If its digest matches the task packet and package lock, do not globally re-audit the repository or reconsider locked decisions.

## Task-specific instructions

- Apply the exact task packet and execution contract.

## Dependency gates

- Start after: `C00`
- Full merge after: `None`
- Candidate integration partners (non-ordering): `F01, F02, F03, F04, F05, F06, F07, P08, P09, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, P22, P23, P24, P25, P26, P27, P28, P29, P30, P31, P32, P33, P34, P35`
- Candidate acceptance after: `None`

## Machine-enforced owned globs

- `apps/web/src/client/app/crm-entry.tsx`
- `apps/web/src/client/app/live-entry.tsx`
- `apps/web/src/client/app/portal-entry.tsx`
- `apps/web/src/server/app.ts`
- `apps/web/src/server/index.ts`
- `apps/worker/src/main/index.ts`
- `integrations/highlevel/registry/workflow-registry.yaml`
- `ops/v2.1-execution/merge/**`
- `ops/v2.1-execution/results/<candidate-digest>/CANDIDATE-RESULT-INDEX.yaml`
- `package-lock.json`
- `package.json`
- `packages/config/src/index.ts`
- `packages/contracts/src/index.ts`
- `packages/domain/src/index.ts`

Scope notes below explain intent but do not grant additional path authority:

- codex/v21-integration branch
- CI/global test configuration
- generated route/action/provider/workflow registries
- codex/v21-evidence-<candidate-short-sha> evidence aggregation branch

## Deliverables

- dependency-ordered micro-batch integration
- central steward-request application
- migration/route/action/provider/workflow inventory
- merged verify/build/changed-area evidence
- immutable candidate SHA and artifact digests
- candidate-specific evidence branch and evidence-only aggregation

## Relevant locked decisions (0)

No direct decision mapping; use the execution contract and task outcome.

## Acceptance requirements and exact cases (0 requirements)

I36 owns integration integrity rather than primary requirements. It consumes every implementation handoff and preserves the complete ownership map.

## Cross-cutting invariants

- Exact assignable roles are `admin`, `parent`, and `student`.
- Students have username/password credentials and no required email; no Student is a GHL contact.
- A Parent never becomes a learner session; an adult learner uses a separate Student seat.
- One adult identity may own multiple independently billed households; authorization remains household-scoped.
- No preview/demo/test product lane, fictional customer, Class Helper, Buffer/social publisher, public WhatsApp assistant, or active Tisha funnel route.
- GHL is adult CRM/campaign/operator billing workflow; Stripe is financial truth; One Time stores a minimum verified access projection and never mutates financial objects.
- Email must complete launch workflows even while WhatsApp is dormant.
- Zoom and Vimeo bearers/URLs never appear in UI URLs, email, GHL, logs, handoffs, or evidence.
- Production evidence must bind one immutable candidate; each case uses only an environment allowed by its acceptance contract and records exact environment/runtime/deployment/provider identity. The 265 cases are not required to share one environment.
- Automated production-safety verification is required even though demo/test product surfaces are prohibited.
