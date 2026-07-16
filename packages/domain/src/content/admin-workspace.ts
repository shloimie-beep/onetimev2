import { createHash } from 'node:crypto';
import type { AppConfig } from '../../../config/src/index.ts';
import type {
  ContentAdminActionResponse,
  ContentAdminArtifactKind,
  ContentAdminArtifactRevision,
  ContentAdminCapability,
  ContentAdminCreateGenerationPayload,
  ContentAdminKnowledgeSection,
  ContentAdminLifecycleStage,
  ContentAdminPromptPatchPayload,
  ContentAdminPromptPreviewPayload,
  ContentAdminPromptTemplate,
  ContentAdminPromptVersion,
  ContentAdminProviderPortStatus,
  ContentAdminSocialDraft,
  ContentAdminSourceDetail,
  ContentAdminSourceSummary,
  ContentAdminWorkspaceQuery,
} from '../../../contracts/src/content/admin-workspace.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import { stableKey } from '../lead/normalize.ts';

const OWNER_CAPABILITIES: ContentAdminCapability[] = [
  'content.view',
  'transcript.review',
  'artifact.generate',
  'artifact.edit',
  'artifact.publish',
  'prompt.manage',
  'social.approve',
  'social.schedule',
  'content.revoke',
];

const ADMIN_BASE_CAPABILITIES: ContentAdminCapability[] = [
  'content.view',
  'transcript.review',
  'artifact.generate',
  'artifact.edit',
];

const DEFAULT_PROMPTS: Array<{
  artifactKind: ContentAdminArtifactKind;
  label: string;
  templateKey: string;
  promptText: string;
}> = [
  {
    artifactKind: 'lesson_summary',
    label: 'Lesson Summary',
    templateKey: 'ot110a.lesson_summary',
    promptText:
      'Create a concise Rabbi Scheller lesson summary from the approved transcript. Use source timestamps for every major point. Do not include learner private data.',
  },
  {
    artifactKind: 'review_sheet',
    label: 'Review Sheet',
    templateKey: 'ot110a.review_sheet',
    promptText:
      'Create a review sheet for One Time Mishnayos students using only approved Rabbi content. Include short questions, exact source citations, and a teacher review note.',
  },
  {
    artifactKind: 'worksheet',
    label: 'Worksheet',
    templateKey: 'ot110a.worksheet',
    promptText:
      'Create a classroom worksheet from the approved transcript. Include vocabulary, fill-in prompts, and answer guidance for staff review.',
  },
  {
    artifactKind: 'newsletter_email',
    label: 'Newsletter / Email Draft',
    templateKey: 'ot110a.newsletter_email',
    promptText:
      'Draft a parent-safe One Time email newsletter from approved class material. Keep it warm, accurate, and unpublished until a human approves.',
  },
  {
    artifactKind: 'social_caption',
    label: 'Social Caption Variants',
    templateKey: 'ot110a.social_caption',
    promptText:
      'Create social caption variants from an exact approved revision. Return separate channel options and never include private learner data.',
  },
  {
    artifactKind: 'short_clip_plan',
    label: 'Short Clip Plan',
    templateKey: 'ot110a.short_clip_plan',
    promptText:
      'Create a short clip plan with start and end timestamps only. Do not cut media or claim a clip was created.',
  },
  {
    artifactKind: 'helper_knowledge',
    label: 'Helper Knowledge Chunks',
    templateKey: 'ot110a.helper_knowledge',
    promptText:
      'Create helper-bot knowledge chunks with section titles, source timestamps, and citations. Use approved Rabbi content only.',
  },
  {
    artifactKind: 'classroom_resource',
    label: 'Classroom Resource',
    templateKey: 'ot110a.classroom_resource',
    promptText:
      'Create a classroom resource for the One Time app from approved class material. Include publication targets and review notes.',
  },
];

export class Ot110aContentWorkspaceError extends Error {
  constructor(
    public readonly code:
      'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'VERSION_CONFLICT' | 'PROMPT_PATCH_NOOP',
    message: string,
  ) {
    super(message);
  }
}

export type Ot110aContentAdminActor = {
  userKey: string;
  role: string;
  capabilities: ContentAdminCapability[];
};

export type Ot110aContentAdminUser = {
  user_key: string;
  role: string;
};

export type Ot110aProviderPorts = {
  vimeo: Ot110aVimeoStatusPort;
  generation: Ot110aGenerationPort;
  knowledge: Ot110aKnowledgeIndexPort;
  buffer: Ot110aBufferStatusPort;
  telegram: Ot110aTelegramNoticePort;
};

export type Ot110aVimeoStatusPort = {
  inspect: () => ContentAdminProviderPortStatus;
};

export type Ot110aGenerationPort = {
  inspect: () => ContentAdminProviderPortStatus;
  render: (input: {
    artifactKind: ContentAdminArtifactKind;
    title: string;
    promptText: string;
    transcriptHash: string;
  }) => { body: string; modelPolicyId: string; providerMode: 'provider_off' | 'sink' | 'ready' };
};

export type Ot110aKnowledgeIndexPort = {
  inspect: () => ContentAdminProviderPortStatus;
};

export type Ot110aBufferStatusPort = {
  inspect: () => ContentAdminProviderPortStatus;
};

export type Ot110aTelegramNoticePort = {
  inspect: () => ContentAdminProviderPortStatus;
};

export function createOt110aProviderOffPorts(): Ot110aProviderPorts {
  return {
    vimeo: {
      inspect: () => providerOffStatus('vimeo', ['VIMEO_ACCESS_TOKEN', 'VIMEO_USER_ID']),
    },
    generation: {
      inspect: () => providerOffStatus('generation', ['OPENAI_API_KEY']),
      render: ({ artifactKind, title, transcriptHash }) => ({
        body: [
          `${title} - ${readableArtifactKind(artifactKind)}`,
          'Provider-off draft generated for human review.',
          `Transcript hash: ${transcriptHash}`,
          'This local draft is deterministic and cannot publish without a separate approval action.',
        ].join('\n\n'),
        modelPolicyId: 'ot110a-provider-off-deterministic-v1',
        providerMode: 'provider_off',
      }),
    },
    knowledge: {
      inspect: () => providerOffStatus('knowledge_index', ['KNOWLEDGE_INDEX_PROVIDER']),
    },
    buffer: {
      inspect: () => providerOffStatus('buffer', ['BUFFER_ACCESS_TOKEN', 'BUFFER_ORGANIZATION_ID']),
    },
    telegram: {
      inspect: () => providerOffStatus('telegram', ['ONE_TIME_TELEGRAM_WEBHOOK_SECRET']),
    },
  };
}

export async function resolveOt110aContentAdminActor(input: {
  pool: DbPool;
  config: AppConfig;
  user: Ot110aContentAdminUser;
}): Promise<Ot110aContentAdminActor> {
  const explicit = await listOt110aExplicitCapabilityGrants({
    pool: input.pool,
    config: input.config,
    userKey: input.user.user_key,
  });
  const base =
    input.user.role === 'owner'
      ? OWNER_CAPABILITIES
      : input.user.role === 'admin'
        ? ADMIN_BASE_CAPABILITIES
        : [];
  return {
    userKey: input.user.user_key,
    role: input.user.role,
    capabilities: [...new Set([...base, ...explicit])],
  };
}

