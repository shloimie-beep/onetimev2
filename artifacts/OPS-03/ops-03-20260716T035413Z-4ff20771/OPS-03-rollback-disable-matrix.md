# OPS-03 Rollback And Disable Matrix

All provider rollback is fail-closed. No OPS-03 canary ran in this checkpoint.

| Provider | Disable Step ID | Queue Or Webhook Step | Cleanup Gate |
| --- | --- | --- | --- |
| telegram | OPS-03-RB-TELEGRAM-DISABLE-HANDLER | Pause staging update consumer and preserve dedupe state | Delete only the canary message if a future authorization permits cleanup |
| whatsapp | OPS-03-RB-WHATSAPP-DISABLE-ASSISTANT | Pause staging webhook consumer and retain message idempotency | No follow-up message or contact import |
| vimeo | OPS-03-RB-VIMEO-DISABLE-UPLOADER | Pause callback consumer and quarantine one synthetic event | Delete or quarantine the single synthetic asset only if authorized |
| buffer | OPS-03-RB-BUFFER-DISABLE-DRAFT-CREATOR | Pause approval queue and block publish worker access | Delete the single draft only if authorized |
| stripe_test | OPS-03-RB-STRIPE-TEST-DISABLE-WEBHOOK | Disable TEST webhook consumer and preserve event idempotency | Revert only synthetic TEST entitlement state if authorized |
| email | OPS-03-RB-EMAIL-DISABLE-STAGING-SENDER | Pause delivery callback consumer and hold retry queue | Do not resend uncertain deliveries |
| zoom | OPS-03-RB-ZOOM-DISABLE-LAUNCH-ISSUER | Pause launch and event consumer, invalidate nonce | Delete temporary staging meeting only if authorized |

Re-enable gate: new exact integrated staging SHA, trusted staging deployment binding, protected configuration readback, one-target proof, current authorization, redaction scan, and provider-specific rollback verification.
