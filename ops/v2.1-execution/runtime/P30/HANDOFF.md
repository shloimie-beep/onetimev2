# P30 Handoff

## Identity

- Branch: `codex/v21-p30-campaign-workflows`
- Start SHA: `49431959f58f284bdc13ca931acf09f980fc483a`
- Claim checkpoint: `c42eb2b971093c603f2334548bfeadad78a368b1`
- Implementation SHA before this handoff metadata commit: `b329dd1ba36756977d4c935cea93be6559253e49`
- Current handoff commit: derive with `git rev-parse HEAD`; C00 records the pushed head
- Task packet digest: `b8aa34e1cdbe02d65f496c2a22925e90ea2b835644ab895af1ff0f9eede9ba64`
- Context digest: `5dd28dbffec92036402b291b484dd537317d4c003406f979aecd71edcd770878`
- Source package digest: `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Claim: `9c4e04b6-485c-4d91-aed4-40e2b8be9aab`
- Writer: `codex-p30-worker-9c4e04b6`
- Containing control authorization: `62db0bf0de280932b07cf86dd8e03501ca708229`
- Claim-consumption control head: `9a3b4856edb82556eca38416b853d6bdff5ef8bf`
- Ready-entry parent control: `f0f7ea05f7c50f3ea64782ff107fbfd1c4486c24`
- Ready-entry digest: `2b0b3f114514f1661b3b07c18145826615770148e0d69ab8314c9f19e2d51f42`
- GHL_CAMPAIGNS lease: `e55a881a-4f1c-4667-9edb-1f5be1d9b492`, released at `2026-07-28T23:36:34Z`

## Completed behavior

P30 now owns a P28-validated fragment for OT-14 Parent Newsletter, OT-15
Former Member Reactivation, and OT-16 Free-Period Conversion. OT-14 is bound
to P31's canonical newsletter copy, exact current-account-owner/newsletter
audience, weekly Thursday noon household-local cadence, operator seed evidence,
and the first-broad-send Rabbi/Admin hold. OT-15 is bound to the exact
three-step approval-launch/day-4/day-9 subjects, former/canceled adult segment,
and active Parent/School exclusions. Both plan fresh marketing suppression and
record dormant WhatsApp as `channel_skipped_not_configured` with zero provider
calls.

OT-16 has deterministic five-checkpoint scheduling relative to
`2026-09-13T19:24:00+03:00`, exact `$67 USD/month`, expiry, no-card,
no-auto-charge, and Checkout content, deterministic dedupe IDs, and exits for
verified paid access, explicit decline, suppression, custom School terms, and
Student contact. Its worker boundary rechecks suppression immediately before
durable reservation and a GHL email call, carries the exact office payload,
records retry/dormant-channel truth, and exposes no WhatsApp port.

The YAML fragment's 15 P28 contract keys match the TypeScript representation
for all three workflows. Central registry/composer work is isolated in
`P30-registry-registration-001`; this task made no shared registry, composer,
migration, provider, deployment, or external-effect mutation.

## Coverage

- `OTV2-GHL-134-AC01`: exact definition/copy/cadence/seed evidence, broad-send
  hold, approved release, and changed send-time suppression.
- `OTV2-GHL-135-AC01`: exact three-step copy/segment, active Parent and School
  exclusion, approval readiness, and changed send-time suppression.
- `OTV2-GHL-225-SCHEDULE`: all five exact UTC instants, exact content fields,
  deterministic replay dedupe, one email, and zero WhatsApp.
- `OTV2-GHL-225-PAID-EXIT`: verified paid access creates zero later effects.
- `OTV2-GHL-225-SCHOOL-EXIT`: custom School terms create zero campaign effects.
- `OTV2-GHL-225-SUPPRESSION`: unsubscribe, DND, complaint, hard bounce,
  invalid address, and marketing suppression all fail closed.

## Verification

- Focused P30 Vitest: 2 files, 10/10 assertions, including all six cases.
- Full TypeScript typecheck: passed.
- Focused ESLint and Prettier: passed.
- YAML parsing and YAML/TypeScript contract drift check: passed.
- Workflow fragment SHA-256:
  `3771f3ccd5c5dd85acb02fed5d2baea87db3aca1cde532449cedefc64edc321d`.
- Steward request SHA-256:
  `308be4a67c6bc73317111b54e34edb9022ac6a709144f96783918c66557fbb54`.
- Secret scan: passed across 2,718 repository text files.
- Full unit suite: 566 passed; the sole failure is the inherited P28 generated
  registry count test expecting 19 assets while the integrated source has 22.
- `git diff --check`: passed.

## Changed files and migrations

- `apps/worker/src/runners/ghl-workflows/campaigns/**`
- `integrations/highlevel/v21/workflow-fragments/P30-campaigns.yaml`
- `packages/domain/src/communications/workflows/campaigns/**`
- `ops/v2.1-execution/runtime/P30/**`
- Migrations: none
- Steward request: `P30-registry-registration-001`

## External effects

Authority: none. Attempted: 0; succeeded: 0; reconciled: 0.

## Review and integration

C00/I36 should review the exact implementation commit
`b329dd1ba36756977d4c935cea93be6559253e49` and this final metadata head. Route
`P30-registry-registration-001` to the canonical registry/worker-composer
steward. That request does not authorize activation, a provider seed, broad
enrollment, or any other live effect.

## Security, privacy, and recovery

No secrets, customer data, Student data, provider payloads, live sends,
enrollments, workflow mutations, or deployments were accessed or performed.
Student contact fails before repository/provider access, and School/paid exits
fail before provider access. Recovery base is exact integration head
`49431959f58f284bdc13ca931acf09f980fc483a`.
