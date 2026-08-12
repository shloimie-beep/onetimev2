import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const packageRoot = path.resolve('scripts/media/windows-package');

async function packageText(name: string) {
  return readFile(path.join(packageRoot, name), 'utf8');
}

describe('local media Windows package safety', () => {
  it('contains no broad Codex/controller prompt and promises only local preparation', async () => {
    const names = await readdir(packageRoot);
    expect(names.some((name) => /codex|controller|launch-review/i.test(name))).toBe(false);
    const readme = await packageText('README-FIRST.md');
    expect(readme).toContain('zero OpenAI, Vimeo, Google Drive, One Time, or other network calls');
    expect(readme).toContain('local review-ready MP4');
    expect(readme).not.toContain('paste');
    const runnerSource = await readFile(
      path.resolve('scripts/media/local-media-runner.ts'),
      'utf8',
    );
    expect(runnerSource).not.toMatch(/\bfetch\s*\(|https?:\/\//i);
  });

  it('requires explicit backed-up replacement and never changes a desktop shortcut', async () => {
    const installer = await packageText('Install-Local-Only-Media-Runner.ps1');
    expect(installer).toContain('REPLACE-WITH-BACKUP');
    expect(installer).toContain('Installation refused because managed files differ');
    expect(installer).toContain(
      'Copy-Item -LiteralPath $file.Destination -Destination $backupPath',
    );
    expect(installer).not.toMatch(/WScript\.Shell|\.lnk|CreateShortcut/i);
  });

  it('constrains uninstall and requires a typed destructive confirmation', async () => {
    const uninstaller = await packageText('Uninstall-Local-Only-Media-Runner.ps1');
    const command = await packageText('UNINSTALL-LOCAL-ONLY-MEDIA-RUNNER.cmd');
    expect(uninstaller).toContain("Join-Path $UserProfilePath 'OneTimeMedia'");
    expect(uninstaller).toContain('REMOVE-LOCAL-RUNNER');
    expect(uninstaller).not.toMatch(/Remove-Item[^\r\n]+-Recurse/i);
    expect(command).toContain('set /p "CONFIRM=');
  });

  it('does not force-replace a scheduled task and performs two observations', async () => {
    const installer = await packageText('Install-Local-Only-Media-Runner.ps1');
    expect(installer).not.toMatch(/schtasks\.exe[^\r\n]+\/F/i);
    expect(installer).toContain('already exists. The installer will not replace any existing task');
    expect(installer).toContain(
      'start --once --wait-for-stability --process-local --root "$RootPath"',
    );
  });
});
