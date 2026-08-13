import { createHash } from 'node:crypto';
import type { AppConfig } from '../../../config/src/index.ts';
import {
  existingVimeoAdoptionCommandSchema,
  existingVimeoAdoptionResultSchema,
  existingVimeoUnpublishResultSchema,
  type ExistingVimeoAdoptionCommand,
} from '../../../contracts/src/content/index.ts';
import type { PortalActorContext } from '../../../contracts/src/portals/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import {
  OT104R_ACCOUNT_KEY,
  OT104R_PRODUCT_KEY,
  registerOt104rVimeoSource,
  type Ot104rVimeoAdapter,
} from './vimeo-private-runtime.ts';
import { canonicalJson, stableOt86Key } from './pipeline.ts';

export const ONE_TIME_VIMEO_ALLOWED_EMBED_DOMAINS = [
  'app.onetimeonetime.com',
  'join.onetimeonetime.com',
] as const;

const PAID_VIMEO_ACCOUNT_TIERS = new Set([
  'advanced',
  'business',
  'creator',
  'custom',
  'enterprise',
  'live_business',
  'live_premium',
  'live_pro',
  'ott_custom',
  'plus',
  'pro',
  'pro_unlimited',
  'producer',
  'production',
  'professional',
  'standard',
  'starter',
  'studio',
]);

export type ExistingVimeoProtectionReadback = {
  providerVideoId: string;
  ownerAccountVerified: boolean;
  ownerAccountIdDigest: string;
  accountTier: string;
  title: string;
  durationMs: number;
  available: boolean;
  transcodeComplete: boolean;
  playable: boolean;
  coldPrivacyRestricted: boolean | null;
  coldStorage: boolean | null;
  copyrightRestricted: boolean | null;
  privacyView: string;
  privacyEmbed: string;
  downloadsAllowed: boolean;
  commentsAllowed: boolean;
  collectionAddsAllowed: boolean;
  allowedEmbedDomains: readonly string[];
  captionsActive: boolean;
};

export interface ExistingVimeoProtectionReader {
  inspect(providerVideoId: string): Promise<ExistingVimeoProtectionReadback>;
}

export class ExistingVimeoAdoptionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 422,
  ) {
    super(message);
  }
}

