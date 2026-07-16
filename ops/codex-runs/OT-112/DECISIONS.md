# OT-112 Decisions

## D1 - Build product-system contracts, not a broad page rewrite

The prompt explicitly says auth, Content, provider leaves, and premium landing are changing in parallel. OT-112 therefore owns neutral package-level contracts, fixtures, gates, and adoption mapping. Runtime page adoption is deferred to the final conductor.

## D2 - Observe PR #47 without merging it

PR #47 head `c64a58ae9a72515fc6135cc2be0f72340c30f49c` was inspected through its visual acceptance, asset matrix, metrics, and final report. Its code was not merged. Overlapping landing invariants were represented as route/visual/adoption contracts.

## D3 - Keep visual fixtures fictional and deterministic

The gallery uses fictional family, learner, owner/admin, support, and provider states. No production account, live provider data, student-sensitive data, or BNA runtime data is required.

## D4 - Treat session-expired screenshots as named states only

Existing portal evidence included a session-expired capture. OT-112 keeps session-expired as an intentional state fixture, but adds pre-usable screenshot bans and gallery `data-ot-usable="true"` checks to prevent accidental final evidence from being captured during `Refreshing`, `Checking session`, or `Signed out` states.

## D5 - Preserve black/yellow with restrained ice-blue accent

The semantic token set preserves the approved One Time identity while completing missing shadows, motion, layers, breakpoints, safe areas, and density tokens.
