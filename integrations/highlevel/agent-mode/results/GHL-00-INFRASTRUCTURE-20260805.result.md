GHL-00 BLOCKED

# Email, DNS, mailbox, sender, and reply infrastructure result

## Source and isolation

- Source pull request: `shloimie-beep/onetimev2` PR `#131`
- Exact source SHA: `f10ba3e41858cf35ace6f86ca8dc5507f9727019`
- Dedicated branch: `codex/ghl-00-infrastructure-20260805`
- HighLevel location: `pBSnOK2nkdxp6gf9Rg3o`
- Execution date: `2026-08-05` (`Asia/Jerusalem`)

## Provider and routing status

| Layer | Provider / resource | Result |
|---|---|---|
| Authoritative DNS | GoDaddy (`ns37.domaincontrol.com`, `ns38.domaincontrol.com`) | Verified; one bounded TXT alias record added and publicly resolved. |
| Root inbound MX | Forward Email (`mx1.forwardemail.net`, `mx2.forwardemail.net`) | Preserved unchanged. No mailbox product was purchased and no root MX was replaced. |
| Existing office route | `info@onetimeonetime.com` to the monitored HighLevel inbox | Verified by live HighLevel Conversations readback. |
| Rabbi route | `rabbielischeller@onetimeonetime.com` to the same monitored HighLevel inbox | Added with a Forward Email TXT alias and verified by a one-message inbound test in HighLevel Conversations. |
| Outbound email service | HighLevel LC Email dedicated domain `mg.onetimeonetime.com` | Reused; shared IP active; warm-up observed in Stage 2. |
| Reply handling | HighLevel Conversations | Verified: both human acceptance-test replies appeared in the same existing operator conversation. |
| Personal-inbox forwarding | HighLevel Reply & Forward settings | Not configured. Forwarding to `info@onetimeonetime.com` would route back into this same HighLevel inbox and create a loop; the HighLevel screen also disallows the sending domain. |
| Global Reply Address | HighLevel Reply & Forward settings | Left blank. The screen warns that using this field prevents replies from being tracked in the originating HighLevel thread. |

## DNS and email authentication

- Root MX was not modified.
- Added one root TXT alias: local part `rabbielischeller` routes to the existing monitored HighLevel inbound address. The destination address is omitted here to avoid duplicating routing internals beyond what is required.
- Existing `info` alias remained intact.
- The new Rabbi alias was observed in public recursive DNS after the change.
- Dedicated sending-domain verification readback was `Verified` for:
  - SPF on `mg.onetimeonetime.com`
  - DKIM on the dedicated-domain selector
  - DMARC on `_dmarc.mg.onetimeonetime.com`
  - Return-path CNAME on `email.mg.onetimeonetime.com`
  - Mailgun MX records on `mg.onetimeonetime.com`
- The bounded deliveries were mailed by and signed by `mg.onetimeonetime.com` with TLS.

## Canonical HighLevel custom values

No duplicate normalized custom-value names were present after the changes.

| Custom value | Required value | Provider ID | Result |
|---|---|---|---|
| One Time Rabbi Campaign Sender Name | `Rabbi Eli Scheller` | `YTbMWivrsI10LnH26Xfv` | Updated from the historical combined brand label. |
| One Time Rabbi Campaign Phase 2 From | `rabbielischeller@onetimeonetime.com` | `vry4UlKB4PAvWLkiz6Ac` | Updated from the prohibited historical `rabbi@` address. |
| One Time Rabbi Reply-To | `rabbielischeller@onetimeonetime.com` | `RPiTf55tOjkOI7Rv68Hp` | Created. |
| One Time Brand Sender Name | `One Time Mishnayos` | `XyASPYbVa4ZBHuJe2yJI` | Already correct; verified. |
| One Time Brand From | `info@onetimeonetime.com` | `o9aOerC0VSMKzDv4hrkX` | Already correct; verified. |
| One Time Office Sender Name | `Shloimie from One Time Mishnayos` | `Lr6PxCIoU2vMpJWkngow` | Already correct; verified. |
| One Time Office From | `info@onetimeonetime.com` | `hqUv17HvF9zGd781UDpX` | Already correct; verified. |
| One Time Default Reply-To | `info@onetimeonetime.com` | `u0msWwGUDL4Upjfe58Bm` | Already correct; verified. |

Provider-generated keys for the two Reply-To values omit the underscore before `to` (`replyto`); the provider IDs above are the stable identifiers used for reconciliation.

## Bounded acceptance test

- Temporary workflow: `TEMP - One Time Sender Acceptance 2026-08-05`
- Operator-owned test contacts used: `1`
- Customer contacts used: `0`
- Initial acceptance emails sent: `2` (Brand `1`, Rabbi `1`)
- Initial acceptance emails delivered: `2`
- Human replies sent: `2`
- Replies observed in the same HighLevel Conversation: `2`
- Separate inbound-alias verification emails sent: `1`
- Temporary workflows deleted: `1`
- Additional retries: `0` (the two-email cap was respected)

Observed recipient headers:

| Test | Values entered in the HighLevel Email action | Delivered From | Delivered Reply-To | Thread result |
|---|---|---|---|---|
| Brand | `One Time Mishnayos <info@onetimeonetime.com>` | `One Time Mishnayos <info@mg.onetimeonetime.com>` | `info@mg.onetimeonetime.com` | Reply remained in the same HighLevel Conversation. |
| Rabbi | `Rabbi Eli Scheller <rabbielischeller@onetimeonetime.com>` | `One Time Mishnayos <info@mg.onetimeonetime.com>` | `info@mg.onetimeonetime.com` | Reply remained in the same HighLevel Conversation. |

## Exact blocker

- Provider: HighLevel LC Email.
- Screens: `Automation > Workflows > TEMP - One Time Sender Acceptance 2026-08-05 > Email` and `Settings > Email Services > Dedicated Domain / Reply & Forward Settings`.
- Failed acceptance condition: HighLevel ignored or replaced the Email action's canonical Rabbi From Name and From Email. Both bounded sends were delivered with the Brand default identity on the dedicated `mg` subdomain. The Workflow Email action exposes From Name and From Email but no per-message Reply-To field. The available global Reply Address explicitly disables same-thread reply tracking, so it cannot be used without violating the reply-routing requirement.
- Required provider-side action: HighLevel must enable or correct per-workflow sender resolution for this location so that the verified `mg.onetimeonetime.com` service preserves the requested header identities and per-message Reply-To values—Brand `info@onetimeonetime.com` and Rabbi `rabbielischeller@onetimeonetime.com`—while retaining replies in the originating HighLevel Conversation. If HighLevel requires an additional verified-root sender identity, it must be added without changing the root Forward Email MX. After that provider-side change, rerun the same two-message acceptance test.
- No further UI mutation or email retry was made because the only visible global Reply-To workaround breaks threading and the bounded two-email limit had been reached.

## Mutations made

- GoDaddy DNS records added: `1`
- GoDaddy DNS records modified or deleted: `0`
- HighLevel custom values updated: `2`
- HighLevel custom values created: `1`
- HighLevel Reply & Forward settings changed: `0`
- HighLevel Email Services domain/authentication records changed: `0`
- HighLevel temporary workflows created: `1`
- HighLevel temporary workflows deleted: `1`
- Customer emails sent: `0`
- Secrets or test-contact PII recorded in this artifact: `0`
