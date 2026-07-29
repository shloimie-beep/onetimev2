# F02 Canonical-Format Atomic Claim

- Parent: `caf4e2be5776c9f33c5d07ff6eef79ab411f9477`
- Containing control: `70fc583372b793c0fb2f009d0bfa327188f6e1e7`
- Sole control acquisition: `da6645bf7da80b4f5bc2dc8ab13ff940ad5ac662`
- READY digest: `40b3587f43321e1682abe17477310cedb20ea4c5d44cb353ee2a0480a440c21c`
- Claim: `7acb5991-7704-4a6f-b590-020e47824876`
- Shared lease: `bf42793b-2731-43aa-8e88-c246c87d70bb`
- Lease expiry: `2026-07-29T21:02:22Z`
- Effects: `0/0/0`

This checkpoint claims only the F02 runtime triplet. The allocation proposal,
all four migration files, native and pg-mem checksum semantics, and all other
paths remain unchanged.

After C00 reconciliation, the only permitted implementation is repository
Prettier with canonical LF Git bytes on the proposal and runtime triplet,
followed by the specified format, secret, scope, checksum, package, and
zero-effect gates. Stop for reconciliation.
