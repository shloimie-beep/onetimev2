MODEL: GPT-5.6-SOL
REASONING: XHIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Reconcile the F02 Lease B compatibility-correction atomic claim.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-f02-schema-state-migrations
Parent before claim: 032aeb9cb0c786729ff2c394744ab561eeb3f6c1
Containing control: 9d53cf1c581dcb67e30b2beb62d048a1839f23e2
Sole acquisition parent: a6bc58cc4a35173fd1606124c0fa651dda2dac64
READY digest: 5011b9dd7fe5c1883e091b46b097d907d6aaa99669999f60b7554dc225e45134
Claim: 6b1e1632-e3d9-4f87-92b3-8b150a6715d2
Shared lease: 31e905c8-d5c2-4e3c-9e98-c2e8f78989ce
Lease expiry: 2026-07-30T01:23:18Z

Require the claim commit to have the sole parent above and change exactly the
F02 runtime triplet. Confirm the proposal, migrations 2239 through 2244,
product code, control state, provider state, and external systems are
byte-identical to the parent.

Verify the new claim and shared lease, canonical READY and dependency digests,
the exact rejected compatibility gate, and effects `0/0/0`. Stop for C00
reconciliation. Do not resume SQL or proposal work beforehand.
