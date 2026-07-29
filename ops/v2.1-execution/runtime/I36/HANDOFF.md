# I36 P13/P25/P26 Full-Wave Atomic Claim

## Identity

- Branch: `codex/v21-integration`
- Exact existing target: `44fd536381e7af8885f31247d6bf91dd6266b195`
- Containing authorization / acquisition:
  `8f7a425ac5ba883e04d534857363aee3c4c881be` /
  `d7df4df6954fcb3cdd06704461f86894285b09f6`
- Ready digest:
  `080fac5c73a526228fc7a8b0c957389362942b7e094decedf1454066bff56862`
- Claim / RELEASE_INTEGRATOR lease:
  `d17f9dc5-0f97-44ea-bb44-600c6c3635a3` /
  `6077f8e5-c498-405e-9cd8-754340775f53`
- Lease issued / expiry:
  `2026-07-29T05:46:11Z` / `2026-07-29T06:46:11Z`
- Phase scope: `P13_P25_P26_full_atomic_claim_only`
- Atomic claim head: derive with `git rev-parse HEAD`; C00 records the
  observed pushed remote head.

## Queue verification

The exact local and remote integration target matched before this checkpoint.
The canonical ready digest and all three queue item digests were reproduced:

- P13 `a9d641e6da6a08c805f34d3f827816fcd8c6138a`, 19 paths,
  digest `3c35d48d6b5eb67abcc4d8995add8ee95cea92d52cc81eea0a8fcb5f621be076`.
- P25 `0979e151f80900cea75edecabe8967ce382d168d`, 15 paths,
  after P13, digest
  `677c7638e6777263d3a2dfb1b4304aa779b9a0be1593c619bc95fb34255c4d11`.
- P26 `5e33807200a24ec53be889234dbaafdda9717dcb`, 20 paths,
  after P25, digest
  `1692243ec52369203f068bbe2eafd0e3a2795814a7828ae14f8a8653f34bbd7d`.

Remote branch heads matched the queued heads without fetching or reading source
content. All items bind the exact expected target, claim, live lease, ready
dependency metadata, and zero-effect summaries.

## Preserved integration state

No queued source was fetched, read for admission, or merged. No P13 steward
request, migration, registration, provider action, or external effect was
attempted. This checkpoint changes only `TASK-STATE.yaml`, `HANDOFF.md`, and
`NEXT-PROMPT.md` under the I36 runtime directory.

## Next action

Push and report this atomic claim, then stop. Source admission and ordered
integration may begin only after C00 consumes the exact pushed claim head and
publishes target-CAS reconciliation.

## Effects

Authority none; attempted/succeeded/reconciled `0/0/0`.
