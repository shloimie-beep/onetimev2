# OT-51P Confirmation Security

Every write is preview-first and then confirmation-bound to:

- bot key;
- environment;
- provider actor opaque ref;
- private chat opaque ref;
- canonical user;
- account key;
- product key;
- capability;
- action digest;
- entity version when applicable;
- security version;
- idempotency key;
- short expiry.

Confirmation behavior:

- Cancel performs no write.
- Expiry performs no write.
- Duplicate callbacks report already handled.
- Forwarded/edited/group contexts are denied.
- Security version change between preview and confirm is denied.
- Task update includes optimistic entity version.
- Adapter capability and actor capability are re-resolved before execution.

Proof:

- `tests/unit/telegram/telegram-foundation.test.ts` covers preview, confirm,
  cancel, expiry, duplicate callback idempotency, and security-version change.
