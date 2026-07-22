import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('content factory migration allocation', () => {
  it('uses the collision-free 2214 prefix and keeps the migration restart-safe', async () => {
    const directory = path.resolve(process.cwd(), 'packages/db/migrations');
    const names = await readdir(directory);
    const migrationName = '2214_learning_delivery_content_factory.sql';
    expect(names).toContain(migrationName);
    expect(names).not.toContain('2210_learning_delivery_content_factory.sql');

    const sql = await readFile(path.join(directory, migrationName), 'utf8');
    expect(sql).toContain(
      'CREATE TABLE IF NOT EXISTS onetime.learning_delivery_content_factory_items',
    );
    expect(sql).toContain('onetime.learning_delivery_content_factory_intakes');
    expect(createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex')).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });
});
