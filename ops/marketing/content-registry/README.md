# One Time Marketing Content-Asset Registry

**Status:** Launch-month repository backend contract  
**Runtime:** None  
**Frontend:** None  
**Database migration:** None  
**Provider dispatch:** None

## Purpose

This registry gives the marketing/media system durable IDs and a future-compatible backend shape without restoring the deferred Social/Buffer product surface or interfering with PR #131.

Drive stores binary media. This repo folder stores the index, relationships, rights state, campaign assignment, publication references, performance, and FX history.

A future Admin content section may import or project this data, but this launch-month lane does not add routes, UI, database tables, migrations, or provider integrations.

## Canonical files

```text
ops/marketing/content-registry/
  README.md
  content-asset.schema.json
  assets.ndjson
  creative-packages.yaml
  publication-events.csv
  performance.csv
  fx-rates.csv
```

## Stable IDs

### Source and derivative assets

```text
OTM-A000001
OTM-A000002
```

### Selected moments

```text
OTM-M0001
```

### Creative packages

```text
OTM-CP-001
```

### Finished creatives

```text
OTM-CR-202608-001-V01
```

Never derive identity solely from a mutable filename or Drive URL.

## Asset lifecycle

```text
source_only
→ inventoried
→ selected
→ derivative_ready
→ rabbi_pack_ready
→ final_review
→ ready_to_schedule
→ scheduled
→ published
→ measured
```

Blocking states:

```text
rights_pending
private_data_blocked
third_party_blocked
song_rights_pending
do_not_use
superseded
```

## Registry rules

1. Original source files are immutable.
2. Every derivative points to one source asset and exact source time range when applicable.
3. Drive file and folder IDs are stored separately from human-facing URLs.
4. Store stable view/download links only when access is appropriate. Never store short-lived signed provider URLs.
5. Do not store Student names, Parent names, emails, phone numbers, raw waivers, private questions, account IDs, or other unnecessary personal data.
6. `contains_student=true` requires an explicit rights/consent state.
7. Allowed destinations are explicit; no asset is assumed safe for every platform.
8. Atomic clips have no added music, text, transitions, watermark, face alteration, or synthetic person.
9. The Rabbi-facing filename is human-readable; technical lineage stays in the registry.
10. Publication and performance records append history rather than overwriting past outcomes.
11. USD is the primary spend currency. Every ILS reference is date-stamped with an FX source.
12. This registry does not authorize publication, scheduling, broadcast, boosting, ad spend, or product deployment.

## Minimum asset fields

- `asset_id`
- `asset_type`
- `title`
- `description`
- `source_asset_id`
- `source_drive_file_id`
- `source_drive_url`
- `source_filename`
- `source_sha256`
- `source_in_ms`
- `source_out_ms`
- `duration_ms`
- `orientation`
- `aspect_ratio`
- `width`
- `height`
- `category`
- `contains_student`
- `contains_rabbi`
- `contains_private_data`
- `rights_status`
- `allowed_destinations`
- `workflow_state`
- `drive_file_id`
- `drive_folder_id`
- `drive_view_url`
- `drive_download_url`
- `package_ids`
- `hook_ids`
- `campaign_ids`
- `first_frame_asset_id`
- `cover_asset_ids`
- `created_at`
- `updated_at`

## Rights status

Allowed registry values:

```text
operator_attested_all_marketing_channels
operator_attested_organic_only
documented_all_marketing_channels
documented_organic_only
not_required
rights_pending
do_not_use
```

`operator_attested_all_marketing_channels` records the operator’s instruction; it is not a substitute for the product/legal team’s final consent implementation or legal review.

## Allowed destinations

Possible values:

```text
facebook_organic
facebook_paid
instagram_organic
instagram_paid
youtube_organic
youtube_paid
whatsapp_status
whatsapp_forward
whatsapp_broadcast
landing_page
email
vimeo_private
one_time_portal_private
```

## Package relationship

`creative-packages.yaml` defines:

- package ID and hook;
- ordered asset IDs;
- 7–10s, 15s, and 25–30s recipes;
- text overlays;
- cover and first frame;
- channel copy references;
- current blocker state;
- Rabbi edit state;
- schedule week;
- finished creative IDs.

## Publication events

`publication-events.csv` is append-only and contains:

```text
publication_event_id,creative_id,platform,channel_mode,published_at,platform_post_id,platform_url,ghl_reference,status,notes
```

Do not add private provider tokens or signed URLs.

## Performance

`performance.csv` stores one row per creative/platform/window:

```text
measurement_id,creative_id,platform,window_start,window_end,organic_or_paid,spend_usd,fx_rate_usd_ils,fx_rate_date,spend_ils_reference,impressions,reach,three_second_views,average_watch_seconds,completion_rate,shares,forwards,landing_clicks,registrations,activations,paid_conversions,registration_cpa_usd,activation_cpa_usd,paid_cac_usd,notes
```

## FX rates

`fx-rates.csv` is append-only:

```text
rate_date,usd_ils_reference,source,source_series,retrieved_at,notes
```

Preferred reference source:

```text
Bank of Israel
RER_USD_ILS
```

## Future import boundary

A later product task may create an import/projection adapter from this registry into the Admin content workspace. That task must be separately authorized and must preserve:

- PR #131 launch scope;
- no restored Buffer/social publishing surface;
- no public child data;
- no provider bearer exposure;
- no automatic publication;
- exact source/rights/audit lineage.
