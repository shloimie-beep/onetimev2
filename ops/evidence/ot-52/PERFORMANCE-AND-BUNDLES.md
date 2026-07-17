# OT-52P Performance And Bundles

## Portal Harness

- Browser render samples: `30`.
- Browser render p50: `6.821ms`.
- Browser render p75: `8.082ms`.
- Browser render p95: `9.78ms`.

## Existing App Performance

- `npm run performance`: passed.
- Public performance tests: 3 passed.
- Bundle output:
  - `public_js_bytes`: `7295`
  - `public_css_bytes`: `10626`
  - `crm_js_bytes`: `204657`

## Bundle Impact

- Portal modules are unmounted and feature-local.
- Existing public and CRM bundles remained within the repo check thresholds.
