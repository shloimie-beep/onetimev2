# P35 Handoff

## Identity

- Branch: `codex/v21-p35-domain-transition-archive`
- Start SHA: `eefca0644e57dca48609682cbc3e1b01992d286d`
- Implementation SHA before this handoff metadata commit: `6b92adbf893c45f4a767b8036ec41b52744cce4e`
- Current handoff commit: derive with `git rev-parse HEAD` after checkout; C00 records the observed remote head in `TASK-REGISTRY.yaml`
- Task packet digest: `533cdac53bcc53fe0abccdd67e1f168b57a6cfbdf63c81d71c611ecb4b29d71f`
- Context digest: `d8d040229639d32c6ec4c94b66ad999d7b0afb1e23abff0aa10ccea9b5d54c06`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim: `9ee0d8f8-944d-47f2-b67a-54cb333cc29d`, held by `codex-p35-worker-9ee0d8f8`
- Writer lease: `DOMAIN_TRANSITION` / `32c1691c-190a-4449-89cd-bdc937284104`, expiring `2026-07-28T18:38:47Z`
- Containing control head: `3df0ee05af64db67af02e1e64d37ded4810d2cd9`
- Ready payload digest: `7f53c07831911d21d07ebe7f3067f5cd046087cb89841b19c1a1a37ad901d27f`

## Completed behavior

Implemented canonical App/Join/marketing host classification, safe legacy
login/signup redirects, source/UTM allowlisting, host-only cookie requirements,
and fail-closed cutover gates. Implemented the task-owned server registration
seam and public link helpers. Historical Tisha browser/form/API routes resolve
to non-mutating `410 Gone` behavior, while unknown legacy paths remain `404`.

Implemented a legacy-adult re-registration planner that preserves only lawful
adult CRM continuity. It applies the specified email normalization and
verified-link/exact-email/quarantine precedence, while rejecting legacy
credentials, sessions, accounts, child data, billing, access, and inferred
consent. Archived the exact Tisha provider asset identities as a dormant
zero-enrollment/zero-send template and published cutover/rollback runbooks.

## Remaining work

No task-owned implementation remains. Central composer, config/deploy, and
Family-signup/GHL consumers must process the three structured steward requests
before candidate freeze. Candidate-bound production evidence remains with the
assigned verification/release lanes.

## Exact next action

C00/I36 should review and integrate implementation head
`6b92adbf893c45f4a767b8036ec41b52744cce4e`, then route the three structured
steward requests to the central composer/config and P08/P27 owners.

## Coverage

- Requirements: all eight are implementation-ready.
- Acceptance cases: all eight are implementation-ready; production cases still
  require candidate-bound proof in their allowed environments.

## Changed files and migrations

Added 17 implementation/archive/runbook/steward-request paths plus the three
P35 runtime checkpoint files. No migration was created, deleted, or edited.

## Verification

- Exact remote control/ready authorization, package/source locks, and F01
  integration ancestry passed.
- `node --import tsx scripts/v21-migration/verify-domain-transition.ts`: passed
  positive redirects, unsafe-query stripping, unknown-host/Tisha rejection,
  cookie isolation, cutover denial, email normalization, prohibited-field
  rejection, ambiguity quarantine, deterministic planning, and archive
  inactivity.
- `npm run typecheck`: passed.
- Scoped ESLint and Prettier: passed.
- P35 YAML parse and `git diff --check`: passed.
- The workspace validator reports all locked files mismatched because global
  Windows `core.autocrlf=true` hashes CRLF worktree bytes. Independent exact
  Git-blob verification passed all 200 locked and all 15 source-spec entries.

## External effects

Authority is `none`; attempted `0`, succeeded `0`, reconciled `0`.

## Security, privacy, and data handling

No provider call, DNS mutation, deployment, live effect, secret, customer data,
child data, private question, legacy credential, legacy session, or bearer URL
was read or recorded. Historical provider asset IDs were copied from committed
read-only registry/current-state evidence solely to prevent identifier reuse.

## Blockers, deviations, and recovery

No blocker. Three structured steward requests preserve the central ownership
boundary:

- `P35-route-registration-001` — integrate the feature and remove old active
  Tisha route/build/client registrations while preserving 410 behavior.
- `P35-config-deploy-001` — configure/verify canonical origins, ingress, and
  host-only cookie isolation; it grants no DNS/deployment authority.
- `P35-reregistration-integration-001` — connect the P35 planner to P08/P27
  signup/GHL seams without widening the migration boundary.
