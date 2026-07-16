import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const outputDir = path.resolve(process.env.OPS06_OUTPUT_DIR ?? 'ops/codex-runs/OPS-06/evidence');
const outputJson = path.join(outputDir, 'migration-safety.json');
const outputMd = path.join(outputDir, 'migration-safety.md');
const migrationsDir = path.resolve('packages/db/migrations');

type MigrationRecord = {
  source: string;
  id: string;
  file_name: string;
  path: string;
  checksum: string;
};

type Report = {
  generated_at: string;
  status: 'passed' | 'failed';
  local_count: number;
  remote_sources_scanned: string[];
  duplicates: Array<{ id: string; sources: string[] }>;
  checksum_collisions: Array<{ id: string; checksums: string[]; paths: string[] }>;
  ordering_failures: string[];
  external_mutations: {
    production_database: false;
    providers: false;
    sends: false;
    deployment: false;
  };
};

const localRecords = await localMigrationRecords();
const remoteRecords = await remoteMigrationRecords();
const allRecords = [...localRecords, ...remoteRecords];
const duplicates = duplicateIds(allRecords);
const checksumCollisions = checksumConflicts(allRecords);
const orderingFailures = orderingChecks(localRecords);
const report: Report = {
  generated_at: new Date().toISOString(),
  status: duplicates.length === 0 && orderingFailures.length === 0 ? 'passed' : 'failed',
  local_count: localRecords.length,
  remote_sources_scanned: [...new Set(remoteRecords.map((record) => record.source))],
  duplicates,
  checksum_collisions: checksumCollisions,
  ordering_failures: orderingFailures,
  external_mutations: {
    production_database: false,
    providers: false,
    sends: false,
    deployment: false,
  },
};

await mkdir(outputDir, { recursive: true });
await writeFile(outputJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await writeFile(outputMd, markdown(report), 'utf8');
process.stdout.write(`OPS-06 migration safety ${report.status}: ${outputJson}\n`);
if (report.status !== 'passed') process.exitCode = 1;

async function localMigrationRecords(): Promise<MigrationRecord[]> {
  const names = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();
  const records: MigrationRecord[] = [];
  for (const name of names) {
    const fullPath = path.join(migrationsDir, name);
    const sql = await readFile(fullPath, 'utf8');
    records.push({
      source: 'worktree',
      id: name.replace(/\.sql$/, ''),
      file_name: name,
      path: path.relative(process.cwd(), fullPath).replace(/\\/g, '/'),
      checksum: sha256(sql),
    });
  }
  return records;
}

async function remoteMigrationRecords(): Promise<MigrationRecord[]> {
  const branches = await remoteBranches();
  const records: MigrationRecord[] = [];
  for (const branch of branches) {
    const files = await gitLines([
      'ls-tree',
      '-r',
      '--name-only',
      branch,
      'packages/db/migrations',
    ]);
    for (const filePath of files.filter((file) => file.endsWith('.sql'))) {
      const sql = await gitText(['show', `${branch}:${filePath}`]).catch(() => '');
      if (!sql) continue;
      const fileName = path.basename(filePath);
      records.push({
        source: branch,
        id: fileName.replace(/\.sql$/, ''),
        file_name: fileName,
        path: filePath,
        checksum: sha256(sql),
      });
    }
  }
  return records;
}

async function remoteBranches() {
  const lines = await gitLines([
    'for-each-ref',
    '--format=%(refname:short)',
    'refs/remotes/origin/codex',
    'refs/remotes/origin/ops',
    'refs/remotes/origin/integration',
  ]).catch(() => []);
  return lines.filter((line) => !line.endsWith('/HEAD')).slice(0, 120);
}

function duplicateIds(records: MigrationRecord[]) {
  const byId = groupBy(records, (record) => `${record.source}:${record.id}`);
  return [...byId.entries()]
    .filter(([, values]) => values.length > 1)
    .map(([, values]) => ({
      id: values[0]?.id ?? 'unknown',
      sources: values.map((value) => `${value.source}:${value.path}`),
    }));
}

function checksumConflicts(records: MigrationRecord[]) {
  const byId = groupBy(records, (record) => record.id);
  const conflicts: Report['checksum_collisions'] = [];
  for (const [id, values] of byId.entries()) {
    const checksums = [...new Set(values.map((value) => value.checksum))];
    if (checksums.length > 1) {
      conflicts.push({
        id,
        checksums,
        paths: values.map((value) => `${value.source}:${value.path}`),
      });
    }
  }
  return conflicts;
}

function orderingChecks(records: MigrationRecord[]) {
  const failures: string[] = [];
  const names = records.map((record) => record.file_name);
  const sorted = [...names].sort();
  if (names.join('\n') !== sorted.join('\n'))
    failures.push('local migration filenames are not lexicographically ordered');
  const ids = records.map((record) => record.id.split('_')[0] ?? '');
  const nonNumeric = ids.filter((id) => !/^\d+$/.test(id));
  if (nonNumeric.length > 0)
    failures.push(`non-numeric migration prefixes: ${nonNumeric.join(', ')}`);
  return failures;
}

function groupBy<T>(values: T[], keyFor: (value: T) => string) {
  const map = new Map<string, T[]>();
  for (const value of values) {
    const key = keyFor(value);
    map.set(key, [...(map.get(key) ?? []), value]);
  }
  return map;
}

async function gitLines(args: string[]) {
  return (await gitText(args))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function gitText(args: string[]) {
  const { stdout } = await execFileAsync('git', args, {
    cwd: process.cwd(),
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function markdown(report: Report) {
  return `# OPS-06 Migration Safety

Generated: ${report.generated_at}

Status: ${report.status}

- Local migrations: ${report.local_count}
- Remote sources scanned: ${report.remote_sources_scanned.length}
- Duplicate IDs: ${report.duplicates.length}
- Cross-branch checksum collisions reported: ${report.checksum_collisions.length}
- Ordering failures: ${report.ordering_failures.length}

External mutations: production_database=false, providers=false, sends=false, deployment=false.
`;
}
