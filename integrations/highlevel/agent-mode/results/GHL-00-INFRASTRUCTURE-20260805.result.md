GHL-00 BLOCKED

# Email, DNS, mailbox, sender, and reply infrastructure result

## Source and isolation

- Source pull request: `shloimie-beep/onetimev2` PR `#131`
- Exact source SHA: `f10ba3e41858cf35ace6f86ca8dc5507f9727019`
- Dedicated branch: `codex/ghl-00-infrastructure-20260805`
- HighLevel location: `pBSnOK2nkdxp6gf9Rg3o`
- Execution date: `2026-08-05` (`Asia/Jerusalem`)
- Recovery run: `GHL-00R — Correct the LC Email sender alignment and complete GHL-00`

## Corrected sender architecture

LC Email sends through the authenticated dedicated domain `mg.onetimeonetime.com`. HighLevel workflow From addresses are therefore aligned to that subdomain:

- Brand outbound: `One Time Mishnayos <info@mg.onetimeonetime.com>`
- Rabbi outbound: `Rabbi Eli Scheller <rabbielischeller@mg.onetimeonetime.com>`
- Office outbound: `Shloimie from One Time Mishnayos <info@mg.onetimeonetime.com>`

The public root-domain addresses remain inbound aliases and were not modified:

- `info@onetimeonetime.com`
- `rabbielischeller@onetimeonetime.com`

## Provider and routing status

| Layer | Provider / resource | Final observed result |
|---|---|---|
| Authoritative DNS | GoDaddy (`ns37.domaincontrol.com`, `ns38.domaincontrol.com`) | Preserved. No GHL-00R DNS mutation. |
| Root inbound MX | Forward Email (`mx1.forwardemail.net`, `mx2.forwardemail.net`) | Preserved unchanged. No mailbox purchase and no root MX replacement. |
| Public office alias | `info@onetimeonetime.com` | Preserved; reaches the monitored HighLevel inbox. |
| Public Rabbi alias | `rabbielischeller@onetimeonetime.com` | Preserved; reaches the monitored HighLevel inbox. |
| Outbound service | HighLevel LC Email dedicated domain `mg.onetimeonetime.com` | Reused; domain authentication remains verified. |
| Reply handling | HighLevel Conversations | Passed for both additional repair messages: each human reply returned to the same operator conversation. |
| Global Reply Address | HighLevel Reply & Forward settings | Left blank because the UI warns it disables originating-thread tracking. |
| Personal-inbox forwarding | HighLevel Reply & Forward settings | Left blank; forwarding to the root office alias would route back into the same HighLevel inbox. |

## DNS and LC Email authentication

- Root MX and both root inbound aliases were not changed during GHL-00R.
- The existing dedicated sending domain remains `mg.onetimeonetime.com`.
- Previously verified SPF, DKIM, DMARC, return path, and sending-domain records remain the accepted infrastructure baseline.
- Both GHL-00R deliveries were mailed by and signed by `mg.onetimeonetime.com` with TLS.

## Final custom values

No duplicate normalized custom-value names were created.

| Custom value | Final value | Provider ID | GHL-00R result |
|---|---|---|---|
| One Time Rabbi Campaign Sender Name | `Rabbi Eli Scheller` | `YTbMWivrsI10LnH26Xfv` | Preserved and verified. |
| One Time Rabbi Campaign Phase 2 From | `rabbielischeller@mg.onetimeonetime.com` | `vry4UlKB4PAvWLkiz6Ac` | Updated to the aligned LC Email address and verified after reload. |
| One Time Rabbi Reply-To | `rabbielischeller@onetimeonetime.com` | `RPiTf55tOjkOI7Rv68Hp` | Preserved as the public inbound value. |
| One Time Brand Sender Name | `One Time Mishnayos` | `XyASPYbVa4ZBHuJe2yJI` | Preserved and verified. |
| One Time Brand From | `info@mg.onetimeonetime.com` | `o9aOerC0VSMKzDv4hrkX` | Updated to the aligned LC Email address and verified. |
| One Time Office Sender Name | `Shloimie from One Time Mishnayos` | `Lr6PxCIoU2vMpJWkngow` | Preserved and verified. |
| One Time Office From | `info@mg.onetimeonetime.com` | `hqUv17HvF9zGd781UDpX` | Updated to the aligned LC Email address and verified. |
| One Time Default Reply-To | `info@onetimeonetime.com` | `u0msWwGUDL4Upjfe58Bm` | Preserved as the public inbound value. |

