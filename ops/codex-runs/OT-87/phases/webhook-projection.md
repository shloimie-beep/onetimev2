# OT-87 Phase Ledger - Webhook And Projection

Status: locally verified.

- Implemented checkout, subscription, invoice, refund, and dispute event projection paths.
- `checkout.session.completed` marks checkout completion but never grants access alone.
- Entitlement projection grants access only with active/scheduled-end subscription truth plus paid USD 6700 invoice truth and no holds.
