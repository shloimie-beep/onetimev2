import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import {
  parseProtectedHighLevelImportCsv,
  requiredReplitProviderTags,
  replitContactTaxonomy,
} from '../../packages/domain/src/audience-reconciliation/replit-subscriber.ts';
import { HighLevelHttpClient } from '../../packages/domain/src/highlevel/http-client.ts';

const args = new Map(
  process.argv
    .slice(2)
    .map((value) => value.split(/=(.*)/s))
    .filter((parts) => parts.length >= 2)
    .map(([key, value]) => [key!.replace(/^--/, ''), value!]),
);
const inputPath = required('input');
const protectedReceiptPath = required('protected-receipt');
const sanitizedOutputPath = required('sanitized-output');
const expectedSha256 = required('expected-sha256');
const authorizationId = required('authorization-id');
const locationId = process.env.HIGHLEVEL_LOCATION_ID;
const apply = process.argv.includes('--apply');
const canonicalLocationId = 'pBSnOK2nkdxp6gf9Rg3o';

if (!apply) throw new Error('HIGHLEVEL_REPLIT_APPLY_REQUIRES_EXPLICIT_APPLY');
if (authorizationId !== 'pr130-replit-reconciliation-20260727') {
  throw new Error('HIGHLEVEL_REPLIT_AUTHORIZATION_MISMATCH');
}
if (locationId !== canonicalLocationId) {
  throw new Error('HIGHLEVEL_REPLIT_LOCATION_MISMATCH');
}
if (!process.env.HIGHLEVEL_PRIVATE_INTEGRATIONS_TOKEN) {
  throw new Error('HIGHLEVEL_REPLIT_TOKEN_UNCONFIGURED');
}

const inputBytes = await readFile(inputPath);
const inputSha256 = sha256(inputBytes);
if (inputSha256 !== expectedSha256) throw new Error('HIGHLEVEL_REPLIT_INPUT_DIGEST_MISMATCH');
const rows = parseProtectedHighLevelImportCsv(inputBytes.toString('utf8'));
if (rows.length !== 84) throw new Error('HIGHLEVEL_REPLIT_ROW_COUNT_MISMATCH');

const priorReceipt = await readReceipt(protectedReceiptPath);
if (priorReceipt.input_sha256 && priorReceipt.input_sha256 !== inputSha256) {
  throw new Error('HIGHLEVEL_REPLIT_RECEIPT_DIGEST_MISMATCH');
}
const receipt: ProtectedReceipt = {
  schema_version: 'onetime.highlevel.replit_tag_apply.private.v1',
  authorization_id: authorizationId,
  input_sha256: inputSha256,
  location_id: canonicalLocationId,
  rows: priorReceipt.rows ?? [],
};
const completed = new Map(receipt.rows.map((row) => [row.protected_row_number, row]));
const client = new HighLevelHttpClient({
  apiBaseUrl: process.env.HIGHLEVEL_API_BASE_URL ?? 'https://services.leadconnectorhq.com',
  apiVersion: process.env.HIGHLEVEL_API_VERSION ?? '2021-07-28',
  privateIntegrationsToken: process.env.HIGHLEVEL_PRIVATE_INTEGRATIONS_TOKEN,
  timeoutMs: 15_000,
});

