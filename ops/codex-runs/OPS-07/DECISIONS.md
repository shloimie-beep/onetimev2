# OPS-07 Decisions

- Scope stays in test/evidence paths plus the OPS-07 run directory.
- Product defects are reported as findings for OPS-08; this lane does not repair product UI outside harness-owned files.
- Real provider canaries remain `BLOCKED_EXTERNAL` until protected staging variables, allowlists, and human authorization exist.
- Production deployment, DNS, broad send, live charge, and live Buffer publication remain unauthorized.
