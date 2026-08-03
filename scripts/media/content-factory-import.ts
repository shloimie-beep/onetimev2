import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../../packages/config/src/index.ts';
import { createPgPool, runMigrations } from '../../packages/db/src/index.ts';
import {
  ingestContentFactoryItem,
  type ContentFactoryIngest,
} from '../../packages/domain/src/content/content-factory.ts';

const pathArg = process.argv.find((arg) => arg.startsWith('--path='));
if (!pathArg) throw new Error('content_factory_private_import_path_required');
const importPath = path.resolve(pathArg.slice('--path='.length));
if (!/\.private\.json$/i.test(importPath)) {
  throw new Error('content_factory_private_import_suffix_required');
}

const config = loadConfig(process.env);
const pool = createPgPool(config);
try {
  await runMigrations(pool);
  const item = JSON.parse(await readFile(importPath, 'utf8')) as ContentFactoryIngest;
  const persisted = await ingestContentFactoryItem({ pool, config, item });
  process.stdout.write(
    `${JSON.stringify({
      source_key: persisted.source_key,
      state: persisted.state,
      input_adapter: persisted.source_kind === 'drive' ? 'DRIVE' : 'LOCAL_DROP',
      captions_active: persisted.vimeo.captions_active,
      raw_provider_url_present: false,
    })}\n`,
  );
} finally {
  await pool.end();
}