let tagRequests = 0;
let readbacks = 0;
let upsertsWithoutPriorId = 0;
for (const row of rows) {
  const prior = completed.get(row.protectedRowNumber);
  if (prior?.status === 'verified') continue;
  const requiredTags = requiredReplitProviderTags(row.tags);
  if (!requiredTags.includes(replitContactTaxonomy.sourceTag)) {
    throw new Error('HIGHLEVEL_REPLIT_SOURCE_TAG_MISSING');
  }
  let contactId = row.contactId;
  let operation: ProtectedReceiptRow['operation'] = 'tag_update';
  if (!contactId) {
    operation = 'upsert_and_tag';
    upsertsWithoutPriorId += 1;
    const value = await providerRequest(
      () =>
        client.request('/contacts/upsert', operationKey(row.protectedRowNumber, 'upsert'), {
          method: 'POST',
          body: JSON.stringify({
            locationId: canonicalLocationId,
            email: row.email,
            phone: row.phone || undefined,
            name: [row.firstName, row.lastName].filter(Boolean).join(' ') || undefined,
          }),
        }),
      'upsert',
    );
    contactId = providerContactId(value);
  }

  await providerRequest(
    () =>
      client.request(
        `/contacts/${encodeURIComponent(contactId)}/tags`,
        operationKey(row.protectedRowNumber, 'add-tags'),
        {
          method: 'POST',
          body: JSON.stringify({ tags: requiredTags }),
        },
      ),
    'add-tags',
  );
  tagRequests += 1;
  const readback = await providerRequest(
    () =>
      client.request(
        `/contacts/${encodeURIComponent(contactId)}`,
        operationKey(row.protectedRowNumber, 'readback'),
        { method: 'GET' },
      ),
    'readback',
  );
  readbacks += 1;
  const providerTags = providerContactTags(readback);
  if (!requiredTags.every((tag) => providerTags.some((value) => sameTag(tag, value)))) {
    throw new Error('HIGHLEVEL_REPLIT_TAG_READBACK_MISMATCH');
  }
  completed.set(row.protectedRowNumber, {
    protected_row_number: row.protectedRowNumber,
    contact_id: contactId,
    operation,
    required_tags: requiredTags,
    status: 'verified',
    verified_at: new Date().toISOString(),
  });
  receipt.rows = [...completed.values()].sort(
    (left, right) => left.protected_row_number - right.protected_row_number,
  );
  await writeFile(protectedReceiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  await delay(125);
}

const verifiedRows = [...completed.values()].filter((row) => row.status === 'verified');
const summary = {
  schema_version: 'onetime.highlevel.replit_tag_apply.sanitized.v1',
  authorization_id: authorizationId,
  input_sha256: inputSha256,
  expected_rows: rows.length,
  verified_rows: verifiedRows.length,
  resumed_verified_rows: Math.max(0, verifiedRows.length - tagRequests),
  existing_contact_tag_updates: rows.filter((row) => Boolean(row.contactId)).length,
  upserts_without_prior_contact_id: rows.filter((row) => !row.contactId).length,
  provider_calls_this_run: {
    contact_upserts: upsertsWithoutPriorId,
    add_tag_requests: tagRequests,
    tag_readbacks: readbacks,
  },
  canonical_tags_only: true,
  sends: 0,
  workflow_enrollments: 0,
  deletions: 0,
  suppression_removals: 0,
  contact_field_replacements: 0,
  raw_values_included: false,
  completed_at: new Date().toISOString(),
};
await writeFile(sanitizedOutputPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

async function providerRequest<T>(request: () => Promise<T>, step: string): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      const code = error instanceof Error ? error.message : 'UNKNOWN';
      if (
        attempt === 4 ||
        ![
          'HIGHLEVEL_PROVIDER_HTTP_429',
          'HIGHLEVEL_PROVIDER_HTTP_502',
          'HIGHLEVEL_PROVIDER_HTTP_503',
          'HIGHLEVEL_PROVIDER_HTTP_504',
        ].includes(code)
      ) {
        throw new Error(`HIGHLEVEL_REPLIT_PROVIDER_${step.toUpperCase()}_FAILED:${code}`);
      }
      await delay(250 * 2 ** attempt);
    }
  }
  throw new Error(`HIGHLEVEL_REPLIT_PROVIDER_${step.toUpperCase()}_RETRY_EXHAUSTED`);
}

function operationKey(rowNumber: number, step: string) {
  return `onetime:pr130:replit:${inputSha256.slice(0, 16)}:${rowNumber}:${step}`;
}

function providerContactId(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('HIGHLEVEL_PROVIDER_RESPONSE_INVALID');
  const record = value as Record<string, unknown>;
  const contact = record.contact;
  if (contact && typeof contact === 'object') {
    const id = (contact as Record<string, unknown>).id;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  if (typeof record.id === 'string' && record.id.length > 0) return record.id;
  throw new Error('HIGHLEVEL_PROVIDER_CONTACT_ID_MISSING');
}

function providerContactTags(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('HIGHLEVEL_PROVIDER_RESPONSE_INVALID');
  const record = value as Record<string, unknown>;
  const contact =
    record.contact && typeof record.contact === 'object'
      ? (record.contact as Record<string, unknown>)
      : record;
  if (!Array.isArray(contact.tags)) throw new Error('HIGHLEVEL_PROVIDER_TAG_READBACK_INVALID');
  return contact.tags.map((tag) => {
    if (typeof tag === 'string') return tag;
    if (
      tag &&
      typeof tag === 'object' &&
      typeof (tag as Record<string, unknown>).name === 'string'
    ) {
      return String((tag as Record<string, unknown>).name);
    }
    throw new Error('HIGHLEVEL_PROVIDER_TAG_READBACK_INVALID');
  });
}

function sameTag(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function required(name: string) {
  const value = args.get(name);
  if (!value) throw new Error(`Missing --${name}=<value>.`);
  return value;
}

function sha256(value: Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readReceipt(path: string): Promise<Partial<ProtectedReceipt>> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Partial<ProtectedReceipt>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

type ProtectedReceiptRow = {
  protected_row_number: number;
  contact_id: string;
  operation: 'tag_update' | 'upsert_and_tag';
  required_tags: string[];
  status: 'verified';
  verified_at: string;
};

type ProtectedReceipt = {
  schema_version: string;
  authorization_id: string;
  input_sha256: string;
  location_id: string;
  rows: ProtectedReceiptRow[];
};