Provider-generated keys for the two Reply-To values omit the underscore before `to` (`replyto`); the provider IDs above are the stable reconciliation identifiers.

## Default header

- The active LC Email service is `mg.onetimeonetime.com`.
- The Email Services UI exposed the active dedicated service but no separate editable fallback From Name or From Email fields.
- Live delivery verified the effective fallback header as `One Time Mishnayos <info@mg.onetimeonetime.com>`.
- The fallback is correct for Brand sends.

## Bounded GHL-00R repair test

- Temporary workflow: `TEMP - One Time Sender Alignment Repair 2026-08-05`
- Workflow state during testing: `Draft` (disabled / never published)
- Operator-owned test contacts used: `1`
- Additional outbound test emails authorized: `2`
- Additional outbound test emails sent: `2` (Brand `1`, Rabbi `1`)
- Additional outbound test emails delivered: `2`
- Human replies sent: `2`
- Replies observed in the same HighLevel Conversation: `2`
- Customer recipients: `0`
- Broad sends: `0`
- Student contacts created: `0`
- Additional retries: `0`
- Temporary workflows deleted: `1`
- Deletion verification: success toast observed and workflow absent from the active workflow list.

### Delivered headers

| Test | Saved HighLevel Email action identity | Delivered From | Delivered Reply-To | Result |
|---|---|---|---|---|
| Brand | `One Time Mishnayos <info@mg.onetimeonetime.com>` | `One Time Mishnayos <info@mg.onetimeonetime.com>` | `info@mg.onetimeonetime.com` | Sender acceptance passed; human reply remained in the same HighLevel Conversation. |
| Rabbi | `Rabbi Eli Scheller <rabbielischeller@mg.onetimeonetime.com>` | `One Time Mishnayos <info@mg.onetimeonetime.com>` | `info@mg.onetimeonetime.com` | Sender acceptance failed; the Brand fallback replaced both Rabbi header fields. Human reply still remained in the same HighLevel Conversation. |

Before the Rabbi send, the workflow Email action was saved and then reopened. Its live UI readback was exactly:

- From Name: `Rabbi Eli Scheller`
- From Email: `rabbielischeller@mg.onetimeonetime.com`

The Rabbi subject and body changes were delivered, proving the updated action version executed, but its saved From Name and From Email were not used by the LC Email runtime.

## Exact remaining blocker

- Provider: HighLevel LC Email workflow runtime.
- Screens: `Automation > Workflows > TEMP - One Time Sender Alignment Repair 2026-08-05 > Email` and `Settings > Email Services > Advanced Settings`.
- Failed condition: the dedicated-domain-aligned Rabbi action identity persisted in the workflow UI but the delivered message used the Brand fallback identity.
- This is not the earlier root-domain alignment mismatch: the action used `rabbielischeller@mg.onetimeonetime.com` before the send.
- No custom SMTP switch, global Reply Address, DNS change, root-alias change, mailbox purchase, permanent-workflow mutation, support contact, or third email retry was made.
- The next repair must determine why this location's LC Email runtime ignores a persisted per-action From override—without changing the correct Brand fallback—and then rerun a newly authorized bounded Rabbi acceptance test.

## GHL-00R mutations

- GoDaddy DNS records changed: `0`
- Forward Email aliases changed: `0`
- HighLevel custom values updated: `3`
- HighLevel custom values created: `0`
- HighLevel Email Services settings changed: `0`
- HighLevel Reply & Forward settings changed: `0`
- HighLevel temporary workflows created: `1`
- HighLevel temporary workflows deleted: `1`
- Permanent business workflows changed: `0`
- Customer emails sent: `0`
- Broad emails sent: `0`
- Student contacts created: `0`
- Secrets or operator-contact PII recorded in this artifact: `0`
