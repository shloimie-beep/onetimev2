# OT-47 Performance

Status: blocked before implementation by `STOP_REAL_POSTGRESQL_UNAVAILABLE`.

## Baseline

- `npm run build`: pass at exact base.
- Public and app bundles built successfully.
- No OT-47 bundle or request proof exists because the module was not
  implemented.

## Required Future Proof

If unblocked, OT-47 must capture synthetic 10,000-row query plans with
`EXPLAIN (ANALYZE, BUFFERS)`, prove keyset pagination stability, bounded query
counts, indexed search, due-event claim index use, lazy app chunk behavior, and
zero BNA/Vimeo requests for ordinary routes.
