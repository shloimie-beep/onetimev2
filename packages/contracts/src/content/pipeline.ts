import { z } from 'zod';

const idSchema = z
  .string()
  .trim()
  .min(3)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]+$/);

const sha256Schema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{64}$/);

const uuidSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

const dateTimeSchema = z.string().datetime({ offset: true });

export const sameOriginPathSchema = z
  .string()
  .min(1)
  .max(768)
  .refine(isCanonicalSameOriginPath, 'Expected a canonical same-origin path.');

export const ot86ContentLifecycleStateSchema = z.enum([
  'received',
  'uploading',
  'transcribing',
  'processing',
  'review_needed',
  'approved',
  'published',
  'failed',
  'corrected',
  'retired',
]);
export type Ot86ContentLifecycleState = z.infer<typeof ot86ContentLifecycleStateSchema>;

export const ot86PublicationActionSchema = z.enum(['publish', 'correct', 'revoke', 'retire']);
export type Ot86PublicationAction = z.infer<typeof ot86PublicationActionSchema>;

export const ot86ManifestPrivacySchema = z
  .object({
    source_scope: z.literal('approved_rabbi_content'),
    contains_learner_name: z.literal(false),
    contains_learner_voice: z.literal(false),
    contains_learner_face: z.literal(false),
    contains_learner_question: z.literal(false),
    contains_private_data: z.literal(false),
    approved_for_student_kb: z.literal(true),
  })
  .strict();

export const ot86SocialPrivacySchema = z
  .object({
    contains_learner_name: z.literal(false),
    contains_learner_voice: z.literal(false),
    contains_learner_face: z.literal(false),
    contains_learner_question: z.literal(false),
    contains_private_data: z.literal(false),
  })
  .strict();

export const ot86ContentArtifactSchema = z
  .object({
    artifact_id: idSchema,
    kind: z.enum([
      'video',
      'transcript',
      'captions',
      'slides',
      'review_material',
      'clip',
      'thumbnail',
    ]),
    uri: z.string().url().max(2048),
    mime_type: z.string().min(3).max(128),
    sha256: sha256Schema,
    byte_length: z.number().int().min(0),
    privacy: ot86ManifestPrivacySchema,
  })
  .strict();

export const ot86ContentSectionSchema = z
  .object({
    section_id: idSchema,
    title: z.string().min(1).max(240),
    ordinal: z.number().int().min(0),
    start_ms: z.number().int().min(0),
    end_ms: z.number().int().min(0),
    canonical_path: sameOriginPathSchema.refine((value) => value.length <= 512),
    deep_link: sameOriginPathSchema.refine((value) => /^\/[^#]*#section-/.test(value)),
    text_sha256: sha256Schema,
  })
  .strict()
  .superRefine((section, ctx) => {
    if (section.end_ms < section.start_ms) {
      ctx.addIssue({
        code: 'custom',
        path: ['end_ms'],
        message: 'end_ms must be greater than or equal to start_ms.',
      });
    }
  });

export const ot86SearchDocumentSchema = z
  .object({
    document_id: idSchema,
    section_id: idSchema,
    title: z.string().min(1).max(240),
    body: z.string().min(1).max(50_000),
    token_count: z.number().int().min(1).max(20_000),
    sha256: sha256Schema,
  })
  .strict();

export const ot86ContentPublishManifestSchema = z
  .object({
    schema_version: z.literal(1),
    event_type: z.literal('content.publication_manifest'),
    message_id: uuidSchema,
    idempotency_key: z
      .string()
      .min(16)
      .max(160)
      .regex(/^[A-Za-z0-9._:-]+$/),
    action: ot86PublicationActionSchema,
    tenant_id: idSchema,
    content_id: idSchema,
    version_id: idSchema,
    supersedes_version_id: idSchema.optional(),
    sequence: z.number().int().min(1),
    occurred_at: dateTimeSchema,
    canonical_path: sameOriginPathSchema.refine((value) => value.length <= 512).optional(),
    approval: z
      .object({
        approval_id: idSchema,
        approved_by_actor_id: idSchema,
        approved_at: dateTimeSchema,
        policy_version: z.string().min(1).max(64),
      })
      .strict(),
    source: z
      .object({
        source_kind: z.literal('rabbi_class'),
        bna_record_id: idSchema,
        source_sha256: sha256Schema,
        vimeo_reference: z
          .object({
            provider: z.literal('vimeo'),
            video_id: z.string().min(1).max(128),
            reference_mode: z.enum(['automated_upload', 'manual_approved_reference']),
          })
          .strict(),
      })
      .strict(),
    artifacts: z.array(ot86ContentArtifactSchema).max(500),
    sections: z.array(ot86ContentSectionSchema).max(2000),
    search_documents: z.array(ot86SearchDocumentSchema).max(5000),
    privacy: ot86ManifestPrivacySchema,
    checksum_algorithm: z.literal('sha256'),
    manifest_sha256: sha256Schema,
  })
  .strict()
  .superRefine((manifest, ctx) => {
    if (
      (manifest.action === 'publish' || manifest.action === 'correct') &&
      !manifest.canonical_path
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['canonical_path'],
        message: 'publish and correct manifests require canonical_path.',
      });
    }
    if (manifest.action === 'correct' && !manifest.supersedes_version_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['supersedes_version_id'],
        message: 'correct manifests require supersedes_version_id.',
      });
    }
    if (
      (manifest.action === 'publish' || manifest.action === 'correct') &&
      manifest.sections.length < 1
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['sections'],
        message: 'publish and correct manifests require at least one section.',
      });
    }
    if (
      (manifest.action === 'publish' || manifest.action === 'correct') &&
      manifest.search_documents.length < 1
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['search_documents'],
        message: 'publish and correct manifests require at least one search document.',
      });
    }
  });
