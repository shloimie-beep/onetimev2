# OT-46 Entitlement Policy Matrix

Policy seam: `packages/domain/src/billing/policy.ts`

Version: `ot46-billing-policy-v1`

| Subscription state | Projection status | Access grant |
| --- | --- | --- |
| `trialing` | `billing_eligible` | false |
| `active` | `active` | false |
| `canceled` with period end | `scheduled_end` | false |
| `canceled` without period end | `revoked` | false |
| `past_due` | `suspended` | false |
| `unpaid` | `suspended` | false |
| `paused` | `suspended` | false |
| `incomplete` | `pending` | false |
| `incomplete_expired` | `manual_review` | false |
| `disputed` | `manual_review` | false |
| `refunded` | `manual_review` | false |
| unknown/unrecognized | `manual_review` | false |
| stale/contradictory confidence | `manual_review` | false |

Unknown commercial policy never silently activates access.
