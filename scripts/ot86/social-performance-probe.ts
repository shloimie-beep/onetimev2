import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { DataType, newDb } from 'pg-mem';
import { ot86bApprovedForSocialEventSchema } from '../../packages/contracts/src/index.ts';
import type { DbPool } from '../../packages/db/src/index.ts';

const sourceCount = Number(process.env.OT86B_PERF_SOURCES ?? 10_000);
const revisionsPerDraft = Number(process.env.OT86B_PERF_REVISIONS_PER_DRAFT ?? 5);
const approvalCount = Number(process.env.OT86B_PERF_APPROVALS ?? sourceCount);
const commandCount = Number(process.env.OT86B_PERF_COMMANDS ?? sourceCount);
const samples = Number(process.env.OT86B_PERF_SAMPLES ?? 30);
const reportPath = process.argv.includes('--write-report')
  ? path.resolve('ops/codex-runs/OT-86B/PERFORMANCE-PROBE.json')
  : null;

const { db, pool } = createProbeHarness();
try {
  initializePerformanceSchema();
  await seedProjection();
  const samplePayload = Buffer.from(JSON.stringify(makeLargeSocialEvent(0)), 'utf8');
  const measurements = {
    event_validation_receipt: await sample(async (index) => {
      const event = makeLargeSocialEvent(index + 1);
      const rawBody = Buffer.from(JSON.stringify(event), 'utf8');
      const parsed = ot86bApprovedForSocialEventSchema.parse(JSON.parse(rawBody.toString('utf8')));
      await pool.query(
        `INSERT INTO onetime.ot86b_social_event_inbox
           (event_id, idempotency_key, origin, event_type, schema_version, tenant_id,
            content_id, version_id, sequence, key_id, raw_body_sha256, payload_sha256,
            raw_event, validation_status, processing_state, received_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'perf-key',$10,$11,$12::jsonb,'accepted','queued',$13)`,
        [
          parsed.event_id,
          parsed.idempotency_key,
          parsed.origin,
          parsed.event_type,
          parsed.schema_version,
          parsed.tenant_id,
          parsed.content_id,
          parsed.version_id,
          parsed.sequence,
          digestBuffer(rawBody),
          parsed.payload_sha256,
          rawBody.toString('utf8'),
          new Date(),
        ],
      );
    }),
    draft_list_filter: await sample(() =>
      pool.query(
        `SELECT draft_id, source_id, tenant_id, content_id, version_id, platform,
                workflow_state, current_revision_id, updated_at
           FROM onetime.ot86b_social_drafts
          WHERE tenant_id = $1
            AND workflow_state = $2
          ORDER BY updated_at DESC, draft_id ASC
          LIMIT 50`,
        ['tenant_perf_001', 'scheduled'],
      ),
    ),
    draft_detail_preview: await sample(() =>
      pool.query(
        `SELECT d.draft_id, d.workflow_state, d.platform, r.revision_id, r.text,
                r.hashtags_json, r.media_json, r.source_excerpt_ids_json, r.revision_sha256
           FROM onetime.ot86b_social_drafts d
           JOIN onetime.ot86b_social_draft_revisions r
             ON r.revision_id = d.current_revision_id
          WHERE d.tenant_id = $1
            AND d.draft_id = $2
          LIMIT 1`,
        ['tenant_perf_001', 'draft_perf_05000'],
      ),
    ),
    scheduler_due_command_selection: await sample(() =>
      pool.query(
        `SELECT command_id, idempotency_key, draft_id, revision_id, revision_sha256,
                approval_id, organization_id, destination_id, platform, scheduled_for,
                command_json
           FROM onetime.ot86b_social_publish_commands
          WHERE command_state = 'scheduled'
            AND scheduled_for <= $1
          ORDER BY scheduled_for ASC, id ASC
          LIMIT 100`,
        [new Date('2026-01-02T12:00:00Z')],
      ),
    ),
    duplicate_event_command_reconciliation: await sample(async () => {
      await pool.query(
        `SELECT event_id
           FROM onetime.ot86b_social_event_inbox
          WHERE event_id = $1
            AND raw_body_sha256 = $2
          LIMIT 1`,
        ['perf-event-duplicate', 'a'.repeat(64)],
      );
      await pool.query(
        `SELECT command_id
           FROM onetime.ot86b_social_publish_commands
          WHERE idempotency_key = $1
             OR (approval_id = $2 AND destination_id = $3)
          LIMIT 1`,
        ['buffer_command:perf-duplicate', 'approval_perf_00000', 'buffer_dest_perf_0'],
      );
    }),
  };
  const budgets = {
    event_validation_receipt: 300,
    draft_list_filter: 300,
    draft_detail_preview: 250,
    scheduler_due_command_selection: 500,
    duplicate_event_command_reconciliation: 250,
  };
  const report = {
    packet_id: 'OT-86B',
    generated_at: new Date().toISOString(),
    fixture: {
      accepted_social_source_count: sourceCount,
      draft_count: sourceCount,
      draft_revision_count: sourceCount * revisionsPerDraft,
      approval_count: approvalCount,
      scheduled_command_count: commandCount,
      samples,
      event_payload_bytes: samplePayload.byteLength,
      event_payload_limit_bytes: 512 * 1024,
      bna_network_dependency: false,
      provider_network_time_excluded: true,
      load_mode:
        'pg-mem performance schema using production social publishing table names and serving indexes',
    },
    serving_indexes: collectServingIndexes(),
    budgets_ms: budgets,
    measurements,
    results: Object.fromEntries(
      Object.entries(measurements).map(([name, value]) => [
        name,
        {
          budget_ms: budgets[name as keyof typeof budgets],
          p95_ms: value.p95_ms,
          passed: value.p95_ms <= budgets[name as keyof typeof budgets],
        },
      ]),
    ),
  };
  if (reportPath) {
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await pool.end();
}

async function seedProjection() {
  const schema = db.getSchema('onetime');
  const inbox = insertableTable(schema.getTable('ot86b_social_event_inbox'));
  const sources = insertableTable(schema.getTable('ot86b_social_sources'));
  const drafts = insertableTable(schema.getTable('ot86b_social_drafts'));
  const revisions = insertableTable(schema.getTable('ot86b_social_draft_revisions'));
  const approvals = insertableTable(schema.getTable('ot86b_social_approvals'));
  const commands = insertableTable(schema.getTable('ot86b_social_publish_commands'));
  const platforms = ['linkedin', 'facebook', 'instagram', 'x'] as const;
  const workflowStates = ['scheduled', 'review_needed', 'published', 'correction_needed'] as const;

  inbox.insert({
    event_id: 'perf-event-duplicate',
    idempotency_key: 'perf-event-duplicate-key',
    tenant_id: 'tenant_perf_001',
    content_id: 'cnt_perf_00000',
    version_id: 'ver_perf_00000',
    sequence: 1,
    raw_body_sha256: 'a'.repeat(64),
    processing_state: 'applied',
    received_at: new Date('2026-01-01T00:00:00Z'),
  });

  for (let index = 0; index < sourceCount; index += 1) {
    const padded = String(index).padStart(5, '0');
    const sourceId = `source_perf_${padded}`;
    const draftId = `draft_perf_${padded}`;
    const contentId = `cnt_perf_${padded}`;
    const versionId = `ver_perf_${padded}`;
    const platform = platforms[index % platforms.length] ?? 'linkedin';
    const workflowState = workflowStates[index % workflowStates.length] ?? 'scheduled';
    const currentRevisionId = `revision_perf_${padded}_004`;
    const updatedAt = new Date(Date.UTC(2026, 0, 1, 0, 0, index % 86_400));

    sources.insert({
      source_id: sourceId,
      event_id: uuidFor('event', index),
      tenant_id: 'tenant_perf_001',
      content_id: contentId,
      version_id: versionId,
      sequence: index + 1,
      canonical_title: `Performance source ${padded}`,
      canonical_url: `https://one-time.example.invalid/library/classes/${contentId}`,
      summary: 'Approved social source for performance testing.',
      approved_excerpts_json: [
        {
          excerpt_id: `excerpt_${padded}`,
          section_id: `section_${padded}`,
          text: 'Approved excerpt with no private data.',
          deep_link: `https://one-time.example.invalid/library/classes/${contentId}#section-${padded}`,
          text_sha256: digestFor(`excerpt-${index}`),
        },
      ],
      media_json: [],
      privacy_json: safeEventPrivacy(),
      payload_sha256: digestFor(`payload-${index}`),
      source_state: 'accepted',
      created_at: updatedAt,
      updated_at: updatedAt,
    });

    drafts.insert({
      draft_id: draftId,
      source_id: sourceId,
      tenant_id: 'tenant_perf_001',
      content_id: contentId,
      version_id: versionId,
      platform,
      workflow_state: workflowState,
      current_revision_id: currentRevisionId,
      created_at: updatedAt,
      updated_at: updatedAt,
    });

    for (let revision = 0; revision < revisionsPerDraft; revision += 1) {
      const revisionId = `revision_perf_${padded}_${String(revision).padStart(3, '0')}`;
      revisions.insert({
        draft_id: draftId,
        revision_id: revisionId,
        supersedes_revision_id:
          revision > 0 ? `revision_perf_${padded}_${String(revision - 1).padStart(3, '0')}` : null,
        source_event_id: uuidFor('event', index),
        tenant_id: 'tenant_perf_001',
        content_id: contentId,
        version_id: versionId,
        platform,
        renderer_version: `ot86-${platform}-v1`,
        text: `Approved ${platform} draft ${padded} revision ${revision}. No learner data.`,
        hashtags_json: ['#OneTime', '#Torah'],
        media_json: [],
        source_excerpt_ids_json: [`excerpt_${padded}`],
        privacy_json: safeDraftPrivacy(),
        warnings_json: [],
        revision_sha256: digestFor(`revision-${index}-${revision}`),
        created_by_actor_id: 'ot86b-draft-generator',
        created_at: updatedAt,
      });
    }

    if (index < approvalCount) {
      approvals.insert({
        approval_id: `approval_perf_${padded}`,
        tenant_id: 'tenant_perf_001',
        draft_id: draftId,
        revision_id: currentRevisionId,
        approved_by_actor_id: 'actor_perf_owner',
        approved_at: new Date('2026-01-02T00:00:00Z'),
        policy_version: 'ot86-social-v1',
        approved_revision_sha256: digestFor(`revision-${index}-4`),
        ordered_media_sha256_json: [],
        destination_snapshot_json: [
          {
            provider: 'buffer',
            organization_id: 'org_perf_001',
            destination_id: `buffer_dest_perf_${index % 4}`,
            platform,
            capability_version: 'buffer-readonly-v1',
          },
        ],
        scheduled_for: new Date('2026-01-02T00:05:00Z'),
        timezone: 'Asia/Jerusalem',
        privacy_json: safeDraftPrivacy(),
        approval_state: 'active',
        created_at: new Date('2026-01-02T00:00:00Z'),
      });
    }

    if (index < commandCount) {
      const scheduledFor =
        index < 100
          ? new Date(Date.UTC(2026, 0, 2, 0, index % 60, 0))
          : new Date(Date.UTC(2026, 0, 3, 0, index % 60, 0));
      const command = makeCommand(index, platform, scheduledFor);
      commands.insert({
        command_id: command.command_id,
        idempotency_key: index === 0 ? 'buffer_command:perf-duplicate' : command.idempotency_key,
        tenant_id: 'tenant_perf_001',
        draft_id: draftId,
        revision_id: currentRevisionId,
        revision_sha256: digestFor(`revision-${index}-4`),
        approval_id: `approval_perf_${padded}`,
        provider: 'buffer',
        organization_id: 'org_perf_001',
        destination_id: `buffer_dest_perf_${index % 4}`,
        platform,
        capability_version: 'buffer-readonly-v1',
        scheduled_for: scheduledFor,
        timezone: 'Asia/Jerusalem',
        command_json: command,
        command_state: 'scheduled',
        attempts: 0,
        created_at: new Date('2026-01-02T00:00:00Z'),
        updated_at: new Date('2026-01-02T00:00:00Z'),
      });
    }
  }
}

function makeCommand(
  index: number,
  platform: 'linkedin' | 'facebook' | 'instagram' | 'x',
  scheduledFor: Date,
) {
  const padded = String(index).padStart(5, '0');
  const revisionSha = digestFor(`revision-${index}-4`);
  return {
    schema_version: 1,
    command_id: uuidFor('command', index),
    idempotency_key: `buffer_command:tenant_perf_001:draft_perf_${padded}:buffer_dest_perf_${index % 4}`,
    tenant_id: 'tenant_perf_001',
    draft_id: `draft_perf_${padded}`,
    revision_id: `revision_perf_${padded}_004`,
    revision_sha256: revisionSha,
    approval: {
      approval_id: `approval_perf_${padded}`,
      approved_by_actor_id: 'actor_perf_owner',
      approved_at: '2026-01-02T00:00:00Z',
      policy_version: 'ot86-social-v1',
      approved_revision_sha256: revisionSha,
    },
    destination: {
      provider: 'buffer',
      organization_id: 'org_perf_001',
      destination_id: `buffer_dest_perf_${index % 4}`,
      platform,
      capability_version: 'buffer-readonly-v1',
    },
    scheduled_for: scheduledFor.toISOString(),
    timezone: 'Asia/Jerusalem',
    privacy: safeDraftPrivacy(),
    audit_correlation_id: `corr_perf_${padded}`,
    created_at: '2026-01-02T00:00:00Z',
  };
}

function makeLargeSocialEvent(index: number) {
  const padded = String(index).padStart(5, '0');
  const contentId = `cnt_perf_evt_${padded}`;
  const versionId = `ver_perf_evt_${padded}`;
  const event = {
    schema_version: 1,
    event_type: 'content.approved_for_social',
    origin: 'ot86a-content-pipeline',
    event_id: uuidFor('large-event', index),
    idempotency_key: `tenant_perf_001:${contentId}:${versionId}:social`,
    tenant_id: 'tenant_perf_001',
    content_id: contentId,
    version_id: versionId,
    sequence: index + 1,
    occurred_at: '2026-01-02T03:05:00Z',
    approval: {
      approval_id: `approval_evt_${padded}`,
      approved_for_social: true,
      approved_by_actor_id: 'actor_rabbi_perf',
      approved_at: '2026-01-02T03:00:00Z',
      policy_version: 'ot86-social-v1',
    },
    content: {
      canonical_title: `Approved performance social event ${padded}`,
      canonical_url: `https://one-time.example.invalid/library/classes/${contentId}`,
      summary: fillText('Approved non-private social performance summary ', 2000),
      approved_excerpts: Array.from({ length: 50 }, (_, excerpt) => {
        const sectionId = `section_evt_${padded}_${String(excerpt).padStart(2, '0')}`;
        const text = fillText(`Approved excerpt ${padded}/${excerpt} without learner data. `, 5000);
        return {
          excerpt_id: `excerpt_evt_${padded}_${String(excerpt).padStart(2, '0')}`,
          section_id: sectionId,
          text,
          deep_link: longUrl(
            `https://one-time.example.invalid/library/classes/${contentId}#section-${sectionId}`,
            1500,
          ),
          text_sha256: digestFor(text),
        };
      }),
      media: Array.from({ length: 30 }, (_, media) => ({
        asset_id: `asset_evt_${padded}_${String(media).padStart(2, '0')}`,
        kind: media % 2 === 0 ? 'graphic' : 'thumbnail',
        uri: longUrl(`https://objects.example.invalid/ot86/${contentId}/asset-${media}.png`, 1800),
        mime_type: 'image/png',
        sha256: digestFor(`media-${index}-${media}`),
        subject_classification: media % 2 === 0 ? 'graphics_only' : 'no_people',
        privacy: safeEventPrivacy(),
      })),
    },
    privacy: safeEventPrivacy(),
  };
  return {
    ...event,
    payload_sha256: digestFor(canonicalJson(event)),
  };
}

function createProbeHarness() {
  const memoryDb = newDb({ autoCreateForeignKeyIndices: true });
  memoryDb.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    impure: true,
    implementation: () => randomUUID(),
  });
  const adapter = memoryDb.adapters.createPg();
  const memoryPool = new adapter.Pool() as DbPool & { __memory?: boolean };
  memoryPool.__memory = true;
  return { db: memoryDb, pool: memoryPool };
}