export type Ot86ContentPublishManifest = z.infer<typeof ot86ContentPublishManifestSchema>;

export const ot86ApprovedForSocialEventSchema = z
  .object({
    schema_version: z.literal(1),
    event_type: z.literal('content.approved_for_social'),
    origin: z.literal('ot86a-content-pipeline'),
    event_id: uuidSchema,
    idempotency_key: z
      .string()
      .min(16)
      .max(160)
      .regex(/^[A-Za-z0-9._:-]+$/),
    tenant_id: idSchema,
    content_id: idSchema,
    version_id: idSchema,
    sequence: z.number().int().min(1),
    occurred_at: dateTimeSchema,
    approval: z
      .object({
        approval_id: idSchema,
        approved_for_social: z.literal(true),
        approved_by_actor_id: idSchema,
        approved_at: dateTimeSchema,
        policy_version: z.string().min(1).max(64),
      })
      .strict(),
    content: z
      .object({
        canonical_title: z.string().min(1).max(240),
        canonical_url: z.string().url().max(2048),
        summary: z.string().min(1).max(2000),
        approved_excerpts: z
          .array(
            z
              .object({
                excerpt_id: idSchema,
                section_id: idSchema,
                text: z.string().min(1).max(5000),
                deep_link: z.string().url().max(2048),
                text_sha256: sha256Schema,
              })
              .strict(),
          )
          .min(1)
          .max(50),
        media: z
          .array(
            z
              .object({
                asset_id: idSchema,
                kind: z.enum(['clip', 'thumbnail', 'graphic', 'caption_file']),
                uri: z.string().url().max(2048),
                mime_type: z.string().min(3).max(128),
                sha256: sha256Schema,
                subject_classification: z.enum(['no_people', 'rabbi_only', 'graphics_only']),
                privacy: ot86SocialPrivacySchema,
              })
              .strict(),
          )
          .max(30),
      })
      .strict(),
    privacy: ot86SocialPrivacySchema,
    payload_sha256: sha256Schema,
  })
  .strict();
export type Ot86ApprovedForSocialEvent = z.infer<typeof ot86ApprovedForSocialEventSchema>;

export const ot86RetrievalResponseSchema = z
  .object({
    answer: z.string().min(1).max(2400),
    abstained: z.boolean(),
    safe_reason_code: z.string().min(1).max(80),
    citations: z
      .array(
        z
          .object({
            content_id: idSchema,
            version_id: idSchema,
            section_id: idSchema,
            section_title: z.string().min(1).max(240),
            deep_link: sameOriginPathSchema,
            section_sha256: sha256Schema,
          })
          .strict(),
      )
      .max(10),
    authorization_decision_id: idSchema,
    correlation_id: idSchema,
  })
  .strict()
  .superRefine((response, ctx) => {
    if (!response.abstained && response.citations.length < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['citations'],
        message: 'Non-abstained retrieval responses require at least one citation.',
      });
    }
  });
export type Ot86RetrievalResponse = z.infer<typeof ot86RetrievalResponseSchema>;

function isCanonicalSameOriginPath(value: string) {
  if (
    value !== value.trim() ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    hasUnsafePathCharacter(value) ||
    /%(?:5c|0[0-9a-f]|1[0-9a-f]|7f)/iu.test(value)
  ) {
    return false;
  }
  try {
    const base = new URL('https://onetime.invalid');
    const parsed = new URL(value, base);
    return (
      parsed.origin === base.origin && `${parsed.pathname}${parsed.search}${parsed.hash}` === value
    );
  } catch {
    return false;
  }
}

function hasUnsafePathCharacter(value: string) {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (character === '\\' || code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

export const ot86ProviderReadinessStateSchema = z.enum([
  'unconfigured',
  'auth_invalid',
  'permission_missing',
  'ready',
  'degraded',
]);
export type Ot86ProviderReadinessState = z.infer<typeof ot86ProviderReadinessStateSchema>;

export const ot86PublishHeadersSchema = z
  .object({
    contentType: z.literal('application/json'),
    keyId: z.string().min(1).max(120),
    timestamp: z.string().regex(/^\d+$/),
    deliveryId: uuidSchema,
    signature: z.string().regex(/^v1=[a-f0-9]{64}$/),
  })
  .strict();
export type Ot86PublishHeaders = z.infer<typeof ot86PublishHeadersSchema>;
