import { createDecipheriv } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const PRIVATE_DIR = 'C:/Users/User/.onetime-w13-103-private';
const RAILWAY_PS1 = 'C:/Users/User/AppData/Roaming/npm/railway.ps1';
const HANDOFF_PATH = join(PRIVATE_DIR, 'LOGIN-HANDOFF.private.json');
const SECRETS_PATH = join(PRIVATE_DIR, 'task-secrets.private.json');
const PROJECT_ID = 'ce55ef20-1418-4ad3-aafa-f877fb992dc8';
const ENVIRONMENT_ID = 'f911acfc-e206-44df-a569-9d69d709b94b';
const TASK_SERVICE_ID = '52db1072-b4eb-450c-bec7-5151cb9a8461';

type JsonObject = Record<string, unknown>;

class SafeFailure extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

async function readJson(path: string): Promise<JsonObject> {
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as unknown;
  if (!isObject(parsed)) throw new SafeFailure('invalid_private_json');
  return parsed;
}

async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArg(name: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((entry) => entry.startsWith(prefix));
  const value = arg?.slice(prefix.length);
  if (!value) throw new SafeFailure(`${name}_arg_missing`);
  return value;
}

function optionalArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv
    .slice(2)
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length);
}

function collectReports(value: unknown, reports: JsonObject[]) {
  if (!isObject(value)) return;
  if (value.schema === 'onetime.w13_103.production_role_access_task.v1') {
    reports.push(value);
  }
  const message = value.message;
  if (typeof message === 'string' && message.trim().startsWith('{')) {
    try {
      collectReports(JSON.parse(message) as unknown, reports);
    } catch {
      // Non-JSON log messages are ignored.
    }
  }
}

function railwayLogs(deploymentId: string) {
  const output = execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      RAILWAY_PS1,
      'logs',
      '--json',
      '--lines',
      '300',
      '--project',
      PROJECT_ID,
      '--environment',
      ENVIRONMENT_ID,
      '--service',
      TASK_SERVICE_ID,
      deploymentId,
    ],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024 * 8 },
  );
  const reports: JsonObject[] = [];
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      collectReports(JSON.parse(line) as unknown, reports);
    } catch {
      // Railway can include progress lines; only structured JSON task reports matter here.
    }
  }
  return reports;
}

function decryptHandoff(keyB64: string, encrypted: JsonObject): JsonObject {
  if (encrypted.alg !== 'A256GCM') throw new SafeFailure('handoff_alg_mismatch');
  const iv = stringField(encrypted, 'iv');
  const tag = stringField(encrypted, 'tag');
  const ciphertext = stringField(encrypted, 'ciphertext');
  const key = Buffer.from(keyB64, 'base64url');
  if (key.length !== 32) throw new SafeFailure('handoff_key_invalid');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
  const parsed = JSON.parse(plaintext) as unknown;
  if (!isObject(parsed)) throw new SafeFailure('handoff_payload_invalid');
  return parsed;
}

function stringField(source: JsonObject, key: string) {
  const value = source[key];
  if (typeof value !== 'string' || value.length === 0) throw new SafeFailure(`${key}_missing`);
  return value;
}

function objectField(source: JsonObject, key: string) {
  const value = source[key];
  if (!isObject(value)) throw new SafeFailure(`${key}_missing`);
  return value;
}

function linksByRole(payload: JsonObject) {
  const links = payload.links;
  if (!Array.isArray(links)) throw new SafeFailure('handoff_links_missing');
  const mapped: Record<string, JsonObject> = {};
  for (const link of links) {
    if (!isObject(link)) continue;
    const role = link.role;
    if (typeof role === 'string') mapped[role] = link;
  }
  return mapped;
}

function sanitizedRole(role: unknown) {
  if (!isObject(role)) return null;
  return {
    role: role.role,
    operation: role.operation,
    status: role.status,
    delivery_state: role.delivery_state ?? null,
    sessions_revoked: role.sessions_revoked ?? 0,
  };
}

async function main() {
  const deploymentId = stringArg('deployment');
  const expectedMode = optionalArg('mode') ?? 'final-reset';
  const [handoff, secrets] = await Promise.all([readJson(HANDOFF_PATH), readJson(SECRETS_PATH)]);
  const reports = railwayLogs(deploymentId).filter((report) => report.mode === expectedMode);
  const report = reports.at(-1);
  if (!report) throw new SafeFailure('task_report_missing');
  const encrypted = objectField(report, 'encrypted_handoff');
  const key = stringField(secrets, 'handoff_encryption_key_b64');
  const decrypted = decryptHandoff(key, encrypted);
  const links = linksByRole(decrypted);

  for (const role of ['administrator', 'parent', 'student']) {
    const roleLink = links[role];
    if (!roleLink) continue;
    const roleHandoff = isObject(handoff[role]) ? { ...handoff[role] } : {};
    const purpose = stringField(roleLink, 'purpose');
    const url = stringField(roleLink, 'url');
    const expiresAt = stringField(roleLink, 'expires_at');
    const targetUrlField =
      purpose === 'owner_admin_invitation' || purpose === 'parent_activation'
        ? 'setup_url'
        : 'reset_url';
    handoff[role] = {
      ...roleHandoff,
      status: 'ready',
      final_purpose: purpose,
      [targetUrlField]: url,
      final_expires_at: expiresAt,
    };
  }

  const roles = Array.isArray(report.roles) ? report.roles.map(sanitizedRole).filter(Boolean) : [];
  const sessionsRevoked = Object.fromEntries(
    roles.map((role) => {
      const entry = role as JsonObject;
      return [String(entry.role), entry.sessions_revoked ?? 0];
    }),
  );
  const privateReport = {
    schema: 'onetime.w13_103.private_task_ingest.v1',
    generated_at: new Date().toISOString(),
    deployment_id: deploymentId,
    mode: expectedMode,
    status: report.status,
    blockers: report.blockers ?? [],
    roles,
    mutation_deltas: report.mutation_deltas ?? null,
    counts_after: report.counts_after ?? null,
    sessions_revoked: sessionsRevoked,
  };
  const privateReportPath = join(PRIVATE_DIR, `task-${expectedMode}.private.json`);
  await writeJson(privateReportPath, privateReport);
  handoff.status = 'PRODUCTION_ROLE_ACCESS_READY';
  handoff.updated_at = new Date().toISOString();
  handoff.deployments = {
    ...(isObject(handoff.deployments) ? handoff.deployments : {}),
    final_reset: {
      deployment_id: deploymentId,
      source_commit: '50aabf46a5fd5e9c0260ed3528e73ac7e2219d1e',
      status: report.status,
      generated_at: report.generated_at,
      mutation_deltas: report.mutation_deltas,
      sessions_revoked: sessionsRevoked,
      private_report_path: privateReportPath,
    },
  };
  await writeJson(HANDOFF_PATH, handoff);
  process.stdout.write(
    `${JSON.stringify({
      status: 'task_report_ingested',
      deployment_id: deploymentId,
      mode: expectedMode,
      task_status: report.status,
      blockers: report.blockers ?? [],
      roles,
      mutation_deltas: report.mutation_deltas ?? null,
      private_report_path: privateReportPath,
    })}\n`,
  );
}

main().catch((error: unknown) => {
  const code = error instanceof SafeFailure ? error.code : 'ingest_failed';
  process.stderr.write(`${JSON.stringify({ status: 'failed', error_code: code })}\n`);
  process.exitCode = 1;
});
