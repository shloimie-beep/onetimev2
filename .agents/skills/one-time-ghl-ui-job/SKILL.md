---
name: one-time-ghl-ui-job
description: Run or specify an authorized One Time HighLevel UI reconciliation job for any create, find, move, organize, reconcile, configure, publish, activate, test, or verify request involving GHL folders, workflows, bots, knowledge bases, fields, tags, values, pipelines, senders, or campaigns.
---

# One Time GHL UI job

Agent Mode may change GHL only under an exact authorized job. Codex owns the canonical Git registry/specification and commits sanitized results.

## Before opening or changing GHL

1. Read the canonical GHL registry and the exact job specification referenced by the conductor.
2. Verify the job names allowed asset types, exact canonical keys/names/paths, permitted operations, send/publish/enrollment authority, test audience/budget, and expected result path.
3. If the authorized job is absent or incomplete, produce a proposed job for Codex review and make no GHL mutation.
4. Default to no-send, no-publish, no-activation, and no-enrollment unless the exact job explicitly authorizes each action.

## Full-location inventory and matching

Inventory the asset type across active, draft, archived, and deprecated states. Record full folder ancestry; a current-folder view is not a complete inventory.

Match in this order using every applicable canonical discriminator:

- exact asset ID;
- asset type plus canonical key;
- workflow normalized name plus full folder path;
- custom-field object type plus `ghlKey` plus datatype;
- tag after Unicode/whitespace/punctuation normalization;
- bot or knowledge-base canonical key;
- other registry-defined ID/key/path tuple.

Reconcile punctuation only after exact-key checks. Never treat a similar display name as ownership proof.

- Zero matches: create only if the job explicitly authorizes creation.
- One match: reuse and reconcile that asset.
- More than one match: fail closed, return every ID/full path/state, and request a separate dedupe job.
- Never delete or rewrite history as part of discovery/dedupe.

## Save and prove

For each allowed change:

1. Capture sanitized before ID/state/path/location fingerprint.
2. Save once.
3. Navigate away or reload.
4. Reopen by canonical path/key and read back ID, full path, configuration, and status.

Use distinct result states:

- `SAVED`: save/reopen readback matches, but activation is not claimed.
- `ACTIVE_CONFIGURED`: active configuration is read back, but controlled execution has not passed.
- `ACTIVE_TESTED`: a controlled authorized trigger/execution proves expected branches and waits, bounded delivery, and idempotency/replay behavior.

Never claim `ACTIVE_TESTED` from a green toggle, save confirmation, or config screenshot. Never publish a shell whose app-side canonical event/tag/bot invocation is absent; preserve the authorized job's exact waiting state (for Phase 2, `DRAFT_WAITING_EXTERNAL`) and exact app-contract reference.

## Sanitized result JSON

Return:

```json
{
  "schema_version": 1,
  "job_id": "...",
  "asset_type": "...",
  "canonical_key": "...",
  "location_fingerprint": "...",
  "full_path": "...",
  "before_id": "...",
  "after_id": "...",
  "duplicate_count": 0,
  "save_status": "SAVED",
  "reopen_status": "MATCHED",
  "activation_status": "DRAFT|DRAFT_WAITING_EXTERNAL|ACTIVE_CONFIGURED|ACTIVE_TESTED",
  "timestamp": "...",
  "sanitized_execution_reference": null,
  "send_count": 0,
  "notes": []
}
```

Do not return secrets, access tokens, customer content, contact details, raw email/message bodies, private destinations, or replayable provider links. Codex reconciles this result into canonical Git state; Agent Mode does not edit the goal BOARD.
