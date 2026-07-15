# OT-87 Phase Ledger - Adapter And Routes

Status: locally verified.

- Official Stripe SDK client wrapper added behind accepted adapter seam.
- Checkout and Customer Portal routes derive principal scope server-side and return local redirect handles.
- Webhook route is mounted before JSON parsing and preserves raw-body verification.