function initializePerformanceSchema() {
  db.public.none(`
    CREATE SCHEMA onetime;

    CREATE TABLE onetime.ot86b_social_event_inbox (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id text UNIQUE,
      idempotency_key text UNIQUE,
      origin text,
      event_type text,
      schema_version integer,
      tenant_id text,
      content_id text,
      version_id text,
      sequence integer,
      key_id text,
      raw_body_sha256 text,
      payload_sha256 text,
      raw_event jsonb,
      validation_status text,
      processing_state text,
      received_at timestamptz
    );
    CREATE INDEX ot86b_social_event_inbox_queue_idx
      ON onetime.ot86b_social_event_inbox(processing_state, received_at);
    CREATE INDEX ot86b_social_event_inbox_duplicate_idx
      ON onetime.ot86b_social_event_inbox(event_id, raw_body_sha256);

    CREATE TABLE onetime.ot86b_social_sources (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source_id text UNIQUE,
      event_id text UNIQUE,
      tenant_id text,
      content_id text,
      version_id text,
      sequence integer,
      canonical_title text,
      canonical_url text,
      summary text,
      approved_excerpts_json jsonb,
      media_json jsonb,
      privacy_json jsonb,
      payload_sha256 text,
      source_state text,
      created_at timestamptz,
      updated_at timestamptz
    );
    CREATE INDEX ot86b_social_sources_tenant_idx
      ON onetime.ot86b_social_sources(tenant_id, created_at DESC);

    CREATE TABLE onetime.ot86b_social_drafts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      draft_id text UNIQUE,
      source_id text,
      tenant_id text,
      content_id text,
      version_id text,
      platform text,
      workflow_state text,
      current_revision_id text,
      created_at timestamptz,
      updated_at timestamptz
    );
    CREATE INDEX ot86b_social_drafts_list_idx
      ON onetime.ot86b_social_drafts(tenant_id, workflow_state, updated_at DESC, draft_id);

    CREATE TABLE onetime.ot86b_social_draft_revisions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      draft_id text,
      revision_id text UNIQUE,
      supersedes_revision_id text,
      source_event_id text,
      tenant_id text,
      content_id text,
      version_id text,
      platform text,
      renderer_version text,
      text text,
      hashtags_json jsonb,
      media_json jsonb,
      source_excerpt_ids_json jsonb,
      privacy_json jsonb,
      warnings_json jsonb,
      revision_sha256 text,
      created_by_actor_id text,
      created_at timestamptz
    );
    CREATE INDEX ot86b_social_draft_revisions_draft_idx
      ON onetime.ot86b_social_draft_revisions(draft_id, created_at DESC);
    CREATE INDEX ot86b_social_draft_revisions_revision_idx
      ON onetime.ot86b_social_draft_revisions(revision_id);

    CREATE TABLE onetime.ot86b_social_approvals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      approval_id text UNIQUE,
      tenant_id text,
      draft_id text,
      revision_id text,
      approved_by_actor_id text,
      approved_at timestamptz,
      policy_version text,
      approved_revision_sha256 text,
      ordered_media_sha256_json jsonb,
      destination_snapshot_json jsonb,
      scheduled_for timestamptz,
      timezone text,
      privacy_json jsonb,
      approval_state text,
      created_at timestamptz
    );
    CREATE INDEX ot86b_social_approvals_draft_idx
      ON onetime.ot86b_social_approvals(tenant_id, draft_id, approval_state);

    CREATE TABLE onetime.ot86b_social_publish_commands (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      command_id text UNIQUE,
      idempotency_key text UNIQUE,
      tenant_id text,
      draft_id text,
      revision_id text,
      revision_sha256 text,
      approval_id text,
      provider text,
      organization_id text,
      destination_id text,
      platform text,
      capability_version text,
      scheduled_for timestamptz,
      timezone text,
      command_json jsonb,
      command_state text,
      lease_owner text,
      lease_expires_at timestamptz,
      attempts integer,
      provider_post_id text,
      provider_update_id text,
      sanitized_error_code text,
      created_at timestamptz,
      updated_at timestamptz
    );
    CREATE INDEX ot86b_social_publish_commands_due_idx
      ON onetime.ot86b_social_publish_commands(command_state, scheduled_for, id);
    CREATE INDEX ot86b_social_publish_commands_duplicate_idx
      ON onetime.ot86b_social_publish_commands(idempotency_key, approval_id, destination_id);
  `);
}

