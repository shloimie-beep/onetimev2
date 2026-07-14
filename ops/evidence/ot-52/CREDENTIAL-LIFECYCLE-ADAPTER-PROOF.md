# OT-52P Credential Lifecycle Adapter Proof

## Adapter Boundary

- Parent student-access actions call an injected `StudentCredentialLifecycleAdapter`.
- Supported operations: setup, reset, suspend, restore.
- Service rejects adapter results containing forbidden credential material indicators.
- Adapter operation references are digested before persistence.
- Audit metadata stores only a digest, not a raw adapter operation reference.

## Test Proof

- `records credential lifecycle operations as digests and rejects adapter material leaks`
  verifies:
  - setup returns `setup_requested`;
  - idempotency replay returns the same state;
  - database stores a 64-character digest;
  - raw operation reference is absent from operation rows;
  - raw operation reference is absent from audit metadata;
  - leaky adapter output is rejected.

## External Sends

- No credentials were generated in product code.
- No credential emails/messages were sent.
- No provider APIs were called.
