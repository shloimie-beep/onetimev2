# P08 Registration Server Correction - Terminal Source Handoff

## Exact review identity

- Branch: `codex/v21-p08-registration-server`
- Base: `9cb28a0078e3dfe814cfca34cf93000993416ce8`
- Implementation parent:
  `30de59df0555058fc021bc6002a3dffc4e3ea916`
- Corrected implementation:
  `1550e6682ff1bcacdea260d1b6b80ec231381ded`
- Implementation timestamp: `2026-07-30T20:44:55+03:00`
- Terminal metadata commit: derive from Git; its sole parent must be the corrected
  implementation above.
- External effects: authority none; attempted 0; succeeded 0; reconciled 0.

The source is ready for independent review. It is not integrated, candidate
complete, provider configured, or released.

## Corrected implementation

The final base-to-implementation diff contains fourteen P08-owned product and
successor-request paths. Although correction commit `1550e668` touches
seventeen paths relative to its parent, three of those changes restore
`apps/web/src/server/app.ts`, `packages/config/src/index.ts`, and
`tests/unit/config/v21-verification-environment.test.ts` exactly to their base
tree state; the test path is absent at both base and corrected head. There is
no cumulative shared-path change.

The corrected source now:

- treats missing or unavailable GHL evidence as `readback_required`, not
  identity ambiguity;
- preserves actual multiple-match or provider-email disagreement as
  `identity_review` and blocks post-expiry checkout or provider dispatch;
- commits an exact adult-only P27 handoff with Student contact prohibited and
  every provider/message/billing authorization false;
- at or after expiry, atomically persists the exact P25 standard
  HighLevel-orchestrated Stripe-hosted commercial command and one `job_outbox`
  intent, with no URL, charge, or direct Stripe mutation;
- uses an injectable v2.1 session seam and reports `session_established: true`
  only with `middleware_readback_verified: true`; the default response is the
  truthful durable HTTP 202 pending state.

## Corrected semantic contract

The source constant and focused assertion are now version `2.1.0`.

- Implementation: `1550e6682ff1bcacdea260d1b6b80ec231381ded`
- Export: `packages/contracts/src/signup/family/index.ts`
- Git blob: `ab1033a22c5c8019ba3c98c1a8b3979beb9b9358`
- Export artifact SHA-256:
  `a29ab4b30049719e530ca38eb0c78671d171959c694d4b6593a5c688caf4dd4c`
- Derived contract digest:
  `800fe2387b47b064d89e2a272253c24c4594deea4b992943fbc3cf3a494bcfcd`

That digest uses the existing checkpoint algorithm with semantic version
`2.1.0`. A superseding interface checkpoint has not been published; C00/I36
must independently admit and publish it. The historical `2.0.0` checkpoint
remains evidence and is not rewritten.

## Immutable successor requests

Canonical digests are SHA-256 over recursively key-sorted JSON of the parsed
YAML, preserving array order. Raw digests are over the exact Git-blob bytes at
`1550e668`.

| Request                  | Git blob                                   | Raw SHA-256                                                        | Canonical SHA-256                                                  |
| ------------------------ | ------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `P08-auth-household-002` | `0b883423f57ccfbadbf2d8e01d15bb0a1aa82a1c` | `600bdc4618a4812ea2ad0cfcdd6074b9ce69d99124991e8be7b21a5c5ed731fc` | `aa7628c7665033ea0ad85ff10fc36a8890cadc6202314dec712feeb4f1db9860` |
| `P08-config-002`         | `3f6ec5d305b7c9a7cbfe92b18ae6078a1ffbdcaf` | `88fcdc20555bcf044455cebf30fbad4e91af89432ee7dd6768114c0d4de24b19` | `d7131affc30ad18aba0a691ffda5410195f3bec829aca1e8f3a270bdec6f26be` |
| `P08-registration-002`   | `e5f0743ac6326e9b85d6a83d7673f4d12f997cc7` | `0b0b82567be04624d0facf501dbc9d5fb418d0d86b79462f6220e8d8b56856d3` | `da27ec8f95da3007e3bf51edec04d18cac093e1c1a568c67fa79d360ced6b5f5` |

The predecessor requests remain byte-identical to base. In particular,
`P08-registration-001` remains Git blob
`d27d048cfca13a0193ec7718eec20c8ed22141ba`; it was not rewritten.

## Verification

- Focused Vitest: five files, 29 tests passed.
- Workspace TypeScript typecheck: passed.
- Targeted ESLint and focused Prettier: passed.
- Secret scan: passed across 3097 repository text files.
- Native PGlite with migrations 2234, 2235, 2236, and 2248:
  `P08_NATIVE_OK adults=2 households=2 signups=2 commercial_commands=3 hosted_checkout_jobs=1`.
- Exact cumulative scope, shared-path restoration, immutable-request bytes,
  YAML, raw/canonical digests, metadata-only diff, and diff hygiene: passed.
- No provider, message, enrollment, billing, deployment, DNS, or migration
  effect was attempted.

## Remaining steward gaps

1. I36 must register the Family route in the central server composer and bind
   the canonical validated runtime/configuration fields.
2. F03/F04 must provide the v2.1 adult-session writer and the same current
   middleware resolver used by authenticated Parent routes.
3. F04 must remove its invalid `v21_households.display_name` read and provide a
   real schema-backed safe household label.
4. P27 must consume the adult-only Family outbox and perform canonical GHL
   readback before classification or any later effect.
5. F06 must supply the exact provider-operation binding, lock, fencing token,
   and reconciliation before any P25 worker dispatch.
6. F07/I36 must implement truthful session-success handling and the safe,
   single-use checkout redirect-handle continuation.
7. C00/I36 must admit and publish the semantic-contract `2.1.0` checkpoint.
8. I36/shared stewards must add the required root-barrel exports and shared
   registration/configuration tests covered by the three successor requests.

## Exact next action

C00 independently audits and admits only implementation
`1550e6682ff1bcacdea260d1b6b80ec231381ded`. On acceptance, I36 dispositions
`P08-registration-002` and `P08-config-002`, while F03/F04 disposition
`P08-auth-household-002`. No provider effect begins from this handoff.
