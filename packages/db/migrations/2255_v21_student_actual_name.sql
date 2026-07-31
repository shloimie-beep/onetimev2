-- @postgres-only-begin
CREATE OR REPLACE FUNCTION onetime.v21_unicode_white_space_characters()
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || chr(32)
    || chr(133) || chr(160) || chr(5760)
    || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196)
    || chr(8197) || chr(8198) || chr(8199) || chr(8200) || chr(8201)
    || chr(8202) || chr(8232) || chr(8233) || chr(8239) || chr(8287)
    || chr(12288);
$$;

CREATE OR REPLACE FUNCTION onetime.v21_name_is_unicode_nonblank(value text)
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT value IS NOT NULL
    AND btrim(value, onetime.v21_unicode_white_space_characters()) <> '';
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM onetime.v21_student_profiles
     WHERE NOT onetime.v21_name_is_unicode_nonblank(display_name)
  ) THEN
    RAISE EXCEPTION
      'Student actual-name migration rejected Unicode-White_Space-only legacy display_name';
  END IF;
END;
$$;
-- @postgres-only-end

ALTER TABLE onetime.v21_student_profiles
  ADD COLUMN actual_name text;

UPDATE onetime.v21_student_profiles
   SET actual_name = display_name;

ALTER TABLE onetime.v21_student_profiles
  ALTER COLUMN actual_name SET NOT NULL,
  ALTER COLUMN display_name DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS v21_student_profiles_display_name_check,
  ADD CONSTRAINT v21_student_profiles_actual_name_storage_check
    CHECK (length(actual_name) > 0),
  ADD CONSTRAINT v21_student_profiles_display_name_storage_check
    CHECK (display_name IS NULL OR length(display_name) > 0);

-- @postgres-only-begin
ALTER TABLE onetime.v21_student_profiles
  ADD CONSTRAINT v21_student_profiles_actual_name_nonblank_check
    CHECK (onetime.v21_name_is_unicode_nonblank(actual_name)),
  ADD CONSTRAINT v21_student_profiles_display_name_nonblank_when_present_check
    CHECK (
      display_name IS NULL
      OR onetime.v21_name_is_unicode_nonblank(display_name)
    );
-- @postgres-only-end
