# I36 P13/P25/P26 Ordered Full-Wave Release

## Identity

- Branch: `codex/v21-integration`
- Clean claim head: `4e17ad727b6f31f10985113fc24f187369a9e544`
- Reconciled control / acquisition:
  `44670793103e9f54476b76a038f962004dfed30c` /
  `d4c8eada7e6d5d85b193ffc06b2124ac901bfd6f`
- Claim / RELEASE_INTEGRATOR lease:
  `d17f9dc5-0f97-44ea-bb44-600c6c3635a3` /
  `6077f8e5-c498-405e-9cd8-754340775f53`
- Lease released: `2026-07-29T06:10:29Z`
- Final metadata release head: derive with `git rev-parse HEAD`; C00 records
  the observed pushed remote head.

## Ordered merge record

1. P13 source `a9d641e6da6a08c805f34d3f827816fcd8c6138a`
   merged at `585d6fb268207c21c91873908e2b44e089583966`, with
   parents `4e17ad727b6f31f10985113fc24f187369a9e544` and the source.
2. P25 source `0979e151f80900cea75edecabe8967ce382d168d`
   merged after P13 at `2b5049e248dd48b9203daa2f55e2b24379af7d7b`,
   with parents `585d6fb268207c21c91873908e2b44e089583966` and
   the source.
3. P26 source `5e33807200a24ec53be889234dbaafdda9717dcb`
   merged after P25 at `5016b50914c693b6ba123d29c82189263aa8781c`,
   with parents `2b5049e248dd48b9203daa2f55e2b24379af7d7b` and
   the source.

All rebound queue digests, exact 19/15/20-path scopes, required merge bases,
task and state/handoff digests, and recorded artifact/steward aggregates were
verified before merge.

## Verification

- P13 focused suite: 4 files, 11 tests passed.
- P25 focused suite: 3 files, 13 tests passed.
- P26 focused suite: 4 files, 11 tests passed.
- Cumulative workspace typecheck passed.
- Focused ESLint and Prettier passed.
- Cumulative diff hygiene and repository secret scan passed.

No P13 steward request, migration, shared registration, provider action, or
external effect was attempted.

## Next action

C00 should reconcile the exact pushed metadata release head and the three merge
heads above. I36 must stop after reporting this checkpoint.

## Effects

Authority none; attempted/succeeded/reconciled `0/0/0`.
