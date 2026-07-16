# OT-110A Integration Delta

## Base

- Started from `origin/codex/ops03-staging-readiness-repair` at `fb5f5eebc539afc9e93833e9417ee67524d62c36`.
- Existing base had `/app/content` as a bounded read-only admitted-content list backed by `/api/v1/content/library`.
- Existing OT-86A/OT-86B base behavior remains intact.

## Related Inputs Read

- PR #48 / OT-109 head `a62d6a73553e175871f6d3124badb96573cdabe7`: final report says OT-109 adds fixed-scope Rabbi publisher contracts, migration `2190_ot109_rabbi_content_publisher.sql`, disabled ports, transcript approval, derivative generation, artifact review, publish/revoke, OT-86-compatible manifests, and OT-106-compatible social events.
- PR #46 / OT-106 head `4155ee706fce2eabc6db5225b5c8ce41a8c1dfd1`: final report says OT-106 adds signed Buffer manifests, durable Buffer queue/provider/audit migration `2160_ot106_buffer_social_publishing.sql`, sink mode, explicit scheduled mode, retries, canary tooling, and no local external writes.
- PR #44 / OT-107 head `560a07c66baddc99df38441299f3e57107d02137`: final report says OT-107 adds bounded student Class Helper retrieval over active entitlements and approved OT86 content, with no raw helper prompt/answer persistence and no live AI canary.
- Integrated PR #31/#32 behavior: OT-86A projection/retrieval and OT-86B social publishing records in `ops/codex-runs/OT-86A/*` and `ops/codex-runs/OT-86B/*`.

## What OT-110A Adds

- Admin-only operational workspace contracts and APIs under `/api/v1/admin/content/*`.
- Lazy authenticated app routes:
  - `/app/content`
  - `/app/content/processing`
  - `/app/content/create`
  - `/app/content/social`
  - `/app/content/knowledge`
  - `/app/content/prompts`
  - `/app/content/activity`
  - `/app/content/:sourceKey`
- Prompt registry tables and domain semantics:
  - immutable templates and versions;
  - structured patch event;
  - preview cannot publish;
  - activate/rollback only change future active prompt selection;
  - generation records exact prompt version checksum.
- Artifact revision tables for lesson summaries, review sheets, worksheets, newsletters, social captions, short-clip plans, helper knowledge, and classroom resources.
- Explicit Content capability grants and audited activity events.
- Deterministic provider-off ports for Vimeo, generation, knowledge indexing, Buffer, and Telegram.

## What OT-110A Does Not Merge

- Does not import OT-109 publisher tables/services or migration `2190_*`.
- Does not import OT-106 Buffer runtime tables/services or migration `2160_*`.
- Does not import OT-107 student helper UI/domain changes.
- Does not connect real Vimeo, Buffer, Telegram, AI, Drive, or BNA provider runtimes.
- Does not alter parent/student entitled projections except by preserving existing OT-86/OT-71 behavior.

## OPS-04C Handoff

- OPS-04C can connect PR #48 publisher source/detail events to OT-110A summaries and source detail.
- OPS-04C can connect PR #46 Buffer runtime to OT-110A social action buttons and status panels.
- OPS-04C can connect PR #44/OT-107 helper readiness to OT-110A knowledge readiness without exposing admin prompt/source data to learners.
- OT-110A provider ports are intentionally narrow and provider-off by default, so missing secrets do not block UI/domain tests.
