import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildSupplyChainInventory,
  createInventoryFixtureRoot,
} from '../../scripts/w12-100/supply-chain/inventory.ts';

function writeFixture(root: string, filePath: string, contents: string): void {
  const absolutePath = path.join(root, filePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents);
}

function writeBaseFixture(root: string): void {
  writeFixture(
    root,
    'package.json',
    JSON.stringify(
      {
        name: 'fixture-app',
        version: '1.0.0',
        private: true,
        engines: { node: '>=24 <25' },
        scripts: { start: 'node --import tsx apps/web/src/server/index.ts' },
        dependencies: { express: '^5.0.0', '@vitejs/plugin-react': '^5.0.0' },
        devDependencies: { tsx: '^4.20.3', vitest: '^3.2.4' },
      },
      null,
      2,
    ),
  );
  writeFixture(
    root,
    'package-lock.json',
    JSON.stringify(
      {
        lockfileVersion: 3,
        packages: {
          '': {
            name: 'fixture-app',
            version: '1.0.0',
            dependencies: { express: '^5.0.0', '@vitejs/plugin-react': '^5.0.0' },
            devDependencies: { tsx: '^4.20.3', vitest: '^3.2.4' },
            engines: { node: '>=24 <25' },
          },
          'node_modules/express': {
            version: '5.1.0',
            resolved: 'https://registry.npmjs.org/express/-/express-5.1.0.tgz',
            integrity: 'sha512-express',
            license: 'MIT',
            engines: { node: '>=18' },
          },
          'node_modules/fixture-native': {
            version: '1.0.0',
            resolved: 'https://registry.npmjs.org/fixture-native/-/fixture-native-1.0.0.tgz',
            integrity: 'sha512-native',
            hasInstallScript: true,
            license: 'MIT',
            engines: { node: '>=20 <25' },
          },
          'node_modules/left-pad': {
            version: '1.3.0',
            resolved: 'https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz',
            integrity: 'sha512-left-pad-1',
            license: 'WTFPL',
          },
          'node_modules/example/node_modules/left-pad': {
            version: '1.1.3',
            resolved: 'https://registry.npmjs.org/left-pad/-/left-pad-1.1.3.tgz',
            integrity: 'sha512-left-pad-2',
            license: 'WTFPL',
          },
          'node_modules/old-engine': {
            version: '1.0.0',
            resolved: 'https://registry.npmjs.org/old-engine/-/old-engine-1.0.0.tgz',
            integrity: 'sha512-old',
            license: 'MIT',
            engines: { node: '<24' },
          },
          'node_modules/no-integrity': {
            version: '1.0.0',
            resolved: 'https://registry.npmjs.org/no-integrity/-/no-integrity-1.0.0.tgz',
            license: 'MIT',
          },
          'node_modules/@vitejs/plugin-react': {
            version: '5.0.0',
            resolved: 'https://registry.npmjs.org/@vitejs/plugin-react/-/plugin-react-5.0.0.tgz',
            integrity: 'sha512-vite-react',
            license: 'MIT',
          },
          'node_modules/tsx': {
            version: '4.20.3',
            resolved: 'https://registry.npmjs.org/tsx/-/tsx-4.20.3.tgz',
            integrity: 'sha512-tsx',
            dev: true,
            license: 'MIT',
          },
        },
      },
      null,
      2,
    ),
  );
  writeFixture(root, '.env.example', 'NODE_ENV=test\nDATABASE_URL=\n');
  writeFixture(
    root,
    'ops/release/ot75/environment-schema.json',
    JSON.stringify({
      environments: [{ variables: [{ name: 'OT75_EXPECTED_SOURCE_SHA' }] }],
    }),
  );
  writeFixture(
    root,
    '.github/workflows/ci.yml',
    [
      'name: CI',
      'on:',
      '  pull_request:',
      'permissions:',
      '  contents: read',
      'jobs:',
      '  verify:',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - uses: actions/checkout@v4',
      '      - uses: actions/setup-node@v4',
      '      - uses: actions/upload-artifact@v4',
      '        with:',
      '          name: fixture',
      '          path: test-results/',
    ].join('\n'),
  );
  writeFixture(root, 'Dockerfile', 'FROM node:24-alpine\nRUN npm ci\n');
}

describe('W12-100 supply-chain inventory', () => {
  it('produces deterministic dependency and workflow findings from repo-local inputs', () => {
    const root = createInventoryFixtureRoot();
    writeBaseFixture(root);

    const first = buildSupplyChainInventory({ rootDir: root });
    const second = buildSupplyChainInventory({ rootDir: root });

    expect(second).toEqual(first);
    expect(first.deterministic).toBe(true);
    expect(first.lockfile.missing_integrity_count).toBe(1);
    expect(first.lockfile.install_script_packages).toEqual([
      { name: 'fixture-native', version: '1.0.0', dev: false, optional: false },
    ]);
    expect(first.dependencies.duplicate_versions).toEqual([
      { name: 'left-pad', versions: ['1.1.3', '1.3.0'] },
    ]);
    expect(first.lockfile.node24_incompatible_packages).toEqual([
      { name: 'old-engine', version: '1.0.0', node_engine: '<24' },
    ]);
    expect(first.workflows.action_pin_summary.tag_or_branch).toBe(3);
    expect(first.findings.map((finding) => finding.id)).toContain(
      'runtime-start-imports-devdependency-tsx',
    );
    expect(first.findings.map((finding) => finding.id)).toContain(
      'docker-base-image-not-digest-pinned',
    );
  });

  it('classifies fork and secret-output workflow risks without reading secret values', () => {
    const root = createInventoryFixtureRoot();
    writeBaseFixture(root);
    writeFixture(
      root,
      '.github/workflows/risky.yml',
      [
        'name: Risky',
        'on:',
        '  pull_request_target:',
        'jobs:',
        '  risky:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - run: echo "token=${{ secrets.PRIVATE_TOKEN }}" >> "$GITHUB_OUTPUT"',
      ].join('\n'),
    );

    const report = buildSupplyChainInventory({ rootDir: root });
    const findingIds = report.findings.map((finding) => finding.id);

    expect(findingIds).toContain('pull-request-target-present');
    expect(findingIds).toContain('workflow-secret-output-risk');
    expect(report.workflows.fork_safety.pull_request_target_workflows).toEqual([
      '.github/workflows/risky.yml',
    ]);
    expect(report.env_name_alignment.secret_like_names_in_env_example).toEqual(['DATABASE_URL']);
  });
});
