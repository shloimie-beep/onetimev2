# CRM Import Approval Raw

Generated: 2026-07-19T15:57:22.8286523+03:00

Source: Codex chat continuation on 2026-07-19.

Raw operator wording preserved exactly:

```text
autorization for crm impot aproved
```

Raw approval SHA-256:
`b4fdefae98ad78ad1e606c9b55f33f1ff6df584752bd678361ed33e2db31cac4`

## Interpretation Ceiling

This approval is accepted as authorization to prepare the private checkpoint
manifest and run the OPS-13A six-source CRM real-data dry-run/preflight.

This approval does not authorize production CRM import apply by itself.
Production apply still requires all of the following:

- Accepted dry-run hash/count set with explicit `apply=true` or equivalent
  protected approval.
- Terminal operator decisions for manual-review rows and dependent conflicts.
- Fresh backup/rollback proof immediately before apply.
- An implemented apply path that remains fail-closed for disallowed rows.

No production database write, CRM import apply, external send, provider
mutation, or secret print was authorized by this raw statement alone.
