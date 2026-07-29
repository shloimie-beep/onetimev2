MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: RECONCILE_ATOMIC_CLAIM_THEN_START_OR_RESUME

Reconcile the exact P21 atomic claim before permitting product, test,
structured-request, steward, provider, or effect work.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p21-content-publication
Authoritative control ref: origin/codex/v21-control
Task packet: ops/v2.1-execution/tasks/P21.yaml
Task context: ops/v2.1-execution/contexts/P21-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P21/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P21/HANDOFF.md

Authorized start:
`088b40476bd5ceeb0af901b6f78a4cb8c556671b`.
Containing authorization:
`4c029e8d6e4ea3a2a4e4942affb61a39e5508129`.
Sole acquisition parent and READY state base:
`d99fde51092abdee97f42f28e8bdee8a08c5e22c`.
READY digest:
`d2b127c6cb94a4428a39f1789f153a625b6b3153b0e4104778aa7f51c98cebe2`.
Claim:
`3a93eeca-5035-4328-b685-e580f2b32ce6`.
Writer:
`codex-p21-worker-3a93eeca`.
CONTENT_PUBLICATION lease:
`31423c6c-74ef-43cc-b3a8-75b425568619`, issued
`2026-07-29T10:23:53Z` and expiring `2026-07-29T11:23:53Z`.
Effect locks: none.

Locked bindings:

- package lock:
  `3d13585587ab64d063c09dd8ef37b2ffe1c40034d3f8dddf93299092a0ea8e4a`
- source package:
  `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- task packet:
  `c04b2cf1b742e4200fe2c38790bcfa99fb9470420c5a83b9998db4d0173ef550`
- context:
  `36e4fb76ff399ae66d3ccd9f4e5851ec31395c247d80a3d7f4392bb8ad30858e`
- prompt:
  `81b77db37a7ecd71e39c86b6cb700acafac66c05aec0a6c16b6f03a4d1b415df`

Dependency bindings:

- F05 task `9174d845e1c04916e2f1884cfadfaef624ac6862`,
  integration `9782a4164662b8059a557c0969de9c35f54d0cf7`,
  interface source `0656380bcfc50cc464dcea7588448dc724049599`,
  implementation `1ade14c52e42e59bb8fd1d1de776b91406c45f15`,
  checkpoint `fd17c478bfc851dcb434b8e0c2750701605b80dfdf880833a6a2993e8fad6329`.
- F06 task `ce061ca5b208cfb2a41e0c2f439a7a4b91e8ca57`,
  integration `d35166838267711a514cf73822cd2ca49a3f3ded`,
  interface source `9a426ccaa294ca1f54ece20ea2a37c7ef9de1ef7`,
  implementation `94281de13063203808ecabef8a818762e5ff1e2e`,
  checkpoint `7d0e2e360036fa6e3b742053c714b13f442e29c9ff3e83ad7b6bf02c005694a0`.
- P14 task/interface source
  `3393169e2284d65ff0a970d797aa1f83ebf9d895`,
  integration `d35166838267711a514cf73822cd2ca49a3f3ded`,
  implementation `9c08e9c6735a61e201f7b05116a3406e6092e08b`,
  checkpoint `1a9b86f0d39cc0e3999973fc988d9c2d00c302ccad13a50857c14c7d5e2f03e1`.

Fetch remote refs and require C00 to have reconciled the exact remote P21 claim
head into a fresh `resume_ready` entry with an unexpired claim and
CONTENT_PUBLICATION lease. Resume only from that exact expected head. Before
implementation, reverify the task branch head, control/READY digest, package,
task, context, prompt, and dependency bindings.

After reconciliation, continue the P21 mission only within its normalized
owned roots. Do not expose private provider playback material. Do not inspect
or mutate live Vimeo, Drive, S3/KMS, or any other provider without a separate,
exact effect authorization and lock. External authority for this atomic claim
is `none`; effects attempted `0`, succeeded `0`, reconciled `0`.
