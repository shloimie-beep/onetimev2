import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const keyholderDir =
  process.env.BNA_KEYHOLDER_DIR ?? join(process.env.USERPROFILE ?? '.', 'BNA-Keyholder');

const requiredInputs = [
  {
    name: 'google_drive_folder_id',
    path: join(keyholderDir, 'google-drive-folder-id.txt'),
    provider: 'drive',
  },
  {
    name: 'google_drive_service_account',
    path: join(keyholderDir, 'google-drive-service-account.json'),
    provider: 'drive',
  },
  {
    name: 'google_drive_oauth',
    path: join(keyholderDir, 'google-drive-oauth.json'),
    provider: 'drive',
    optional: true,
  },
  {
    name: 'vimeo_access_token',
    path: join(keyholderDir, 'vimeo-access-token.txt'),
    provider: 'vimeo',
  },
  {
    name: 'vimeo_test_project_uri',
    path: join(keyholderDir, 'vimeo-test-project-uri.txt'),
    provider: 'vimeo',
  },
  {
    name: 'vimeo_webhook_secret',
    path: join(keyholderDir, 'vimeo-webhook-secret.txt'),
    provider: 'vimeo',
  },
  { name: 'zoom_account_id', path: join(keyholderDir, 'zoom-account-id.txt'), provider: 'zoom' },
  { name: 'zoom_client_id', path: join(keyholderDir, 'zoom-client-id.txt'), provider: 'zoom' },
  {
    name: 'zoom_client_secret',
    path: join(keyholderDir, 'zoom-client-secret.txt'),
    provider: 'zoom',
  },
  {
    name: 'zoom_webhook_secret',
    path: join(keyholderDir, 'zoom-webhook-secret.txt'),
    provider: 'zoom',
  },
  { name: 'zoom_sdk_key', path: join(keyholderDir, 'zoom-sdk-key.txt'), provider: 'zoom' },
  {
    name: 'zoom_sdk_secret',
    path: join(keyholderDir, 'zoom-sdk-secret.txt'),
    provider: 'zoom',
  },
  { name: 'openai_api_key', path: join(keyholderDir, 'openai-api-key.txt'), provider: 'openai' },
] as const;

type ProviderName = (typeof requiredInputs)[number]['provider'];

function inspectPath(path: string) {
  if (!existsSync(path)) return { present: false, bytes: 0, sha256_prefix: null };
  const stat = statSync(path);
  if (!stat.isFile()) return { present: false, bytes: 0, sha256_prefix: null };
  const content = readFileSync(path);
  return {
    present: content.length > 0,
    bytes: content.length,
    sha256_prefix: createHash('sha256').update(content).digest('hex').slice(0, 12),
  };
}

function providerStatus(provider: ProviderName, entries: ReturnType<typeof entriesWithStatus>) {
  const required = entries.filter((entry) => entry.provider === provider && !entry.optional);
  const missing = required.filter((entry) => !entry.present).map((entry) => entry.name);
  return {
    provider,
    accepted: missing.length === 0,
    missing,
  };
}

function entriesWithStatus() {
  return requiredInputs.map((input) => ({
    name: input.name,
    provider: input.provider,
    path_name: input.path,
    optional: 'optional' in input ? input.optional : false,
    ...inspectPath(input.path),
  }));
}

function writeTemplate(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const template = {
    note: 'Private operator-owned placeholders only. Do not commit secrets or raw provider URLs.',
    google_drive_folder_id_path: join(keyholderDir, 'google-drive-folder-id.txt'),
    google_drive_service_account_path: join(keyholderDir, 'google-drive-service-account.json'),
    vimeo_webhook_secret_path: join(keyholderDir, 'vimeo-webhook-secret.txt'),
    zoom_sdk_key_path: join(keyholderDir, 'zoom-sdk-key.txt'),
    zoom_sdk_secret_path: join(keyholderDir, 'zoom-sdk-secret.txt'),
    openai_api_key_path: join(keyholderDir, 'openai-api-key.txt'),
    approvals_needed: [
      'explicit private Vimeo upload canary approval',
      'fresh explicit Zoom meeting canary approval',
      'one approved Drive folder/file for scheduled polling canary',
    ],
  };
  writeFileSync(path, JSON.stringify(template, null, 2) + '\n', { flag: 'wx' });
}

const entries = entriesWithStatus();
const summary = {
  keyholder_dir_path_name: keyholderDir,
  generated_at: new Date().toISOString(),
  external_calls_performed: false,
  provider_account_mutations: false,
  providers: [
    providerStatus('drive', entries),
    providerStatus('vimeo', entries),
    providerStatus('zoom', entries),
    providerStatus('openai', entries),
  ],
  protected_inputs: entries,
};

const templateArg = process.argv.find((arg) => arg.startsWith('--write-template='));
if (templateArg) {
  writeTemplate(templateArg.slice('--write-template='.length));
}

process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
