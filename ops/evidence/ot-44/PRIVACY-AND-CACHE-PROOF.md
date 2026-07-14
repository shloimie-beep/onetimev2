# OT-44 Privacy And Cache Proof

Privacy controls:

- API DTO excludes payload, raw recipient, display name, raw email, raw phone, contact key field, signup key, delivery key, outbox UUID, provider, provider receipt, subject, body, HTML, attachments, retry errors, worker lease timestamps, and audit metadata.
- Recipient masking happens server-side.
- Email renders as `Email recipient`.
- WhatsApp/phone reveals at most final four digits.
- Internal alert renders as `Internal owner`.
- Missing/unsafe recipient renders as `Recipient unavailable`.
- Cursor is encrypted and authenticated; the raw outbox UUID is not visible in the token string.
- Cursor is accepted only through `X-OT-Communications-Cursor`, not URL query.

Cache controls:

- Communications route hook sets `Cache-Control: private, no-store`.
- Communications route hook sets `Vary: Cookie`.
- Client fetch uses `cache: "no-store"` and `credentials: "same-origin"`.
- Client state is component memory only; no localStorage, sessionStorage, IndexedDB, CacheStorage, service worker, or module row cache is used.

Protected-state clearing:

- On `401` or `403`, the client aborts in-flight Communications requests, clears cursor by setting `nextCursor` to `null`, replaces row state with the error state, and invokes the later shell's `onProtectedStateCleared` callback.

Proof:

- `tests/unit/communications/communications-contract.test.ts`
- `tests/integration/communications/api.test.ts`
- `tests/e2e/ot-44/communications-descriptor.spec.ts`
