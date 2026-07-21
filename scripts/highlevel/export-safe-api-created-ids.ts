import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type AssetEntry = { name: string; status: string; id: string | null };
type PipelineEntry = AssetEntry & {
  stages: Array<{ name: string | null; id: string | null; position: number | null }>;
};

type PrivateReport = {
  generatedAt: string;
  mode: string;
  location: { id: string; status: string };
  customFields: AssetEntry[];
  tags: AssetEntry[];
  customValues: AssetEntry[];
  pipelines: PipelineEntry[];
  externalEffects: Record<string, number>;
};

async function main() {
  const input = requiredArg('--input');
  const output = requiredArg('--output');
  const report = JSON.parse(await readFile(input, 'utf8')) as PrivateReport;
  const effects = report.externalEffects;
  if (
    report.mode !== 'apply' ||
    report.location.status !== 'verified' ||
    effects.messagesSent !== 0 ||
    effects.workflowEnrollments !== 0 ||
    effects.contactsCreated !== 0 ||
    effects.stripeMutations !== 0
  ) {
    throw new Error('unsafe_or_unverified_api_report');
  }

  const created = {
    schema_id: 'one-time-highlevel-safe-created-asset-ids',
    schema_version: '1.1.0',
    source_generated_at: report.generatedAt,
    location_id: report.location.id,
    custom_fields: createdAssets(report.customFields),
    tags: createdAssets(report.tags),
    custom_values: createdAssets(report.customValues),
    pipelines: report.pipelines
      .filter((entry) => entry.status === 'created')
      .map((entry) => ({ name: entry.name, id: entry.id, stages: entry.stages })),
    external_effects: effects,
    safety: {
      values_included: false,
      credentials_included: false,
      contact_data_included: false,
      messages_sent: 0,
      workflows_published: 0,
      production_contacts_enrolled: 0,
      stripe_mutations: 0,
    },
  };

  await writeFile(path.resolve(output), `${JSON.stringify(created, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `${JSON.stringify({
      output,
      counts: {
        customFields: created.custom_fields.length,
        tags: created.tags.length,
        customValues: created.custom_values.length,
        pipelines: created.pipelines.length,
      },
    })}\n`,
  );
}

function createdAssets(entries: AssetEntry[]) {
  return entries
    .filter((entry) => entry.status === 'created')
    .map((entry) => ({ name: entry.name, id: entry.id }));
}

function requiredArg(name: string) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : '';
  if (!value || value.startsWith('--')) throw new Error(`missing_required_argument:${name}`);
  return value;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