export async function listOt110aExplicitCapabilityGrants(input: {
  pool: DbPool;
  config: AppConfig;
  userKey: string;
}): Promise<ContentAdminCapability[]> {
  const result = await input.pool.query(
    `SELECT capability
       FROM onetime.ot110a_content_admin_capability_grants
      WHERE account_key = $1
        AND product_key = $2
        AND user_key = $3
        AND active = true
      ORDER BY capability`,
    [input.config.accountKey, input.config.productKey, input.userKey],
  );
  return result.rows.map((row) => String(row.capability) as ContentAdminCapability);
}

export async function grantOt110aContentAdminCapability(input: {
  pool: DbPool;
  config: AppConfig;
  userKey: string;
  capability: ContentAdminCapability;
  grantedByUserKey: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  await input.pool.query(
    `INSERT INTO onetime.ot110a_content_admin_capability_grants
       (grant_key, account_key, product_key, user_key, capability, granted_by_user_key,
        active, created_at, revoked_at)
     VALUES ($1, $2, $3, $4, $5, $6, true, $7, NULL)
     ON CONFLICT (account_key, product_key, user_key, capability)
     DO UPDATE SET active = true, revoked_at = NULL, granted_by_user_key = EXCLUDED.granted_by_user_key`,
    [
      stableKey('ot110a_capability_grant', [
        input.config.accountKey,
        input.config.productKey,
        input.userKey,
        input.capability,
      ]),
      input.config.accountKey,
      input.config.productKey,
      input.userKey,
      input.capability,
      input.grantedByUserKey,
      now,
    ],
  );
}

export function hasOt110aContentCapability(
  actor: Ot110aContentAdminActor,
  capability: ContentAdminCapability,
) {
  return actor.capabilities.includes(capability);
}

export async function getOt110aContentWorkspaceOverview(input: {
  pool: DbPool;
  config: AppConfig;
  actor: Ot110aContentAdminActor;
  query?: unknown;
  ports?: Ot110aProviderPorts;
}) {
  requireCapability(input.actor, 'content.view');
  const query = normalizeWorkspaceQuery(input.query);
  const listed = await listOt110aContentSourcesInternal({
    pool: input.pool,
    config: input.config,
    query,
  });
  const allSources = await listOt110aContentSourcesInternal({
    pool: input.pool,
    config: input.config,
    query: { ...query, cursor: undefined, limit: 50 },
  });
  return {
    capabilities: input.actor.capabilities,
    provider_ports: providerPortStatuses(input.ports),
    counts: countSourceStates(allSources.sources),
    sources: listed.sources,
    page: listed.page,
  };
}

export async function getOt110aContentProcessingQueue(input: {
  pool: DbPool;
  config: AppConfig;
  actor: Ot110aContentAdminActor;
  ports?: Ot110aProviderPorts;
}) {
  requireCapability(input.actor, 'content.view');
  const listed = await listOt110aContentSourcesInternal({
    pool: input.pool,
    config: input.config,
    query: { search: '', sort: 'updated_desc', limit: 50 },
  });
  return {
    provider_ports: providerPortStatuses(input.ports),
    items: listed.sources.filter((source) =>
      ['private_source', 'vimeo_processing', 'transcript_received', 'failed'].includes(
        source.lifecycle_stage,
      ),
    ),
  };
}

export async function getOt110aContentCreateWorkspace(input: {
  pool: DbPool;
  config: AppConfig;
  actor: Ot110aContentAdminActor;
  ports?: Ot110aProviderPorts;
}) {
  requireCapability(input.actor, 'artifact.generate');
  const listed = await listOt110aContentSourcesInternal({
    pool: input.pool,
    config: input.config,
    query: { search: '', sort: 'updated_desc', limit: 50 },
  });
  return {
    provider_ports: providerPortStatuses(input.ports),
    eligible_sources: listed.sources.filter((source) =>
      ['transcript_review', 'derivative_generation', 'artifact_review', 'published'].includes(
        source.lifecycle_stage,
      ),
    ),
    prompt_templates: await listOt110aPromptTemplates({
      pool: input.pool,
      config: input.config,
      actor: input.actor,
    }),
  };
}

export async function createOt110aGeneratedArtifact(input: {
  pool: DbPool;
  config: AppConfig;
  actor: Ot110aContentAdminActor;
  payload: ContentAdminCreateGenerationPayload;
  ports?: Ot110aProviderPorts;
  now?: Date;
}): Promise<ContentAdminArtifactRevision> {
  requireCapability(input.actor, 'artifact.generate');
  const now = input.now ?? new Date();
  const ports = input.ports ?? createOt110aProviderOffPorts();
  await ensureOt110aDefaultPromptRegistry({ pool: input.pool, config: input.config, now });

  return inTransaction(input.pool, async (client) => {
    const item = await getContentItemRow(client, input.config, input.payload.source_key);
    if (!item) throw new Ot110aContentWorkspaceError('NOT_FOUND', 'Content source was not found.');
    const prompt = await getPromptVersionRow(
      client,
      input.config,
      input.payload.prompt_version_key,
    );
    if (!prompt)
      throw new Ot110aContentWorkspaceError('NOT_FOUND', 'Prompt version was not found.');
    if (prompt.status !== 'active') {
      throw new Ot110aContentWorkspaceError(
        'VERSION_CONFLICT',
        'Generation requires an active prompt version.',
      );
    }
    if (prompt.artifact_kind !== input.payload.artifact_kind) {
      throw new Ot110aContentWorkspaceError(
        'VALIDATION_ERROR',
        'Prompt artifact kind does not match the requested artifact.',
      );
    }
    const transcript = await latestContentRevision(client, input.config, input.payload.source_key);
    const transcriptHash = transcript
      ? digest(JSON.stringify(transcript.transcript_metadata ?? {}))
      : digest(String(item.content_item_key));
    const rendered = ports.generation.render({
      artifactKind: input.payload.artifact_kind,
      title: String(item.title),
      promptText: String(prompt.prompt_text),
      transcriptHash,
    });
    const outputHash = digest(rendered.body);
    const generationRunKey = stableKey('ot110a_generation_run', [
      input.config.accountKey,
      input.config.productKey,
      input.payload.source_key,
      input.payload.artifact_kind,
      String(prompt.version_key),
      now.toISOString(),
    ]);
    await client.query(
      `INSERT INTO onetime.ot110a_generation_runs
         (generation_run_key, account_key, product_key, source_key, artifact_kind,
          transcript_revision_key, prompt_version_key, prompt_version_checksum,
          model_policy_id, provider_mode, output_hash, run_state, created_by_user_key, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'completed', $12, $13)`,
      [
        generationRunKey,
        input.config.accountKey,
        input.config.productKey,
        input.payload.source_key,
        input.payload.artifact_kind,
        transcript?.revision_key ?? null,
        prompt.version_key,
        prompt.checksum,
        rendered.modelPolicyId,
        rendered.providerMode,
        outputHash,
        input.actor.userKey,
        now,
      ],
    );
    const revisionNumber = await nextArtifactRevisionNumber(
      client,
      input.config,
      input.payload.source_key,
      input.payload.artifact_kind,
    );
    const artifactRevisionKey = stableKey('ot110a_artifact_revision', [
      input.config.accountKey,
      input.config.productKey,
      input.payload.source_key,
      input.payload.artifact_kind,
      String(revisionNumber),
    ]);
    await client.query(
      `INSERT INTO onetime.ot110a_content_artifact_revisions
         (artifact_revision_key, account_key, product_key, source_key, artifact_kind,
          revision_number, prompt_version_key, prompt_version_checksum, transcript_revision_key,
          generation_run_key, model_policy_id, output_hash, body, review_state,
          publication_targets_json, created_by_user_key, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'review_needed',
          $14::jsonb, $15, $16, $16)`,
      [
        artifactRevisionKey,
        input.config.accountKey,
        input.config.productKey,
        input.payload.source_key,
        input.payload.artifact_kind,
        revisionNumber,
        prompt.version_key,
        prompt.checksum,
        transcript?.revision_key ?? null,
        generationRunKey,
        rendered.modelPolicyId,
        outputHash,
        rendered.body,
        JSON.stringify(defaultPublicationTargets(input.payload.artifact_kind)),
        input.actor.userKey,
        now,
      ],
    );
    await recordActivity(client, {
      config: input.config,
      scopeKey: input.payload.source_key,
      actor: input.actor,
      actionType: 'artifact.generated',
      capability: 'artifact.generate',
      metadata: {
        artifact_kind: input.payload.artifact_kind,
        provider_mode: rendered.providerMode,
        reason: input.payload.reason,
      },
      now,
    });
    const artifact = await getArtifactRevision(client, input.config, artifactRevisionKey);
    if (!artifact) throw new Error('Artifact revision was not persisted.');
    return artifact;
  });
}

export async function getOt110aContentSourceDetail(input: {
  pool: DbPool;
  config: AppConfig;
  actor: Ot110aContentAdminActor;
  sourceKey: string;
  ports?: Ot110aProviderPorts;
}): Promise<ContentAdminSourceDetail | null> {
  requireCapability(input.actor, 'content.view');
  const listed = await listOt110aContentSourcesInternal({
    pool: input.pool,
    config: input.config,
    query: { search: '', sort: 'updated_desc', limit: 50 },
  });
  const summary = listed.sources.find((source) => source.source_key === input.sourceKey);
  if (!summary) return null;
  const [transcripts, artifacts, socialDrafts, knowledgeSections, activity] = await Promise.all([
    listTranscriptRevisions(input.pool, input.config, input.sourceKey),
    listArtifactRevisions(input.pool, input.config, input.sourceKey),
    listSocialDrafts(input.pool, input.config, input.sourceKey),
    listKnowledgeSections(input.pool, input.config, input.sourceKey),
    listActivity(input.pool, input.config, input.sourceKey),
  ]);
  return {
    ...summary,
    provider_ports: providerPortStatuses(input.ports),
    transcript_revisions: transcripts,
    artifact_revisions: artifacts,
    social_drafts: socialDrafts,
    knowledge_sections: knowledgeSections,
    activity,
  };
}

export async function listOt110aSocialWorkspace(input: {
  pool: DbPool;
  config: AppConfig;
  actor: Ot110aContentAdminActor;
  ports?: Ot110aProviderPorts;
}) {
  requireCapability(input.actor, 'content.view');
  return {
    provider_ports: providerPortStatuses(input.ports).filter((status) => status.port === 'buffer'),
    drafts: await listSocialDrafts(input.pool, input.config),
  };
}

export async function listOt110aKnowledgeWorkspace(input: {
  pool: DbPool;
  config: AppConfig;
  actor: Ot110aContentAdminActor;
  ports?: Ot110aProviderPorts;
}) {
  requireCapability(input.actor, 'content.view');
  return {
    provider_ports: providerPortStatuses(input.ports).filter(
      (status) => status.port === 'knowledge_index',
    ),
    sections: await listKnowledgeSections(input.pool, input.config),
  };
}

export async function listOt110aPromptTemplates(input: {
  pool: DbPool;
  config: AppConfig;
  actor: Ot110aContentAdminActor;
  now?: Date;
}): Promise<ContentAdminPromptTemplate[]> {
  requireCapability(input.actor, 'content.view');
  await ensureOt110aDefaultPromptRegistry({
    pool: input.pool,
    config: input.config,
    ...(input.now ? { now: input.now } : {}),
  });
  return readPromptTemplates(input.pool, input.config);
}

export async function createOt110aPromptPatch(input: {
  pool: DbPool;
  config: AppConfig;
  actor: Ot110aContentAdminActor;
  templateKey: string;
  payload: ContentAdminPromptPatchPayload;
  now?: Date;
}) {
  requireCapability(input.actor, 'prompt.manage');
  const now = input.now ?? new Date();
  await ensureOt110aDefaultPromptRegistry({ pool: input.pool, config: input.config, now });
  return inTransaction(input.pool, async (client) => {
    const parent = await getPromptVersionRow(
      client,
      input.config,
      input.payload.parent_version_key,
    );
    if (!parent || parent.template_key !== input.templateKey) {
      throw new Ot110aContentWorkspaceError('NOT_FOUND', 'Parent prompt version was not found.');
    }
    const promptText = applyPromptPatch(String(parent.prompt_text), input.payload.patch);
    if (promptText === parent.prompt_text) {
      throw new Ot110aContentWorkspaceError(
        'PROMPT_PATCH_NOOP',
        'Prompt patch did not change text.',
      );
    }
    const versionNumber = await nextPromptVersionNumber(client, input.config, input.templateKey);
    const checksum = digest(promptText);
    const versionKey = stableKey('ot110a_prompt_version', [
      input.config.accountKey,
      input.config.productKey,
      input.templateKey,
      String(versionNumber),
      checksum,
    ]);
    await client.query(
      `INSERT INTO onetime.ot110a_prompt_versions
         (version_key, template_key, account_key, product_key, version_number,
          parent_version_key, prompt_text, patch_json, reason, checksum, status,
          author_user_key, activated_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, 'draft', $11, NULL, $12)`,
      [
        versionKey,
        input.templateKey,
        input.config.accountKey,
        input.config.productKey,
        versionNumber,
        parent.version_key,
        promptText,
        JSON.stringify(input.payload.patch),
        input.payload.reason,
        checksum,
        input.actor.userKey,
        now,
      ],
    );
    await client.query(
      `INSERT INTO onetime.ot110a_prompt_patch_events
         (patch_key, account_key, product_key, template_key, parent_version_key,
          candidate_version_key, diff_json, reason, author_user_key, checksum, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11)`,
      [
        stableKey('ot110a_prompt_patch', [
          input.config.accountKey,
          input.config.productKey,
          input.templateKey,
          versionKey,
        ]),
        input.config.accountKey,
        input.config.productKey,
        input.templateKey,
        parent.version_key,
        versionKey,
        JSON.stringify(input.payload.patch),
        input.payload.reason,
        input.actor.userKey,
        checksum,
        now,
      ],
    );
    await recordActivity(client, {
      config: input.config,
      scopeKey: input.templateKey,
      actor: input.actor,
      actionType: 'prompt.patch_saved',
      capability: 'prompt.manage',
      metadata: { candidate_version_key: versionKey, parent_version_key: parent.version_key },
      now,
    });
    const templates = await readPromptTemplates(client, input.config);
    const template = templateByKey(templates, input.templateKey);
    return { template, version: versionByKey(template, versionKey) };
  });
}

export async function previewOt110aPromptPatch(input: {
  pool: DbPool;
  config: AppConfig;
  actor: Ot110aContentAdminActor;
  templateKey: string;
  payload: ContentAdminPromptPreviewPayload;
}) {
  requireCapability(input.actor, 'prompt.manage');
  const parent = await getPromptVersionRow(
    input.pool,
    input.config,
    input.payload.parent_version_key,
  );
  if (!parent || parent.template_key !== input.templateKey) {
    throw new Ot110aContentWorkspaceError('NOT_FOUND', 'Parent prompt version was not found.');
  }
  const candidate = applyPromptPatch(String(parent.prompt_text), input.payload.patch);
  const source = input.payload.source_key
    ? await getContentItemRow(input.pool, input.config, input.payload.source_key)
    : null;
  return {
    source_key: input.payload.source_key ?? null,
    parent_checksum: String(parent.checksum),
    candidate_checksum: digest(candidate),
    rendered_excerpt: [
      `Template: ${String(parent.template_label ?? input.templateKey)}`,
      `Source: ${source ? String(source.title) : 'fictional entitled sample'}`,
      candidate.slice(0, 900),
    ].join('\n'),
    can_publish: false as const,
  };
}

export async function activateOt110aPromptVersion(input: {
  pool: DbPool;
  config: AppConfig;
  actor: Ot110aContentAdminActor;
  templateKey: string;
  versionKey: string;
  reason: string;
  now?: Date;
}) {
  requireCapability(input.actor, 'prompt.manage');
  const now = input.now ?? new Date();
  return setPromptActiveVersion({
    pool: input.pool,
    config: input.config,
    actor: input.actor,
    templateKey: input.templateKey,
    versionKey: input.versionKey,
    reason: input.reason,
    actionType: 'prompt.activated',
    now,
  });
}

export async function rollbackOt110aPromptVersion(input: {
  pool: DbPool;
  config: AppConfig;
  actor: Ot110aContentAdminActor;
  templateKey: string;
  targetVersionKey: string;
  reason: string;
  now?: Date;
}) {
  requireCapability(input.actor, 'prompt.manage');
  return setPromptActiveVersion({
    pool: input.pool,
    config: input.config,
    actor: input.actor,
    templateKey: input.templateKey,
    versionKey: input.targetVersionKey,
    reason: input.reason,
    actionType: 'prompt.rollback_reactivated',
    now: input.now ?? new Date(),
  });
}

export async function listOt110aActivity(input: {
  pool: DbPool;
  config: AppConfig;
  actor: Ot110aContentAdminActor;
  sourceKey?: string;
}) {
  requireCapability(input.actor, 'content.view');
  return listActivity(input.pool, input.config, input.sourceKey);
}

export async function performOt110aContentAction(input: {
  pool: DbPool;
  config: AppConfig;
  actor: Ot110aContentAdminActor;
  sourceKey: string;
  actionType:
    | 'transcript.approve'
    | 'artifact.approve'
    | 'artifact.publish'
    | 'content.retry'
    | 'content.retract'
    | 'social.approve'
    | 'social.schedule'
    | 'social.retract';
  reason: string;
  expectedRevisionKey?: string;
  now?: Date;
}): Promise<ContentAdminActionResponse['action']> {
  const capability = capabilityForAction(input.actionType);
  requireCapability(input.actor, capability);
  const now = input.now ?? new Date();
  await inTransaction(input.pool, async (client) => {
    const source = await getContentItemRow(client, input.config, input.sourceKey);
    if (!source)
      throw new Ot110aContentWorkspaceError('NOT_FOUND', 'Content source was not found.');
    if (input.expectedRevisionKey) {
      const revision = await latestContentRevision(client, input.config, input.sourceKey);
      if (revision && revision.revision_key !== input.expectedRevisionKey) {
        throw new Ot110aContentWorkspaceError(
          'VERSION_CONFLICT',
          'The source changed before this action could be applied.',
        );
      }
    }
    if (input.actionType === 'artifact.approve' || input.actionType === 'artifact.publish') {
      await updateLatestArtifactState(client, input.config, input.sourceKey, input.actionType, now);
    }
    await recordActivity(client, {
      config: input.config,
      scopeKey: input.sourceKey,
      actor: input.actor,
      actionType: input.actionType,
      capability,
      metadata: { reason: input.reason, provider_result: 'provider_off' },
      now,
    });
  });
  return {
    action_type: input.actionType,
    capability,
    provider_result: input.actionType.startsWith('social') ? 'sink_queued' : 'provider_off',
    can_claim_provider_success: false,
  };
}

async function ensureOt110aDefaultPromptRegistry(input: {
  pool: DbPool;
  config: AppConfig;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  await inTransaction(input.pool, async (client) => {
    for (const prompt of DEFAULT_PROMPTS) {
      await client.query(
        `INSERT INTO onetime.ot110a_prompt_templates
           (template_key, account_key, product_key, label, artifact_kind,
            active_version_key, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NULL, $6, $6)
         ON CONFLICT (account_key, product_key, template_key)
         DO UPDATE SET label = EXCLUDED.label,
                       artifact_kind = EXCLUDED.artifact_kind,
                       updated_at = EXCLUDED.updated_at`,
        [
          prompt.templateKey,
          input.config.accountKey,
          input.config.productKey,
          prompt.label,
          prompt.artifactKind,
          now,
        ],
      );
      const existing = await client.query(
        `SELECT active_version_key
           FROM onetime.ot110a_prompt_templates
          WHERE account_key = $1 AND product_key = $2 AND template_key = $3`,
        [input.config.accountKey, input.config.productKey, prompt.templateKey],
      );
      if (existing.rows[0]?.active_version_key) continue;
      const checksum = digest(prompt.promptText);
      const versionKey = stableKey('ot110a_prompt_version', [
        input.config.accountKey,
        input.config.productKey,
        prompt.templateKey,
        '1',
        checksum,
      ]);
      await client.query(
        `INSERT INTO onetime.ot110a_prompt_versions
           (version_key, template_key, account_key, product_key, version_number,
            parent_version_key, prompt_text, patch_json, reason, checksum, status,
            author_user_key, activated_at, created_at)
         VALUES ($1, $2, $3, $4, 1, NULL, $5, '{}'::jsonb,
            'OT-110A default prompt registry seed', $6, 'active', NULL, $7, $7)
         ON CONFLICT (account_key, product_key, template_key, version_number) DO NOTHING`,
        [
          versionKey,
          prompt.templateKey,
          input.config.accountKey,
          input.config.productKey,
          prompt.promptText,
          checksum,
          now,
        ],
      );
      await client.query(
        `UPDATE onetime.ot110a_prompt_templates
            SET active_version_key = $4, updated_at = $5
          WHERE account_key = $1 AND product_key = $2 AND template_key = $3`,
        [input.config.accountKey, input.config.productKey, prompt.templateKey, versionKey, now],
      );
    }
  });
}

async function readPromptTemplates(
  pool: DbPool | Queryable,
  config: AppConfig,
): Promise<ContentAdminPromptTemplate[]> {
  const result = await pool.query(
    `SELECT templates.template_key,
            templates.label,
            templates.artifact_kind,
            templates.active_version_key,
            templates.updated_at,
            versions.version_key,
            versions.version_number,
            versions.parent_version_key,
            versions.checksum,
            versions.status,
            versions.reason,
            versions.author_user_key,
            versions.activated_at,
            versions.created_at
       FROM onetime.ot110a_prompt_templates AS templates
       JOIN onetime.ot110a_prompt_versions AS versions
         ON versions.account_key = templates.account_key
        AND versions.product_key = templates.product_key
        AND versions.template_key = templates.template_key
      WHERE templates.account_key = $1
        AND templates.product_key = $2
      ORDER BY templates.artifact_kind ASC, templates.template_key ASC, versions.version_number DESC`,
    [config.accountKey, config.productKey],
  );
  const templates = new Map<string, ContentAdminPromptTemplate>();
  for (const row of result.rows) {
    const templateKey = String(row.template_key);
    const version: ContentAdminPromptVersion = {
      version_key: String(row.version_key),
      template_key: templateKey,
      version_number: Number(row.version_number),
      parent_version_key: nullableString(row.parent_version_key),
      checksum: String(row.checksum),
      status: String(row.status) as ContentAdminPromptVersion['status'],
      reason: String(row.reason ?? ''),
      author_user_key: nullableString(row.author_user_key),
      activated_at: nullableIso(row.activated_at),
      created_at: asDate(row.created_at).toISOString(),
    };
    const existing = templates.get(templateKey);
    if (existing) {
      existing.versions.push(version);
      continue;
    }
    templates.set(templateKey, {
      template_key: templateKey,
      label: String(row.label),
      artifact_kind: String(row.artifact_kind) as ContentAdminArtifactKind,
      active_version_key: nullableString(row.active_version_key),
      versions: [version],
      updated_at: asDate(row.updated_at).toISOString(),
    });
  }
  return [...templates.values()];
}

async function listOt110aContentSourcesInternal(input: {
  pool: DbPool;
  config: AppConfig;
  query: Partial<ContentAdminWorkspaceQuery>;
}): Promise<{
  sources: ContentAdminSourceSummary[];
  page: { page_size: number; next_cursor: string | null };
}> {
  const limit = Math.min(Math.max(Number(input.query.limit ?? 20), 1), 50);
  const offset = input.query.cursor ? Math.max(Number.parseInt(input.query.cursor, 10) || 0, 0) : 0;
  const values: unknown[] = [input.config.accountKey, input.config.productKey];
  const filters = [`items.account_key = $1`, `items.product_key = $2`];
  if (input.query.search) {
    values.push(`%${input.query.search.toLowerCase()}%`);
    filters.push(
      `(lower(items.title) LIKE $${values.length} OR lower(items.content_item_key) LIKE $${values.length})`,
    );
  }
  if (input.query.item_type) {
    values.push(input.query.item_type);
    filters.push(`items.item_type = $${values.length}`);
  }
  const order =
    input.query.sort === 'updated_asc'
      ? 'items.updated_at ASC, items.content_item_key ASC'
      : input.query.sort === 'title_asc'
        ? 'items.title ASC, items.content_item_key ASC'
        : 'items.updated_at DESC, items.content_item_key ASC';
  values.push(limit + 1);
  const limitIndex = values.length;
  values.push(offset);
  const offsetIndex = values.length;
  const result = await input.pool.query(
    `WITH artifact_counts AS (
        SELECT source_key,
               SUM(CASE WHEN review_state = 'draft' THEN 1 ELSE 0 END)::int AS drafts,
               SUM(CASE WHEN review_state = 'review_needed' THEN 1 ELSE 0 END)::int AS review_needed,
               SUM(CASE WHEN review_state = 'approved' THEN 1 ELSE 0 END)::int AS approved,
               SUM(CASE WHEN review_state = 'published' THEN 1 ELSE 0 END)::int AS published
          FROM onetime.ot110a_content_artifact_revisions
         WHERE account_key = $1 AND product_key = $2
         GROUP BY source_key
      ),
      social_counts AS (
        SELECT content_id AS source_key,
               SUM(CASE WHEN workflow_state IN ('review_needed','draft_generated') THEN 1 ELSE 0 END)::int AS social_pending,
               SUM(CASE WHEN workflow_state IN ('scheduled','publishing') THEN 1 ELSE 0 END)::int AS buffer_pending,
               SUM(CASE WHEN workflow_state = 'published' THEN 1 ELSE 0 END)::int AS buffer_published
          FROM onetime.ot86b_social_drafts
         WHERE tenant_id = $1
         GROUP BY content_id
      )
      SELECT items.*,
             COALESCE(artifact_counts.drafts, 0) AS artifact_drafts,
             COALESCE(artifact_counts.review_needed, 0) AS artifact_review_needed,
             COALESCE(artifact_counts.approved, 0) AS artifact_approved,
             COALESCE(artifact_counts.published, 0) AS artifact_published,
             COALESCE(social_counts.social_pending, 0) AS social_pending,
             COALESCE(social_counts.buffer_pending, 0) AS buffer_pending,
             COALESCE(social_counts.buffer_published, 0) AS buffer_published
        FROM onetime.content_items AS items
        LEFT JOIN artifact_counts ON artifact_counts.source_key = items.content_item_key
        LEFT JOIN social_counts ON social_counts.source_key = items.content_item_key
       WHERE ${filters.join(' AND ')}
       ORDER BY ${order}
       LIMIT $${limitIndex}
      OFFSET $${offsetIndex}`,
    values,
  );
  const mapped = result.rows.map(sourceSummaryFromRow);
  const filtered = input.query.lifecycle_stage
    ? mapped.filter((source) => source.lifecycle_stage === input.query.lifecycle_stage)
    : mapped;
  const sources = filtered.slice(0, limit);
  return {
    sources,
    page: {
      page_size: limit,
      next_cursor: result.rows.length > limit ? String(offset + limit) : null,
    },
  };
}

function sourceSummaryFromRow(row: Record<string, unknown>): ContentAdminSourceSummary {
  const artifactCounts = {
    drafts: Number(row.artifact_drafts ?? 0),
    review_needed: Number(row.artifact_review_needed ?? 0),
    approved: Number(row.artifact_approved ?? 0),
    published: Number(row.artifact_published ?? 0),
  };
  const socialPending = Number(row.social_pending ?? 0);
  const bufferPending = Number(row.buffer_pending ?? 0);
  const bufferPublished = Number(row.buffer_published ?? 0);
  const lifecycleState = String(row.lifecycle_state);
  const stage = lifecycleStageFor(lifecycleState, artifactCounts, socialPending, bufferPending);
  return {
    source_key: String(row.content_item_key),
    title: String(row.title),
    item_type: String(row.item_type) as ContentAdminSourceSummary['item_type'],
    lifecycle_stage: stage,
    provider_state: providerStateFor(lifecycleState),
    transcript_state: transcriptStateFor(lifecycleState),
    artifact_state: artifactStateFor(artifactCounts),
    social_state:
      socialPending > 0
        ? 'exact_revision_review_needed'
        : bufferPublished > 0
          ? 'published'
          : 'idle',
    buffer_state: bufferPending > 0 ? 'scheduled_or_publishing' : 'provider_off',
    latest_revision_number: Number(row.latest_revision_number ?? 0),
    latest_revision_key: nullableString(row.latest_revision_key),
    published_revision_key: nullableString(row.published_revision_key),
    artifact_counts: artifactCounts,
    retry_eligible: lifecycleState === 'failed',
    updated_at: asDate(row.updated_at).toISOString(),
  };
}

async function listTranscriptRevisions(pool: DbPool, config: AppConfig, sourceKey: string) {
  const result = await pool.query(
    `SELECT revision_key, revision_number, lifecycle_state, transcript_metadata,
            provider_event_ref_digest, received_at, published_at, failed_at, created_at
       FROM onetime.content_revisions
      WHERE account_key = $1 AND product_key = $2 AND content_item_key = $3
      ORDER BY revision_number DESC
      LIMIT 10`,
    [config.accountKey, config.productKey, sourceKey],
  );
  return result.rows.map((row) => {
    const metadata = asRecord(row.transcript_metadata);
    return {
      revision_key: String(row.revision_key),
      revision_number: Number(row.revision_number),
      state: String(row.lifecycle_state),
      transcript_hash: String(row.provider_event_ref_digest ?? digest(JSON.stringify(metadata))),
      summary: String(metadata.summary ?? 'Transcript metadata is available for human review.'),
      received_at: nullableIso(row.received_at),
      approved_at: nullableIso(row.published_at),
      conflict: String(row.lifecycle_state) === 'superseded',
    };
  });
}

async function listArtifactRevisions(
  pool: DbPool | Queryable,
  config: AppConfig,
  sourceKey: string,
): Promise<ContentAdminArtifactRevision[]> {
  const result = await pool.query(
    `SELECT *
       FROM onetime.ot110a_content_artifact_revisions
      WHERE account_key = $1 AND product_key = $2 AND source_key = $3
      ORDER BY artifact_kind ASC, revision_number DESC
      LIMIT 50`,
    [config.accountKey, config.productKey, sourceKey],
  );
  return result.rows.map(artifactRevisionFromRow);
}

async function getArtifactRevision(
  pool: DbPool | Queryable,
  config: AppConfig,
  artifactRevisionKey: string,
): Promise<ContentAdminArtifactRevision | null> {
  const result = await pool.query(
    `SELECT *
       FROM onetime.ot110a_content_artifact_revisions
      WHERE account_key = $1 AND product_key = $2 AND artifact_revision_key = $3
      LIMIT 1`,
    [config.accountKey, config.productKey, artifactRevisionKey],
  );
  return result.rows[0] ? artifactRevisionFromRow(result.rows[0]) : null;
}

function artifactRevisionFromRow(row: Record<string, unknown>): ContentAdminArtifactRevision {
  return {
    artifact_revision_key: String(row.artifact_revision_key),
    artifact_kind: String(row.artifact_kind) as ContentAdminArtifactKind,
    revision_number: Number(row.revision_number),
    review_state: String(row.review_state) as ContentAdminArtifactRevision['review_state'],
    prompt_version_key: nullableString(row.prompt_version_key),
    prompt_version_checksum: nullableString(row.prompt_version_checksum),
    transcript_revision_key: nullableString(row.transcript_revision_key),
    model_policy_id: nullableString(row.model_policy_id),
    generation_run_key: nullableString(row.generation_run_key),
    output_hash: String(row.output_hash),
    publication_targets: arrayOfStrings(row.publication_targets_json),
    created_by_user_key: nullableString(row.created_by_user_key),
    created_at: asDate(row.created_at).toISOString(),
    updated_at: asDate(row.updated_at).toISOString(),
  };
}

async function listSocialDrafts(
  pool: DbPool,
  config: AppConfig,
  sourceKey?: string,
): Promise<ContentAdminSocialDraft[]> {
  const values: unknown[] = [config.accountKey];
  const filters = [`drafts.tenant_id = $1`];
  if (sourceKey) {
    values.push(sourceKey);
    filters.push(`drafts.content_id = $${values.length}`);
  }
  const result = await pool.query(
    `SELECT drafts.draft_id,
            drafts.content_id,
            drafts.version_id,
            drafts.platform,
            drafts.workflow_state,
            drafts.current_revision_id,
            drafts.updated_at,
            commands.command_state,
            commands.scheduled_for
       FROM onetime.ot86b_social_drafts AS drafts
       LEFT JOIN onetime.ot86b_social_publish_commands AS commands
         ON commands.tenant_id = drafts.tenant_id
        AND commands.draft_id = drafts.draft_id
      WHERE ${filters.join(' AND ')}
      ORDER BY drafts.updated_at DESC, drafts.draft_id ASC
      LIMIT 50`,
    values,
  );
  return result.rows.map((row) => ({
    draft_id: String(row.draft_id),
    source_key: String(row.content_id),
    revision_id: nullableString(row.current_revision_id ?? row.version_id),
    platform: String(row.platform) as ContentAdminSocialDraft['platform'],
    workflow_state: String(row.workflow_state),
    exact_revision_required: true as const,
    buffer_command_state: nullableString(row.command_state),
    scheduled_for: nullableIso(row.scheduled_for),
    updated_at: asDate(row.updated_at).toISOString(),
  }));
}

async function listKnowledgeSections(
  pool: DbPool,
  config: AppConfig,
  sourceKey?: string,
): Promise<ContentAdminKnowledgeSection[]> {
  const values: unknown[] = [config.accountKey];
  const filters = [`sections.tenant_id = $1`];
  if (sourceKey) {
    values.push(sourceKey);
    filters.push(`sections.content_id = $${values.length}`);
  }
  const result = await pool.query(
    `SELECT sections.content_id,
            sections.version_id,
            sections.section_id,
            sections.title,
            sections.active,
            published.active_state,
            published.updated_at
       FROM onetime.ot86_published_sections AS sections
       JOIN onetime.ot86_published_content_versions AS published
         ON published.tenant_id = sections.tenant_id
        AND published.content_id = sections.content_id
        AND published.version_id = sections.version_id
      WHERE ${filters.join(' AND ')}
      ORDER BY published.updated_at DESC, sections.ordinal ASC
      LIMIT 50`,
    values,
  );
  return result.rows.map((row) => ({
    content_id: String(row.content_id),
    version_id: String(row.version_id),
    section_id: String(row.section_id),
    title: String(row.title),
    readiness_state:
      row.active === false || row.active_state !== 'active'
        ? ('revoked' as const)
        : ('indexed' as const),
    citation_count: row.active === false ? 0 : 1,
    entitlement_projection:
      row.active_state === 'active' ? 'published_entitled_only' : 'not_projected',
    updated_at: asDate(row.updated_at).toISOString(),
  }));
}

async function listActivity(pool: DbPool | Queryable, config: AppConfig, sourceKey?: string) {
  const values: unknown[] = [config.accountKey, config.productKey];
  const filters = [`account_key = $1`, `product_key = $2`];
  if (sourceKey) {
    values.push(sourceKey);
    filters.push(`scope_key = $${values.length}`);
  }
  const result = await pool.query(
    `SELECT *
       FROM onetime.ot110a_content_activity_events
      WHERE ${filters.join(' AND ')}
      ORDER BY created_at DESC, activity_key ASC
      LIMIT 75`,
    values,
  );
  return result.rows.map((row) => ({
    activity_key: String(row.activity_key),
    scope_key: nullableString(row.scope_key),
    actor_user_key: nullableString(row.actor_user_key),
    action_type: String(row.action_type),
    capability: nullableString(row.capability) as ContentAdminCapability | null,
    safe_metadata: asRecord(row.safe_metadata_json),
    created_at: asDate(row.created_at).toISOString(),
  }));
}

async function setPromptActiveVersion(input: {
  pool: DbPool;
  config: AppConfig;
  actor: Ot110aContentAdminActor;
  templateKey: string;
  versionKey: string;
  reason: string;
  actionType: string;
  now: Date;
}) {
  await ensureOt110aDefaultPromptRegistry({
    pool: input.pool,
    config: input.config,
    now: input.now,
  });
  return inTransaction(input.pool, async (client) => {
    const version = await getPromptVersionRow(client, input.config, input.versionKey);
    if (!version || version.template_key !== input.templateKey) {
      throw new Ot110aContentWorkspaceError('NOT_FOUND', 'Prompt version was not found.');
    }
    await client.query(
      `UPDATE onetime.ot110a_prompt_versions
          SET status = CASE WHEN version_key = $4 THEN 'active' ELSE 'retired' END,
              activated_at = CASE WHEN version_key = $4 THEN $5 ELSE activated_at END
        WHERE account_key = $1 AND product_key = $2 AND template_key = $3 AND status <> 'draft'`,
      [
        input.config.accountKey,
        input.config.productKey,
        input.templateKey,
        input.versionKey,
        input.now,
      ],
    );
    await client.query(
      `UPDATE onetime.ot110a_prompt_versions
          SET status = 'active', activated_at = $5
        WHERE account_key = $1 AND product_key = $2 AND template_key = $3 AND version_key = $4`,
      [
        input.config.accountKey,
        input.config.productKey,
        input.templateKey,
        input.versionKey,
        input.now,
      ],
    );
    await client.query(
      `UPDATE onetime.ot110a_prompt_templates
          SET active_version_key = $4, updated_at = $5
        WHERE account_key = $1 AND product_key = $2 AND template_key = $3`,
      [
        input.config.accountKey,
        input.config.productKey,
        input.templateKey,
        input.versionKey,
        input.now,
      ],
    );
    await recordActivity(client, {
      config: input.config,
      scopeKey: input.templateKey,
      actor: input.actor,
      actionType: input.actionType,
      capability: 'prompt.manage',
      metadata: { version_key: input.versionKey, reason: input.reason },
      now: input.now,
    });
    const templates = await readPromptTemplates(client, input.config);
    const template = templateByKey(templates, input.templateKey);
    return { template, version: versionByKey(template, input.versionKey) };
  });
}

async function getContentItemRow(
  pool: DbPool | Queryable,
  config: AppConfig,
  sourceKey: string,
): Promise<Record<string, unknown> | null> {
  const result = await pool.query(
    `SELECT *
       FROM onetime.content_items
      WHERE account_key = $1 AND product_key = $2 AND content_item_key = $3
      LIMIT 1`,
    [config.accountKey, config.productKey, sourceKey],
  );
  return result.rows[0] ?? null;
}

async function latestContentRevision(
  pool: DbPool | Queryable,
  config: AppConfig,
  sourceKey: string,
): Promise<Record<string, unknown> | null> {
  const result = await pool.query(
    `SELECT *
       FROM onetime.content_revisions
      WHERE account_key = $1 AND product_key = $2 AND content_item_key = $3
      ORDER BY revision_number DESC
      LIMIT 1`,
    [config.accountKey, config.productKey, sourceKey],
  );
  return result.rows[0] ?? null;
}

async function getPromptVersionRow(
  pool: DbPool | Queryable,
  config: AppConfig,
  versionKey: string,
): Promise<Record<string, unknown> | null> {
  const result = await pool.query(
    `SELECT versions.*, templates.label AS template_label, templates.artifact_kind
       FROM onetime.ot110a_prompt_versions AS versions
       JOIN onetime.ot110a_prompt_templates AS templates
         ON templates.account_key = versions.account_key
        AND templates.product_key = versions.product_key
        AND templates.template_key = versions.template_key
      WHERE versions.account_key = $1 AND versions.product_key = $2 AND versions.version_key = $3
      LIMIT 1`,
    [config.accountKey, config.productKey, versionKey],
  );
  return result.rows[0] ?? null;
}

async function nextPromptVersionNumber(client: Queryable, config: AppConfig, templateKey: string) {
  const result = await client.query(
    `SELECT COALESCE(MAX(version_number), 0)::int + 1 AS next_version
       FROM onetime.ot110a_prompt_versions
      WHERE account_key = $1 AND product_key = $2 AND template_key = $3`,
    [config.accountKey, config.productKey, templateKey],
  );
  return Number(result.rows[0]?.next_version ?? 1);
}

async function nextArtifactRevisionNumber(
  client: Queryable,
  config: AppConfig,
  sourceKey: string,
  artifactKind: ContentAdminArtifactKind,
) {
  const result = await client.query(
    `SELECT COALESCE(MAX(revision_number), 0)::int + 1 AS next_revision
       FROM onetime.ot110a_content_artifact_revisions
      WHERE account_key = $1 AND product_key = $2 AND source_key = $3 AND artifact_kind = $4`,
    [config.accountKey, config.productKey, sourceKey, artifactKind],
  );
  return Number(result.rows[0]?.next_revision ?? 1);
}

async function updateLatestArtifactState(
  client: Queryable,
  config: AppConfig,
  sourceKey: string,
  actionType: 'artifact.approve' | 'artifact.publish',
  now: Date,
) {
  const state = actionType === 'artifact.publish' ? 'published' : 'approved';
  await client.query(
    `UPDATE onetime.ot110a_content_artifact_revisions
        SET review_state = $4, updated_at = $5
      WHERE artifact_revision_key = (
        SELECT artifact_revision_key
          FROM onetime.ot110a_content_artifact_revisions
         WHERE account_key = $1 AND product_key = $2 AND source_key = $3
         ORDER BY updated_at DESC, artifact_revision_key ASC
         LIMIT 1
      )`,
    [config.accountKey, config.productKey, sourceKey, state, now],
  );
}

async function recordActivity(
  client: Queryable,
  input: {
    config: AppConfig;
    scopeKey: string | null;
    actor: Ot110aContentAdminActor;
    actionType: string;
    capability: ContentAdminCapability;
    metadata: Record<string, unknown>;
    now: Date;
  },
) {
  await client.query(
    `INSERT INTO onetime.ot110a_content_activity_events
       (activity_key, account_key, product_key, scope_key, actor_user_key, action_type,
        capability, safe_metadata_json, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
    [
      stableKey('ot110a_activity', [
        input.config.accountKey,
        input.config.productKey,
        input.scopeKey ?? 'global',
        input.actionType,
        input.now.toISOString(),
        input.actor.userKey,
      ]),
      input.config.accountKey,
      input.config.productKey,
      input.scopeKey,
      input.actor.userKey,
      input.actionType,
      input.capability,
      JSON.stringify(redactActivityMetadata(input.metadata)),
      input.now,
    ],
  );
}

function normalizeWorkspaceQuery(query: unknown): ContentAdminWorkspaceQuery {
  const value = query && typeof query === 'object' ? (query as Record<string, unknown>) : {};
  return {
    search: typeof value.search === 'string' ? value.search.slice(0, 120) : '',
    lifecycle_stage:
      typeof value.lifecycle_stage === 'string'
        ? (value.lifecycle_stage as ContentAdminLifecycleStage)
        : undefined,
    item_type:
      typeof value.item_type === 'string'
        ? (value.item_type as ContentAdminWorkspaceQuery['item_type'])
        : undefined,
    sort: value.sort === 'updated_asc' || value.sort === 'title_asc' ? value.sort : 'updated_desc',
    cursor: typeof value.cursor === 'string' ? value.cursor : undefined,
    limit: Number(value.limit ?? 20),
  };
}

function countSourceStates(sources: ContentAdminSourceSummary[]) {
  return {
    total_sources: sources.length,
    processing: sources.filter((source) =>
      ['private_source', 'vimeo_processing', 'transcript_received'].includes(
        source.lifecycle_stage,
      ),
    ).length,
    transcript_review: sources.filter((source) => source.lifecycle_stage === 'transcript_review')
      .length,
    artifact_review: sources.filter((source) => source.lifecycle_stage === 'artifact_review')
      .length,
    published: sources.filter((source) => source.lifecycle_stage === 'published').length,
    social_pending: sources.filter((source) => source.lifecycle_stage === 'social_approval').length,
    buffer_pending: sources.filter((source) => source.lifecycle_stage === 'buffer_scheduled')
      .length,
    failed: sources.filter((source) => source.lifecycle_stage === 'failed').length,
  };
}

function lifecycleStageFor(
  lifecycleState: string,
  artifactCounts: ContentAdminSourceSummary['artifact_counts'],
  socialPending: number,
  bufferPending: number,
): ContentAdminLifecycleStage {
  if (lifecycleState === 'failed') return 'failed';
  if (bufferPending > 0) return 'buffer_scheduled';
  if (socialPending > 0) return 'social_approval';
  if (artifactCounts.review_needed > 0 || artifactCounts.approved > 0) return 'artifact_review';
  if (artifactCounts.drafts > 0) return 'derivative_generation';
  if (lifecycleState === 'published') return 'published';
  if (lifecycleState === 'review_needed') return 'transcript_review';
  if (lifecycleState === 'processing') return 'transcript_received';
  if (lifecycleState === 'transcribing') return 'vimeo_processing';
  return 'private_source';
}

function providerStateFor(lifecycleState: string) {
  if (lifecycleState === 'transcribing' || lifecycleState === 'processing')
    return 'sink_processing';
  if (lifecycleState === 'failed') return 'provider_off_failure';
  return 'provider_off_reference';
}

function transcriptStateFor(lifecycleState: string) {
  if (lifecycleState === 'received' || lifecycleState === 'transcribing') return 'waiting';
  if (lifecycleState === 'review_needed') return 'human_review_needed';
  if (lifecycleState === 'failed') return 'failed';
  return 'received';
}

function artifactStateFor(artifactCounts: ContentAdminSourceSummary['artifact_counts']) {
  if (artifactCounts.review_needed > 0) return 'review_needed';
  if (artifactCounts.published > 0) return 'published';
  if (artifactCounts.approved > 0) return 'approved';
  if (artifactCounts.drafts > 0) return 'draft';
  return 'not_started';
}

function providerPortStatuses(ports = createOt110aProviderOffPorts()) {
  return [
    ports.vimeo.inspect(),
    ports.generation.inspect(),
    ports.knowledge.inspect(),
    ports.buffer.inspect(),
    ports.telegram.inspect(),
  ];
}

function providerOffStatus(
  port: ContentAdminProviderPortStatus['port'],
  missingVariables: string[],
): ContentAdminProviderPortStatus {
  return {
    port,
    mode: 'provider_off',
    state: 'unconfigured',
    label: `${port.replaceAll('_', ' ')} provider is off; local sink UI remains available`,
    missing_variables: missingVariables,
    can_mutate_provider: false,
  };
}

function requireCapability(actor: Ot110aContentAdminActor, capability: ContentAdminCapability) {
  if (!actor.capabilities.includes(capability)) {
    throw new Ot110aContentWorkspaceError(
      'FORBIDDEN',
      `Missing required Content capability: ${capability}.`,
    );
  }
}

function capabilityForAction(
  actionType: Parameters<typeof performOt110aContentAction>[0]['actionType'],
) {
  const map: Record<
    Parameters<typeof performOt110aContentAction>[0]['actionType'],
    ContentAdminCapability
  > = {
    'transcript.approve': 'transcript.review',
    'artifact.approve': 'artifact.edit',
    'artifact.publish': 'artifact.publish',
    'content.retry': 'artifact.generate',
    'content.retract': 'content.revoke',
    'social.approve': 'social.approve',
    'social.schedule': 'social.schedule',
    'social.retract': 'content.revoke',
  };
  return map[actionType];
}

function applyPromptPatch(promptText: string, patch: { find: string; replace: string }) {
  if (!promptText.includes(patch.find)) {
    return `${promptText}\n\nPatch note: ${patch.replace}`;
  }
  return promptText.replace(patch.find, patch.replace);
}

function templateByKey(templates: ContentAdminPromptTemplate[], templateKey: string) {
  const template = templates.find((entry) => entry.template_key === templateKey);
  if (!template) throw new Error('Prompt template was not persisted.');
  return template;
}

function versionByKey(template: ContentAdminPromptTemplate, versionKey: string) {
  const version = template.versions.find((entry) => entry.version_key === versionKey);
  if (!version) throw new Error('Prompt version was not persisted.');
  return version;
}

function defaultPublicationTargets(kind: ContentAdminArtifactKind) {
  if (kind === 'social_caption') return ['social_review'];
  if (kind === 'helper_knowledge') return ['knowledge_index'];
  if (kind === 'newsletter_email') return ['email_draft'];
  if (kind === 'short_clip_plan') return ['staff_clip_plan'];
  return ['classroom_library'];
}

function readableArtifactKind(kind: ContentAdminArtifactKind) {
  return kind.replaceAll('_', ' ');
}

function redactActivityMetadata(metadata: Record<string, unknown>) {
  const json = JSON.stringify(metadata);
  if (/(https?:\/\/|token|secret|password|credential|private)/i.test(json)) {
    return { redacted: true, digest: digest(json) };
  }
  return metadata;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function arrayOfStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [];
    }
  }
  return [];
}

function nullableString(value: unknown) {
  if (value === null || value === undefined) return null;
  return String(value);
}

function nullableIso(value: unknown) {
  if (value === null || value === undefined) return null;
  return asDate(value).toISOString();
}

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return new Date(0);
  return parsed;
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
