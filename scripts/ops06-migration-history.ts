import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const migrationsPath = 'packages/db/migrations';
const defaultRefPrefixes = [
  'refs/remotes/origin/codex',
  'refs/remotes/origin/ops',
  'refs/remotes/origin/integration',
] as const;
const defaultTreeConcurrency = 8;
const defaultBlobBatchSize = 256;
const maxGitOutputBytes = 64 * 1024 * 1024;

export type MigrationHistoryRecord = {
  source: string;
  id: string;
  file_name: string;
  path: string;
  checksum: string;
};

export type MigrationHistoryScan = {
  records: MigrationHistoryRecord[];
  sources: string[];
  unique_commit_count: number;
  unique_blob_count: number;
  git_process_count: number;
};

type RemoteRef = {
  source: string;
  commit: string;
};

type MigrationTreeEntry = {
  blob: string;
  path: string;
};

export async function scanRemoteMigrationHistory(options?: {
  cwd?: string;
  refPrefixes?: readonly string[];
  treeConcurrency?: number;
  blobBatchSize?: number;
}): Promise<MigrationHistoryScan> {
  const cwd = path.resolve(options?.cwd ?? process.cwd());
  const refPrefixes = options?.refPrefixes ?? defaultRefPrefixes;
  const treeConcurrency = positiveInteger(options?.treeConcurrency, defaultTreeConcurrency);
  const blobBatchSize = positiveInteger(options?.blobBatchSize, defaultBlobBatchSize);
  const refs = await remoteRefs(cwd, refPrefixes);
  const refsByCommit = groupBy(refs, (ref) => ref.commit);
  const commits = [...refsByCommit.keys()].sort();
  const trees = await mapWithConcurrency(commits, treeConcurrency, async (commit) => ({
    commit,
    entries: await migrationTree(cwd, commit),
  }));
  const blobs = [
    ...new Set(trees.flatMap(({ entries }) => entries.map((entry) => entry.blob))),
  ].sort();
  const blobContents = await readBlobs(cwd, blobs, blobBatchSize);
  const blobChecksums = new Map(
    [...blobContents].map(([blob, sql]) => [blob, sha256(sql)] as const),
  );
  const records: MigrationHistoryRecord[] = [];

  for (const { commit, entries } of trees) {
    const sources =
      refsByCommit
        .get(commit)
        ?.map((ref) => ref.source)
        .sort() ?? [];
    for (const source of sources) {
      for (const entry of entries) {
        const checksum = blobChecksums.get(entry.blob);
        if (checksum === undefined) {
          throw new Error(`OPS06_MIGRATION_BLOB_MISSING:${entry.blob}`);
        }
        const fileName = path.posix.basename(entry.path);
        records.push({
          source,
          id: fileName.replace(/\.sql$/, ''),
          file_name: fileName,
          path: entry.path,
          checksum,
        });
      }
    }
  }

  return {
    records,
    sources: refs.map((ref) => ref.source),
    unique_commit_count: commits.length,
    unique_blob_count: blobs.length,
    git_process_count: 1 + commits.length + Math.ceil(blobs.length / blobBatchSize),
  };
}

async function remoteRefs(cwd: string, refPrefixes: readonly string[]) {
  const output = await gitText(
    cwd,
    ['for-each-ref', '--format=%(refname:short)%09%(objectname)', ...refPrefixes],
    maxGitOutputBytes,
  );
  const refs: RemoteRef[] = [];
  for (const line of output.split(/\r?\n/)) {
    if (!line) continue;
    const separator = line.indexOf('\t');
    if (separator < 1) throw new Error('OPS06_REMOTE_REF_FORMAT_INVALID');
    const source = line.slice(0, separator);
    const commit = line.slice(separator + 1);
    if (source.endsWith('/HEAD')) continue;
    if (!/^[0-9a-f]{40,64}$/i.test(commit)) {
      throw new Error(`OPS06_REMOTE_REF_OBJECT_INVALID:${source}`);
    }
    refs.push({ source, commit });
  }
  return refs.sort((left, right) => left.source.localeCompare(right.source));
}

