import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('content factory migration allocation', () => {
  it('keeps immutable 2214/2221 and forward-repairs the provider constraint at 2222', async () => {
    const directory = path.resolve(process.cwd(), 'packages/db/migrations');
    const names = await readdir(directory);
    const migrationName = '2214_learning_delivery_content_factory.sql';
    const previewMigrationName = '2215_experience_preview_sessions.sql';
    const durableMigrationName = '2221_video_to_classroom_e2e.sql';
    const providerConstraintMigrationName = '2222_content_factory_provider_constraint.sql';
    expect(names).toContain(migrationName);
    expect(names).toContain(previewMigrationName);
    expect(names).toContain(durableMigrationName);
    expect(names).toContain(providerConstraintMigrationName);
    expect(names).not.toContain('2210_learning_delivery_content_factory.sql');
    expect(names).not.toContain('2214_experience_preview_sessions.sql');

    const prefixes = names.flatMap((name) => name.match(/^(\d{4})_/)?.[1] ?? []);
    expect(new Set(prefixes).size).toBe(prefixes.length);

    const sql = await readFile(path.join(directory, migrationName), 'utf8');
    expect(sql).toContain(
      'CREATE TABLE IF NOT EXISTS onetime.learning_delivery_content_factory_items',
    );
    expect(sql).toContain('onetime.learning_delivery_content_factory_intakes');
    expect(createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex')).toBe(
      '7c5a8ad21cc4610dc32c2378b72e2024eafc45445a9658a1ae1e9783fcf8068c',
    );

    const previewSql = await readFile(path.join(directory, previewMigrationName), 'utf8');
    expect(createHash('sha256').update(previewSql.replace(/\r\n/g, '\n')).digest('hex')).toBe(
      'e2a9f039e66b659ee630f232ad88fbbfbd4d9dc06d1437256ca07f2655483d56',
    );

    const durableSql = await readFile(path.join(directory, durableMigrationName), 'utf8');
    expect(durableSql).toContain('classroom_occurrence_learner_entitlements');
    expect(durableSql).toContain('learning_delivery_content_factory_jobs');
    expect(durableSql).toContain('learning_delivery_content_factory_stage_results');
    expect(createHash('sha256').update(durableSql.replace(/\r\n/g, '\n')).digest('hex')).toBe(
      '25559ae6b514864c02e2e9ef2139a4906733cdeb9fe2208ca2db1b0a42f40536',
    );

    const providerConstraintSql = await readFile(
      path.join(directory, providerConstraintMigrationName),
      'utf8',
    );
    expect(providerConstraintSql).toContain(
      'DROP CONSTRAINT IF EXISTS learning_delivery_content_factory__transcription_provider_check',
    );
    expect(providerConstraintSql).toContain('ADD CONSTRAINT learning_delivery_cf_provider_check');
    expect(
      createHash('sha256').update(providerConstraintSql.replace(/\r\n/g, '\n')).digest('hex'),
    ).toBe('79a3f3f60a2cd9b4c08bcd08b4d694f1d652f90ab288da79d578d87ce1cd32c0');
  });
});
