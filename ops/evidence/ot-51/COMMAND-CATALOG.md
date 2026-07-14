# OT-51P Command Catalog

## Deterministic Commands

| User text | Result |
| --- | --- |
| `help` or `/help` | Capability explanation. |
| `status` or `/status` | Product/readiness status. |
| `classes` or `/classes` | Upcoming class summary without class links. |
| `content` or `/content` | Content pipeline summary without prompts/transcripts. |
| `contacts <query>` | Redacted bounded contact lookup. |
| `tasks [query]` | Scoped task lookup. |
| `task create <title>` | Preview then explicit confirmation. |
| `task update <task> <version> <open|done|blocked>` | Preview then explicit confirmation. |
| `confirm:<confirmationKey>` | Callback-only confirmation. |
| `cancel:<confirmationKey>` | Callback-only cancellation. |

## Explicitly Unsupported

- Bulk messaging or blasts.
- Payment, refund, Stripe, credential, DNS, integration, access-grant, class
  link disclosure, Studio/agent configuration, arbitrary DB/HTTP/shell/file
  operation, public-recipient messaging, BNA action, impersonation, or
  "View as Rabbi".
- Arbitrary natural language beyond the finite classifier. Ambiguous text asks
  for a more specific command or shows help.

## Adapter Truthfulness

The command exists only when the injected `OneTimeBotApplicationAdapter`
advertises the matching capability and the actor has it. Missing operations do
not fabricate data and do not show dead write paths.
