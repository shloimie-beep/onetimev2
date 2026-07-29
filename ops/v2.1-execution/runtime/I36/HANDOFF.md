# I36 P35 Full-Integration Release

## Identity

- Branch: `codex/v21-integration`
- Atomic claim target:
  `550106c61716b5e11825610ea4e5b1ce7e93b930`
- Reconciled authorizing control:
  `f93eaaa3b57f403847ceb18c6c79af7eb808e50c`
- Sole acquisition parent:
  `d8a031e92ad3b02c8b3f62af2063737a20253af0`
- READY I36 digest:
  `70c2781a19242cd1b6bcc0452dd755c3b1964dd9b68b4694d5fa5a606d8ee4d9`
- Claim: `5f6577ac-9fcd-4558-8d8a-1318b5b002b5`
- RELEASE_INTEGRATOR lease: `11eac672-8eda-4188-baed-82e0a2a9ef8b`
- Lease window: `2026-07-29T14:23:14Z` through
  `2026-07-29T15:38:14Z`
- Lease released: `2026-07-29T14:45:50Z`
- Phase scope: `P35_full_integration_atomic_claim_only`
- Release head: derive with `git rev-parse HEAD`; C00 records and audits the
  observed pushed head and its sole parent.

## Merge result

- Merge ID: `6754c434-bf7a-44ad-97e2-ea367ff38e1d`
- Payload digest:
  `6c0c90143d90e79835a4e7c9b7464a3678084fb87d8a41e122c335ca32e12dd5`
- Source: `a85aecc22b013d583589a67cf0cc9dfad6745aba`
- Fixed source/merge base:
  `eefca0644e57dca48609682cbc3e1b01992d286d`
- Merge head: `3655909a3ccbfb2d9b319c45c3a6ad945dffbafb`
- Merge parents:
  `550106c61716b5e11825610ea4e5b1ce7e93b930` and
  `a85aecc22b013d583589a67cf0cc9dfad6745aba`
- Required F01 full ancestor:
  `b5344992a43a735a9c66047fecd83f951651de27`
- First-parent delta: exactly the 20 control-authorized P35 paths

## Verification

The reconciled control, registry, claim head, sole lease, canonical merge item,
source head, fixed merge base, F01 prerequisite, task/state-handoff/tail
digests, request blob digests, YAML syntax, and 0/0/0 effect record all passed.
The non-fast-forward merge preserves exact source ancestry and parents.

The focused P35 domain-transition contract proof passed, as did repository
typecheck, full lint, full build, exact-path Prettier and diff hygiene, all
200 locked blobs, all 15 source-package blobs, seven YAML parses, and the
secret scan across 2932 repository text files.

The repository-wide formatting command retains the pre-existing baseline
reported in the preceding release; all exact P35 paths pass the CRLF-aware
Prettier check. The prior broader unit/integration baseline was not rerun
because the focused P35 proof plus typecheck/lint/build was the proportionate
gate for this isolated source tail.

## Steward and effect boundary

`P35-config-deploy-001`, `P35-reregistration-integration-001`, and
`P35-route-registration-001` are present as immutable request records but
remain unapplied. No provider inspection, send, DNS/deployment action, product
edit beyond the exact source merge, or external effect occurred.

This release checkpoint changes only I36 `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md`.

## Next action

C00 must audit and reconcile the exact pushed release head and its sole parent.
I36 must stop after reporting it.

## Effects

Authority none; attempted/succeeded/reconciled `0/0/0`.
