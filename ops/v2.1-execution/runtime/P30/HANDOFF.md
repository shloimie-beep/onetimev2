# P30 Correction Claim Handoff

## Identity

- Branch: `codex/v21-p30-campaign-workflows`
- Authorized integration start:
  `49431959f58f284bdc13ca931acf09f980fc483a`
- Expected existing/local/remote head:
  `337baba3d9b2d271205f6f2cb9bfd8adeabbb549`
- Prior implementation:
  `b329dd1ba36756977d4c935cea93be6559253e49`
- This atomic correction-claim head: derive with `git rev-parse HEAD`; C00
  records the pushed head
- Correction controller:
  `89ac83c2e816e9726f1ae2d2193e34e3269fb36c`
- Ready-entry parent:
  `32c9ef6a0738f0a4fa038f1212ff7019e19992f1`
- Ready-entry digest:
  `f7d3413b150bcf942e2a27354bc340c4296ce48b1543df287a6def3b034a611b`
- Claim: `cea57710-2506-4983-a821-4e23733d0766`
- Writer: `codex-p30-worker-cea57710`
- GHL_CAMPAIGNS lease:
  `0bc6fecd-2a7c-4c34-8c11-598c03634ab1`
- Lease expiry: `2026-07-29T00:51:24Z`

## Atomic claim result

The exact `resume_existing_branch` entry was verified at controller commit
`89ac83c2`. Its canonical digest recomputes exactly, all dependency and package
bindings match, and local plus remote P30 both equal the authorized expected
head. The existing head descends from the authorized integration start and has
sole parent `b329dd1b`.

This checkpoint changes only the three P30 runtime files. No product,
workflow-fragment, steward-request, registry, composer, migration, package,
provider, or external state changed.

## Bounded correction findings

1. OT-15 launch approval currently validates only step 1. Steps 2 and 3 are not
   canonical P31 copy entries and are not independently content-approved.
2. OT-16 currently trusts caller-supplied operation IDs without requiring exact
   equality to `ot16OperationId`.

These findings are recorded for the later correction phase only. Product repair
must not start until C00 reconciles this atomic claim head.

## Exact next action

Push and report this exact atomic correction claim, then stop. After C00
consumes it, resume from the exact remote claim head, implement the smallest
fail-closed corrections inside P30-owned paths, add only a task-local structured
copy/catalog steward request if shared P31 authority is required, rerun all six
cases plus focused regressions, and return to `ready_for_review`.

## External effects

Authority: none. Attempted: 0; succeeded: 0; reconciled: 0.
