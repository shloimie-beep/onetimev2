# W13-104 Rabbi Handoff

Status: sanitized operational handoff only. Do not send as an activation email
until the operator supplies the exact approved recipient, copy, sender action,
and email/provider authorization.

The live site is now W13-104 at `https://join.onetimeonetime.com`. Public
health, readiness, login, signup, activation, and forgot-password route smoke
checks passed after production deployment.

What changed in W13-104:

- The public page font load was stabilized so the launch performance/CLS gate
  passes.
- The automated production-role test fixture was updated so test sessions do
  not expire before the run begins.
- The release was deployed after a fresh production backup/restore proof and
  green PR validation.

What did not happen:

- No Rabbi email was sent.
- No CRM import was applied.
- No provider canary changed Zoom, Vimeo, Telegram, WhatsApp, OpenAI, Buffer,
  Stripe, or BNA support state.
- No private links, passwords, contact details, provider credentials, CRM rows,
  or student/family data belong in this sanitized file.
