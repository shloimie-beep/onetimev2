# OPS-04 Decisions

- `DEC-OPS04-001`: Use `origin/codex/ot85-whatsapp-lead-assistant` at `fb6b3266e2bb2689fdfc1f751764fd98ecca8f0a` as the implementation base because it contains the packet preferred SHA and descends from both OT-80 convergence and OT-74 legacy-audience foundation.
- `DEC-OPS04-002`: Treat `CHECKSUMS.sha256` as the packet checksum manifest because the ZIP does not contain a literal `SHA256SUMS.txt`; all listed SHA-256 values matched.
- `DEC-OPS04-003`: Final safe disposition is expected to be `waiting_for_source_export` unless a protected non-production source/root, row-access receipt, HMAC key, and explicitly marked non-production database are provided later.
- `DEC-OPS04-004`: Production import and campaign send authorizations are absent and must remain absent for OPS-04.
