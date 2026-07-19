import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const spreadsheetExtensions = new Set(['.csv', '.tsv', '.xlsx', '.xls']);
const acceptedClassifications = new Set([
  'one_time_rabbi_scheller_followers',
  'email_audience_export',
]);

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value) throw new Error(`Missing value for --${key}`);
    values.set(key, value);
    index += 1;
  }
  for (const key of ['source-inventory', 'downloads-root', 'out', 'private-out']) {
    if (!values.get(key)) throw new Error(`Missing --${key}`);
  }
  return {
    sourceInventory: values.get('source-inventory'),
    downloadsRoot: values.get('downloads-root'),
    out: values.get('out'),
    privateOut: values.get('private-out'),
    now: values.get('now') ? new Date(values.get('now')) : new Date(),
  };
}

async function walkFiles(root) {
  const files = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (
        entry.isFile() &&
        spreadsheetExtensions.has(path.extname(entry.name).toLowerCase())
      ) {
        files.push(fullPath);
      }
    }
  }
  await visit(root);
  return files;
}

async function sha256File(filePath) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

function expectedSources(sourceInventory) {
  return sourceInventory.primary_source_files
    .filter((source) => acceptedClassifications.has(source.classification))
    .map((source) => ({
      id: source.id,
      file_name: source.file_name,
      classification: source.classification,
      sha256: String(source.sha256).toLowerCase(),
      row_count_estimate: source.row_count_estimate,
      column_count: source.column_count,
      header_signal_names: source.header_signal_names ?? [],
      readiness: source.readiness,
    }));
}

async function discover(args) {
  const sourceInventory = JSON.parse(await readFile(args.sourceInventory, 'utf8'));
  const expected = expectedSources(sourceInventory);
  const expectedByHash = new Map(expected.map((source) => [source.sha256, source]));
  const matches = new Map(expected.map((source) => [source.sha256, []]));
  const scannedFiles = await walkFiles(args.downloadsRoot);

  for (const filePath of scannedFiles) {
    const digest = await sha256File(filePath);
    const normalizedDigest = digest.toLowerCase();
    if (!expectedByHash.has(normalizedDigest)) continue;
    const fileStat = await stat(filePath);
    matches.get(normalizedDigest).push({
      absolute_path: path.resolve(filePath),
      file_name: path.basename(filePath),
      byte_size: fileStat.size,
      mtime: fileStat.mtime.toISOString(),
    });
  }

  const sourceResults = expected.map((source) => {
    const found = matches.get(source.sha256) ?? [];
    return {
      ...source,
      found_count: found.length,
      hash_verified: found.length > 0,
      ambiguous_duplicate_matches: found.length > 1,
      matched_file_names: [...new Set(found.map((match) => match.file_name))],
      private_paths_included: false,
    };
  });

  const privateManifest = {
    schema: 'onetime.w13_102.crm_source_acceptance.private.v1',
    generated_at: args.now.toISOString(),
    approval_status: 'operator_approval_required',
    source_paths_are_private: true,
    source_rows_included: false,
    operator_must_set_before_apply: {
      accepted_for_production_apply: false,
      tag_map_approved: false,
      allow_delivery_side_effects: false,
      accepted_run_id: 'W13-102',
    },
    sources: expected.map((source) => ({
      ...source,
      matches: matches.get(source.sha256) ?? [],
      operator_accepts_source: false,
    })),
  };

  const report = {
    schema: 'onetime.w13_102.crm_source_discovery.v1',
    generated_at: args.now.toISOString(),
    discovery_scope: {
      source_inventory: 'ops/codex-runs/OPS-13A/SOURCE-INVENTORY.json',
      downloads_root_scanned: 'Downloads',
      source_rows_read: false,
      source_rows_printed: false,
      private_paths_printed: false,
      exact_hash_matching_only: true,
    },
    expected_source_count: expected.length,
    scanned_spreadsheet_file_count: scannedFiles.length,
    source_results: sourceResults,
    hash_verification: {
      all_expected_sources_found: sourceResults.every((source) => source.hash_verified),
      duplicate_hash_matches_present: sourceResults.some(
        (source) => source.ambiguous_duplicate_matches,
      ),
      verified_sources: sourceResults.filter((source) => source.hash_verified).length,
      missing_sources: sourceResults
        .filter((source) => !source.hash_verified)
        .map((source) => source.id),
    },
    acceptance_manifest: {
      private_manifest_written: true,
      committed_private_path: false,
      approval_status: 'operator_approval_required',
      required_private_fields: [
        'accepted_for_production_apply',
        'tag_map_approved',
        'operator_accepts_source for each source',
      ],
    },
    crm_apply: {
      status: 'blocked_before_apply',
      blockers: [
        'operator_approval_required_for_private_acceptance_manifest',
        'tag_map_approval_required',
        'dry_run_rehearsal_not_yet_performed_for_W13_102',
        'production_apply_not_started',
      ],
      contacts_imported: 0,
      external_sends: 0,
      outbox_rows_created: 0,
    },
  };

  await mkdir(path.dirname(path.resolve(args.out)), { recursive: true });
  await mkdir(path.dirname(path.resolve(args.privateOut)), { recursive: true });
  await writeFile(args.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(args.privateOut, `${JSON.stringify(privateManifest, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  return report;
}

const report = await discover(parseArgs(process.argv.slice(2)));
process.stdout.write(
  `${JSON.stringify(
    {
      status: 'written',
      expected_source_count: report.expected_source_count,
      hash_verification: report.hash_verification,
      crm_apply: report.crm_apply,
    },
    null,
    2,
  )}\n`,
);
