import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Snapshot = {
  schema_version: 'onetime.w13_101.protected_env_snapshot.v1';
  generated_at: string;
  updated_at: string;
  sources: string[];
  env: Record<string, string>;
};

const APP_KEYS = [
  'NODE_ENV',
  'DELIVERY_ENVIRONMENT',
  'ONE_TIME_RUNTIME_ENVIRONMENT',
  'PUBLIC_BASE_URL',
  'APP_VERSION',
  'COMMIT_SHA',
  'AUTH_CSRF_SECRET',
  'MFA_SECRET_ENCRYPTION_KEY',
  'ONE_TIME_LIFECYCLE_DELIVERY_KEY',
  'ONE_TIME_LIFECYCLE_DELIVERY_KEY_ID',
  'ONE_TIME_ACCOUNT_KEY',
  'ONE_TIME_PRODUCT_KEY',
  'OUTBOX_TRANSPORT_MODE',
  'DELIVERY_TRANSPORT_MODE',
  'DELIVERY_PROVIDER_MODE',
  'ONE_TIME_DELIVERY_PROVIDER_TRANSPORT_ENABLED',
  'ONE_TIME_RESEND_TRANSPORT_ENABLED',
  'ONE_TIME_WAPI_TRANSPORT_ENABLED',
  'ENABLE_REAL_EMAIL_TRANSPORT',
  'ENABLE_REAL_WHATSAPP_TRANSPORT',
  'ENABLE_REAL_TELEGRAM_TRANSPORT',
  'ENABLE_PAYMENT_TRANSPORT',
  'ONE_TIME_OWNER_TEST_EMAIL',
  'ONE_TIME_PARENT_TEST_EMAIL',
  'ONE_TIME_DELIVERY_TEST_CANARY_EMAIL',
] as const;

const DB_KEYS = ['DATABASE_PUBLIC_URL', 'DATABASE_URL', 'DATABASE_SSL'] as const;

function parseArgs(argv: string[]) {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [key, ...rest] = arg.slice(2).split('=');
    if (!key) continue;
    if (rest.length === 0) flags.add(key);
    else values.set(key, rest.join('='));
  }
  return {
    mode: values.get('mode') ?? '',
    out: values.get('out') ?? '',
    merge: flags.has('merge'),
    repoRoot: values.get('repo-root') ?? process.cwd(),
  };
}

function assertOutsideRepo(outputPath: string, repoRoot: string) {
  const resolvedOutput = path.resolve(outputPath);
  const resolvedRepo = path.resolve(repoRoot);
  const relative = path.relative(resolvedRepo, resolvedOutput);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
    throw new Error('Protected env snapshot output must be outside the repository.');
  }
}

async function readExisting(outputPath: string): Promise<Snapshot | null> {
  try {
    const parsed = JSON.parse(await readFile(outputPath, 'utf8')) as Snapshot;
    if (parsed.schema_version !== 'onetime.w13_101.protected_env_snapshot.v1') {
      throw new Error('Existing snapshot has an unexpected schema.');
    }
    return parsed;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return null;
    throw error;
  }
}

function collect(mode: string) {
  const env: Record<string, string> = {};
  const keys = mode === 'app' ? APP_KEYS : mode === 'db' ? DB_KEYS : null;
  if (!keys) throw new Error('Use --mode=app or --mode=db.');
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.length > 0) env[key] = value;
  }
  if (mode === 'db') {
    const publicUrl = process.env.DATABASE_PUBLIC_URL;
    if (typeof publicUrl === 'string' && publicUrl.length > 0) {
      env.DATABASE_URL = publicUrl;
      env.DATABASE_SSL = 'false';
    }
  }
  return env;
}

function redactedSummary(env: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(env)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [
        key,
        {
          present: value.length > 0,
          length: value.length,
          sha12: createHash('sha256').update(value).digest('hex').slice(0, 12),
        },
      ]),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.out) throw new Error('Missing --out=...');
  assertOutsideRepo(args.out, args.repoRoot);
  const now = new Date().toISOString();
  const existing = args.merge ? await readExisting(args.out) : null;
  const collected = collect(args.mode);
  const snapshot: Snapshot = {
    schema_version: 'onetime.w13_101.protected_env_snapshot.v1',
    generated_at: existing?.generated_at ?? now,
    updated_at: now,
    sources: [...new Set([...(existing?.sources ?? []), args.mode])],
    env: {
      ...(existing?.env ?? {}),
      ...collected,
    },
  };
  await mkdir(path.dirname(path.resolve(args.out)), { recursive: true });
  await writeFile(args.out, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `${JSON.stringify(
      {
        status: 'written',
        path: args.out,
        mode: args.mode,
        keys: redactedSummary(collected),
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`protected env snapshot failed: ${message}\n`);
  process.exitCode = 1;
});
