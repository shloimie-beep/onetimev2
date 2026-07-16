# OT-89A Decisions

## DEC-OT89A-001 - Use the packet contract as frozen authority

Decision: copy `SUPPORT-EVENT-CONTRACT.json` byte-for-byte and treat it as immutable. Any application types or fixtures must be checked against this committed file rather than regenerating it.

Evidence: `ops/codex-runs/OT-89A/SUPPORT-EVENT-CONTRACT.json`, `ops/codex-runs/OT-89A/CONTRACT-SHA256.txt`.

## DEC-OT89A-002 - Work from isolated worktree

Decision: implement in `C:/Users/User/.onetime-worktrees/OT-89A` on `codex/ot89a-subscriber-support-producer`, based on the exact remote OT84 commit.

Evidence: `git ls-remote` and `git rev-parse HEAD` both resolved `f98103ecc3660dbda871a91485656e17580940a8`.

## DEC-OT89A-003 - No production mutation

Decision: OT-89A may create a branch, push commits, and open a draft PR. It may not deploy or mutate production secrets/configuration. Delivery tests must use local fake or mock BNA endpoints.

Evidence: packet deployment/canary rule and `EXTERNAL-MUTATIONS.md`.
