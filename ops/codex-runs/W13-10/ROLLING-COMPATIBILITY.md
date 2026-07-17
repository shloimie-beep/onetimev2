# Rolling Compatibility

The active production runtime remains separate from the W12-99 source. W13-10 changed no checked migrations. Rolling compatibility for web-old/worker-old against the W12 migration set and web-new/worker-new against pre-migration schema must be rehearsed in disposable PostgreSQL before staging deployment authorization.
