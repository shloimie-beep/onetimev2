# HighLevel LC Email DNS Checklist

Use this checklist when preparing HighLevel email sending for One Time. Do not
change DNS, verify a sending domain, or send a campaign without exact operator
authorization.

## Sender Contract

- Visible sender: `info@onetimeonetime.com`
- Reply-to: `info@onetimeonetime.com`
- Dedicated sending subdomain: `mail.onetimeonetime.com`
- HighLevel location: the One Time location recorded in `workflows.yaml`

## Operator Setup Steps

1. In HighLevel, open the One Time sub-account only.
2. Configure LC Email for the dedicated sending subdomain
   `mail.onetimeonetime.com`.
3. Copy the exact DNS records HighLevel provides for the subdomain.
4. Record the DNS record names, types, values, and HighLevel screen reference in
   private operator notes.
5. Apply DNS only after the operator explicitly approves the exact records.
6. Wait for HighLevel verification to complete.
7. Send only an operator-owned test email after verification.
8. Record safe evidence in `workflows.yaml` without committing raw account
   tokens, private mailbox contents, or campaign copy.

## Required Checks

- Confirm the account is the One Time HighLevel location, not a BNA or agency
  location.
- Confirm the sender and reply-to are both `info@onetimeonetime.com`.
- Confirm suppression behavior uses `OT | Marketing Suppressed`.
- Confirm workflows do not send student credentials, reset links, raw class
  links, or private Vimeo credentials through HighLevel.
- Confirm no broad marketing campaign is scheduled or sent in this checkpoint.

## Evidence To Record

- Verification date.
- Safe HighLevel location reference.
- Sending subdomain.
- Test recipient safe reference.
- Whether DNS is pending, verified, or blocked.
- Whether a test email was sent.
