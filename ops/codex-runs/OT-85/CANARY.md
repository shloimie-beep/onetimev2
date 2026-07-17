# OT-85 Canary

Canary readiness command:

```bash
npx tsx scripts/ot85/canary-readiness.ts
```

Observed result:

```json
{
  "checkpoint": "WAITING_FOR_WHATSAPP_CANARY_SECRET",
  "canary_recipient_secret_configured": false,
  "provider_env": "UNKNOWN",
  "staging_isolated": false,
  "canary_authorized": false,
  "recipient_value_printed": false
}
```

No canary send was attempted. The protected recipient value was not printed, logged, passed as an argument, or stored in run artifacts.