export function createExistingVimeoProtectionReader(
  input: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
    apiBaseUrl?: string;
  } = {},
): ExistingVimeoProtectionReader {
  const env = input.env ?? process.env;
  const token = env.VIMEO_ACCESS_TOKEN?.trim();
  const expectedOwnerAccountId = normalizeVimeoAccountId(env.VIMEO_ACCOUNT_ID ?? '');
  const fetchImpl = input.fetchImpl ?? fetch;
  const apiBaseUrl = (input.apiBaseUrl ?? 'https://api.vimeo.com').replace(/\/+$/u, '');

  async function request(path: string) {
    if (!token) {
      throw new ExistingVimeoAdoptionError(
        'VIMEO_READ_AUTH_UNAVAILABLE',
        'Protected Vimeo read access is not configured.',
        503,
      );
    }
    const response = await fetchImpl(`${apiBaseUrl}${path}`, {
      method: 'GET',
      headers: {
        accept: 'application/vnd.vimeo.*+json;version=3.4',
        authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new ExistingVimeoAdoptionError(
        response.status === 401 || response.status === 403
          ? 'VIMEO_READ_AUTH_UNAVAILABLE'
          : 'VIMEO_READBACK_UNAVAILABLE',
        `Vimeo protection readback returned safe status ${response.status}.`,
        response.status === 404 ? 404 : 503,
      );
    }
    const text = await response.text();
    try {
      return text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      throw new ExistingVimeoAdoptionError(
        'VIMEO_READBACK_INVALID',
        'Vimeo protection readback was invalid.',
        503,
      );
    }
  }

  return {
    async inspect(providerVideoId) {
      const boundOwnerAccountId = expectedOwnerAccountId;
      if (!boundOwnerAccountId) {
        throw new ExistingVimeoAdoptionError(
          'VIMEO_OWNER_ACCOUNT_UNCONFIGURED',
          'The expected Vimeo owner account is not configured.',
          503,
        );
      }
      if (!/^\d{6,20}$/u.test(providerVideoId)) {
        throw new ExistingVimeoAdoptionError(
          'OPAQUE_VIDEO_ID_REQUIRED',
          'Use the opaque Vimeo video ID, not a provider URL.',
        );
      }
      const fields = [
        'uri',
        'name',
        'duration',
        'status',
        'is_playable',
        'is_cold_privacy_restricted',
        'is_cold_storage',
        'is_copyright_restricted',
        'transcode.status',
        'privacy.view',
        'privacy.embed',
        'privacy.download',
        'privacy.comments',
        'privacy.add',
        'metadata.connections.texttracks.total',
        'user.uri',
        'user.resource_key',
      ].join(',');
      const video = await request(
        `/videos/${encodeURIComponent(providerVideoId)}?fields=${encodeURIComponent(fields)}`,
      );
      const videoOwner = asRecord(video.user);
      const ownerUri = normalizedVimeoUserUri(stringValue(videoOwner.uri) ?? '');
      const ownerResourceKey = stringValue(videoOwner.resource_key);
      if (
        !ownerUri ||
        !vimeoOwnerIdentityMatches(boundOwnerAccountId, ownerUri, ownerResourceKey)
      ) {
        throw new ExistingVimeoAdoptionError(
          'VIMEO_OWNER_ACCOUNT_MISMATCH',
          'The video does not belong to the configured Vimeo owner account.',
          409,
        );
      }
      const owner = await request(
        `${ownerUri}?fields=${encodeURIComponent('uri,resource_key,membership.type,account')}`,
      );
      if (
        !vimeoOwnerIdentityMatches(
          boundOwnerAccountId,
          normalizedVimeoUserUri(stringValue(owner.uri) ?? ''),
          stringValue(owner.resource_key),
        )
      ) {
        throw new ExistingVimeoAdoptionError(
          'VIMEO_OWNER_ACCOUNT_MISMATCH',
          'Vimeo owner readback did not match the configured account.',
          409,
        );
      }
      const accountTier = (
        stringValue(asRecord(owner.membership).type) ??
        stringValue(owner.account) ??
        'unknown'
      ).toLowerCase();
      if (!PAID_VIMEO_ACCOUNT_TIERS.has(accountTier)) {
        throw new ExistingVimeoAdoptionError(
          'VIMEO_PROTECTED_EMBED_PLAN_REQUIRED',
          'The configured Vimeo owner account does not have a verified paid plan.',
          409,
        );
      }
      const domains = await request(
        `/videos/${encodeURIComponent(providerVideoId)}/privacy/domains?per_page=100&fields=domain`,
      );
      const uri = stringValue(video.uri);
      if (uri !== `/videos/${providerVideoId}`) {
        throw new ExistingVimeoAdoptionError(
          'VIMEO_VIDEO_ID_MISMATCH',
          'Vimeo returned a different video identity.',
          409,
        );
      }
      const privacy = asRecord(video.privacy);
      const transcode = asRecord(video.transcode);
      const metadata = asRecord(video.metadata);
      const connections = asRecord(metadata.connections);
      const textTracks = asRecord(connections.texttracks);
      const expectedTextTrackTotal = nonnegativeSafeInteger(textTracks.total);
      if (expectedTextTrackTotal === null) {
        throw new ExistingVimeoAdoptionError(
          'VIMEO_TEXT_TRACK_READBACK_INVALID',
          'Vimeo text-track readback was invalid.',
          503,
        );
      }
      const textTrackState = await inspectVimeoTextTracks({
        request,
        apiBaseUrl,
        providerVideoId,
        expectedTotal: expectedTextTrackTotal,
      });
      const paging = asRecord(domains.paging);
      if (paging.next) {
        throw new ExistingVimeoAdoptionError(
          'VIMEO_DOMAIN_READBACK_INCOMPLETE',
          'Vimeo returned more embed domains than the bounded readback can verify.',
          409,
        );
      }
      const durationMs = Math.round(Number(video.duration) * 1_000);
      if (!Number.isSafeInteger(durationMs) || durationMs < 1) {
        throw new ExistingVimeoAdoptionError(
          'VIMEO_DURATION_INVALID',
          'Vimeo did not return a playable duration.',
          409,
        );
      }
      const privacyView = stringValue(privacy.view) ?? '';
      return {
        providerVideoId,
        ownerAccountVerified: true,
        ownerAccountIdDigest: sha256(boundOwnerAccountId),
        accountTier,
        title: stringValue(video.name) ?? 'One Time Mishnayos recording',
        durationMs,
        available: (stringValue(video.status) ?? '').toLowerCase() === 'available',
        transcodeComplete: (stringValue(transcode.status) ?? '').toLowerCase() === 'complete',
        playable: video.is_playable === true,
        coldPrivacyRestricted: optionalVimeoBoolean(
          video.is_cold_privacy_restricted,
          'is_cold_privacy_restricted',
        ),
        coldStorage: optionalVimeoBoolean(video.is_cold_storage, 'is_cold_storage'),
        copyrightRestricted: optionalVimeoBoolean(
          video.is_copyright_restricted,
          'is_copyright_restricted',
        ),
        privacyView,
        privacyEmbed: stringValue(privacy.embed) ?? '',
        downloadsAllowed: privacy.download !== false,
        commentsAllowed: privacy.comments !== 'nobody',
        collectionAddsAllowed: privacy.add !== false,
        allowedEmbedDomains: asArray(domains.data)
          .map((entry) => normalizeDomain(stringValue(asRecord(entry).domain) ?? ''))
          .filter(Boolean)
          .sort(),
        captionsActive: textTrackState.captionsActive,
      };
    },
  };
}

export async function adoptExistingPrivateVimeo(input: {
  pool: DbPool;
  config: AppConfig;
  actorUserKey: string;
  actorRole: string;
  command: unknown;
  reader: ExistingVimeoProtectionReader;
  now?: Date;
}) {
  assertContentOperator(input.actorRole);
  const command = existingVimeoAdoptionCommandSchema.parse(input.command);
  const readback = await input.reader.inspect(command.provider_video_id);
  assertProtectedReadback(command, readback);
  const now = input.now ?? new Date();
  const domainDigest = sha256(canonicalJson([...readback.allowedEmbedDomains].sort()));
  const protectionDigest = sha256(
    canonicalJson({
      owner_account_id_digest: readback.ownerAccountIdDigest,
      account_tier: readback.accountTier,
      available: readback.available,
      transcode_complete: readback.transcodeComplete,
      playable: readback.playable,
      cold_privacy_restricted: readback.coldPrivacyRestricted,
      cold_storage: readback.coldStorage,
      copyright_restricted: readback.copyrightRestricted,
      privacy_view: readback.privacyView,
      privacy_embed: readback.privacyEmbed,
      downloads_allowed: readback.downloadsAllowed,
      comments_allowed: readback.commentsAllowed,
      collection_adds_allowed: readback.collectionAddsAllowed,
      allowed_domain_digest: domainDigest,
      captions_active: readback.captionsActive,
    }),
  );
  const contentId = `existing_vimeo_${command.source_sha256.slice(0, 40)}`;
  const sourceRecordId = `reviewed_source_${command.reviewed_source_digest.slice(0, 40)}`;
  const registration = await registerOt104rVimeoSource({
    pool: input.pool,
    adapter: validatedRegistrationAdapter(readback, protectionDigest, domainDigest),
    now,
    command: {
      account_key: OT104R_ACCOUNT_KEY,
      product_key: OT104R_PRODUCT_KEY,
      idempotency_key: command.idempotency_key,
      content_id: contentId,
      source_record_id: sourceRecordId,
      title: command.title,
      source_sha256: command.source_sha256,
      byte_length: null,
      submitted_by_actor_id: input.actorUserKey,
      registration_mode: 'existing_private_video',
      provider_video_id: command.provider_video_id,
      correlation_id: stableOt86Key('existing_vimeo_adoption', [command.idempotency_key]),
    },
  });
  const adoptionDigest = sha256(
    canonicalJson({
      command,
      source_key: registration.source_key,
      protection_digest: protectionDigest,
    }),
  );
  return inTransaction(input.pool, async (client) => {
    const registeredSource = await client.query(
      `SELECT provider_video_id, sanitized_metadata_json
         FROM onetime.ot104r_vimeo_sources
        WHERE account_key = $1 AND product_key = $2 AND source_key = $3
        LIMIT 1 FOR UPDATE`,
      [OT104R_ACCOUNT_KEY, OT104R_PRODUCT_KEY, registration.source_key],
    );
    const registeredSourceRow = registeredSource.rows[0] as Record<string, unknown> | undefined;
    const registeredMetadata = asRecord(registeredSourceRow?.sanitized_metadata_json);
    if (
      !registeredSourceRow ||
      String(registeredSourceRow.provider_video_id ?? '') !== command.provider_video_id ||
      registeredMetadata.protection_digest !== protectionDigest ||
      registeredMetadata.owner_account_id_digest !== readback.ownerAccountIdDigest
    ) {
      throw new ExistingVimeoAdoptionError(
        'EXISTING_VIMEO_SOURCE_BINDING_CONFLICT',
        'The registered Vimeo source no longer matches this verified protection readback.',
        409,
      );
    }
    const existing = await client.query(
      `SELECT lifecycle_state, published_revision_key, metadata
         FROM onetime.content_items
        WHERE account_key = $1 AND product_key = $2 AND content_item_key = $3
        LIMIT 1 FOR UPDATE`,
      [input.config.accountKey, input.config.productKey, registration.source_key],
    );
    if (existing.rowCount) {
      const row = existing.rows[0] as Record<string, unknown>;
      const metadata = asRecord(row.metadata);
      if (
        metadata.existing_vimeo_adoption_digest !== adoptionDigest ||
        row.lifecycle_state !== 'published' ||
        !row.published_revision_key
      ) {
        throw new ExistingVimeoAdoptionError(
          'EXISTING_VIMEO_ADOPTION_CONFLICT',
          'This reviewed source is already bound to a different library state.',
          409,
        );
      }
      return existingVimeoAdoptionResultSchema.parse({
        item_key: registration.source_key,
        title: command.title,
        state: 'published',
        replay: true,
        privacy_contract: 'embed_only_domain_whitelist',
        entitled_audience: 'all_active_learners',
        playback_route: `/app/learning/items/${registration.source_key}`,
        raw_provider_url_present: false,
      });
    }

    const revisionKey = stableOt86Key('existing_vimeo_revision', [registration.source_key]);
    const outcomeEventKey = stableOt86Key('existing_vimeo_publish', [registration.source_key]);
    await client.query(
      `INSERT INTO onetime.content_items
         (content_item_key, account_key, product_key, occurrence_key, title, item_type,
          lifecycle_state, latest_revision_number, latest_revision_key, published_revision_key,
          metadata, published_at, updated_at)
       VALUES ($1,$2,$3,NULL,$4,'video','published',1,$5,$5,$6::jsonb,$7,$7)`,
      [
        registration.source_key,
        input.config.accountKey,
        input.config.productKey,
        command.title,
        revisionKey,
        JSON.stringify({
          source_type: 'existing_private_vimeo',
          existing_vimeo_adoption_digest: adoptionDigest,
          protection_digest: protectionDigest,
          owner_account_id_digest: readback.ownerAccountIdDigest,
          allowed_domain_digest: domainDigest,
          reviewed_source_digest: command.reviewed_source_digest,
          duration_ms: readback.durationMs,
          captions_active: readback.captionsActive,
          raw_provider_url_present: false,
        }),
        now,
      ],
    );
    await client.query(
      `INSERT INTO onetime.content_revisions
         (revision_key, account_key, product_key, content_item_key, outcome_event_key,
          revision_number, lifecycle_state, transcript_metadata, source_metadata,
          review_sheet_metadata, playback_descriptor, provider_event_ref_digest,
          source_ref_digest, raw_provider_target_present, published_at)
       VALUES ($1,$2,$3,$4,$5,1,'published',$6::jsonb,$7::jsonb,'{}'::jsonb,$8::jsonb,
          $9,$10,false,$11)`,
      [
        revisionKey,
        input.config.accountKey,
        input.config.productKey,
        registration.source_key,
        outcomeEventKey,
        JSON.stringify({
          transcript_state: readback.captionsActive ? 'provider_captioned' : 'not_adopted',
        }),
        JSON.stringify({
          source_type: 'existing_private_vimeo',
          reviewed_source_digest: command.reviewed_source_digest,
          protection_digest: protectionDigest,
          owner_account_id_digest: readback.ownerAccountIdDigest,
        }),
        JSON.stringify({
          kind: 'server_authorized_vimeo_playback',
          playback_route: `/app/learning/items/${registration.source_key}`,
          privacy_contract: 'embed_only_domain_whitelist',
          raw_provider_url_present: false,
        }),
        sha256(command.provider_video_id),
        command.source_sha256,
        now,
      ],
    );
    await client.query(
      `INSERT INTO onetime.content_item_entitlements
         (entitlement_key, account_key, product_key, content_item_key, audience,
          entitlement_state, created_at)
       VALUES ($1,$2,$3,$4,'all_active_learners','active',$5)`,
      [
        stableOt86Key('existing_vimeo_entitlement', [registration.source_key]),
        input.config.accountKey,
        input.config.productKey,
        registration.source_key,
        now,
      ],
    );
    await recordLibraryAudit(client, input.config, {
      itemKey: registration.source_key,
      revisionKey,
      actorUserKey: input.actorUserKey,
      actionType: 'existing_private_vimeo_adopted',
      metadata: {
        privacy_contract: 'embed_only_domain_whitelist',
        protection_digest: protectionDigest,
        allowed_domain_digest: domainDigest,
        provider_mutation_performed: false,
        raw_provider_url_present: false,
      },
      now,
    });
    return existingVimeoAdoptionResultSchema.parse({
      item_key: registration.source_key,
      title: command.title,
      state: 'published',
      replay: false,
      privacy_contract: 'embed_only_domain_whitelist',
      entitled_audience: 'all_active_learners',
      playback_route: `/app/learning/items/${registration.source_key}`,
      raw_provider_url_present: false,
    });
  });
}

export async function unpublishExistingPrivateVimeo(input: {
  pool: DbPool;
  config: AppConfig;
  actorUserKey: string;
  actorRole: string;
  itemKey: string;
  now?: Date;
}) {
  assertContentOperator(input.actorRole);
  const now = input.now ?? new Date();
  return inTransaction(input.pool, async (client) => {
    const result = await client.query(
      `SELECT latest_revision_key, metadata
         FROM onetime.content_items
        WHERE account_key = $1 AND product_key = $2 AND content_item_key = $3
        LIMIT 1 FOR UPDATE`,
      [input.config.accountKey, input.config.productKey, input.itemKey],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row || asRecord(row.metadata).source_type !== 'existing_private_vimeo') {
      throw new ExistingVimeoAdoptionError('CONTENT_UNAVAILABLE', 'Content is unavailable.', 404);
    }
    await client.query(
      `UPDATE onetime.content_items
          SET lifecycle_state = 'review_needed', published_revision_key = NULL,
              published_at = NULL, updated_at = $4
        WHERE account_key = $1 AND product_key = $2 AND content_item_key = $3`,
      [input.config.accountKey, input.config.productKey, input.itemKey, now],
    );
    await client.query(
      `UPDATE onetime.content_item_entitlements
          SET entitlement_state = 'revoked', revoked_at = $4
        WHERE account_key = $1 AND product_key = $2 AND content_item_key = $3`,
      [input.config.accountKey, input.config.productKey, input.itemKey, now],
    );
    await recordLibraryAudit(client, input.config, {
      itemKey: input.itemKey,
      revisionKey: String(row.latest_revision_key),
      actorUserKey: input.actorUserKey,
      actionType: 'existing_private_vimeo_unpublished',
      metadata: { provider_mutation_performed: false, entitlements_revoked: true },
      now,
    });
    return existingVimeoUnpublishResultSchema.parse({
      item_key: input.itemKey,
      state: 'unpublished',
      entitlements_revoked: true,
      provider_mutation_performed: false,
    });
  });
}

export async function getExistingPrivateVimeoPlayback(input: {
  pool: DbPool;
  config: AppConfig;
  itemKey: string;
  actor: Pick<
    PortalActorContext,
    'actor_role' | 'student_learner' | 'authorized_households' | 'account_key' | 'product_key'
  >;
  now?: Date;
}) {
  if (
    input.actor.account_key !== input.config.accountKey ||
    input.actor.product_key !== input.config.productKey
  ) {
    throw unavailablePlayback();
  }
  const result = await input.pool.query(
    `SELECT item.title, item.metadata, source.provider_video_id, source.duration_ms,
            source.processing_state, source.privacy_state, source.sanitized_metadata_json
       FROM onetime.content_items AS item
       JOIN onetime.ot104r_vimeo_sources AS source
         ON source.source_key = item.content_item_key
        AND source.account_key = $4
        AND source.product_key = $5
      WHERE item.account_key = $1 AND item.product_key = $2
        AND item.content_item_key = $3
        AND item.lifecycle_state = 'published'
        AND item.published_revision_key IS NOT NULL
        AND source.processing_state IN ('available','transcript_ready')
        AND source.privacy_state = 'private'
      LIMIT 1`,
    [
      input.config.accountKey,
      input.config.productKey,
      input.itemKey,
      OT104R_ACCOUNT_KEY,
      OT104R_PRODUCT_KEY,
    ],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw unavailablePlayback();
  const metadata = asRecord(row.metadata);
  const providerMetadata = asRecord(row.sanitized_metadata_json);
  if (
    metadata.source_type !== 'existing_private_vimeo' ||
    typeof metadata.protection_digest !== 'string' ||
    metadata.protection_digest !== providerMetadata.protection_digest ||
    !/^\d{6,20}$/u.test(String(row.provider_video_id ?? ''))
  ) {
    throw unavailablePlayback();
  }
  if (!['owner', 'admin', 'rabbi'].includes(input.actor.actor_role)) {
    const entitled = await currentPlaybackEntitlement(input, input.actor);
    if (!entitled) throw unavailablePlayback();
  }
  return {
    itemKey: input.itemKey,
    title: String(row.title),
    providerVideoId: String(row.provider_video_id),
    durationMs: Number(row.duration_ms ?? metadata.duration_ms),
    captionsActive: metadata.captions_active === true,
    playbackRoute: `/api/v1/content/vimeo/${encodeURIComponent(input.itemKey)}/playback`,
  };
}

function assertProtectedReadback(
  command: ExistingVimeoAdoptionCommand,
  readback: ExistingVimeoProtectionReadback,
) {
  const expectedDomains = [...ONE_TIME_VIMEO_ALLOWED_EMBED_DOMAINS].sort();
  const actualDomains = [...new Set(readback.allowedEmbedDomains.map(normalizeDomain))].sort();
  const protectedContract =
    readback.providerVideoId === command.provider_video_id &&
    readback.ownerAccountVerified === true &&
    /^[a-f0-9]{64}$/u.test(readback.ownerAccountIdDigest) &&
    PAID_VIMEO_ACCOUNT_TIERS.has(readback.accountTier) &&
    readback.available &&
    readback.transcodeComplete &&
    readback.playable &&
    (readback.coldPrivacyRestricted === false || readback.coldPrivacyRestricted === null) &&
    (readback.coldStorage === false || readback.coldStorage === null) &&
    (readback.copyrightRestricted === false || readback.copyrightRestricted === null) &&
    readback.privacyView === 'disable' &&
    readback.privacyEmbed === 'whitelist' &&
    readback.downloadsAllowed === false &&
    readback.commentsAllowed === false &&
    readback.collectionAddsAllowed === false &&
    readback.captionsActive === false &&
    JSON.stringify(actualDomains) === JSON.stringify(expectedDomains);
  if (!protectedContract) {
    throw new ExistingVimeoAdoptionError(
      readback.accountTier === 'free' || !PAID_VIMEO_ACCOUNT_TIERS.has(readback.accountTier)
        ? 'VIMEO_PROTECTED_EMBED_PLAN_REQUIRED'
        : 'VIMEO_PROTECTION_CONTRACT_MISMATCH',
      'Vimeo protection readback does not satisfy the One Time embed-only contract.',
      409,
    );
  }
}

function validatedRegistrationAdapter(
  readback: ExistingVimeoProtectionReadback,
  protectionDigest: string,
  domainDigest: string,
): Ot104rVimeoAdapter {
  return {
    async readiness() {
      return {
        provider: 'vimeo',
        mode: 'real',
        state: 'ready',
        configured: true,
        can_register_existing_private_video: true,
        can_create_controlled_upload: false,
        can_receive_webhooks: false,
        can_import_text_tracks: false,
        missing_variable_names: [],
        capability_names: ['read_only_existing_private_video_adoption'],
        safe_reason_code: 'existing_private_video_protection_verified',
      };
    },
    async registerExistingPrivateVideo() {
      return {
        providerVideoId: readback.providerVideoId,
        privacyState: 'private',
        processingState: 'available',
        durationMs: readback.durationMs,
        width: null,
        height: null,
        revision: protectionDigest,
        safeMetadata: {
          protection_digest: protectionDigest,
          owner_account_id_digest: readback.ownerAccountIdDigest,
          allowed_domain_digest: domainDigest,
          privacy_contract: 'embed_only_domain_whitelist',
          captions_active: readback.captionsActive,
          raw_provider_url_present: false,
        },
      };
    },
    async createUploadIntent() {
      throw new ExistingVimeoAdoptionError(
        'CONTROLLED_UPLOAD_DISABLED',
        'This path registers an existing video only.',
      );
    },
    async inspectVideo() {
      throw new ExistingVimeoAdoptionError('INSPECTION_NOT_MOUNTED', 'Inspection is unavailable.');
    },
    async listTextTracks() {
      return [];
    },
    async downloadTextTrack() {
      throw new ExistingVimeoAdoptionError('TEXT_TRACK_NOT_MOUNTED', 'Text track is unavailable.');
    },
  };
}

async function currentPlaybackEntitlement(
  input: { pool: DbPool; config: AppConfig; itemKey: string; now?: Date },
  actor: Pick<PortalActorContext, 'actor_role' | 'student_learner' | 'authorized_households'>,
) {
  const householdKeys =
    actor.actor_role === 'student' && actor.student_learner
      ? [actor.student_learner.household_key]
      : actor.actor_role === 'parent'
        ? actor.authorized_households
            .filter((subject) => subject.authority !== 'support_only')
            .map((subject) => subject.household_key)
        : [];
  const learnerKey =
    actor.actor_role === 'student' ? (actor.student_learner?.learner_key ?? null) : null;
  if (householdKeys.length < 1) return false;
  const now = input.now ?? new Date();
  const access = await input.pool.query(
    `SELECT household_key
       FROM onetime.account_access_projections
      WHERE account_key = $1 AND product_key = $2
        AND household_key = ANY($3::text[])
        AND state = 'active'
        AND effective_at <= $4
        AND (expires_at IS NULL OR expires_at > $4)`,
    [input.config.accountKey, input.config.productKey, householdKeys, now],
  );
  const activeHouseholds = new Set(access.rows.map((row) => String(row.household_key)));
  if (activeHouseholds.size < 1) return false;
  const entitlement = await input.pool.query(
    `SELECT audience, household_key, learner_key
       FROM onetime.content_item_entitlements
      WHERE account_key = $1 AND product_key = $2 AND content_item_key = $3
        AND entitlement_state = 'active'`,
    [input.config.accountKey, input.config.productKey, input.itemKey],
  );
  return entitlement.rows.some((row) => {
    if (row.audience === 'all_active_learners') return true;
    if (row.audience === 'household') return activeHouseholds.has(String(row.household_key));
    return (
      row.audience === 'learner' &&
      learnerKey !== null &&
      row.learner_key === learnerKey &&
      activeHouseholds.has(householdKeys[0]!)
    );
  });
}

async function recordLibraryAudit(
  client: Queryable,
  config: AppConfig,
  input: {
    itemKey: string;
    revisionKey: string;
    actorUserKey: string;
    actionType: string;
    metadata: Record<string, unknown>;
    now: Date;
  },
) {
  await client.query(
    `INSERT INTO onetime.content_audit_events
       (audit_key, account_key, product_key, content_item_key, revision_key, actor_user_key,
        action_type, metadata, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
    [
      stableOt86Key('existing_vimeo_audit', [
        input.itemKey,
        input.actionType,
        input.now.toISOString(),
      ]),
      config.accountKey,
      config.productKey,
      input.itemKey,
      input.revisionKey,
      input.actorUserKey,
      input.actionType,
      JSON.stringify(input.metadata),
      input.now,
    ],
  );
}

function assertContentOperator(role: string) {
  if (!['owner', 'admin', 'rabbi'].includes(role)) {
    throw new ExistingVimeoAdoptionError(
      'FORBIDDEN',
      'Owner, Admin, or Rabbi access required.',
      403,
    );
  }
}

function unavailablePlayback() {
  return new ExistingVimeoAdoptionError('CONTENT_UNAVAILABLE', 'Content is unavailable.', 404);
}

async function inspectVimeoTextTracks(input: {
  request: (path: string) => Promise<Record<string, unknown>>;
  apiBaseUrl: string;
  providerVideoId: string;
  expectedTotal: number;
}) {
  const collectionPath = `/videos/${encodeURIComponent(input.providerVideoId)}/texttracks`;
  let nextPath: string | null = `${collectionPath}?per_page=100&fields=active`;
  const visited = new Set<string>();
  let observedTotal = 0;
  let captionsActive = false;

  while (nextPath) {
    if (visited.has(nextPath) || visited.size >= 100) {
      throw new ExistingVimeoAdoptionError(
        'VIMEO_TEXT_TRACK_READBACK_INCOMPLETE',
        'Vimeo text-track pagination could not be verified.',
        503,
      );
    }
    visited.add(nextPath);
    const page = await input.request(nextPath);
    if (!Array.isArray(page.data)) {
      throw new ExistingVimeoAdoptionError(
        'VIMEO_TEXT_TRACK_READBACK_INVALID',
        'Vimeo text-track readback was invalid.',
        503,
      );
    }
    for (const entry of page.data) {
      const active = asRecord(entry).active;
      if (typeof active !== 'boolean') {
        throw new ExistingVimeoAdoptionError(
          'VIMEO_TEXT_TRACK_READBACK_INVALID',
          'Vimeo text-track activation state was invalid.',
          503,
        );
      }
      observedTotal += 1;
      captionsActive ||= active;
    }
    const next = stringValue(asRecord(page.paging).next);
    nextPath = next ? boundedVimeoPagePath(next, input.apiBaseUrl, collectionPath) : null;
  }

  if (observedTotal !== input.expectedTotal) {
    throw new ExistingVimeoAdoptionError(
      'VIMEO_TEXT_TRACK_READBACK_INCOMPLETE',
      'Vimeo text-track count did not match the video readback.',
      503,
    );
  }
  return { captionsActive };
}

function boundedVimeoPagePath(value: string, apiBaseUrl: string, collectionPath: string) {
  try {
    const base = new URL(apiBaseUrl);
    const page = new URL(value, `${base.origin}/`);
    if (page.origin !== base.origin || page.pathname !== collectionPath) throw new Error('scope');
    return `${page.pathname}${page.search}`;
  } catch {
    throw new ExistingVimeoAdoptionError(
      'VIMEO_TEXT_TRACK_READBACK_INCOMPLETE',
      'Vimeo text-track pagination left the verified collection.',
      503,
    );
  }
}

function optionalVimeoBoolean(value: unknown, field: string): boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value;
  throw new ExistingVimeoAdoptionError(
    'VIMEO_READBACK_INVALID',
    `Vimeo returned an invalid ${field} value.`,
    503,
  );
}

function nonnegativeSafeInteger(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//u, '')
    .replace(/\/+$/u, '');
}

function normalizeVimeoAccountId(value: string) {
  const trimmed = value.trim();
  const uri = normalizedVimeoUserUri(trimmed);
  if (uri) return uri.slice('/users/'.length);
  return /^[A-Za-z0-9_-]{2,200}$/u.test(trimmed) ? trimmed : null;
}

function normalizedVimeoUserUri(value: string) {
  const match = /^\/users\/([A-Za-z0-9_-]{2,200})$/u.exec(value.trim());
  return match ? `/users/${match[1]}` : null;
}

function vimeoOwnerIdentityMatches(
  expectedOwnerAccountId: string,
  ownerUri: string | null,
  ownerResourceKey: string | null,
) {
  const ownerUserId = ownerUri?.slice('/users/'.length) ?? null;
  return expectedOwnerAccountId === ownerUserId || expectedOwnerAccountId === ownerResourceKey;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}
