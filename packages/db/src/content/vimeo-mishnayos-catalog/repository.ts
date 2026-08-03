import type {
  VimeoCatalogAdoptionRepository,
  VimeoCatalogAdoptionUnit,
} from '../../../../domain/src/content/vimeo-mishnayos-catalog.ts';
import type { VimeoMishnayosCatalogRevision } from '../../../../contracts/src/content/vimeo-mishnayos-catalog.ts';
import { inTransaction, type DbPool, type Queryable } from '../../index.ts';

export function createVimeoMishnayosCatalogRepository(
  pool: DbPool,
): VimeoCatalogAdoptionRepository {
  return {
    inTransaction: (run) => inTransaction(pool, (client) => run(createUnit(client))),
  };
}

function createUnit(client: Queryable): VimeoCatalogAdoptionUnit {
  return {
    async getCurrent(accountKey, providerIdentityDigest) {
      const current = await client.query(
        `SELECT revision_key
           FROM onetime.vimeo_mishnayos_catalog_current
          WHERE account_key = $1
            AND product_key = 'one_time_mishnayos'
            AND schema_version = '1.0.0'
            AND provider_identity_digest = $2
          FOR UPDATE`,
        [accountKey, providerIdentityDigest],
      );
      if (!current.rowCount) return null;
      const result = await client.query(
        `SELECT revision.record_json,
                CASE WHEN review.review_state IN ('approved', 'published')
                  THEN true ELSE false END AS approved
           FROM onetime.vimeo_mishnayos_catalog_revisions AS revision
           LEFT JOIN onetime.vimeo_mishnayos_catalog_review_queue AS review
             ON review.revision_key = revision.revision_key
          WHERE revision.revision_key = $1`,
        [current.rows[0]?.revision_key],
      );
      return {
        revision: parseRevision(result.rows[0]?.record_json),
        approved: Boolean(result.rows[0]?.approved),
      };
    },
    async insertRevision(revision) {
      await client.query(
        `INSERT INTO onetime.vimeo_mishnayos_catalog_revisions (
           revision_key, account_key, product_key, schema_version,
           provider_identity_digest, metadata_digest, classification_status,
           publication_state, protected_provider_reference, record_json, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
         ON CONFLICT (
           account_key, product_key, schema_version, provider_identity_digest, metadata_digest
         ) DO NOTHING`,
        [
          revision.revisionKey,
          revision.accountKey,
          revision.productKey,
          revision.schemaVersion,
          revision.providerIdentityDigest,
          revision.metadataDigest,
          revision.classification.status,
          revision.publicationState,
          revision.protectedProviderReference,
          JSON.stringify(revision),
          revision.createdAt,
        ],
      );
    },
    async setCurrent(revision) {
      await client.query(
        `INSERT INTO onetime.vimeo_mishnayos_catalog_current (
           account_key, product_key, schema_version, provider_identity_digest,
           revision_key, metadata_digest, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (account_key, product_key, schema_version, provider_identity_digest)
         DO UPDATE SET revision_key = EXCLUDED.revision_key,
                       metadata_digest = EXCLUDED.metadata_digest,
                       updated_at = EXCLUDED.updated_at`,
        [
          revision.accountKey,
          revision.productKey,
          revision.schemaVersion,
          revision.providerIdentityDigest,
          revision.revisionKey,
          revision.metadataDigest,
          revision.createdAt,
        ],
      );
    },
    async stageForCurrentReview(revision) {
      await client.query(
        `INSERT INTO onetime.vimeo_mishnayos_catalog_review_queue (
           review_key, account_key, product_key, revision_key, content_id,
           content_version_id, review_state, participant_review_state,
           privacy_review_state, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,'needs_review','pending','pending',$7,$7)
         ON CONFLICT (account_key, product_key, revision_key) DO NOTHING`,
        [
          `review_${revision.revisionKey}`,
          revision.accountKey,
          revision.productKey,
          revision.revisionKey,
          revision.contentId,
          revision.contentVersionId,
          revision.createdAt,
        ],
      );
    },
  };
}

function parseRevision(value: unknown): VimeoMishnayosCatalogRevision {
  if (!value) throw new Error('Vimeo catalog revision record is missing.');
  return (typeof value === 'string' ? JSON.parse(value) : value) as VimeoMishnayosCatalogRevision;
}
