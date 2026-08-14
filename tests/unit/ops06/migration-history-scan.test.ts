import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { scanRemoteMigrationHistory } from '../../../scripts/ops06-migration-history.ts';

const execFileAsync = promisify(execFile);
const temporaryRepositories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRepositories.splice(0).map(async (directory) => {
      await rm(directory, { recursive: true, force: true });
    }),
  );
});

describe('OPS-06 remote migration history scan', () => {
  it('scans every relevant ref while batching aliases by commit and blobs by object', async () => {
    const repository = await createRepository();
    const migrationsDirectory = path.join(repository, 'packages', 'db', 'migrations');
    await mkdir(migrationsDirectory, { recursive: true });
    await writeFile(
      path.join(migrationsDirectory, '1000_history_fixture.sql'),
      'CREATE TABLE history_fixture (id integer PRIMARY KEY);\n',
      'utf8',
    );
    await git(repository, ['add', '.']);
    await git(repository, ['commit', '-m', 'first migration']);
    const originalCommit = (await git(repository, ['rev-parse', 'HEAD'])).trim();

    await writeFile(
      path.join(migrationsDirectory, '1000_history_fixture.sql'),
      'CREATE TABLE history_fixture (id bigint PRIMARY KEY);\n',
      'utf8',
    );
    await git(repository, ['commit', '-am', 'mutated migration']);
    const mutatedCommit = (await git(repository, ['rev-parse', 'HEAD'])).trim();

    const codexRefs = path.join(repository, '.git', 'refs', 'remotes', 'origin', 'codex');
    await mkdir(codexRefs, { recursive: true });
    await Promise.all(
      Array.from({ length: 271 }, async (_, index) => {
        await writeFile(
          path.join(codexRefs, `history-${String(index).padStart(3, '0')}`),
          `${originalCommit}\n`,
          'ascii',
        );
      }),
    );
    const opsRefs = path.join(repository, '.git', 'refs', 'remotes', 'origin', 'ops');
    await mkdir(opsRefs, { recursive: true });
    await writeFile(path.join(opsRefs, 'mutated'), `${mutatedCommit}\n`, 'ascii');
    const ignoredRefs = path.join(repository, '.git', 'refs', 'remotes', 'origin', 'feature');
    await mkdir(ignoredRefs, { recursive: true });
    await writeFile(path.join(ignoredRefs, 'outside-scope'), `${mutatedCommit}\n`, 'ascii');

    const scan = await scanRemoteMigrationHistory({ cwd: repository });

    expect(scan.sources).toHaveLength(272);
    expect(scan.sources).not.toContain('origin/feature/outside-scope');
    expect(scan.records).toHaveLength(272);
    expect(scan.unique_commit_count).toBe(2);
    expect(scan.unique_blob_count).toBe(2);
    expect(scan.git_process_count).toBe(4);
    expect(new Set(scan.records.map((record) => record.checksum))).toHaveProperty('size', 2);
    const originalChecksum = scan.records.find(
      (record) => record.source === 'origin/codex/history-000',
    )?.checksum;
    expect(scan.records.filter((record) => record.source === 'origin/ops/mutated')).toEqual([
      expect.objectContaining({
        id: '1000_history_fixture',
        path: 'packages/db/migrations/1000_history_fixture.sql',
      }),
    ]);
    expect(
      scan.records.find((record) => record.source === 'origin/ops/mutated')?.checksum,
    ).not.toBe(originalChecksum);
  });
});

async function createRepository() {
  const repository = await mkdtemp(path.join(tmpdir(), 'ops06-migration-history-'));
  temporaryRepositories.push(repository);
  await git(repository, ['init']);
  await git(repository, ['config', 'user.name', 'OPS06 Test']);
  await git(repository, ['config', 'user.email', 'ops06-test@example.invalid']);
  return repository;
}

async function git(repository: string, args: string[]) {
  const { stdout } = await execFileAsync('git', args, {
    cwd: repository,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  return stdout;
}
