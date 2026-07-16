# OT-103 Blockers

## BLOCK-OT103-001 - Provider Canary Credentials

Status: blocked for canary only.

The prompt permits a staging provider canary only when protected staging Zoom credentials and explicit `OT103_STAGING_CANARY_AUTHORIZED=true` already exist. Local implementation and sink proof can continue without those credentials. No real Zoom meeting, invite, recording, webhook, provider mutation, or external user action is authorized by default.
