# OT-109 Decisions

- Fixed OT-109 scope in code and storage as `rabbi_sheller_provider` / `one_time_mishnah_class`.
- Stored source references and Vimeo provider references as digests, not raw URLs, tokens, or protected Drive locators.
- Kept Vimeo and transcription as feature-local ports with disabled sink factories by default.
- Produced library payloads as OT-86 `content.publication_manifest` objects, but did not wire shared app routes or send signed manifests.
- Produced social payloads as OT-106-compatible `content.approved_for_social` events, but did not invoke Buffer or OT-106 dispatch.
- Required transcript approval before derivative generation and per-artifact approval before publication.
- Kept helper retrieval bounded to server-supplied entitlements and active approved helper publications.
- Recorded shared route/worker/UI wiring as OPS-04 follow-up instead of editing shared entrypoints in OT-109.
