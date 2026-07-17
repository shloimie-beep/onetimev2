import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const publicDir = path.resolve(process.cwd(), 'dist/apps/web/public');
const publicJs = path.join(publicDir, 'assets/public.js');
const publicCss = path.join(publicDir, 'assets/public.css');
const indexHtml = await readFile(path.join(publicDir, 'index.html'), 'utf8');
const signupHtml = await readFile(path.join(publicDir, 'signup.html'), 'utf8');
const publicJsText = await readFile(publicJs, 'utf8');
const appManifest = JSON.parse(
  await readFile(path.join(publicDir, 'manifest-app.json'), 'utf8'),
) as Record<
  string,
  { file?: string; imports?: string[]; css?: string[]; isEntry?: boolean; src?: string }
>;

const crmEntry = appManifest['apps/web/src/client/app/crm-entry.tsx'];
if (!crmEntry?.file) {
  throw new Error('CRM entry is missing from app manifest');
}
const portalEntry = appManifest['apps/web/src/client/app/portal-entry.tsx'];
if (!portalEntry?.file) {
  throw new Error('Portal entry is missing from app manifest');
}

function collectManifestFiles(entry: { file?: string; imports?: string[]; css?: string[] }) {
  const files = new Set<string>();
  if (entry.file) files.add(entry.file);
  for (const cssFile of entry.css ?? []) files.add(cssFile);
  for (const importKey of entry.imports ?? []) {
    const imported = appManifest[importKey];
    if (imported?.file) files.add(imported.file);
    for (const cssFile of imported?.css ?? []) files.add(cssFile);
  }
  return files;
}

const crmManifestFiles = collectManifestFiles(crmEntry);
const portalManifestFiles = collectManifestFiles(portalEntry);
const crmJsFiles = [...crmManifestFiles].filter((file) => file.endsWith('.js'));
const portalJsFiles = [...portalManifestFiles].filter((file) => file.endsWith('.js'));
const crmJsBytes = (
  await Promise.all(crmJsFiles.map((file) => stat(path.join(publicDir, file))))
).reduce((total, fileStat) => total + fileStat.size, 0);
const portalJsBytes = (
  await Promise.all(portalJsFiles.map((file) => stat(path.join(publicDir, file))))
).reduce((total, fileStat) => total + fileStat.size, 0);
const appCssFiles = [...new Set([...crmManifestFiles, ...portalManifestFiles])]
  .filter((file) => file.endsWith('.css'))
  .sort();
const appCssBytes = (
  await Promise.all(appCssFiles.map((file) => stat(path.join(publicDir, file))))
).reduce((total, fileStat) => total + fileStat.size, 0);
const fontDir = path.join(publicDir, 'assets/fonts');
let woff2Bytes = 0;
try {
  const fontFiles = await readdir(fontDir);
  woff2Bytes = (
    await Promise.all(
      fontFiles
        .filter((file) => file.endsWith('.woff2'))
        .map((file) => stat(path.join(fontDir, file))),
    )
  ).reduce((total, fileStat) => total + fileStat.size, 0);
} catch {
  woff2Bytes = 0;
}

async function fileMetrics(filePath: string) {
  const buffer = await readFile(filePath);
  return {
    raw_bytes: buffer.byteLength,
    gzip_bytes: gzipSync(buffer).byteLength,
  };
}

const checks = [
  [(await stat(publicJs)).size <= 45_000, 'public.js must stay <= 45KB raw'],
  [(await stat(publicCss)).size <= 35_000, 'public.css must stay <= 35KB raw'],
  [crmJsBytes > 50_000, 'CRM bundle should remain separate and detectable'],
  [portalJsBytes > 10_000, 'Portal bundle should remain separate and detectable'],
  [woff2Bytes <= 250_000, 'Total WOFF2 payload must stay <= 250KB raw'],
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
      public_js: await fileMetrics(publicJs),
      public_css: await fileMetrics(publicCss),
      crm_js: {
        raw_bytes: crmJsBytes,
        files: crmJsFiles,
      },
      portal_js: {
        raw_bytes: portalJsBytes,
        files: portalJsFiles,
      },
      app_css: {
        raw_bytes: appCssBytes,
        files: appCssFiles,
      },
      woff2: {
        raw_bytes: woff2Bytes,
      },
    },
    null,
    2,
  ),
);
process.stdout.write('\n');
