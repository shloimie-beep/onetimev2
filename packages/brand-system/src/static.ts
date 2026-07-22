import { brandAssetPaths } from './tokens.ts';

export type StaticLink = readonly [label: string, href: string];

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function renderLogo({
  label = 'One Time Mishnayos home',
  subtitle = 'Worldwide Mishnah Learning',
  href = '/',
  size = 72,
}: {
  label?: string;
  subtitle?: string;
  href?: string;
  size?: number;
} = {}) {
  return `<a class="brand-lockup" href="${escapeHtml(href)}" aria-label="${escapeHtml(label)}">
    <img src="${brandAssetPaths.logo}" width="${size}" height="${size}" alt="" aria-hidden="true">
    <span><strong>One Time Mishnayos</strong><small>${escapeHtml(subtitle)}</small></span>
  </a>`;
}

export function renderPublicHeader(navLinks: readonly StaticLink[]) {
  const drawerLinks = navLinks
    .map(([label, href]) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`)
    .join('');
  return `<header class="site-header" data-ot-shell="public-marketing">
  ${renderLogo()}
  <nav class="header-actions" aria-label="Primary">
    <a class="text-link" href="/login">Member Login</a>
    <a class="button button-primary" href="/signup" data-ot-primitive="Button">Sign Up Now</a>
    <button class="icon-button" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="site-drawer" data-drawer-toggle data-ot-primitive="DrawerTrigger"><span></span><span></span><span></span></button>
  </nav>
</header>
<div class="drawer-overlay" hidden data-drawer-overlay></div>
<aside class="drawer" id="site-drawer" hidden data-drawer aria-label="One Time Menu" data-ot-primitive="Drawer">
  <button class="icon-button drawer-close" type="button" aria-label="Close navigation" data-drawer-close><span></span><span></span></button>
  <h2>One Time Menu</h2>
  <nav>${drawerLinks}</nav>
  <p>Live Mishnayos with Rabbi Eli Scheller from Eretz Yisrael.</p>
</aside>`;
}

export function renderPublicFooter(links: readonly StaticLink[], line: string) {
  return `<footer class="site-footer" data-ot-primitive="Footer">
  <div class="footer-brand"><img src="${brandAssetPaths.logo}" width="40" height="40" alt="" aria-hidden="true"><p>${escapeHtml(line)}</p></div>
  <nav aria-label="Footer">${links
    .map(([label, href]) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`)
    .join('')}</nav>
</footer>`;
}

export function renderCampaignTicker(copy: string | null, deadlineDate: string) {
  if (!copy) return '';
  const items = Array.from(
    { length: 6 },
    () => `<span class="campaign-ticker-item">${escapeHtml(copy)}</span>`,
  ).join('');
  return `<div class="campaign-ticker-shell" role="region" aria-label="Campaign countdown" data-ot-ticker-route="/">
  <a class="campaign-ticker" href="/signup" aria-label="${escapeHtml(copy)}" data-campaign-deadline="${escapeHtml(deadlineDate)}">
    <span class="campaign-ticker-track" aria-hidden="true">${items}</span>
  </a>
</div>`;
}

export function renderPageShell({
  title,
  description,
  body,
  canonical,
  ogTitle,
  ogDescription,
  app = false,
  appEntry = 'crm',
}: {
  title: string;
  description: string;
  body: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  app?: boolean;
  appEntry?: 'crm' | 'live' | 'portal' | 'experience-preview-student';
}) {
  const script = app ? `/assets/app-${appEntry}.js` : '/assets/public.js';
  const stylesheet = app ? '/assets/app-crm.css' : '/assets/public.css';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:title" content="${escapeHtml(ogTitle)}">
  <meta property="og:description" content="${escapeHtml(ogDescription)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta name="theme-color" content="#050505">
  <link rel="preload" href="/assets/fonts/dm-serif-display-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${stylesheet}">
</head>
<body>
${body}
<script type="module" src="${script}"></script>
</body>
</html>`;
}
