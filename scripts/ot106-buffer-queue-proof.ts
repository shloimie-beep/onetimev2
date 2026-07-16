import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import type { Ot106PublicationManifest } from '../packages/contracts/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../packages/db/src/index.ts';
import {
  createOt106SinkAdapter,
  parseOt106BufferChannelAliases,
  processOt106BufferQueueOnce,
  withOt106ManifestChecksum,
  type Ot106RuntimeConfig,
} from '../packages/domain/src/index.ts';

const queueSize = Number(process.env.OT106_QUEUE_PROOF_SIZE ?? 10_000);
const batchSize = Number(process.env.OT106_QUEUE_PROOF_BATCH_SIZE ?? 250);
const reportPath = process.argv.includes('--write-report')
  ? path.resolve('ops/codex-runs/OT-106/QUEUE-PROOF.json')
  : null;

const pool = createMemoryPool();
const started = performance.now();

try {
  await runMigrations(pool);
  await seedQueue(pool, queueSize);
  const config: Ot106RuntimeConfig = {
    accountKey: 'one_time',
    productKey: 'one_time_mishnah_class',
    mode: 'sink',
    bufferOrganizationId: 'buffer_org_sink',
    channels: parseOt106BufferChannelAliases(
      'facebook-main=buffer_channel_facebook_001:facebook:Facebook Main',
      'buffer_org_sink',
    ),
    maxAttempts: 5,
  };
  let processed = 0;
  let providerWrites = 0;
  for (;;) {
    const result = await processOt106BufferQueueOnce({
      pool,
      config,
      adapter: createOt106SinkAdapter(),
      batchSize,
      now: new Date('2026-07-16T20:01:00Z'),
    });
    if (result.inspected === 0) break;
    processed += result.provider_drafts + result.scheduled + result.failed;
    providerWrites += result.provider_writes;
  }
  const summary = await summarize(pool);
  const report = {
    packet_id: 'OT-106',
    generated_at: new Date().toISOString(),
    queue_size: queueSize,
    batch_size: batchSize,
    processed,
    provider_writes: providerWrites,
    external_network_used: false,
    elapsed_ms: Number((performance.now() - started).toFixed(2)),
    summary,
    passed:
      summary.provider_draft_created === queueSize &&
      summary.retryable_failure === 0 &&
      summary.dead_lettered === 0 &&
      providerWrites === 0,
  };
  if (reportPath) {
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.passed ? 0 : 1);
} finally {
  await pool.end();
}

async function seedQueue(pool: DbPool, count: number) {
  const now = new Date('2026-07-16T19:00:00Z');
  for (let index = 0; index < count; index += 1) {
    const manifest = manifestFor(index);
    await pool.query(
      `INSERT INTO onetime.ot106_publication_manifests
         (manifest_id, idempotency_key, account_key, product_key, source_content_id,
          derivative_batch_id, mode, state, due_at_utc, approval_id,
          approved_by_actor_id, raw_body_sha256, manifest_sha256, manifest_json,
          next_attempt_at, max_attempts, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'queued',NULL,$8,$9,$10,$11,$12::jsonb,$13,5,$13,$13)`,
      [
        manifest.manifest_id,
        manifest.idempotency_key,
        manifest.account_key,
        manifest.product_key,
        manifest.source.content_id,
        manifest.source.derivative_batch_id,
        manifest.mode,
        manifest.approval.approval_id,
        manifest.approval.approved_by_actor_id,
        digest(JSON.stringify(manifest)),
        manifest.manifest_sha256,
        JSON.stringify(manifest),
        now,
      ],
    );
    await pool.query(
      `INSERT INTO onetime.ot106_publication_targets
         (target_id, manifest_id, target_alias, requested_platform, target_state, created_at, updated_at)
       VALUES ($1,$2,'facebook-main','facebook','queued',$3,$3)`,
      [
        stableKey('ot106_target', [manifest.manifest_id, 'facebook-main']),
        manifest.manifest_id,
        now,
      ],
    );
  }
}

async function summarize(pool: DbPool) {
  const result = await pool.query(
    `SELECT state, count(*)::int AS count
       FROM onetime.ot106_publication_manifests
      GROUP BY state
      ORDER BY state`,
  );
  const output: Record<string, number> = {
    provider_draft_created: 0,
    retryable_failure: 0,
    dead_lettered: 0,
  };
  for (const row of result.rows) output[String(row.state)] = Number(row.count);
  return output;
}

function manifestFor(index: number): Ot106PublicationManifest {
  const padded = String(index).padStart(5, '0');
  return withOt106ManifestChecksum({
    schema_version: 1,
    event_type: 'ot106.social_publication_manifest',
    manifest_id: uuidFor(index),
    idempotency_key: `ot106:queue-proof:${padded}`,
    account_key: 'one_time',
    product_key: 'one_time_mishnah_class',
    source: {
      pipeline: 'one_time_content_pipeline',
      content_id: `content_queue_${padded}`,
      derivative_batch_id: `batch_queue_${padded}`,
      source_sha256: digest(`source-${index}`),
    },
    caption: {
      text: `Synthetic approved OT-106 queue proof caption ${padded}.`,
      hashtags: ['#OneTime'],
    },
    targets: [{ alias: 'facebook-main', platform: 'facebook' }],
    mode: 'draft',
    approval: {
      approval_id: `approval_queue_${padded}`,
      approved_by_actor_id: 'actor_owner_queue',
      approved_by_role: 'owner',
      approved_at: '2026-07-16T18:00:00Z',
      policy_version: 'ot106-social-v1',
    },
    media: [],
    privacy: {
      source_scope: 'approved_one_time_social_derivative',
      contains_learner_name: false,
      contains_learner_voice: false,
      contains_learner_face: false,
      contains_learner_question: false,
      contains_private_data: false,
      approved_for_social: true,
    },
    checksum_algorithm: 'sha256',
    created_at: '2026-07-16T18:00:10Z',
  });
}

function uuidFor(index: number) {
  const hash = digest(`ot106-queue-${index}`);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function stableKey(prefix: string, parts: string[]) {
  return `${prefix}_${digest(parts.join('\0')).slice(0, 32)}`;
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
