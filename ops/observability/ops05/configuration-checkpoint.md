# OPS-05 Configuration Checkpoint

Status: `ready_for_observability_configuration`

The code and contracts are ready for monitoring configuration. The following
protected names may be configured by the operator or deployment owner. Values
must never be committed, pasted into issue comments, printed in reports, or
logged.

## Monitoring Runtime

- `OPS05_MONITORING_ENABLED`
- `OPS05_MONITORING_MODE`
- `OPS05_EXPECTED_SOURCE_SHA`
- `OPS05_EXPECTED_CONFIG_MODE`
- `OPS05_EXPECTED_PROVIDER_MODE`
- `OPS05_SYNTHETIC_SHARED_SECRET`
- `OPS05_ALERT_DEDUP_WINDOW_SECONDS`
- `OPS05_ALERT_DISPATCH_MODE`
- `OPS05_ALERT_HMAC_SECRET`

## OTEL-Compatible Export

- `OTEL_SERVICE_NAME`
- `OTEL_RESOURCE_ATTRIBUTES`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_EXPORTER_OTLP_HEADERS`
- `OTEL_METRIC_EXPORT_INTERVAL`
- `OTEL_TRACES_SAMPLER`
- `OTEL_TRACES_SAMPLER_ARG`

## Asynchronous BNA Support Bridge

- `BNA_SUPPORT_BRIDGE_MODE`
- `BNA_SUPPORT_BRIDGE_ENDPOINT`
- `BNA_SUPPORT_BRIDGE_SIGNING_KEY_ID`
- `BNA_SUPPORT_BRIDGE_SIGNING_SECRET`
- `BNA_SUPPORT_BRIDGE_CONSUMER_STATUS_TTL_SECONDS`

Ordinary One Time routes must not call BNA synchronously. These names are only
for async producer receipts, cached consumer status, and operator alert routing.

## Provider Status Readback

- `ONE_TIME_PROVIDER_STATUS_READBACK_MODE`
- `ONE_TIME_EMAIL_PROVIDER_MODE`
- `ONE_TIME_WHATSAPP_PROVIDER_MODE`
- `ONE_TIME_TELEGRAM_PROVIDER_MODE`
- `ONE_TIME_VIMEO_PROVIDER_MODE`
- `ONE_TIME_BUFFER_PROVIDER_MODE`
- `ONE_TIME_STRIPE_TEST_PROVIDER_MODE`
- `ONE_TIME_ZOOM_PROVIDER_MODE`

Provider modes should remain `disabled`, `sink`, or `test` until the separate
provider-specific approval gates authorize live canaries.

## Operator Steps

1. Configure protected names in the deployment secret manager, not in Git.
2. Run provider-off synthetic checks in staging.
3. Confirm `/healthz`, `/readyz`, and `/version` expose expected SHA/mode
   headers and no secrets.
4. Enable alert dispatch only to the protected operator channel.
5. Run one alert dedupe test and record only alert ID, service key, timestamp,
   and result.
6. Keep provider canaries disabled until separately approved.
