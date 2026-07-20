import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { protectedImportPaths } from './canonical-registry-data.ts';

type ImportManifest = {
  generated_at?: string;
  mode?: string;
  counts?: {
    ready_contacts?: number;
    email_conflicts?: number;
    phone_conflicts?: number;
    quarantined?: number;
  };
  apply?: {
    attempted?: number;
    succeeded?: number;
    failed?: number;
    created_planned?: number;
    updated_planned?: number;
    workflow_enrollments?: number;
    messages_sent?: number;
  };
  safety?: {
    workflow_enrollments?: number;
    messages_sent?: number;
    stripe_mutations?: number;
  };
};

type ContactMap = { generated_at?: string; mappings?: Array<{ status?: string }> };
type ImportErrors = { generated_at?: string; errors?: Array<{ code?: string }> };
type Credentials = { locationId: string; pit: string };
type LiveCountProbe =
  | { status: 'verified'; statusCode: number; total: number | null }
  | { status: 'blocked'; statusCode: number; code: string }
  | { status: 'skipped'; reason: string };

const privateDir = parsePrivateDir(process.argv.slice(2));

await main();

async function main() {
  const manifest = await readPrivateJson<ImportManifest>(protectedImportPaths.manifest);
  const contactMap = await readPrivateJson<ContactMap>(protectedImportPaths.contactMap);
  const errors = await readPrivateJson<ImportErrors>(protectedImportPaths.errors);
  const liveCount = await probeLiveContactCount(privateDir);
  const mappingCount = contactMap.mappings?.length ?? 0;
  const errorCount = errors.errors?.length ?? 0;
  const apply = manifest.apply ?? {};
  const status = contactImportStatus({
    mode: manifest.mode ?? '',
    attempted: apply.attempted ?? 0,
    succeeded: apply.succeeded ?? 0,
    failed: apply.failed ?? 0,
    mappingCount,
    readyContacts: manifest.counts?.ready_contacts ?? 0,
  });
  const report = {
    generated_at: new Date().toISOString(),
    status,
    manifest_generated_at: manifest.generated_at ?? null,
    map_generated_at: contactMap.generated_at ?? null,
    errors_generated_at: errors.generated_at ?? null,
    protected_paths: protectedImportPaths,
    live_contact_count: liveCount,
    counts: {
      ready_contacts: manifest.counts?.ready_contacts ?? 0,
      contact_map_entries: mappingCount,
      error_count: errorCount,
      contact_conflicts:
        (manifest.counts?.email_conflicts ?? 0) +
        (manifest.counts?.phone_conflicts ?? 0) +
        (manifest.counts?.quarantined ?? 0),
      contacts_created: 0,
      contacts_updated: 0,
      apply_attempted: apply.attempted ?? 0,
      apply_succeeded: apply.succeeded ?? 0,
      apply_failed: apply.failed ?? 0,
      planned_creates: apply.created_planned ?? 0,
      planned_updates: apply.updated_planned ?? 0,
    },
    safety: {
      messages_sent: manifest.safety?.messages_sent ?? apply.messages_sent ?? 0,
      workflow_enrollments:
        manifest.safety?.workflow_enrollments ?? apply.workflow_enrollments ?? 0,
      stripe_mutations: manifest.safety?.stripe_mutations ?? 0,
      raw_values_printed: false,
      raw_values_committed: false,
    },
  };

  await mkdir(path.dirname(protectedImportPaths.reconciliation), { recursive: true });
  await writeFile(
    protectedImportPaths.reconciliation,
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  writeStdoutJson({
    status: report.status,
    liveContactCount: report.live_contact_count,
    counts: report.counts,
    protectedOutputs: {
      manifest: protectedImportPaths.manifest,
      contactMap: protectedImportPaths.contactMap,
      errors: protectedImportPaths.errors,
      reconciliation: protectedImportPaths.reconciliation,
    },
    safety: report.safety,
  });
}

function contactImportStatus(input: {
  mode: string;
  attempted: number;
  succeeded: number;
  failed: number;
  mappingCount: number;
  readyContacts: number;
}) {
  if (input.attempted === 0 && input.mappingCount === 0) return 'NOT_STARTED';
  if (input.failed > 0) return 'PARTIAL';
  if (input.readyContacts > 0 && input.mappingCount >= input.readyContacts) return 'COMPLETE';
  if (input.attempted > 0 || input.mappingCount > 0) return 'IN_PROGRESS';
  return input.mode === 'dry_run' ? 'NOT_STARTED' : 'IN_PROGRESS';
}

async function probeLiveContactCount(privateDirectory: string): Promise<LiveCountProbe> {
  let credentials: Credentials;
  try {
    credentials = await readCredentials(privateDirectory);
  } catch {
    return { status: 'skipped', reason: 'protected_credentials_unavailable' };
  }
  const url = new URL('https://services.leadconnectorhq.com/contacts/');
  url.searchParams.set('locationId', credentials.locationId);
  url.searchParams.set('limit', '1');
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${credentials.pit}`,
        version: '2021-07-28',
      },
    });
    const parsed = await parseJson(response);
    if (!response.ok) {
      return { status: 'blocked', statusCode: response.status, code: providerErrorCode(parsed) };
    }
    return {
      status: 'verified',
      statusCode: response.status,
      total: numericProperty(parsed, ['total', 'totalCount', 'count']),
    };
  } catch {
    return { status: 'blocked', statusCode: 0, code: 'network_error' };
  }
}

async function readCredentials(privateDirectory: string): Promise<Credentials> {
  return {
    locationId: (await readFile(path.join(privateDirectory, 'location-id.txt'), 'utf8')).trim(),
    pit: (await readFile(path.join(privateDirectory, 'pit-sync.txt'), 'utf8')).trim(),
  };
}

async function readPrivateJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function numericProperty(value: unknown, names: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const object = value as Record<string, unknown>;
  for (const name of names) {
    const candidate = object[name];
    if (typeof candidate === 'number') return candidate;
  }
  return null;
}

function providerErrorCode(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'provider_error';
  const object = value as Record<string, unknown>;
  const candidate = object.code ?? object.error ?? object.message;
  return typeof candidate === 'string' ? sanitizeProviderCode(candidate) : 'provider_error';
}

function sanitizeProviderCode(value: string) {
  return value
    .replace(/pit-[a-z0-9-]+/gi, '[REDACTED:PIT]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, '[REDACTED_PHONE]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .slice(0, 120);
}

function parsePrivateDir(argv: string[]) {
  let privateDirectory = 'C:/Users/User/.onetime-highlevel-private';
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--private-dir') privateDirectory = argv[(index += 1)] ?? privateDirectory;
    else if (value?.startsWith('--private-dir='))
      privateDirectory = value.slice('--private-dir='.length);
  }
  return privateDirectory;
}

function writeStdoutJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
