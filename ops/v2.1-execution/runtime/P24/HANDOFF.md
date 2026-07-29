# P24 Support Correction Atomic Claim

## Identity

- Branch: `codex/v21-p24-support`
- Authorized start: `408b21afa4b9ac6f100b3ce33ea87984d18d4bf7`
- Reconciled atomic claim:
  `2a3b36c98b9a8698536149d668f0c58552c7eea4`
- Implementation commit:
  `81bb28c76744b52b52f9262c7e31e91954dc6472`
- Prior ready-for-review head:
  `78e6c88647356268424e16a29edbe60d36fe7703`
- Current correction atomic-claim commit: derive with `git rev-parse HEAD`; C00
  must record and reconcile the exact observed remote head
- Task packet digest:
  `a0b763435e1c23e670b5894e56037735b4bfb74bfae247ebfa70145d86b89383`
- Task context digest:
  `dc0b18db7b0e5a8eac1d02f6bf0d482ea58ab2b8efecaf8d214e05006b2f2427`
- Prompt digest:
  `1cf9d6f343ea49b8c7399864280f5bcdb24616199c2a6591bbb5f4f909fbee99`
- Source package digest:
  `10df0e699e9ebe88d8b9dd4a756f6110ed3292110ff138a6de5caf97f139ec3e`
- Package lock digest:
  `3d13585587ab64d063c09dd8ef37b2ffe1c40034d3f8dddf93299092a0ea8e4a`
- Correction claim: `30f62864-3c37-4610-8a83-09dff3d63213`
- SUPPORT lease: `b7c91222-fb97-4719-a14d-1428a7f11a01`, issued
  `2026-07-29T13:21:47Z`, expiring `2026-07-29T14:36:47Z`, scope
  `P24_atomic_claim_review_digest_requester_projection_correction_only`
- Latest valid containing control:
  `a4fda5d21837c7140083ce70619e301f26db2590`
- READY acquisition/state basis:
  `d7475995baa425229077fadd522082855997ed48`
- READY payload digest:
  `70989507326113265e2e4cb81b00f51ce1d4db92f007bd9aab28ffdaadea97f1`

## Dependency bindings

- F03: task/source `7c638131a0cab757657e95c4d2229a1573e4cde1`,
  integration `9782a4164662b8059a557c0969de9c35f54d0cf7`, implementation
  `56fa990c5d4a6cb7b602b5f68fe0d2402a0ee71e`, checkpoint
  `66464e9a769c717dfdfda082bb8a26030da1681d601d6752fb04b10d812db111`
- F04: task `54a0ac28b51d271aacab60003451dbcc66ffcac8`, source
  `4cc95c29c6012174595ba1821e0554aca8572e08`, integration
  `9782a4164662b8059a557c0969de9c35f54d0cf7`, implementation
  `8ba3f6c83ed3d7239ae672e938829ec9c572cd6b`, checkpoint
  `a57837379bfc8210188887ff31937ed7882befe10b80941499dc7ba305e7984d`
- F05: task `9174d845e1c04916e2f1884cfadfaef624ac6862`, source
  `0656380bcfc50cc464dcea7588448dc724049599`, integration
  `9782a4164662b8059a557c0969de9c35f54d0cf7`, implementation
  `1ade14c52e42e59bb8fd1d1de776b91406c45f15`, checkpoint
  `fd17c478bfc851dcb434b8e0c2750701605b80dfdf880833a6a2993e8fad6329`
- F07: task `2c451d7b1f59eece1ae8df505d4eeec19f42e1ef`, source
  `47a2bb6b76225951e0599683499a95f4dc9881be`, integration
  `91349fc1fa9a474ae31cf408ae0364aa10520385`, implementation
  `a90baae8cf69d6823af6d741161fe0e9e7441321`, checkpoint
  `366a1b30f724afc35e525f3f3175a4c84a45b7c13681cea1a17060bee75e4188`

The exact task/context dependency digests are recorded in `TASK-STATE.yaml`.
Every named interface source is an ancestor of the authorized start.

## Bounded corrections

1. Replace the superseded aggregate
   `e87246e9ab1ca1601fc0626af978b02a5d76f8fcd163e9fadab165bf0f35e877`
   with canonical digest
   `249f6b304e4273c0f565387fc5924cf4d19ea9d37e95b2a048a7531b41514e12`.
   The preimage is the 15 raw Git-blob SHA-256 values rendered as sorted
   `<path>=<digest>` lines, LF-separated with no final LF. There is no extra
   literal `path=` prefix.
2. Make both first create and idempotent create replay return only
   `SupportRequesterView`. Add a direct regression that creates adult support,
   links a GHL conversation, replays the original create command, and proves the
   response never contains raw `ghlConversationId`.

No product or test implementation is included in this atomic claim.

## Exact next action

C00 must reconcile the exact pushed correction claim head. Stop until that
reconciliation explicitly authorizes the two bounded corrections.

## Coverage and verification

Prior verification remains evidence only pending correction. This atomic claim
changes exactly `TASK-STATE.yaml`, `HANDOFF.md`, and `NEXT-PROMPT.md`.

## Steward requests

- `P24-migration-001`:
  `71065002e827d8b51c6bafc808568eb6940e2527a0ec0c30bd648d49d8bf93f3`
- `P24-registration-001`:
  `7fe2d310c429c37ddc7efa24c7b3b9d9509bf9ee59f2707f5d94e7fdfa0002f7`
- Aggregate:
  `27e11a78bcdb2b0a3913b1192012368fadf29a3bc7647c8166cb9a95047f63fa`

No migration, composer, route registry, root barrel, dependency, lockfile,
provider configuration, or global control path changed.

## External effects

Authority is `none`; no effect lock was claimed; attempted 0, succeeded 0,
reconciled 0. No Telegram or other provider state was inspected or mutated.

## Blockers and recovery

Correction implementation is intentionally paused pending C00 reconciliation.
Existing steward requests remain byte-identical and unapplied.
