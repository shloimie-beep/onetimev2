import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { DataType, newDb } from 'pg-mem';
import type { DbPool } from '../../packages/db/src/index.ts';

const itemCount = Number(process.env.OT86_PERF_ITEMS ?? 1000);
const sectionsPerItem = Number(process.env.OT86_PERF_SECTIONS_PER_ITEM ?? 10);
const docsPerSection = Number(process.env.OT86_PERF_DOCS_PER_SECTION ?? 5);
const samples = Number(process.env.OT86_PERF_SAMPLES ?? 30);
const reportPath = process.argv.includes('--write-report')
  ? path.resolve('ops/codex-runs/OT-86A/PERFORMANCE-PROBE.json')
  : null;

const { db, pool } = createProbeHarness();
try {
  initializePerformanceSchema();
  await seedProjection();
  const measurements = {
    library_list: await sample(() =>
      pool.query(
        `SELECT content_id, version_id, canonical_path
           FROM onetime.ot86_published_content_versions
          WHERE tenant_id = $1 AND active_state = 'active'
          ORDER BY published_at DESC, content_id ASC
          LIMIT 25`,
        ['tenant_perf_001'],
      ),
    ),
    content_detail: await sample(async () => {
      const version = await pool.query(
        `SELECT content_id, version_id
           FROM onetime.ot86_published_content_versions
          WHERE tenant_id = $1
            AND content_id = $2
            AND active_state = 'active'
          LIMIT 1`,
        ['tenant_perf_001', 'cnt_perf_0500'],
      );
      const versionId = String(version.rows[0]?.version_id ?? 'ver_perf_0500');
      await pool.query(
        `SELECT content_id, version_id, section_id, title
           FROM onetime.ot86_published_sections
          WHERE tenant_id = $1
            AND content_id = $2
            AND version_id = $3
            AND active = true
          ORDER BY ordinal
          LIMIT 50`,
        ['tenant_perf_001', 'cnt_perf_0500', versionId],
      );
    }),
    deep_link: await sample(() =>
      pool.query(
        `SELECT section_id, deep_link
           FROM onetime.ot86_published_sections
          WHERE tenant_id = $1 AND section_id = $2 AND active = true
          LIMIT 1`,
        ['tenant_perf_001', 'section_0500_005'],
      ),
    ),
    retrieval_rank: await sample(() =>
      pool.query(
        `SELECT content_id, version_id, section_id, title, body
           FROM onetime.ot86_search_documents
          WHERE tenant_id = $1
            AND active = true
            AND content_id = ANY($2)
            AND body LIKE $3
          LIMIT 10`,
        ['tenant_perf_001', ['cnt_perf_0500'], '%mishnah%'],
      ),
    ),
    duplicate_ack_lookup: await sample(() =>
      pool.query(
        `SELECT message_id
           FROM onetime.ot86_publication_inbox_receipts
          WHERE message_id = $1 AND raw_body_sha256 = $2
          LIMIT 1`,
        ['11111111-1111-4111-8111-111111111111', 'a'.repeat(64)],
      ),
    ),
  };
  const report = {
    packet_id: 'OT-86A',
    generated_at: new Date().toISOString(),
    fixture: {
      item_count: itemCount,
      section_count: itemCount * sectionsPerItem,
      search_document_count: itemCount * sectionsPerItem * docsPerSection,
      samples,
      bna_network_dependency: false,
      load_mode:
        'pg-mem performance schema using production serving table names and serving indexes',
    },
    serving_indexes: collectServingIndexes(),
    measurements,
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
  const versions = insertableTable(schema.getTable('ot86_published_content_versions'));
  const sections = insertableTable(schema.getTable('ot86_published_sections'));
  const documents = insertableTable(schema.getTable('ot86_search_documents'));
  const receipts = insertableTable(schema.getTable('ot86_publication_inbox_receipts'));

  for (let item = 0; item < itemCount; item += 1) {
    const contentId = `cnt_perf_${String(item).padStart(4, '0')}`;
    const versionId = `ver_perf_${String(item).padStart(4, '0')}`;
    versions.insert({
      tenant_id: 'tenant_perf_001',
      content_id: contentId,
      version_id: versionId,
      sequence: item + 1,
      action: 'publish',
      canonical_path: `/library/classes/${contentId}`,
      source_sha256: digestFor(`source-${item}`),
      manifest_sha256: digestFor(`manifest-${item}`),
      approval_json: {},
      privacy_json: {
        source_scope: 'approved_rabbi_content',
        contains_learner_name: false,
        contains_learner_voice: false,
        contains_learner_face: false,
        contains_learner_question: false,
        contains_private_data: false,
        approved_for_student_kb: true,
      },
      active_state: 'active',
      published_at: new Date(Date.now() - item * 1000),
    });
    for (let section = 0; section < sectionsPerItem; section += 1) {
      const sectionId = `section_${String(item).padStart(4, '0')}_${String(section).padStart(3, '0')}`;
      sections.insert({
        tenant_id: 'tenant_perf_001',
        content_id: contentId,
        version_id: versionId,
        section_id: sectionId,
        title: `Mishnah section ${section}`,
        ordinal: section,
        start_ms: section * 60_000,
        end_ms: (section + 1) * 60_000,
        canonical_path: `/library/classes/${contentId}`,
        deep_link: `/library/classes/${contentId}#section-${sectionId}`,
        text_sha256: digestFor(sectionId),
        active: true,
      });
      for (let doc = 0; doc < docsPerSection; doc += 1) {
        const documentId = `doc_${String(item).padStart(4, '0')}_${String(section).padStart(3, '0')}_${doc}`;
        const body = `Approved Mishnah class document ${documentId} with local retrieval text.`;
        documents.insert({
          tenant_id: 'tenant_perf_001',
          content_id: contentId,
          version_id: versionId,
          section_id: sectionId,
          document_id: documentId,
          title: `Mishnah section ${section}`,
          body,
          token_count: 8,
          document_sha256: digestFor(body),
          active: true,
          updated_at: new Date(),
        });
      }
    }
  }
  receipts.insert({
    message_id: '11111111-1111-4111-8111-111111111111',
    idempotency_key: 'perf:duplicate',
    tenant_id: 'tenant_perf_001',
    content_id: 'cnt_perf_0001',
    version_id: 'ver_perf_0001',
    sequence: 9999,
    action: 'publish',
    key_id: 'perf-key',
    raw_body_sha256: 'a'.repeat(64),
    manifest_sha256: 'b'.repeat(64),
    raw_manifest: {},
    validation_status: 'accepted',
    processing_state: 'applied',
    received_at: new Date(),
  });
}

function createProbeHarness() {
  const memoryDb = newDb({ autoCreateForeignKeyIndices: true });
  memoryDb.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    impure: true,
    implementation: () => randomUUID(),
  });
  memoryDb.public.registerFunction({
    name: 'pg_advisory_xact_lock',
    args: [DataType.integer],
    returns: DataType.integer,
    implementation: () => 1,
  });
  const adapter = memoryDb.adapters.createPg();
  const memoryPool = new adapter.Pool() as DbPool & { __memory?: boolean };
  memoryPool.__memory = true;
  return { db: memoryDb, pool: memoryPool };
}

