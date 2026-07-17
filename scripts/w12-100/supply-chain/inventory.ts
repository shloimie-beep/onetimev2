import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
type Exploitability = 'direct' | 'conditional' | 'indirect' | 'not_exploitable_locally';

interface PackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  engines?: { node?: string };
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[];
}

interface PackageLockEntry {
  name?: string;
  version?: string;
  resolved?: string;
  integrity?: string;
  dev?: boolean;
  optional?: boolean;
  license?: string;
  engines?: { node?: string };
  hasInstallScript?: boolean;
  deprecated?: string;
}

interface PackageLock {
  lockfileVersion?: number;
  packages?: Record<string, PackageLockEntry>;
}

interface SourceFile {
  path: string;
  sha256: string;
  bytes: number;
}

interface UpgradeRecommendation {
  id: string;
  current_version: string;
  target_version: string;
  breaking_risk: 'low' | 'medium' | 'high' | 'unknown';
  affected_tests: string[];
  separate_branch_plan: string;
}

interface Finding {
  id: string;
  title: string;
  severity: Severity;
  exploitability: Exploitability;
  category: string;
  evidence: string[];
  recommendation: string;
  upgrade_recommendation_ids?: string[];
}

interface LockedPackage {
  name: string;
  version: string;
  path: string;
  dev: boolean;
  optional: boolean;
  license: string | null;
  node_engine: string | null;
  node24: 'compatible' | 'incompatible' | 'unknown';
  has_install_script: boolean;
  deprecated: boolean;
  integrity_present: boolean;
  resolved: string | null;
  local_workspace_link: boolean;
}

interface WorkflowActionUse {
  workflow: string;
  line: number;
  value: string;
  pin_type: 'sha' | 'tag_or_branch' | 'unpinned' | 'local' | 'docker';
}

interface NpmAuditSummary {
  file: string;
  present: boolean;
  vulnerabilities: Record<string, number>;
  dependency_count: number | null;
  vulnerable_packages: Array<{
    name: string;
    severity: string;
    direct: boolean;
    via_count: number;
    fix_available: string;
  }>;
}

interface InventoryOptions {
  rootDir: string;
  auditProductionPath?: string;
  auditDevelopmentPath?: string;
}

const binaryExtensions = new Set([
  '.avif',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.pdf',
  '.png',
  '.webp',
  '.woff',
  '.woff2',
  '.zip',
]);

const secretLikeNames = [
  'SECRET',
  'TOKEN',
  'PASSWORD',
  'KEY',
  'WEBHOOK',
  'PRIVATE',
  'DATABASE_URL',
];

function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function repoPath(rootDir: string, filePath: string): string {
  return normalizePath(path.relative(rootDir, filePath));
}

function readJson<T>(rootDir: string, filePath: string): T {
  return JSON.parse(readTextFile(path.join(rootDir, filePath))) as T;
}

function readTextFile(filePath: string): string {
  const buffer = readFileSync(filePath);
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.toString('utf16le').replace(/^\uFEFF/, '');
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return buffer
      .swap16()
      .toString('utf16le')
      .replace(/^\uFEFF/, '');
  }
  return buffer.toString('utf8').replace(/^\uFEFF/, '');
}

function sha256(buffer: Buffer | string): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function sourceFile(rootDir: string, relativePath: string): SourceFile | null {
  const absolutePath = path.join(rootDir, relativePath);
  if (!existsSync(absolutePath)) return null;
  const buffer = readFileSync(absolutePath);
  return {
    path: normalizePath(relativePath),
    sha256: sha256(buffer),
    bytes: buffer.byteLength,
  };
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function listFilesRecursive(rootDir: string, relativeDir = ''): string[] {
  const absoluteDir = path.join(rootDir, relativeDir);
  if (!existsSync(absoluteDir)) return [];
  const result: string[] = [];
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') continue;
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      result.push(...listFilesRecursive(rootDir, relativePath));
    } else if (entry.isFile()) {
      result.push(normalizePath(relativePath));
    }
  }
  return result.sort((a, b) => a.localeCompare(b));
}

