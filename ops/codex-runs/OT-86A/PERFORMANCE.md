# OT-86A Performance

Packet id: OT-86A  
Branch: codex/ot86a-vimeo-content-kb  
Base SHA: a02d1d254ae0d17804fb657079a7871567260ea2  
Head SHA: pending until commit/push  
Generated UTC: 2026-07-15T17:15:21.808Z

## Environment

- Node: v24.13.0
- npm: 11.6.2
- Tool: `scripts/ot86/content-performance-probe.ts`
- Fixture: 1,000 content items, 10,000 sections, 50,000 search documents
- Samples: 30
- BNA network dependency: false
- Provider/model network time: excluded; no provider/model calls in probe.

## Command

`npx tsx scripts/ot86/content-performance-probe.ts --write-report`

Exit code: 0

## Results

| Path                                       | Budget p95 | Measured p95 | Result |
| ------------------------------------------ | ---------: | -----------: | ------ |
| Library list                               |     250 ms |    58.106 ms | Pass   |
| Content detail                             |     250 ms |     8.505 ms | Pass   |
| Citation deep link                         |     150 ms |     2.507 ms | Pass   |
| Authorization plus local retrieval/ranking |     750 ms |    24.319 ms | Pass   |
| Duplicate publish acknowledgement          |     250 ms |     0.355 ms | Pass   |

`PERFORMANCE-PROBE.json` contains median, p95, max, fixture size, and serving index evidence.

## Index Evidence

- `ot86_published_versions_active_idx`: `(tenant_id, active_state, published_at)`
- `ot86_published_versions_content_idx`: `(tenant_id, content_id, active_state)`
- `ot86_published_sections_content_idx`: `(tenant_id, content_id, version_id, ordinal)`
- `ot86_published_sections_deep_link_idx`: `(tenant_id, section_id, active)`
- `ot86_search_documents_lookup_idx`: `(tenant_id, active, content_id, version_id)`
- `ot86_publication_inbox_message_idx`: `(message_id, raw_body_sha256)` in probe; production table has unique `message_id`.

## Bundle Boundary

`npm run build` passed. OT-86A adds no client route, Vimeo SDK, transcription SDK, BNA admin/studio module, provider secret helper, or raw prompt tooling to client bundles.

## Note

The probe uses a pg-mem performance schema with production serving table names and serving indexes because loading 61,000 rows through every migrated pg-mem constraint/index was the setup bottleneck. Migration correctness is covered separately by integration tests.
