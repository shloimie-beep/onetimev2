MODEL: GPT-5.6-SOL
REASONING: HIGH
SERVICE TIER: PRIORITY
MODE: START_OR_RESUME

Resume the bounded One Time v2.1 P24 correction only after C00 reconciles its
exact correction atomic-claim head.

Repository: shloimie-beep/onetimev2
Branch: codex/v21-p24-support
Authoritative control ref: origin/codex/v21-control
Authorized start: 408b21afa4b9ac6f100b3ce33ea87984d18d4bf7
Reconciled atomic claim: 2a3b36c98b9a8698536149d668f0c58552c7eea4
Implementation commit: 81bb28c76744b52b52f9262c7e31e91954dc6472
Prior ready-for-review head: 78e6c88647356268424e16a29edbe60d36fe7703
Task packet: ops/v2.1-execution/tasks/P24.yaml
Task context: ops/v2.1-execution/contexts/P24-CONTEXT.md
Task state: ops/v2.1-execution/runtime/P24/TASK-STATE.yaml
Handoff: ops/v2.1-execution/runtime/P24/HANDOFF.md
Correction claim: 30f62864-3c37-4610-8a83-09dff3d63213
SUPPORT lease: b7c91222-fb97-4719-a14d-1428a7f11a01
READY digest: 70989507326113265e2e4cb81b00f51ce1d4db92f007bd9aab28ffdaadea97f1

Fetch remote refs and require the P24 branch to equal the exact correction claim
head reported to C00. Require a newer valid control state that reconciles that
exact head under the same correction claim. Re-verify task/context/package,
F03/F04/F05/F07, lease, and zero-effect identities from `TASK-STATE.yaml`.

After reconciliation only:

1. Keep canonical artifact aggregation as sorted
   `<path>=<raw Git blob SHA-256>` LF/no-final-LF lines, with no literal `path=`
   prefix; require current implementation digest
   `249f6b304e4273c0f565387fc5924cf4d19ea9d37e95b2a048a7531b41514e12`.
2. Change create and idempotent create replay to return only
   `SupportRequesterView`. Add a direct regression proving replay after an adult
   GHL link does not expose raw `ghlConversationId`.

Do not broaden scope, change steward requests, inspect Telegram/providers,
send, claim an effect lock, or perform an external effect.
