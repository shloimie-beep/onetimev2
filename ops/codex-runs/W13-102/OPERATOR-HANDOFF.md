# W13-102 Operator Handoff

Status: `CORE_LIVE_IDENTITY_HANDOFF_BLOCKED`

This committed handoff is sanitized. It must not contain passwords, raw activation/reset links, tokens, TOTP seeds, credentials, private provider URLs, private contact rows, or PII.

Private runtime material belongs only under:

```text
C:\Users\User\.onetime-w13-102-private\
```

Current private handoff status:

- Identity authorization manifest: template exists, required values missing.
- CRM source acceptance manifest: private template exists; source hashes verified; operator approval and tag-map approval are still required.
- Login URLs: none produced.
- Delivery IDs: none produced.
- Recovery instructions: complete the private identity manifest, prove transactional email or permitted fallback, then run the W13-102 identity command from a tested candidate.
- Provider setup locations: recorded by missing variable name in `ops/codex-runs/W13-102/evidence/provider-readiness-snapshot.json`.
- No passwords, raw activation/reset links, tokens, TOTP seeds, credentials, private provider URLs, private contact rows, or PII were committed or printed.
