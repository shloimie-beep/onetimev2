# OT-P6 Trial Copy and Routing Result

- Date: 2026-08-09
- Branch: `codex/ot-p6-trial-copy-routing-20260809`
- Base: `codex/one-time-complete-production-launch-20260805`
- Deployment: none — OT-CTRL owns integration and deployment.

## Delivered correction

- Locked public behavior to real Family-account creation with immediate free access through the configured September 11 cutoff.
- Replaced public launch pre-registration wording with the approved Family-account CTA, offer, and three How It Works steps without changing section order or imagery.
- Routed Member Login and post-signup Parent continuation to `https://app.onetimeonetime.com`.
- Kept session cookies host-only; no cross-subdomain cookie domain was added.
- Preserved the archived delivered Tisha B’Av email as historical evidence and recorded current Family launch copy separately.
- Set password-reset lifetime to 60 minutes.
- Made the post-expiry flow cardless and non-automatic: an approved `ONE_TIME_GHL_PAYMENT_LINK` is required before a hosted-payment handoff is planned; otherwise the account receives a clear `info@onetimeonetime.com` support path.
- Kept the standard $67/month decision in the canonical decision register; no unrelated price copies were introduced.

## Focused validation

Updated focused assertions cover:

- landing and signup copy, CTA, no pre-registration language, canonical Rabbi and security identities;
- Member Login and post-signup routing to the canonical app origin;
- free-period boundary and no-payment-link after-expiry support fallback;
- no card fields or automatic-charge claim in the signup journey;
- existing landing accessibility, mobile, metadata, performance, and no-horizontal-overflow coverage remains in the focused public Playwright suite.

Native execution could not be run from this task workspace because the local shell runner was unavailable and no checkout was provisioned. The focused tests are included in the child PR for CI validation; no provider configuration or deployment action was performed.
