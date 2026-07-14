import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const publicDir = path.resolve(process.cwd(), 'dist/apps/web/public');
const publicJs = path.join(publicDir, 'assets/public.js');
const publicCss = path.join(publicDir, 'assets/public.css');
const crmJs = path.join(publicDir, 'assets/app-crm.js');
const indexHtml = await readFile(path.join(publicDir, 'index.html'), 'utf8');
const signupHtml = await readFile(path.join(publicDir, 'signup.html'), 'utf8');
const publicJsText = await readFile(publicJs, 'utf8');

const checks = [
  [(await stat(publicJs)).size <= 45_000, 'public.js must stay <= 45KB raw'],
  [(await stat(publicCss)).size <= 35_000, 'public.css must stay <= 35KB raw'],
  [(await stat(crmJs)).size > 50_000, 'CRM bundle should remain separate and detectable'],
  [
    !indexHtml.includes('app-crm.js') && !signupHtml.includes('app-crm.js'),
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
      crm_js_bytes: (await stat(crmJs)).size,
    },
    null,
    2,
  ),
);
process.stdout.write('\n');
