CREATE TABLE onetime.vimeo_mishnayos_catalog_revisions (
  revision_key text PRIMARY KEY CHECK (revision_key <> ''),
  account_key text NOT NULL CHECK (account_key <> ''),
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  schema_version text NOT NULL CHECK (schema_version = '1.0.0'),
  provider_identity_digest text NOT NULL,
  metadata_digest text NOT NULL,
  classification_status text NOT NULL CHECK (classification_status IN (
    'include_mishnayos', 'exclude_non_mishnayos', 'quarantine_ambiguous'
  )),
  publication_state text NOT NULL CHECK (publication_state IN (
    'not_eligible', 'quarantined', 'needs_review'
  )),
  protected_provider_reference text NOT NULL
    CHECK (protected_provider_reference LIKE 'v1.%'),
  record_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (
    account_key,
    product_key,
    schema_version,
    provider_identity_digest,
    metadata_digest
  ),
  UNIQUE (account_key, product_key, revision_key),
  UNIQUE (
    account_key,
    product_key,
    schema_version,
    provider_identity_digest,
    revision_key,
    metadata_digest
  ),
  CHECK (length(provider_identity_digest) = 64),
  CHECK (provider_identity_digest = lower(provider_identity_digest)),
  CHECK (length(metadata_digest) = 64),
  CHECK (metadata_digest = lower(metadata_digest)),
  CHECK ((record_json ->> 'providerIdentityDigest') = provider_identity_digest),
  CHECK ((record_json ->> 'metadataDigest') = metadata_digest),
  CHECK ((record_json -> 'classification' ->> 'status') = classification_status),
  CHECK ((record_json ->> 'publicationState') = publication_state),
  CHECK ((record_json ->> 'protectedProviderReference') = protected_provider_reference),
  CHECK ((record_json ->> 'participantReviewState') = 'pending'),
  CHECK ((record_json ->> 'privacyReviewState') = 'pending')
);

CREATE TABLE onetime.vimeo_mishnayos_catalog_current (
  account_key text NOT NULL,
  product_key text NOT NULL,
  schema_version text NOT NULL,
  provider_identity_digest text NOT NULL,
  revision_key text NOT NULL,
  metadata_digest text NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (account_key, product_key, schema_version, provider_identity_digest),
  FOREIGN KEY (
    account_key,
    product_key,
    schema_version,
    provider_identity_digest,
    revision_key,
    metadata_digest
  ) REFERENCES onetime.vimeo_mishnayos_catalog_revisions(
    account_key,
    product_key,
    schema_version,
    provider_identity_digest,
    revision_key,
    metadata_digest
  )
    ON DELETE RESTRICT,
  CHECK (product_key = 'one_time_mishnayos'),
  CHECK (schema_version = '1.0.0'),
  CHECK (length(provider_identity_digest) = 64),
  CHECK (length(metadata_digest) = 64)
);

-- This queue is an intake bridge to the canonical v2.1 P19/P20/P21 review and
-- publication path. It does not publish, assign, or expose a Vimeo asset.
CREATE TABLE onetime.vimeo_mishnayos_catalog_review_queue (
  review_key text PRIMARY KEY CHECK (review_key <> ''),
  account_key text NOT NULL,
  product_key text NOT NULL CHECK (product_key = 'one_time_mishnayos'),
  revision_key text NOT NULL,
  content_id text NOT NULL CHECK (content_id <> ''),
  content_version_id text NOT NULL CHECK (content_version_id <> ''),
  review_state text NOT NULL DEFAULT 'needs_review' CHECK (review_state IN (
    'needs_review', 'approved', 'rejected', 'published', 'unpublished', 'archived'
  )),
  participant_review_state text NOT NULL DEFAULT 'pending' CHECK (
    participant_review_state IN ('pending', 'complete')
  ),
  privacy_review_state text NOT NULL DEFAULT 'pending' CHECK (
    privacy_review_state IN ('pending', 'clear', 'hold', 'revoked')
  ),
  canonical_publication_content_id text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (account_key, product_key, revision_key),
  FOREIGN KEY (account_key, product_key, revision_key)
    REFERENCES onetime.vimeo_mishnayos_catalog_revisions(
      account_key,
      product_key,
      revision_key
    )
    ON DELETE RESTRICT
);

CREATE INDEX vimeo_mishnayos_catalog_classification_idx
  ON onetime.vimeo_mishnayos_catalog_revisions(
    account_key, product_key, classification_status, created_at
  );

CREATE INDEX vimeo_mishnayos_catalog_review_idx
  ON onetime.vimeo_mishnayos_catalog_review_queue(
    account_key, product_key, review_state, updated_at
  );

-- @postgres-only-begin
ALTER TABLE onetime.vimeo_mishnayos_catalog_revisions
  ADD CONSTRAINT vimeo_mishnayos_provider_digest_hex_check
    CHECK (provider_identity_digest ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT vimeo_mishnayos_metadata_digest_hex_check
    CHECK (metadata_digest ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT vimeo_mishnayos_no_raw_reference_check
    CHECK (
      protected_provider_reference !~* 'https?://'
      AND record_json::text !~* 'https?://(player\.)?vimeo\.com'
      AND record_json::text !~ '"providerIdentity"'
    );

CREATE OR REPLACE FUNCTION onetime.reject_vimeo_catalog_revision_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Vimeo catalog revisions are append-only';
END;
$$;

CREATE TRIGGER vimeo_mishnayos_catalog_revisions_append_only
BEFORE UPDATE OR DELETE ON onetime.vimeo_mishnayos_catalog_revisions
FOR EACH ROW EXECUTE FUNCTION onetime.reject_vimeo_catalog_revision_mutation();

CREATE OR REPLACE FUNCTION onetime.guard_vimeo_catalog_review_queue()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM onetime.vimeo_mishnayos_catalog_revisions AS revision
     WHERE revision.revision_key = NEW.revision_key
       AND revision.account_key = NEW.account_key
       AND revision.product_key = NEW.product_key
       AND revision.classification_status = 'include_mishnayos'
       AND revision.publication_state = 'needs_review'
  ) THEN
    RAISE EXCEPTION 'Only included Mishnayos revisions may enter canonical review';
  END IF;
  IF NEW.review_state IN ('approved', 'published')
     AND (
       NEW.participant_review_state <> 'complete'
       OR NEW.privacy_review_state <> 'clear'
     ) THEN
    RAISE EXCEPTION 'Catalog publication requires complete participant and privacy review';
  END IF;
  IF NEW.review_state IN ('approved', 'published')
     AND NOT EXISTS (
       SELECT 1
         FROM onetime.vimeo_mishnayos_catalog_current AS current_revision
        WHERE current_revision.account_key = NEW.account_key
          AND current_revision.product_key = NEW.product_key
          AND current_revision.revision_key = NEW.revision_key
     ) THEN
    RAISE EXCEPTION 'Only the current catalog revision may be approved or published';
  END IF;
  IF NEW.review_state = 'published'
     AND NEW.canonical_publication_content_id IS NULL THEN
    RAISE EXCEPTION 'Catalog publication must bind the canonical content publication';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER vimeo_mishnayos_catalog_review_guard
BEFORE INSERT OR UPDATE ON onetime.vimeo_mishnayos_catalog_review_queue
FOR EACH ROW EXECUTE FUNCTION onetime.guard_vimeo_catalog_review_queue();
-- @postgres-only-end