function gitFiles(rootDir: string): string[] {
  try {
    const output = execFileSync(
      'git',
      ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      {
        cwd: rootDir,
        encoding: 'buffer',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
    return output
      .toString('utf8')
      .split('\0')
      .filter(Boolean)
      .map((filePath) => normalizePath(filePath))
      .filter((filePath) => !filePath.startsWith('node_modules/'))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return listFilesRecursive(rootDir);
  }
}

function workflowFiles(rootDir: string): string[] {
  const workflowDir = path.join(rootDir, '.github', 'workflows');
  if (!existsSync(workflowDir)) return [];
  return readdirSync(workflowDir)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map((name) => `.github/workflows/${name}`)
    .sort((a, b) => a.localeCompare(b));
}

function dockerAndRailwayFiles(rootDir: string): string[] {
  return gitFiles(rootDir).filter((filePath) => {
    const base = path.basename(filePath).toLowerCase();
    return (
      base === 'dockerfile' ||
      base.startsWith('dockerfile.') ||
      base === 'railway.json' ||
      /^railway\..+\.json$/i.test(base) ||
      base === 'nixpacks.toml' ||
      base === 'procfile'
    );
  });
}

function packageNameFromLockPath(lockPath: string): string {
  const segments = lockPath.split('/');
  const lastNodeModules = segments.lastIndexOf('node_modules');
  if (lastNodeModules === -1) return lockPath;
  const first = segments[lastNodeModules + 1] ?? lockPath;
  if (first.startsWith('@')) {
    const second = segments[lastNodeModules + 2] ?? '';
    return `${first}/${second}`;
  }
  return first;
}

function versionParts(version: string): [number, number, number] | null {
  const match = version.match(/v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

function compareVersion(left: [number, number, number], right: [number, number, number]): number {
  for (let index = 0; index < 3; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function tokenAllowsNode24(token: string): boolean | null {
  const trimmed = token.trim();
  if (!trimmed || trimmed === '-' || trimmed === 'node') return null;
  const match = trimmed.match(/^(>=|>|<=|<|=|\^|~)?\s*v?(\d+(?:\.\d+){0,2}|x)$/i);
  if (!match) return null;
  const operator = match[1] ?? '=';
  const version = match[2];
  if (!version) return null;
  if (version.toLowerCase() === 'x') return true;
  const target = versionParts(version);
  if (!target) return null;
  const node24: [number, number, number] = [24, 13, 0];
  if (operator === '>=') return compareVersion(node24, target) >= 0;
  if (operator === '>') return compareVersion(node24, target) > 0;
  if (operator === '<=') return compareVersion(node24, target) <= 0;
  if (operator === '<') return compareVersion(node24, target) < 0;
  if (operator === '^' || operator === '~') return target[0] === 24;
  return target[0] === 24;
}

function node24Compatibility(
  range: string | null | undefined,
): 'compatible' | 'incompatible' | 'unknown' {
  if (!range) return 'unknown';
  const clauses = range.split('||').map((clause) => clause.trim());
  let sawKnown = false;
  for (const clause of clauses) {
    const rawTokens = clause.replace(/[(),]/g, ' ').split(/\s+/).filter(Boolean);
    const tokens: string[] = [];
    for (let index = 0; index < rawTokens.length; index += 1) {
      const token = rawTokens[index] ?? '';
      const next = rawTokens[index + 1] ?? '';
      if (/^(>=|>|<=|<|=|\^|~)$/.test(token) && next) {
        tokens.push(`${token}${next}`);
        index += 1;
      } else {
        tokens.push(token);
      }
    }
    const known = tokens
      .map((token) => tokenAllowsNode24(token))
      .filter((result): result is boolean => result !== null);
    if (known.length > 0) sawKnown = true;
    if (known.length > 0 && known.every(Boolean)) return 'compatible';
  }
  return sawKnown ? 'incompatible' : 'unknown';
}

function isLocalWorkspaceLink(entry: PackageLockEntry): boolean {
  return Boolean(entry.resolved && !/^[a-z][a-z0-9+.-]*:\/\//i.test(entry.resolved));
}

function lockedPackages(lock: PackageLock): LockedPackage[] {
  const packages = lock.packages ?? {};
  return Object.entries(packages)
    .filter(([lockPath]) => lockPath.startsWith('node_modules/'))
    .map(([lockPath, entry]) => ({
      name: entry.name ?? packageNameFromLockPath(lockPath),
      version: entry.version ?? 'unknown',
      path: lockPath,
      dev: entry.dev === true,
      optional: entry.optional === true,
      license: entry.license ?? null,
      node_engine: entry.engines?.node ?? null,
      node24: node24Compatibility(entry.engines?.node),
      has_install_script: entry.hasInstallScript === true,
      deprecated: Boolean(entry.deprecated),
      integrity_present: Boolean(entry.integrity),
      resolved: entry.resolved ?? null,
      local_workspace_link: isLocalWorkspaceLink(entry),
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path));
}

function directDependencyExposure(pkg: PackageJson, locked: LockedPackage[]) {
  const lockedByName = new Map(locked.map((entry) => [entry.name, entry]));
  const runtime = Object.entries(pkg.dependencies ?? {})
    .map(([name, range]) => ({
      name,
      declared_range: range,
      locked_version: lockedByName.get(name)?.version ?? 'not_locked',
      license: lockedByName.get(name)?.license ?? null,
      has_install_script: lockedByName.get(name)?.has_install_script ?? false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const development = Object.entries(pkg.devDependencies ?? {})
    .map(([name, range]) => ({
      name,
      declared_range: range,
      locked_version: lockedByName.get(name)?.version ?? 'not_locked',
      license: lockedByName.get(name)?.license ?? null,
      has_install_script: lockedByName.get(name)?.has_install_script ?? false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { runtime, development };
}

function duplicatePackages(locked: LockedPackage[]) {
  const versionsByName = new Map<string, Set<string>>();
  for (const entry of locked) {
    if (!versionsByName.has(entry.name)) versionsByName.set(entry.name, new Set());
    versionsByName.get(entry.name)?.add(entry.version);
  }
  return [...versionsByName.entries()]
    .map(([name, versions]) => ({ name, versions: [...versions].sort() }))
    .filter((entry) => entry.versions.length > 1)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function licenseSummary(locked: LockedPackage[]) {
  const counts = new Map<string, number>();
  const missing: string[] = [];
  const restricted: Array<{ name: string; version: string; license: string }> = [];
  for (const entry of locked) {
    const license = entry.license ?? 'UNSPECIFIED';
    counts.set(license, (counts.get(license) ?? 0) + 1);
    if (!entry.license) missing.push(`${entry.name}@${entry.version}`);
    if (/\b(AGPL|GPL|LGPL|SSPL)\b/i.test(license)) {
      restricted.push({ name: entry.name, version: entry.version, license });
    }
  }
  return {
    counts: [...counts.entries()]
      .map(([license, count]) => ({ license, count }))
      .sort((a, b) => a.license.localeCompare(b.license)),
    missing,
    restricted,
  };
}

function workflowLineRecords(
  filePath: string,
  text: string,
): Array<{ line: number; text: string }> {
  return text.split(/\r?\n/).map((lineText, index) => ({ line: index + 1, text: lineText }));
}

function classifyActionPin(value: string): WorkflowActionUse['pin_type'] {
  if (value.startsWith('./') || value.startsWith('../')) return 'local';
  if (value.startsWith('docker://')) return 'docker';
  const atIndex = value.lastIndexOf('@');
  if (atIndex === -1) return 'unpinned';
  const ref = value.slice(atIndex + 1);
  return /^[a-f0-9]{40}$/i.test(ref) ? 'sha' : 'tag_or_branch';
}

function analyzeWorkflow(rootDir: string, filePath: string) {
  const text = readTextFile(path.join(rootDir, filePath));
  const lines = workflowLineRecords(filePath, text);
  const uses: WorkflowActionUse[] = [];
  const secretOutputRisks: Array<{ line: number; text: string }> = [];
  const artifactUploads: Array<{ line: number; retention_days: number | null }> = [];
  const permissions = {
    has_top_level_permissions: /^permissions:/m.test(text),
    broad_write_lines: lines
      .filter(({ text: lineText }) =>
        /^\s*(write-all|contents:\s*write|id-token:\s*write|actions:\s*write)\b/i.test(lineText),
      )
      .map(({ line, text: lineText }) => ({ line, text: lineText.trim() })),
  };

  for (const record of lines) {
    const usesMatch = record.text.match(/\buses:\s*([^#\s]+)/);
    if (usesMatch) {
      const actionValue = usesMatch[1];
      if (!actionValue) continue;
      const value = actionValue.replace(/^['"]|['"]$/g, '');
      uses.push({
        workflow: filePath,
        line: record.line,
        value,
        pin_type: classifyActionPin(value),
      });
      if (value.startsWith('actions/upload-artifact@')) {
        const window = lines.slice(record.line - 1, record.line + 20);
        const retention = window
          .map(({ text: lineText }) => lineText.match(/retention-days:\s*(\d+)/)?.[1])
          .find((valueOrUndefined) => valueOrUndefined !== undefined);
        artifactUploads.push({
          line: record.line,
          retention_days: retention ? Number(retention) : null,
        });
      }
    }

    if (
      record.text.includes('${{ secrets.') &&
      /\b(echo|printf|tee|GITHUB_OUTPUT|GITHUB_STEP_SUMMARY)\b/i.test(record.text)
    ) {
      secretOutputRisks.push({ line: record.line, text: record.text.trim() });
    }
  }

  return {
    path: filePath,
    sha256: sha256(text),
    triggers: {
      pull_request: /^\s*pull_request:/m.test(text),
      pull_request_target: /^\s*pull_request_target:/m.test(text),
      workflow_dispatch: /^\s*workflow_dispatch:/m.test(text),
      push: /^\s*push:/m.test(text),
    },
    permissions,
    action_uses: uses,
    artifact_uploads: artifactUploads,
    secret_output_risks: secretOutputRisks,
  };
}

function parseEnvExample(rootDir: string): string[] {
  const filePath = path.join(rootDir, '.env.example');
  if (!existsSync(filePath)) return [];
  return sortedUnique(
    readTextFile(filePath)
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Z0-9_]+)=/)?.[1])
      .filter((name): name is string => Boolean(name)),
  );
}

function schemaEnvNames(rootDir: string): string[] {
  const filePath = 'ops/release/ot75/environment-schema.json';
  if (!existsSync(path.join(rootDir, filePath))) return [];
  const schema = readJson<{
    environments?: Array<{ variables?: Array<{ name?: string }> }>;
  }>(rootDir, filePath);
  return sortedUnique(
    (schema.environments ?? []).flatMap((environment) =>
      (environment.variables ?? []).map((variable) => variable.name ?? ''),
    ),
  ).filter(Boolean);
}

function codeEnvNames(rootDir: string): string[] {
  const names: string[] = [];
  const files = gitFiles(rootDir).filter(
    (filePath) =>
      /^(apps|packages|scripts|tests)\//.test(filePath) &&
      /\.(ts|tsx|js|mjs)$/.test(filePath) &&
      !filePath.startsWith('scripts/w12-100/supply-chain/'),
  );
  const envNamePattern = /\b(?:process\.env|env)\.([A-Z][A-Z0-9_]+)/g;
  for (const filePath of files) {
    const text = readTextFile(path.join(rootDir, filePath));
    let match = envNamePattern.exec(text);
    while (match) {
      const name = match[1];
      if (name) names.push(name);
      match = envNamePattern.exec(text);
    }
  }
  return sortedUnique(names);
}

function summarizeAuditFile(
  rootDir: string,
  relativePath: string | undefined,
): NpmAuditSummary | null {
  if (!relativePath) return null;
  const absolutePath = path.resolve(rootDir, relativePath);
  if (!existsSync(absolutePath)) {
    return {
      file: normalizePath(relativePath),
      present: false,
      vulnerabilities: {},
      dependency_count: null,
      vulnerable_packages: [],
    };
  }
  const parsed = JSON.parse(readTextFile(absolutePath)) as {
    metadata?: {
      vulnerabilities?: Record<string, number>;
      dependencies?: { total?: number };
    };
    vulnerabilities?: Record<
      string,
      {
        severity?: string;
        isDirect?: boolean;
        via?: unknown[];
        fixAvailable?: boolean | { name?: string; version?: string; isSemVerMajor?: boolean };
      }
    >;
  };
  return {
    file: repoPath(rootDir, absolutePath),
    present: true,
    vulnerabilities: parsed.metadata?.vulnerabilities ?? {},
    dependency_count: parsed.metadata?.dependencies?.total ?? null,
    vulnerable_packages: Object.entries(parsed.vulnerabilities ?? {})
      .map(([name, vulnerability]) => {
        const fix = vulnerability.fixAvailable;
        const fixAvailable =
          typeof fix === 'object' && fix
            ? `${fix.name ?? name}@${fix.version ?? 'unknown'}${
                fix.isSemVerMajor ? ' (semver-major)' : ''
              }`
            : String(fix ?? false);
        return {
          name,
          severity: vulnerability.severity ?? 'unknown',
          direct: vulnerability.isDirect === true,
          via_count: vulnerability.via?.length ?? 0,
          fix_available: fixAvailable,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function inspectBuildDescriptors(rootDir: string) {
  return dockerAndRailwayFiles(rootDir).map((filePath) => {
    const text = readTextFile(path.join(rootDir, filePath));
    const fromImages = text
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*FROM\s+([^\s]+)/i)?.[1])
      .filter((value): value is string => Boolean(value));
    return {
      path: filePath,
      sha256: sha256(text),
      from_images: fromImages,
      digest_pinned_images: fromImages.filter((image) => image.includes('@sha256:')),
      npm_ci_lines: text
        .split(/\r?\n/)
        .map((line, index) => ({ line: index + 1, text: line.trim() }))
        .filter((line) => /\bnpm\s+ci\b/.test(line.text)),
      start_command_mentions_tsx: text.includes('--import') && text.includes('tsx'),
    };
  });
}

function trackedBinaryEvidence(rootDir: string) {
  return gitFiles(rootDir)
    .filter((filePath) => binaryExtensions.has(path.extname(filePath).toLowerCase()))
    .map((filePath) => {
      const absolutePath = path.join(rootDir, filePath);
      return {
        path: filePath,
        bytes: existsSync(absolutePath) ? statSync(absolutePath).size : 0,
      };
    })
    .sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));
}

function secretLikeEnvNames(names: string[]) {
  return names.filter((name) => secretLikeNames.some((marker) => name.includes(marker)));
}

function addFinding(findings: Finding[], finding: Finding): void {
  findings.push(finding);
}

export function buildSupplyChainInventory(options: InventoryOptions) {
  const rootDir = options.rootDir;
  const pkg = readJson<PackageJson>(rootDir, 'package.json');
  const lock = readJson<PackageLock>(rootDir, 'package-lock.json');
  const locked = lockedPackages(lock);
  const directExposure = directDependencyExposure(pkg, locked);
  const duplicates = duplicatePackages(locked);
  const licenses = licenseSummary(locked);
  const workflows = workflowFiles(rootDir).map((filePath) => analyzeWorkflow(rootDir, filePath));
  const buildDescriptors = inspectBuildDescriptors(rootDir);
  const envExampleNames = parseEnvExample(rootDir);
  const schemaNames = schemaEnvNames(rootDir);
  const codeNames = codeEnvNames(rootDir);
  const binaryEvidence = trackedBinaryEvidence(rootDir);
  const auditProduction = summarizeAuditFile(rootDir, options.auditProductionPath);
  const auditDevelopment = summarizeAuditFile(rootDir, options.auditDevelopmentPath);
  const sourceFiles = [
    sourceFile(rootDir, 'package.json'),
    sourceFile(rootDir, 'package-lock.json'),
    sourceFile(rootDir, '.env.example'),
    sourceFile(rootDir, 'ops/release/ot75/environment-schema.json'),
    ...workflowFiles(rootDir).map((filePath) => sourceFile(rootDir, filePath)),
    ...dockerAndRailwayFiles(rootDir).map((filePath) => sourceFile(rootDir, filePath)),
  ].filter((entry): entry is SourceFile => entry !== null);

  const findings: Finding[] = [];
  const upgradeRecommendations: UpgradeRecommendation[] = [];
  const missingIntegrity = locked.filter(
    (entry) => !entry.integrity_present && !entry.local_workspace_link,
  );
  const installScriptPackages = locked.filter((entry) => entry.has_install_script);
  const deprecatedPackages = locked.filter((entry) => entry.deprecated);
  const incompatibleNodePackages = locked.filter((entry) => entry.node24 === 'incompatible');
  const mutableActions = workflows.flatMap((workflow) =>
    workflow.action_uses.filter((action) => action.pin_type === 'tag_or_branch'),
  );
  const unpinnedActions = workflows.flatMap((workflow) =>
    workflow.action_uses.filter((action) => action.pin_type === 'unpinned'),
  );
  const missingRetention = workflows.flatMap((workflow) =>
    workflow.artifact_uploads
      .filter((artifact) => artifact.retention_days === null)
      .map((artifact) => `${workflow.path}:${artifact.line}`),
  );
  const pullRequestTargetWorkflows = workflows.filter(
    (workflow) => workflow.triggers.pull_request_target,
  );
  const secretOutputRiskLines = workflows.flatMap((workflow) =>
    workflow.secret_output_risks.map((risk) => `${workflow.path}:${risk.line}`),
  );
  const broadPermissionLines = workflows.flatMap((workflow) =>
    workflow.permissions.broad_write_lines.map((line) => `${workflow.path}:${line.line}`),
  );
  const workflowsMissingPermissions = workflows.filter(
    (workflow) => !workflow.permissions.has_top_level_permissions,
  );
  const unpinnedBaseImages = buildDescriptors.flatMap((descriptor) =>
    descriptor.from_images
      .filter((image) => !image.includes('@sha256:'))
      .map((image) => `${descriptor.path}:${image}`),
  );
  const runtimeUsesTsx =
    (pkg.scripts?.start?.includes('--import tsx') ?? false) ||
    buildDescriptors.some((descriptor) => descriptor.start_command_mentions_tsx);
  const tsxRuntimeOnlyInDev =
    runtimeUsesTsx && !pkg.dependencies?.tsx && Boolean(pkg.devDependencies?.tsx);
  const sbomFiles = gitFiles(rootDir).filter((filePath) =>
    /(?:^|\/)(?:SBOM\.(?:cdx|spdx)\.json|.*\.sbom\.(?:cdx|spdx)\.json)$/i.test(filePath),
  );
  const sbomResultFiles = gitFiles(rootDir).filter((filePath) =>
    /(?:^|\/)SBOM-GENERATION-RESULT\.json$/i.test(filePath),
  );
  const runtimeBuildToolDeps = directExposure.runtime.filter((entry) =>
    ['@vitejs/plugin-react', 'vite', 'typescript', 'tsx', 'vitest', 'eslint', 'prettier'].includes(
      entry.name,
    ),
  );
  const schemaNotInExample = schemaNames.filter((name) => !envExampleNames.includes(name));
  const codeNotInExample = codeNames.filter((name) => !envExampleNames.includes(name));
  const exampleNotInCodeOrSchema = envExampleNames.filter(
    (name) => !codeNames.includes(name) && !schemaNames.includes(name),
  );

  if (missingIntegrity.length > 0) {
    addFinding(findings, {
      id: 'npm-lock-missing-integrity',
      title: 'Lockfile packages missing integrity hashes',
      severity: 'high',
      exploitability: 'conditional',
      category: 'npm_lockfile_integrity',
      evidence: missingIntegrity.map((entry) => `${entry.name}@${entry.version}`),
      recommendation:
        'Regenerate the lockfile in a dedicated dependency branch and require review.',
    });
  }

  if (installScriptPackages.length > 0) {
    addFinding(findings, {
      id: 'npm-install-scripts-present',
      title: 'npm install/build scripts execute during dependency install',
      severity: 'medium',
      exploitability: 'conditional',
      category: 'install_script_behavior',
      evidence: installScriptPackages.map((entry) => `${entry.name}@${entry.version}`),
      recommendation:
        'Keep npm ci locked, review install-script packages on upgrade, and consider isolated build attestations.',
    });
  }

  if (duplicates.length > 0) {
    addFinding(findings, {
      id: 'duplicate-transitive-dependencies',
      title: 'Duplicate dependency versions increase review and patch surface',
      severity: 'low',
      exploitability: 'indirect',
      category: 'duplicate_dependencies',
      evidence: duplicates.map((entry) => `${entry.name}: ${entry.versions.join(', ')}`),
      recommendation:
        'Track duplicates during normal dependency refreshes; do not bulk-dedupe in launch lanes.',
    });
  }

  if (deprecatedPackages.length > 0) {
    addFinding(findings, {
      id: 'deprecated-lockfile-packages',
      title: 'Deprecated packages are present in the lockfile',
      severity: 'medium',
      exploitability: 'indirect',
      category: 'abandoned_dependencies',
      evidence: deprecatedPackages.map((entry) => `${entry.name}@${entry.version}`),
      recommendation:
        'Replace deprecated dependencies through focused upstream or direct dependency upgrades.',
    });
  }

  if (licenses.restricted.length > 0 || licenses.missing.length > 0) {
    addFinding(findings, {
      id: 'license-review-required',
      title: 'License inventory contains copyleft-family or unspecified entries',
      severity: 'low',
      exploitability: 'indirect',
      category: 'licenses',
      evidence: [
        `restricted_license_entries=${licenses.restricted.length}`,
        `missing_license_entries=${licenses.missing.length}`,
      ],
      recommendation:
        'Review Sharp/libvips LGPL obligations and add/document workspace package license metadata in a legal/compliance branch.',
    });
  }

  if (incompatibleNodePackages.length > 0) {
    addFinding(findings, {
      id: 'node24-engine-incompatibility',
      title: 'Some locked packages declare Node engines that do not include Node 24',
      severity: 'medium',
      exploitability: 'not_exploitable_locally',
      category: 'node24_compatibility',
      evidence: incompatibleNodePackages.map(
        (entry) => `${entry.name}@${entry.version} engines.node=${entry.node_engine}`,
      ),
      recommendation:
        'Upgrade or replace incompatible packages in a dependency branch with Node 24 CI proof.',
    });
  }

  if (mutableActions.length > 0 || unpinnedActions.length > 0) {
    const currentActions = sortedUnique(
      [...mutableActions, ...unpinnedActions]
        .filter((action) => !action.value.startsWith('actions/cache@'))
        .map((action) => action.value),
    );
    for (const value of currentActions) {
      upgradeRecommendations.push({
        id: `pin-${value.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
        current_version: value,
        target_version: `${value.split('@')[0]}@<reviewed-full-length-commit-sha>`,
        breaking_risk: 'low',
        affected_tests: ['GitHub Actions CI workflows', 'npm run secret:scan', 'npm run test'],
        separate_branch_plan:
          'Create a workflow-hardening branch that pins each action tag to a reviewed SHA.',
      });
    }
    addFinding(findings, {
      id: 'github-actions-not-sha-pinned',
      title: 'GitHub Actions use mutable tags or unpinned refs',
      severity: 'medium',
      exploitability: 'conditional',
      category: 'action_version_pinning',
      evidence: [...mutableActions, ...unpinnedActions].map(
        (action) => `${action.workflow}:${action.line} ${action.value} (${action.pin_type})`,
      ),
      recommendation:
        'Pin third-party GitHub Actions to reviewed full-length SHAs in a dedicated CI branch.',
      upgrade_recommendation_ids: upgradeRecommendations.map((entry) => entry.id),
    });
  }

  if (missingRetention.length > 0) {
    addFinding(findings, {
      id: 'artifact-retention-missing',
      title: 'Workflow artifact uploads missing explicit retention',
      severity: 'low',
      exploitability: 'indirect',
      category: 'artifact_retention',
      evidence: missingRetention,
      recommendation: 'Set short explicit retention-days for every upload-artifact step.',
    });
  }

  if (pullRequestTargetWorkflows.length > 0) {
    addFinding(findings, {
      id: 'pull-request-target-present',
      title: 'pull_request_target workflows require fork-safety review',
      severity: 'high',
      exploitability: 'conditional',
      category: 'pull_request_fork_safety',
      evidence: pullRequestTargetWorkflows.map((workflow) => workflow.path),
      recommendation:
        'Avoid checking out untrusted fork code in privileged pull_request_target contexts.',
    });
  }

  if (secretOutputRiskLines.length > 0) {
    addFinding(findings, {
      id: 'workflow-secret-output-risk',
      title: 'Workflow output may expose secret contexts',
      severity: 'high',
      exploitability: 'conditional',
      category: 'secret_exposure_through_workflow_output',
      evidence: secretOutputRiskLines,
      recommendation:
        'Never echo secrets or derived secret values to logs, summaries, or GITHUB_OUTPUT.',
    });
  }

  if (broadPermissionLines.length > 0 || workflowsMissingPermissions.length > 0) {
    addFinding(findings, {
      id: 'workflow-permissions-review',
      title: 'Workflow permissions need least-privilege review',
      severity: 'medium',
      exploitability: 'conditional',
      category: 'github_actions_permissions',
      evidence: [
        ...broadPermissionLines,
        ...workflowsMissingPermissions.map(
          (workflow) => `${workflow.path}: missing top-level permissions`,
        ),
      ],
      recommendation:
        'Keep top-level permissions explicit and read-only unless a job proves a write need.',
    });
  }

  if (unpinnedBaseImages.length > 0) {
    upgradeRecommendations.push({
      id: 'pin-node-24-alpine-digest',
      current_version: sortedUnique(
        unpinnedBaseImages.map((entry) => entry.split(':').slice(1).join(':')),
      ).join(', '),
      target_version: '<each-base-image>@sha256:<reviewed-digest>',
      breaking_risk: 'medium',
      affected_tests: [
        'npm run build',
        'npm run e2e',
        'Railway staging smoke in a non-production lane',
      ],
      separate_branch_plan:
        'Create a Docker reproducibility branch that resolves and reviews each base image digest.',
    });
    addFinding(findings, {
      id: 'docker-base-image-not-digest-pinned',
      title: 'Docker base images are tag-pinned, not digest-pinned',
      severity: 'medium',
      exploitability: 'conditional',
      category: 'docker_railway_reproducibility',
      evidence: unpinnedBaseImages,
      recommendation:
        'Pin Docker base images to reviewed sha256 digests after compatibility smoke tests.',
      upgrade_recommendation_ids: ['pin-node-24-alpine-digest'],
    });
  }

  if (tsxRuntimeOnlyInDev) {
    addFinding(findings, {
      id: 'runtime-start-imports-devdependency-tsx',
      title: 'Runtime start path imports tsx while tsx is declared as a dev dependency',
      severity: 'medium',
      exploitability: 'not_exploitable_locally',
      category: 'runtime_dependency_minimization',
      evidence: [
        `package.json start=${pkg.scripts?.start ?? ''}`,
        'scripts/railway-start.mjs imports tsx',
        `devDependencies.tsx=${pkg.devDependencies?.tsx ?? 'missing'}`,
      ],
      recommendation:
        'In a separate runtime branch, either compile server/worker JavaScript for production or classify tsx as a runtime dependency and prove production-install boot.',
    });
  }

  if (runtimeBuildToolDeps.length > 0) {
    addFinding(findings, {
      id: 'runtime-dependencies-include-build-tools',
      title: 'Runtime dependencies include build-only candidates',
      severity: 'low',
      exploitability: 'indirect',
      category: 'runtime_dependency_minimization',
      evidence: runtimeBuildToolDeps.map((entry) => `${entry.name}@${entry.locked_version}`),
      recommendation:
        'Review whether build-only packages can move to devDependencies after server/runtime boot no longer needs them.',
    });
  }

  if (sbomFiles.length === 0) {
    addFinding(findings, {
      id: 'sbom-generation-blocked-or-missing',
      title: 'SBOM generation is blocked or no committed SBOM output was found',
      severity: 'medium',
      exploitability: 'indirect',
      category: 'sbom_generation',
      evidence:
        sbomResultFiles.length > 0
          ? sbomResultFiles
          : ['No tracked CycloneDX/SPDX SBOM file was found.'],
      recommendation:
        'Fix npm SBOM package-url blockers or add a CI-compatible SBOM generator in a dedicated hardening branch.',
    });
  }

  if (schemaNotInExample.length > 0 || codeNotInExample.length > 0) {
    addFinding(findings, {
      id: 'env-example-name-drift',
      title: '.env.example does not cover every schema/code-referenced environment name',
      severity: 'low',
      exploitability: 'indirect',
      category: 'env_example_config_schema_drift',
      evidence: [
        `schema_not_in_env_example=${schemaNotInExample.length}`,
        `code_not_in_env_example=${codeNotInExample.length}`,
      ],
      recommendation:
        'Update .env.example names in a config-doc branch after owners confirm which test/local names should be documented.',
    });
  }

  if (binaryEvidence.length > 0) {
    addFinding(findings, {
      id: 'tracked-binary-evidence-growth',
      title: 'Tracked binary evidence and media increase repository growth pressure',
      severity: 'low',
      exploitability: 'not_exploitable_locally',
      category: 'generated_evidence_and_binary_growth',
      evidence: [
        `binary_file_count=${binaryEvidence.length}`,
        `largest=${binaryEvidence[0]?.path ?? 'none'}:${binaryEvidence[0]?.bytes ?? 0}`,
      ],
      recommendation:
        'Keep launch evidence summarized in JSON/Markdown and move bulky screenshots/archives to short-retention artifacts where possible.',
    });
  }

  addFinding(findings, {
    id: 'branch-protection-not-repo-local',
    title: 'Branch protection assumptions are not fully represented in repository files',
    severity: 'info',
    exploitability: 'not_exploitable_locally',
    category: 'branch_protection_assumptions',
    evidence: [
      'Repository workflows can prove CI intent, but required checks/reviews/admin bypass rules live in GitHub settings.',
    ],
    recommendation:
      'Verify integration and main branch protection in GitHub settings before launch; record required checks and bypass policy.',
  });

  return {
    schema_version: 'onetime.w12_100_12.supply_chain_inventory.v1',
    deterministic: true,
    repository: pkg.name ?? 'unknown',
    root_package: {
      name: pkg.name ?? null,
      version: pkg.version ?? null,
      private: pkg.private === true,
      node_engine: pkg.engines?.node ?? null,
      node24: node24Compatibility(pkg.engines?.node),
      script_names: Object.keys(pkg.scripts ?? {}).sort(),
    },
    source_files: sourceFiles.sort((a, b) => a.path.localeCompare(b.path)),
    lockfile: {
      lockfile_version: lock.lockfileVersion ?? null,
      package_count: locked.length,
      missing_integrity_count: missingIntegrity.length,
      non_registry_resolved: locked
        .filter(
          (entry) =>
            entry.resolved &&
            !entry.local_workspace_link &&
            !entry.resolved.startsWith('https://registry.npmjs.org/'),
        )
        .map((entry) => `${entry.name}@${entry.version}:${entry.resolved}`)
        .sort(),
      local_workspace_links: locked
        .filter((entry) => entry.local_workspace_link)
        .map((entry) => `${entry.name}:${entry.resolved}`)
        .sort(),
      install_script_packages: installScriptPackages.map((entry) => ({
        name: entry.name,
        version: entry.version,
        dev: entry.dev,
        optional: entry.optional,
      })),
      deprecated_packages: deprecatedPackages.map((entry) => ({
        name: entry.name,
        version: entry.version,
      })),
      node24_incompatible_packages: incompatibleNodePackages.map((entry) => ({
        name: entry.name,
        version: entry.version,
        node_engine: entry.node_engine,
      })),
    },
    dependencies: {
      direct_exposure: directExposure,
      duplicate_versions: duplicates,
      license_summary: licenses,
      package_scope_counts: {
        runtime_direct: Object.keys(pkg.dependencies ?? {}).length,
        development_direct: Object.keys(pkg.devDependencies ?? {}).length,
        transitive_total: locked.length,
        transitive_dev_marked: locked.filter((entry) => entry.dev).length,
        transitive_optional_marked: locked.filter((entry) => entry.optional).length,
      },
    },
    vulnerability_reports: {
      production: auditProduction,
      development: auditDevelopment,
    },
    workflows: {
      files: workflows,
      action_pin_summary: {
        sha: workflows.flatMap((workflow) =>
          workflow.action_uses.filter((action) => action.pin_type === 'sha'),
        ).length,
        tag_or_branch: mutableActions.length,
        unpinned: unpinnedActions.length,
        local: workflows.flatMap((workflow) =>
          workflow.action_uses.filter((action) => action.pin_type === 'local'),
        ).length,
        docker: workflows.flatMap((workflow) =>
          workflow.action_uses.filter((action) => action.pin_type === 'docker'),
        ).length,
      },
      fork_safety: {
        pull_request_target_workflows: pullRequestTargetWorkflows.map((workflow) => workflow.path),
        secret_output_risk_lines: secretOutputRiskLines,
      },
    },
    build_reproducibility: {
      descriptors: buildDescriptors,
      docker_base_images_digest_pinned: unpinnedBaseImages.length === 0,
      runtime_start_imports_tsx: runtimeUsesTsx,
      tsx_declared_as_runtime_dependency: Boolean(pkg.dependencies?.tsx),
    },
    sbom_generation: {
      tracked_sbom_files: sbomFiles,
      generation_result_files: sbomResultFiles,
      npm_sbom_recommended_command: 'npm sbom --sbom-format cyclonedx',
    },
    env_name_alignment: {
      env_example_count: envExampleNames.length,
      schema_name_count: schemaNames.length,
      code_reference_count: codeNames.length,
      schema_not_in_env_example: schemaNotInExample,
      code_not_in_env_example: codeNotInExample,
      env_example_not_seen_in_code_or_schema: exampleNotInCodeOrSchema,
      secret_like_names_in_env_example: secretLikeEnvNames(envExampleNames),
    },
    generated_evidence_and_binary_growth: {
      tracked_binary_file_count: binaryEvidence.length,
      tracked_binary_total_bytes: binaryEvidence.reduce((sum, entry) => sum + entry.bytes, 0),
      largest_tracked_binary_files: binaryEvidence.slice(0, 20),
    },
    findings: findings.sort((a, b) => a.id.localeCompare(b.id)),
    recommended_upgrades: upgradeRecommendations.sort((a, b) => a.id.localeCompare(b.id)),
    safety_counters: {
      external_actions_sent: 0,
      provider_resource_mutations: 0,
      production_database_reads: 0,
      production_database_writes: 0,
    },
  };
}

export function writeInventory(options: InventoryOptions & { outPath: string }): void {
  const report = buildSupplyChainInventory(options);
  writeFileSync(
    path.resolve(options.rootDir, options.outPath),
    `${JSON.stringify(report, null, 2)}\n`,
  );
}

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outPath = argValue('--out');
  const options: InventoryOptions = {
    rootDir: process.cwd(),
  };
  const auditProductionPath = argValue('--audit-production');
  const auditDevelopmentPath = argValue('--audit-development');
  if (auditProductionPath) options.auditProductionPath = auditProductionPath;
  if (auditDevelopmentPath) options.auditDevelopmentPath = auditDevelopmentPath;
  if (outPath) {
    writeInventory({ ...options, outPath });
  } else {
    const report = buildSupplyChainInventory(options);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }
}

export function createInventoryFixtureRoot(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'onetime-supply-chain-inventory-'));
}
