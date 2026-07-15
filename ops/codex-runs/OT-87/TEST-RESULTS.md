# OT-87 Test Results

## Initial Environment

| Command | Exit | Result |
| --- | ---: | --- |
| `git remote get-url origin` | 0 | `https://github.com/webcraft-media/onetimev2.git` |
| `git fetch origin refs/heads/codex/ot83-household-portals-foundation:refs/remotes/origin/codex/ot83-household-portals-foundation` | 0 | Source ref fetched. |
| `git ls-remote --heads origin refs/heads/codex/ot87-stripe-test-entitlements` | 0 | No target remote branch output; target absent. |
| `git rev-parse refs/remotes/origin/codex/ot83-household-portals-foundation` | 0 | `a02d1d254ae0d17804fb657079a7871567260ea2`. |
| `node --version` | 0 | `v24.13.0`. |
| `npm --version` | 0 | `11.6.2`. |

No product tests have been run yet. No protected Stripe configuration has been inspected.
