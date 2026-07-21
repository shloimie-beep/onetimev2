import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type CurrentRegistry = {
  schema_id?: string;
  schema_version?: string;
  status?: string;
  counts?: Record<string, number>;
  protected_import_paths?: Record<string, string>;
  prompts?: PromptRecord[];
  knowledge_bases?: PromptRecord[];
};

type PromptRecord = {
  file_path?: string;
  sha256?: string;
};

const repoRoot = process.cwd();
const currentPath = path.join(repoRoot, 'integrations/highlevel/registry/current.json');

const current = JSON.parse(await readFile(currentPath, 'utf8')) as CurrentRegistry;
const promptHashesChanged = await refreshHashes(current.prompts ?? []);
const knowledgeBaseHashesChanged = await refreshHashes(current.knowledge_bases ?? []);
if (promptHashesChanged || knowledgeBaseHashesChanged) {
  await writeFile(currentPath, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
  await writeFile(
    path.join(repoRoot, 'integrations/highlevel/registry/prompt-registry.yaml'),
    yaml(current.prompts ?? []),
    'utf8',
  );
  await writeFile(
    path.join(repoRoot, 'integrations/highlevel/registry/knowledge-base-registry.yaml'),
    yaml(current.knowledge_bases ?? []),
    'utf8',
  );
}

writeStdoutJson({
  schemaId: current.schema_id,
  schemaVersion: current.schema_version,
  status: current.status,
  counts: current.counts ?? {},
  currentPath: path.relative(repoRoot, currentPath).replaceAll('\\', '/'),
  protectedImportPathsRecorded: Boolean(current.protected_import_paths),
});

function writeStdoutJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function refreshHashes(records: PromptRecord[]) {
  let changed = false;
  for (const record of records) {
    if (!record.file_path) continue;
    const nextHash = sha256(await readFile(path.join(repoRoot, record.file_path), 'utf8'));
    if (record.sha256 !== nextHash) {
      record.sha256 = nextHash;
      changed = true;
    }
  }
  return changed;
}

function sha256(value: string) {
  return createHash('sha256').update(canonicalHashText(value)).digest('hex');
}

function canonicalHashText(value: string) {
  return value.replace(/\r\n/g, '\n');
}

function yaml(value: unknown) {
  return `${yamlNode(value, 0)}\n`;
}

function yamlNode(value: unknown, indent: number): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return `${spaces(indent)}[]`;
    return value
      .map((entry) => {
        if (isScalar(entry)) return `${spaces(indent)}- ${yamlScalar(entry)}`;
        return `${spaces(indent)}-\n${yamlNode(entry, indent + 2)}`;
      })
      .join('\n');
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return `${spaces(indent)}{}`;
    return entries
      .map(([key, entry]) => {
        if (isScalar(entry)) return `${spaces(indent)}${key}: ${yamlScalar(entry)}`;
        return `${spaces(indent)}${key}:\n${yamlNode(entry, indent + 2)}`;
      })
      .join('\n');
  }
  return `${spaces(indent)}${yamlScalar(value)}`;
}

function yamlScalar(value: unknown) {
  if (value === null || value === undefined) return "''";
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function isScalar(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function spaces(count: number) {
  return ' '.repeat(count);
}
