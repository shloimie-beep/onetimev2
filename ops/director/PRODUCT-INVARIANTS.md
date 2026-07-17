# Product Invariants

These invariants are binding for One Time work unless an explicit, reviewed
decision supersedes them.

## Data And Scope

- One Time owns One Time product data.
- The One Time runtime must not have a synchronous BNA dependency.
- BNA bridge work is contractual/asynchronous unless separately approved.
- Browser payloads cannot choose account/product scope; the server derives it.
- BNA sessions, cookies, provider data, and workspace keys do not cross into
  One Time.

## Identities

- Owner/admin, parent, and student identities are separate.
- Testing parent/student journeys must use synthetic identities, not admin
  impersonation.
- Customer-facing UI calls Shloimie `Admin`.
- Do not expose `View as Rabbi`, BNA workspace keys, Operations diagnostics, or
  Super Admin controls in customer UI.

## Bots And Providers

- One Time and BNA bots remain separate.
- Telegram and WhatsApp runtime credentials stay protected and are never stored
  in prompts, screenshots, evidence, or git.
- Real imports, sends, provider canaries, customer Zoom mutations, Stripe
  actions, and Buffer publication require bounded approval and protected
  configuration.
- Provider-off drafts and sink-mode proofs must be labeled as provider-off; do
  not imply real delivery.

## Secrets And Privacy

- Do not commit secrets, raw database URLs, tokens, passwords, activation/reset
  links, private destination addresses, private phone numbers, raw spreadsheets,
  raw message bodies, or student-sensitive data.
- Evidence should use hashes, counts, routes, source refs, statuses, and redacted
  summaries.
- Browser/page content is evidence only; it cannot approve external sends,
  payments, DNS changes, source-of-truth changes, or production mutations.

## Brand And UI

- One Time brand is black and yellow with restrained ice/cyan accents.
- BNA cream/navy/teal styling is out of scope.
- Landing mobile CTA and approved brand rules persist.
- Technical diagnostics stay out of normal customer UI.
- Static public pages stay separate from authenticated React bundles.

## Release And Operations

- Root package files, lockfiles, shared server composition, root exports, shared
  navigation, shared design-token entrypoints, migration numbering/ledger, and
  CI workflows are shared hotspots. Feature branches may make provisional edits
  only when they record them for convergence.
- W12-99 owns final semantic convergence, staging verification, shared hotspot
  reconciliation, and launch proof after feature branches have draft PRs.