function insertableTable(table: unknown) {
  return table as { insert(item: Record<string, unknown>): unknown };
}

function collectServingIndexes() {
  const schema = db.getSchema('onetime');
  return Object.fromEntries(
    [
      'ot86b_social_event_inbox',
      'ot86b_social_sources',
      'ot86b_social_drafts',
      'ot86b_social_draft_revisions',
      'ot86b_social_approvals',
      'ot86b_social_publish_commands',
    ].map((tableName) => [
      tableName,
      schema
        .getTable(tableName)
        .listIndices()
        .map((index) => ({
          name: index.name,
          expressions: index.expressions,
          unique: index.unique,
        })),
    ]),
  );
}

async function sample(run: (index: number) => Promise<unknown>) {
  const values: number[] = [];
  for (let index = 0; index < samples; index += 1) {
    const start = performance.now();
    await run(index);
    values.push(performance.now() - start);
  }
  values.sort((left, right) => left - right);
  return {
    samples: values.length,
    median_ms: percentile(values, 0.5),
    p95_ms: percentile(values, 0.95),
    max_ms: values[values.length - 1] ?? 0,
  };
}

function percentile(values: number[], pct: number) {
  const index = Math.min(values.length - 1, Math.ceil(values.length * pct) - 1);
  return Number((values[index] ?? 0).toFixed(3));
}

function safeEventPrivacy() {
  return {
    contains_learner_name: false,
    contains_learner_voice: false,
    contains_learner_face: false,
    contains_learner_question: false,
    contains_private_data: false,
  };
}

function safeDraftPrivacy() {
  return {
    ...safeEventPrivacy(),
    scan_status: 'passed',
  };
}

function longUrl(base: string, targetLength: number) {
  if (base.length >= targetLength) return base;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}pad=${'a'.repeat(targetLength - base.length - separator.length - 4)}`;
}

function fillText(seed: string, targetLength: number) {
  return seed.repeat(Math.ceil(targetLength / seed.length)).slice(0, targetLength);
}

function uuidFor(scope: string, index: number) {
  const hash = digestFor(`${scope}-${index}`);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function digestFor(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function digestBuffer(value: Buffer) {
  return createHash('sha256').update(value).digest('hex');
}