async function migrationTree(cwd: string, commit: string) {
  const output = await gitText(
    cwd,
    ['ls-tree', '-r', '-z', '--format=%(objectname)%x09%(path)', commit, '--', migrationsPath],
    maxGitOutputBytes,
  );
  const entries: MigrationTreeEntry[] = [];
  for (const row of output.split('\0')) {
    if (!row) continue;
    const separator = row.indexOf('\t');
    if (separator < 1) throw new Error(`OPS06_MIGRATION_TREE_FORMAT_INVALID:${commit}`);
    const blob = row.slice(0, separator);
    const filePath = row.slice(separator + 1);
    if (!filePath.endsWith('.sql')) continue;
    if (!/^[0-9a-f]{40,64}$/i.test(blob)) {
      throw new Error(`OPS06_MIGRATION_TREE_OBJECT_INVALID:${commit}`);
    }
    entries.push({ blob, path: filePath });
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

async function readBlobs(cwd: string, objectIds: string[], batchSize: number) {
  const contents = new Map<string, string>();
  for (let start = 0; start < objectIds.length; start += batchSize) {
    const batch = objectIds.slice(start, start + batchSize);
    const output = await catFileBatch(cwd, batch);
    const parsed = parseCatFileBatch(output, batch);
    for (const [objectId, content] of parsed) contents.set(objectId, content);
  }
  return contents;
}

async function catFileBatch(cwd: string, objectIds: string[]) {
  if (objectIds.length === 0) return Buffer.alloc(0);
  return await new Promise<Buffer>((resolve, reject) => {
    const child = spawn('git', ['cat-file', '--batch'], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > maxGitOutputBytes) {
        child.kill();
        fail(new Error('OPS06_GIT_CAT_FILE_OUTPUT_LIMIT_EXCEEDED'));
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', fail);
    child.on('close', (code) => {
      if (settled) return;
      if (code !== 0) {
        fail(
          new Error(
            `OPS06_GIT_CAT_FILE_FAILED:${code ?? 'unknown'}:${Buffer.concat(stderr)
              .toString('utf8')
              .trim()}`,
          ),
        );
        return;
      }
      settled = true;
      resolve(Buffer.concat(stdout));
    });
    child.stdin.on('error', fail);
    child.stdin.end(`${objectIds.join('\n')}\n`, 'utf8');
  });
}

function parseCatFileBatch(output: Buffer, expectedObjectIds: string[]) {
  const contents = new Map<string, string>();
  let offset = 0;
  for (const expectedObjectId of expectedObjectIds) {
    const headerEnd = output.indexOf(0x0a, offset);
    if (headerEnd < 0) throw new Error('OPS06_GIT_CAT_FILE_HEADER_MISSING');
    const header = output.subarray(offset, headerEnd).toString('utf8');
    const [actualObjectId, objectType, sizeText, extra] = header.split(' ');
    if (
      extra !== undefined ||
      actualObjectId !== expectedObjectId ||
      objectType !== 'blob' ||
      !/^\d+$/.test(sizeText ?? '')
    ) {
      throw new Error(`OPS06_GIT_CAT_FILE_HEADER_INVALID:${expectedObjectId}`);
    }
    const size = Number(sizeText);
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + size;
    if (contentEnd >= output.length || output[contentEnd] !== 0x0a) {
      throw new Error(`OPS06_GIT_CAT_FILE_BODY_INVALID:${expectedObjectId}`);
    }
    contents.set(expectedObjectId, output.subarray(contentStart, contentEnd).toString('utf8'));
    offset = contentEnd + 1;
  }
  if (offset !== output.length) throw new Error('OPS06_GIT_CAT_FILE_TRAILING_OUTPUT');
  return contents;
}

async function gitText(cwd: string, args: string[], maxBuffer: number) {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer,
    windowsHide: true,
  });
  return stdout;
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      const value = values[index];
      if (value === undefined) continue;
      results[index] = await mapper(value);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => await worker()),
  );
  return results;
}

function groupBy<T>(values: readonly T[], keyFor: (value: T) => string) {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyFor(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
}

function positiveInteger(value: number | undefined, fallback: number) {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
