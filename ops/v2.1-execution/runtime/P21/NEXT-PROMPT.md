MODEL: GPT-5.6 SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Review the containing terminal commit on
`codex/v21-p21-publication-scope-correction` under live control
`0a2e8c390d48da157be35a2f9d06f876a70b5e62`.

First verify:

- the branch descends directly from clean start
  `3250bb761aa0d6fb84db77f637bc05eb5f1c444d`;
- local, tracking, and live remote terminal heads are equal;
- READY
  `ccad2b56eb4b33fc7a35cfc61625dad9d9de14863823d1c0e96242924306fec5`
  authorized claim `cbec9b83-9d44-4d00-a797-fed83be43059` and exact eight-path
  inventory digest
  `5b93f48fdc9d709b450316ac4423f5077d39a253ca317424263433eb444e6b19`;
- CONTENT_PUBLICATION lease `f03e8f5d-10fc-40f1-8720-e39086b4a799` is
  released in the terminal runtime state;
- external effects remain `0/0/0`.

The exact eight-path set matches READY, but the stated LF/no-final-newline
recomputation is
`d3a605c5bd24812fc87d3795b76f3b1ee92eca60f3a4595434df747d32593829`,
not the control-recorded `5b93f48f…`. Do not fabricate reproduction; verify the
path set directly and disposition the control metadata mismatch explicitly.

Independently inspect and reproduce these two corrections only:

1. Exact pre-approval `needs_review -> archived` derives canonical scope and
   source identity from the locked approved processing-version/source join,
   reaches canonical version 5, creates no provider/outbox work, and rejects
   use of that derivation mode for any other transition.
2. Exact registration retry verifies source binding, canonical scope, and all
   four bootstrap events before accepting a compatible canonical successor
   without an event or aggregate write. Incompatible state, changed
   source/hash/scope, missing events, invalid version, and rollback must still
   fail closed.

Rerun the five focused files and require 31 passing tests, workspace typecheck,
focused ESLint/Prettier, the native PostgreSQL proof, steward-request schema,
secret, static event-only DML, diff, exact scope, and artifact-digest gates.

Verify `P21-registration-003` remains byte-identical at raw SHA-256
`0100943c4acb2104fd1e5d755f860a675944ce19b1a0b92188dcac84ac19ed16`
and remains unapplied. Verify implementation artifact digest
`0e512a204943046e3710a44cdd514f690d54e2665a02c381f36909ab84a95e97`.

If all evidence passes, C00 or I36 integrates the exact terminal head and
dispositions registration-003. Otherwise return one bounded rejection tied to
a reproduced failure. Do not edit a migration or shared registration from the
P21 branch, weaken source/provider fencing, mutate a provider, deploy, change
DNS, send, charge, activate a customer, or claim candidate/operator/production
completion from this source checkpoint.
