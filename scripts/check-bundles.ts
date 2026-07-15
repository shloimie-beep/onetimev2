import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const publicDir = path.resolve(process.cwd(), 'dist/apps/web/public');
const publicJs = path.join(publicDir, 'assets/public.js');
const publicCss = path.join(publicDir, 'assets/public.css');
const indexHtml = await readFile(path.join(publicDir, 'index.html'), 'utf8');
const signupHtml = await readFile(path.join(publicDir, 'signup.html'), 'utf8');
const publicJsText = await readFile(publicJs, 'utf8');
const appManifest = JSON.parse(
  await readFile(path.join(publicDir, 'manifest-app.json'), 'utf8'),
) as Record<string, { file?: string; imports?: string[]; isEntry?: boolean; src?: string }>;

const crmEntry = appManifest['apps/web/src/client/app/crm-entry.tsx'];
if (!crmEntry?.file) {
  throw new Error('CRM entry is missing from app manifest');
}

const crmManifestFiles = new Set<string>([crmEntry.file]);
for (const importKey of crmEntry.imports ?? []) {
  const imported = appManifest[importKey];
  if (imported?.file) crmManifestFiles.add(imported.file);
}

const crmJsFiles = [...crmManifestFiles].filter((file) => file.endsWith('.js'));
const crmJsBytes = (
  await Promise.all(crmJsFiles.map((file) => stat(path.join(publicDir, file))))
).reduce((total, fileStat) => total + fileStat.size, 0);

const checks = [
  [(await stat(publicJs)).size <= 45_000, 'public.js must stay <= 45KB raw'],
  [(await stat(publicCss)).size <= 35_000, 'public.css must stay <= 35KB raw'],
  [crmJsBytes > 50_000, 'CRM bundle should remain separate and detectable'],
  [
    !/app-crm\d*\.js/.test(indexHtml) && !/app-crm\d*\.js/.test(signupHtml),
    'public HTML must not include CRM bundle',
  ],
  [
    !publicJsText.includes('react') && !publicJsText.includes('React'),
    'public JS must not include React',
  ],
] as const;

for (const [ok, message] of checks) {
  if (!ok) {
    throw new Error(message);
  }
}

process.stdout.write(
  JSON.stringify(
    {
      public_js_bytes: (await stat(publicJs)).size,
      public_css_bytes: (await stat(publicCss)).size,
      crm_js_bytes: crmJsBytes,
      crm_js_files: crmJsFiles,
    },
    null,
    2,
  ),
);
process.stdout.write('\n');
