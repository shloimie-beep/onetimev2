INSERT INTO onetime.event_definitions (
  event_definition_key,
  account_key,
  product_key,
  event_code,
  public_title,
  event_start,
  event_timezone,
  event_start_israel,
  registration_open,
  landing_path,
  join_path,
  join_open_at,
  join_close_at,
  provider,
  provider_state,
  metadata
)
SELECT
  'event_tisha_bav_2026_rabbi_sheller_provider',
  'rabbi_sheller_provider',
  product_key,
  event_code,
  public_title,
  event_start,
  event_timezone,
  event_start_israel,
  registration_open,
  landing_path,
  join_path,
  join_open_at,
  join_close_at,
  provider,
  provider_state,
  metadata
FROM onetime.event_definitions
WHERE account_key = 'one_time'
  AND product_key = 'one_time_mishnah_class'
  AND event_code = 'tisha-bav-2026'
ON CONFLICT (account_key, product_key, event_code)
DO UPDATE SET
  public_title = EXCLUDED.public_title,
  event_start = EXCLUDED.event_start,
  event_timezone = EXCLUDED.event_timezone,
  event_start_israel = EXCLUDED.event_start_israel,
  registration_open = EXCLUDED.registration_open,
  landing_path = EXCLUDED.landing_path,
  join_path = EXCLUDED.join_path,
  join_open_at = EXCLUDED.join_open_at,
  join_close_at = EXCLUDED.join_close_at,
  provider = EXCLUDED.provider,
  provider_state = EXCLUDED.provider_state,
  metadata = EXCLUDED.metadata,
  updated_at = now();
