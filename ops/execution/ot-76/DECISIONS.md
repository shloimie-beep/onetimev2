# OT-76 Decisions

## DEC-OT76-001: Audit Mode Is Honest But Non-Blocking

Audit mode reports missing and partial capabilities while exiting 0 unless the
harness itself is invalid or file-scope safety fails. This lets OT-76 run now
without pretending that absent Day-One capabilities are present.

## DEC-OT76-002: Certify Mode Is Strict

Certify mode exits nonzero if any Day-One gate is missing, partial, or blocked.
It is intended for OT-80 and later integrated release candidates.

## DEC-OT76-003: No Package Script Change

The prompt forbids package/runtime composition edits, so the harness is run
directly with Node instead of adding `package.json` scripts.
