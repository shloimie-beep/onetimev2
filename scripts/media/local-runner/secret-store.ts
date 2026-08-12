import { spawn } from 'node:child_process';
import { access, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { LocalMediaSettings } from './contracts.ts';

export type LocalMediaSecretName =
  'openai_api_key' | 'vimeo_access_token' | 'one_time_import_hmac_key';

const ENVIRONMENT_NAMES: Record<LocalMediaSecretName, string> = {
  openai_api_key: 'ONE_TIME_MEDIA_OPENAI_API_KEY',
  vimeo_access_token: 'ONE_TIME_MEDIA_VIMEO_ACCESS_TOKEN',
  one_time_import_hmac_key: 'ONE_TIME_MEDIA_IMPORT_HMAC_KEY',
};

const LEGACY_FILES: Partial<Record<LocalMediaSecretName, string>> = {
  openai_api_key: 'openaiv2.txt',
  vimeo_access_token: 'vimeo-access-token.txt',
};

export class LocalMediaSecretStore {
  constructor(private readonly settings: LocalMediaSettings) {}

  async read(name: LocalMediaSecretName) {
    const environmentValue = process.env[ENVIRONMENT_NAMES[name]]?.trim();
    if (environmentValue) return environmentValue;
    const protectedPath = this.protectedPath(name);
    if (await exists(protectedPath)) {
      if (process.platform !== 'win32') throw new Error('local_media_dpapi_requires_windows');
      const value = await runPowerShell(
        [
          '$encrypted = Get-Content -LiteralPath $args[0] -Raw',
          '$secure = ConvertTo-SecureString $encrypted',
          '$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)',
          'try { [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }',
        ].join('; '),
        [protectedPath],
      );
      if (value.trim()) return value.trim();
    }
    const legacyFile = LEGACY_FILES[name];
    if (legacyFile && this.settings.legacyKeyholderDir) {
      const legacyPath = path.join(this.settings.legacyKeyholderDir, legacyFile);
      if (await exists(legacyPath)) {
        const value = (await readFile(legacyPath, 'utf8')).trim();
        if (value) return value;
      }
    }
    throw new Error(`local_media_secret_${name}_required`);
  }

  async protectFromFile(name: LocalMediaSecretName, sourcePath: string) {
    if (process.platform !== 'win32') throw new Error('local_media_dpapi_requires_windows');
    const destination = this.protectedPath(name);
    await mkdir(path.dirname(destination), { recursive: true });
    await runPowerShell(
      [
        '$plain = (Get-Content -LiteralPath $args[0] -Raw).Trim()',
        "if ([string]::IsNullOrWhiteSpace($plain)) { throw 'secret_source_empty' }",
        '$secure = ConvertTo-SecureString $plain -AsPlainText -Force',
        '$encrypted = ConvertFrom-SecureString $secure',
        'Set-Content -LiteralPath $args[1] -Value $encrypted -Encoding UTF8',
      ].join('; '),
      [path.resolve(sourcePath), destination],
    );
    return destination;
  }

  protectedPath(name: LocalMediaSecretName) {
    return path.join(this.settings.rootPath, 'Config', 'secrets', `${name}.dpapi`);
  }
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function runPowerShell(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', command, ...args],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const stdout: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.resume();
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve(Buffer.concat(stdout).toString('utf8'));
      else reject(new Error(`local_media_dpapi_command_failed_${code ?? -1}`));
    });
  });
}
