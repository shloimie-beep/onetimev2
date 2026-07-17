# Staging Migration Runbook

Use exact immutable source 0d8d7168f066668f035176d777bdaaa4dcc5accd. Do not run against production. Apply migrations as a separate controlled operation after a backup freshness check and before provider activation. Record migration ledger before and after, schema hash, lock wait observations, row counts, and redacted errors only.
