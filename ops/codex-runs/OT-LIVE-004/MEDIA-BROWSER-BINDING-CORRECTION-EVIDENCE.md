# OT-LIVE-004.01 media browser-binding correction

- Control snapshot: `428ff71287b31f9f0aeee7415ffaa917ce57d6bd`.
- Accepted base: `5851104c4a42435abb2bc699432a04ace1a58bfe`, tree `8f82277cee950872dec324680d77c9c843cde07e`.
- Terminal receipt raw SHA-256: `51431c187c4c1cf7180945f530e2cfdd3e96c92d9052e6c409778dcc4ff27ec1`.
- Correction claim: `a7a2325a-ab81-4283-a111-9845ae494c29`; raw SHA-256 `80773841bbd27f16716cf6f564235175f64a766b21db5642b48e6b9ba618b21f`.

## Security correction

- The content workspace no longer reads media authorization or canary values from URL query parameters or retains them in client state.
- The browser begin request contains only `file_name`, `mime_type`, and `byte_count`, plus the existing session-bound CSRF header. It contains no authorization, canary, or idempotency field.
- The strict server begin schema rejects `authorization_id`, `canary_id`, and `idempotency_key` as unknown browser fields before service, state, or storage invocation.
- Protected server configuration supplies the authorization and canary bindings. The server hashes those bindings with the Admin/account/product scope to derive one stable opaque replay key; raw control values are not echoed to the browser or embedded in the key.
- Begin and part-completion responses omit the server-derived idempotency key and request hash, so those authority-bound values cannot re-enter browser state.
- A new durable begin initializes managed storage exactly once. A durable replay performs zero new managed-storage initialization because the injected adapter contract does not prove multipart creation idempotency.
- Admin entitlement, CSRF, same-origin credentials, no-store headers, and the default-off gate remain unchanged.

## Verification and zero effects

- Focused client API tests prove an exact query-free URL and metadata-only request body.
- Focused workspace tests prove control-looking query values are discarded rather than projected into route state.
- Focused router tests prove strict forbidden-field rejection, missing protected-binding fail-closed behavior, default-off zero effects, stable server-derived replay identity, one initialization for a new begin, and zero initialization for replay.
- Correction tests: 3 files / 11 tests passed. Adjacent ingest and composition compatibility tests: 4 files / 12 tests passed.
- Repository typecheck, claimed-path ESLint, claimed-path Prettier, diff whitespace check, and the repository secret scan passed.
- No provider runtime was composed and no database, migration, upload, S3, Drive, OpenAI, Vimeo, deployment, DNS, send, billing, Customer, or Student effect was performed.
