import 'dotenv/config';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../../packages/config/src/index.ts';
import { createPgPool } from '../../packages/db/src/index.ts';
import { createVimeoMishnayosCatalogRepository } from '../../packages/db/src/content/vimeo-mishnayos-catalog/index.ts';
import {
  adoptCompleteVimeoCatalog,
  buildCatalogAggregateEvidence,
  classifyCompleteVimeoCatalog,
  inventoryCompleteVimeoCatalog,
  type PrivateVimeoInventoryCheckpoint,
} from '../../packages/domain/src/content/vimeo-mishnayos-catalog.ts';
import {
  createRealVimeoCatalogReadAdapter,
  VimeoCatalogReadError,
} from '../../packages/domain/src/content/vimeo-mishnayos-provider.ts';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const runtimeDirectory = path.resolve(process.cwd(), '.runtime', 'vimeo-mishnayos-catalog');
const checkpointPath = path.join(runtimeDirectory, 'inventory-checkpoint.private.json');
const inventoryPath = path.join(runtimeDirectory, 'inventory.private.json');
const safeEvidencePath = valueArgument('--write-safe-evidence=');

if (apply && process.env.DELIVERY_ENVIRONMENT === 'production') {
  throw new Error('This isolated catalog-adoption command may not write production data.');
}

try {
  await mkdir(runtimeDirectory, { recursive: true });
  const checkpoint = await readPrivateJson<PrivateVimeoInventoryCheckpoint>(checkpointPath);
  const adapter = createRealVimeoCatalogReadAdapter();
  const inventory = await inventoryCompleteVimeoCatalog({
    adapter,
    ...(checkpoint ? { checkpoint } : {}),
    saveCheckpoint: (value) => writePrivateJson(checkpointPath, value),
  });
  const classified = await classifyCompleteVimeoCatalog({ inventory, adapter });
  const aggregate = buildCatalogAggregateEvidence({ inventory, classified });
  await writePrivateJson(inventoryPath, { inventory, classified });
  if (safeEvidencePath) await writeJson(path.resolve(safeEvidencePath), aggregate);

  let adoption: Record<string, unknown> = { mode: 'dry_run', databaseWritesPerformed: false };
  if (apply) {
    const referenceKey = loadReferenceKey();
    const pool = createPgPool(loadConfig(process.env));
    try {
      const result = await adoptCompleteVimeoCatalog({
        repository: createVimeoMishnayosCatalogRepository(pool),
        accountKey: requiredEnv('ONE_TIME_ACCOUNT_KEY'),
        classified,
        referenceKey,
        now: new Date().toISOString(),
      });
      adoption = {
        mode: 'apply',
        databaseWritesPerformed: result.inserted > 0,
        ...result,
      };
    } finally {
      await pool.end();
    }
  }
  process.stdout.write(`${JSON.stringify({ status: 'complete', aggregate, adoption }, null, 2)}\n`);
} catch (error) {
  if (error instanceof VimeoCatalogReadError && error.code === 'VIMEO_READ_AUTH_UNAVAILABLE') {
    process.stderr.write('VIMEO_READ_AUTH_UNAVAILABLE\n');
    process.exitCode = 2;
  } else {
    throw error;
  }
}

function valueArgument(prefix: string) {
  const argument = [...args].find((value) => value.startsWith(prefix));
  return argument?.slice(prefix.length) || null;
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function loadReferenceKey() {
  const key = Buffer.from(requiredEnv('VIMEO_CATALOG_REFERENCE_KEY'), 'base64');
  if (key.length !== 32) throw new Error('VIMEO_CATALOG_REFERENCE_KEY must decode to 32 bytes.');
  return key;
}

async function readPrivateJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function writePrivateJson(filePath: string, value: unknown) {
  await writeJson(filePath, value, 0o600);
}

async function writeJson(filePath: string, value: unknown, mode?: number) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode });
  await rename(temporaryPath, filePath);
}
