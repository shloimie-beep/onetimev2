# 03-OT-GHL

Canonical current assignment:
`BOARD.yaml#tracks[id=audit_wave_03_ghl_sender_design]`.

## One-line continuation prompt

Continue 03-OT-GHL from the immutable conductor assignment SHA and execute
numbered GHL queue item 02 only: re-author the repository-only Rabbi
sender/message-class design on the current conductor descendant, do not open
HighLevel, do not use PR #116, keep every external-effect counter at zero, and
return the validated commit/PR plus sanitized handoff before waiting for
01-OT-CONTROL.

## Numbered GHL queue

1. `OT-LAUNCH-01-GHL-FULL-INVENTORY-02` — completed read-only in draft PR
   #123 exact head `b2fd8c73246a3a1e1655b22ee5c837d65c19ec97`; unavailable UI scopes remain explicitly
   `UNVERIFIED`, with every effect counter zero.
2. `OT-LAUNCH-01-GHL-RABBI-LAUNCH-EMAIL-DESIGN-REAUTHOR` — current,
   repository-only assignment under the `OT-GHL` lock.
3. Rabbi sender provider acceptance/canary — blocked. It requires the accepted
   queue-02 design, an exact operator-owned seed, mailbox/reply-routing
   ownership, and fresh separate provider authority.

Do not skip or combine queue items.

## Assignment

- Window ID: `03-OT-GHL`
- Task ID: `OT-LAUNCH-01-GHL-RABBI-LAUNCH-EMAIL-DESIGN-REAUTHOR`
- Repository: `shloimie-beep/onetimev2`
- Branch: `codex/ghl-rabbi-launch-email-design-reauthor-20260727`
- System: repository-only HighLevel sender/message-class governance
- Concurrency lock: `OT-GHL`
- Acceptance IDs: `GHL-003`, `GHL-SENDER-DESIGN-001`
- Canonical design packet:
  `ops/goals/OT-LAUNCH-01/handoffs/ghl-app-contract-shells--rabbi-launch-email-design.md`
- Inventory predecessor:
  `integrations/highlevel/agent-mode/results/GHL-READONLY-INVENTORY-20260727.result.json`
- Dependencies: accepted A01–A12 audit checkpoint, completed queue item 01,
  and explicit conductor adoption of sender packet
  `53a18e771488c61cf271cb33a0bcacee2c7135f4`

## Exact work

Read the full canonical Board row and design packet. Re-author the smallest
reviewable current-head diff that:

1. Reuses `rabbi_campaign`, `rabbi_personal`, `office`, `brand`, and
   `account_security`.
2. Preserves phase-one office routing until phase-two acceptance.
3. Keeps GHL-UI-13 a zero-send preflight and adds at most one reviewed,
   separately gated successor for one operator-owned seed and one reply
   readback.
4. Writes separate canonical copy for OT-02A operational migration and OT-02B
   independently consented nurture without sharing audience, permission,
   sequence state, or send authority.
5. Keeps Tisha registration event-purpose only and security-token mail in
   One Time/Resend.
6. Regenerates projections through canonical scripts, adds focused tests, and
   returns one sanitized handoff plus the exact later browser-executor prompt.

PR #116 is evidence of a divergent lane only. Do not merge or cherry-pick it.

## Forbidden behavior

Do not open or mutate HighLevel. Do not send, enroll, publish, activate,
select an audience, import or change a contact, run a canary, touch Stripe,
access, production, or provider systems, or edit `BOARD.yaml`. Do not commit
customer/Student data, private destinations, protected IDs, or secrets.

## Required validation and stop

Run HighLevel registry validation, canonical projection sync/check, goal
governance validation, focused sender/message-class tests, secret scan,
formatting, and diff checks.

Stop without implementation if the inventory unknowns change sender or
assistant identity, mailbox/routing ownership must be invented, final copy
cannot map to one exact message class, or protected/customer data would enter
Git.

End with `NEXT_QUEUE_STATE: WAITING_FOR_01_OT_CONTROL`.
