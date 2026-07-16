# OPS-05 Verification Plan

Local verification stays provider-off and production-off.

## Static Contract Checks

- Parse every JSON file under `ops/observability/ops05`.
- Confirm every metric uses only approved low-cardinality labels.
- Confirm no forbidden telemetry field appears in metrics, dashboard panels,
  synthetic checks, alerts, or runbooks.
- Confirm every alert points to a runbook.
- Confirm every synthetic check has `external_write_allowed=false`.

## Code Checks

- Unit-test route family classification.
- Unit-test runtime readback source SHA normalization and header shape.
- Unit-test telemetry sanitizer against email, phone, URL, token, raw message,
  child, and payment-like inputs.
- Unit-test that delivery logs pass through the shared sanitizer.

## Future Configuration Checks

Once monitoring credentials are configured, run provider-off synthetic checks
from staging first. Do not enable provider canaries or alerts that send outside
protected operator channels until the separate provider approval gate is
recorded.

Success state: `ready_for_observability_configuration`.
