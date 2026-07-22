import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('content factory migration allocation', () => {
  it('keeps immutable 2214, exact 2215, and a unique source prefix ledger', async () => {
    const directory = path.resolve(process.cwd(), 'packages/db/migrations');
    const names = await readdir(directory);
    const migrationName = '2214_learning_delivery_content_factory.sql';
    const previewMigrationName = '2215_experience_preview_sessions.sql';
    expect(names).toContain(migrationName);
    expect(names).toContain(previewMigrationName);
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
  });
});
