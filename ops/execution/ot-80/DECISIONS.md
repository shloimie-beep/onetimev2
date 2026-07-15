# OT-80 Decisions

## DEC-OT80-001 - Remote Heads Are Source Authority

OT80 follows the packet rule that fetched remote heads are authoritative.
Stale registry, state, or self-SHA metadata is evidence to reconcile, not a
whole-task stop gate.

## DEC-OT80-002 - Communications Archive Implemented Directly

No fetched remote ref or local OneTime worktree evidence contained the Day-One
communications ZIP hash or message-catalog hash during Phase 0. OT80 will
preserve the archive byte-for-byte as audit input and implement the reconciled
server-owned catalog directly unless a later refetch finds a safe descendant
implementation lane.

## DEC-OT80-003 - Staging Is Later, Isolated, And Gated

The input manifest authorizes isolated One Time staging after candidate gates.
It does not authorize production, root-domain DNS, live Stripe charges,
bulk/audience sends, real family/school/legacy sends, or real legacy-data
mutation.