function initializePerformanceSchema() {
  db.public.none(`
    CREATE SCHEMA onetime;
    CREATE TABLE onetime.ot86_published_content_versions (
      tenant_id text,
      content_id text,
      version_id text,
      sequence integer,
      action text,
      canonical_path text,
      source_sha256 text,
      manifest_sha256 text,
      approval_json jsonb,
      privacy_json jsonb,
      active_state text,
      published_at timestamptz
    );
    CREATE INDEX ot86_published_versions_active_idx
      ON onetime.ot86_published_content_versions(tenant_id, active_state, published_at DESC);
    CREATE INDEX ot86_published_versions_content_idx
      ON onetime.ot86_published_content_versions(tenant_id, content_id, active_state);

    CREATE TABLE onetime.ot86_published_sections (
      tenant_id text,
      content_id text,
      version_id text,
      section_id text,
      title text,
      ordinal integer,
      start_ms integer,
      end_ms integer,
      canonical_path text,
      deep_link text,
      text_sha256 text,
      active boolean
    );
    CREATE INDEX ot86_published_sections_content_idx
      ON onetime.ot86_published_sections(tenant_id, content_id, version_id, ordinal);
    CREATE INDEX ot86_published_sections_deep_link_idx
      ON onetime.ot86_published_sections(tenant_id, section_id, active);

    CREATE TABLE onetime.ot86_search_documents (
      tenant_id text,
      content_id text,
      version_id text,
      section_id text,
      document_id text,
      title text,
      body text,
      token_count integer,
      document_sha256 text,
      active boolean,
      updated_at timestamptz
    );
    CREATE INDEX ot86_search_documents_lookup_idx
      ON onetime.ot86_search_documents(tenant_id, active, content_id, version_id);

    CREATE TABLE onetime.ot86_publication_inbox_receipts (
      message_id text,
      idempotency_key text,
      tenant_id text,
      content_id text,
      version_id text,
      sequence integer,
      action text,
      key_id text,
      raw_body_sha256 text,
      manifest_sha256 text,
      raw_manifest jsonb,
      validation_status text,
      processing_state text,
      received_at timestamptz
    );
    CREATE INDEX ot86_publication_inbox_message_idx
      ON onetime.ot86_publication_inbox_receipts(message_id, raw_body_sha256);
  `);
}

function insertableTable(table: unknown) {
  return table as { insert(item: Record<string, unknown>): unknown };
}

function collectServingIndexes() {
  const schema = db.getSchema('onetime');
  return Object.fromEntries(
    [
      'ot86_published_content_versions',
      'ot86_published_sections',
      'ot86_search_documents',
      'ot86_publication_inbox_receipts',
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

async function sample(run: () => Promise<unknown>) {
  const values: number[] = [];
  for (let index = 0; index < samples; index += 1) {
    const start = performance.now();
    await run();
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

function digestFor(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
