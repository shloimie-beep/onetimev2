import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Vimeo Mishnayos catalog migration', () => {
  it('uses a unique forward-only allocation and protected current-review bridge', async () => {
    const directory = path.resolve(process.cwd(), 'packages/db/migrations');
    const names = await readdir(directory);
    const migration = '2259_vimeo_mishnayos_catalog_adoption.sql';
    expect(names).toContain(migration);
    const prefixes = names.flatMap((name) => name.match(/^(\d+)_/)?.[1] ?? []);
    expect(new Set(prefixes).size).toBe(prefixes.length);
    const sql = await readFile(path.join(directory, migration), 'utf8');
    expect(sql).toContain('vimeo_mishnayos_catalog_revisions');
    expect(sql).toContain('vimeo_mishnayos_catalog_current');
    expect(sql).toContain('vimeo_mishnayos_catalog_review_queue');
    expect(sql).toContain("classification_status = 'include_mishnayos'");
    expect(sql).toContain('protected_provider_reference');
    expect(sql).toContain('Vimeo catalog revisions are append-only');
    expect(sql).not.toMatch(/player\.vimeo\.com\/video\/\d+/);
    expect(sql).not.toMatch(
      /INSERT\s+INTO\s+onetime\.(?:class_occurrences|portal_learners|portal_households)/i,
    );
  });
});
