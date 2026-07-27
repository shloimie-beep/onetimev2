import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import {
  parseHighLevelContactCsv,
  parseAcceptedHistoricalImportCsv,
  parseHistoricalAudienceCsv,
  parseReplitSubscriberCsv,
  reconcileReplitSubscribers,
  replitContactTaxonomy,
  toProtectedHighLevelImportCsv,
  type ExistingAdultIdentity,
} from '../../packages/domain/src/audience-reconciliation/replit-subscriber.ts';

const args = new Map(
  process.argv
    .slice(2)
    .map((value) => value.split(/=(.*)/s))
    .filter((parts) => parts.length >= 2)
    .map(([key, value]) => [key!.replace(/^--/, ''), value!]),
);

const sourcePath = required('source');
const ghlPath = required('ghl-export');
const protectedOutputPath = required('protected-output');
const sanitizedOutputPath = required('sanitized-output');
const historical = await Promise.all(
  [
    ['subscribed', args.get('historical-subscribed')],
    ['unsubscribed', args.get('historical-unsubscribed')],
    ['cleaned', args.get('historical-cleaned')],
  ]
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(async ([kind, filePath]) =>
      parseHistoricalAudienceCsv(
        await readFile(filePath, 'utf8'),
        kind as 'subscribed' | 'unsubscribed' | 'cleaned',
      ),
    ),
);
if (args.get('historical-import')) {
  historical.push(
    parseAcceptedHistoricalImportCsv(await readFile(args.get('historical-import')!, 'utf8')),
  );
}
const oneTimeAdults = args.get('one-time-json')
  ? ((
      JSON.parse(await readFile(args.get('one-time-json')!, 'utf8')) as {
        adults?: ExistingAdultIdentity[];
      }
    ).adults ?? [])
  : [];
const sourceBytes = await readFile(sourcePath);
const ghlBytes = await readFile(ghlPath);
const rows = parseReplitSubscriberCsv(sourceBytes.toString('utf8'));
const ghl = parseHighLevelContactCsv(ghlBytes.toString('utf8'));
const result = reconcileReplitSubscribers({
  rows,
  existingAdults: [...ghl, ...historical.flat(), ...oneTimeAdults],
});

await writeFile(
  protectedOutputPath,
  toProtectedHighLevelImportCsv(result.protectedImportRows),
  'utf8',
);
const manifest = {
  schema_version: 'onetime.replit_contact_reconciliation.v1',
  generated_at: new Date().toISOString(),
  source: {
    kind: 'replit_subscriber_export',
    file_name: fileName(sourcePath),
    sha256: sha256(sourceBytes),
    row_count: rows.length,
  },
  evidence: {
    highlevel_export: {
      file_name: fileName(ghlPath),
      sha256: sha256(ghlBytes),
      row_count: ghl.length,
    },
    historical_record_count: historical.flat().length,
    one_time_adult_record_count: oneTimeAdults.length,
  },
  canonical_taxonomy: replitContactTaxonomy,
  candidate_rule: {
    include_all_tags: [
      replitContactTaxonomy.sourceTag,
      replitContactTaxonomy.activeSubscriberTag,
      replitContactTaxonomy.migrationCandidateTag,
    ],
    exclude_any_tags: [replitContactTaxonomy.suppressionTag],
    workflow_enrollment: false,
  },
  summary: result.summary,
  quarantine: {
    groups: result.quarantined.length,
    rows: result.quarantined.reduce((count, item) => count + item.sourceRowNumbers.length, 0),
    reason_counts: Object.fromEntries(
      [...new Set(result.quarantined.map((item) => item.reason))].map((reason) => [
        reason,
        result.quarantined.filter((item) => item.reason === reason).length,
      ]),
    ),
  },
  import_file: {
    protected_local_only: true,
    row_count: result.protectedImportRows.length,
    sha256: sha256(Buffer.from(toProtectedHighLevelImportCsv(result.protectedImportRows))),
  },
  provider_effects: {
    contacts_created: 0,
    contacts_updated: 0,
    sends: result.sends,
    workflow_enrollments: result.workflow_enrollments,
    deletions: result.deletions,
    suppression_removals: result.suppression_removals,
  },
  raw_values_included: false,
  production_side_effects: false,
};
await writeFile(sanitizedOutputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(manifest.summary, null, 2)}\n`);

function required(name: string) {
  const value = args.get(name);
  if (!value) throw new Error(`Missing --${name}=<path>.`);
  return value;
}

function sha256(value: Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

function fileName(value: string) {
  return value.replace(/\\/g, '/').split('/').pop() ?? value;
}
