import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('parent welcome existing reviewed source migration', () => {
  const sql = readFileSync(
    'packages/db/migrations/2287_existing_reviewed_content_source_capture_method.sql',
    'utf8',
  ).replace(/\r\n?/gu, '\n');

  it('replaces only the original OBS-only content-source capture-method check', () => {
    expect(sql).toContain("relation.relname = 'content_sources_v21'");
    expect(sql).toContain("record_json ->> 'captureMethod'");
    expect(sql).toContain("LIKE '%record_json%captureMethod%obs%'");
    expect(sql).toContain('DROP CONSTRAINT');
    expect(sql).toContain('content_source_capture_method_check');
  });

  it('permits exactly OBS or the governed existing-reviewed-recording lane', () => {
    const captureCheck = sql.match(
      /ADD CONSTRAINT content_source_capture_method_check[\s\S]*?CHECK\s*\(([\s\S]*?)\n\s*\);\s*\n\n-- Migration 2279/u,
    )?.[1];
    expect(captureCheck).toBeDefined();
    expect(captureCheck).toContain("record_json ->> 'captureMethod' IS NOT NULL");
    expect(captureCheck).toMatch(
      /record_json\s*->>\s*'captureMethod'\s+IN\s*\(\s*'obs',\s*'existing_reviewed_recording'\s*\)/u,
    );
    expect(captureCheck).not.toMatch(/\bOR\b|IS NULL|COALESCE/iu);

    const allowed = [
      ...(captureCheck?.matchAll(/'(obs|existing_reviewed_recording)'/gu) ?? []),
    ].map((match) => match[1]);
    expect(allowed).toEqual(['obs', 'existing_reviewed_recording']);
    for (const rejected of [
      null,
      undefined,
      '',
      'unknown',
      'app_upload',
      'recordings_collection',
    ]) {
      expect(typeof rejected === 'string' && allowed.includes(rejected)).toBe(false);
    }
  });

  it('canonically hashes only the existing-reviewed arrays and delegates every other lane', () => {
    expect(sql).toContain('compact_existing_reviewed_projection_references');
    expect(sql).toContain('compact_existing_reviewed_projection_artifacts');
    expect(sql).toContain("',' ORDER BY item.ordinality");
    expect(sql).toContain(
      `'\u007b"artifactId":' || to_jsonb(item.value ->> 'artifactId')::text ||`,
    );
    expect(sql).toContain(
      `',"schemaVersion":' ||\n        COALESCE((item.value -> 'schemaVersion')::text, 'null')`,
    );
    expect(sql).toContain('THEN onetime.approved_publication_projection_digest_obs(evidence)');
    expect(sql).not.toContain("COALESCE(evidence -> 'artifacts', '[]'::jsonb)::text");
    expect(sql).not.toContain("COALESCE(evidence -> 'mishnahReferences', '[]'::jsonb)::text");
  });

  it('locks native JSONB values back into the domain projection order', () => {
    const artifactFunction = sql.match(
      /compact_existing_reviewed_projection_artifacts[\s\S]*?RETURNS text[\s\S]*?AS \$\$([\s\S]*?)\$\$;/u,
    )?.[1];
    const digestFunction = sql.match(
      /approved_publication_projection_digest\([\s\S]*?RETURNS text[\s\S]*?AS \$\$([\s\S]*?)\$\$;/u,
    )?.[1];
    expect(artifactFunction).toBeDefined();
    expect(digestFunction).toBeDefined();
    expectFieldsInOrder(artifactFunction!, [
      'artifactId',
      'kind',
      'revision',
      'payloadDigest',
      'model',
      'operationVersion',
      'promptVersion',
      'schemaVersion',
    ]);
    expectFieldsInOrder(digestFunction!, [
      'accountKey',
      'productKey',
      'contentId',
      'contentVersionId',
      'contentVersionDigest',
      'sourceId',
      'sourceSha256',
      'sourceObjectVersionId',
      'reviewKind',
      'reviewedSourceDigest',
      'reviewedByAdminId',
      'reviewedAt',
      'approvalEvidenceDigest',
      'title',
      'englishTranscriptText',
      'classTopic',
      'mishnahReferences',
      'occurredAt',
      'durationMs',
      'approvedByAdminId',
      'approvedAt',
      'artifacts',
      'approvedArtifactSetDigest',
      'sourceEvidenceDigest',
    ]);
  });

  it('does not seed, update, or delete content inventory', () => {
    expect(sql).not.toMatch(/\bINSERT\s+INTO\b/iu);
    expect(sql).not.toMatch(/\bUPDATE\s+onetime\.content_sources_v21\b/iu);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/iu);
  });

  it('adds immutable one-use manifest authorization and committed-operation evidence', () => {
    expect(sql).toContain('parent_welcome_binding_authorizations_v21');
    expect(sql).toContain('parent_welcome_binding_operation_results_v21');
    expect(sql).toMatch(/authorization_phrase_sha256\s+text\s+PRIMARY KEY/iu);
    expect(sql).toMatch(/operation_id\s+text\s+NOT NULL\s+UNIQUE/iu);
    expect(sql).toContain("operation_id ~ '^pwb_[0-9a-f]{32}$'");
    expect(sql).toContain('manifest_digest');
    expect(sql).toContain('authorization_binding_sha256');
    expect(sql).toContain('REFERENCES onetime.parent_welcome_binding_authorizations_v21');
    expect(sql).toContain('parent_welcome_binding_evidence_append_only');
    expect(sql).toMatch(
      /BEFORE UPDATE OR DELETE ON onetime\.parent_welcome_binding_authorizations_v21/iu,
    );
    expect(sql).toMatch(
      /BEFORE UPDATE OR DELETE ON onetime\.parent_welcome_binding_operation_results_v21/iu,
    );
  });

  it('has one forward inventory entry and remains structurally replay-safe', () => {
    const inventory = readdirSync('packages/db/migrations').filter((name) =>
      name.startsWith('2287_'),
    );
    expect(inventory).toEqual(['2287_existing_reviewed_content_source_capture_method.sql']);
    expect(sql).toContain('IF replaced_count <> 1 THEN');
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION onetime.approved_publication_projection_digest',
    );
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION onetime.compact_existing_reviewed_projection_references',
    );
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION onetime.compact_existing_reviewed_projection_artifacts',
    );
  });
});

function expectFieldsInOrder(fragment: string, fields: readonly string[]) {
  let prior = -1;
  for (const field of fields) {
    const current = fragment.indexOf(`"${field}":`, prior + 1);
    expect(current, `missing or out-of-order canonical field ${field}`).toBeGreaterThan(prior);
    prior = current;
  }
}
