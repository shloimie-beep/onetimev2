import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { campaignTicker, landingContent, sharedNav } from '../packages/domain/src/index.ts';

const outDir = path.resolve(process.cwd(), 'dist/apps/web/public');

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function pageShell(
  title: string,
  body: string,
  options: { description?: string; app?: boolean } = {},
) {
  const description = options.description ?? landingContent.seo.description;
  const script = options.app ? '/assets/app-crm.js' : '/assets/public.js';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(landingContent.seo.canonical)}">
  <meta property="og:title" content="${escapeHtml(landingContent.seo.ogTitle)}">
  <meta property="og:description" content="${escapeHtml(landingContent.seo.ogDescription)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(landingContent.seo.canonical)}">
  <meta name="theme-color" content="#050505">
  <link rel="stylesheet" href="/assets/public.css">
</head>
<body>
${body}
<script type="module" src="${script}"></script>
</body>
</html>`;
}

function header() {
  const drawerLinks = sharedNav
    .map(([label, href]) => `<a href="${href}">${escapeHtml(label)}</a>`)
    .join('');
  return `<header class="site-header">
  <a class="brand-lockup" href="/" aria-label="One Time Mishnayos home">
    <img src="/assets/brand/onetimelogo.webp" width="56" height="56" alt="" aria-hidden="true">
    <span><strong>One Time Mishnayos</strong><small>Worldwide Mishnah Learning</small></span>
  </a>
  <nav class="header-actions" aria-label="Primary">
    <a class="text-link" href="/login">Member Login</a>
    <a class="button button-primary" href="/signup">Sign Up Now</a>
    <button class="icon-button" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="site-drawer" data-drawer-toggle><span></span><span></span><span></span></button>
  </nav>
</header>
<div class="drawer-overlay" hidden data-drawer-overlay></div>
<aside class="drawer" id="site-drawer" hidden data-drawer aria-label="One Time Menu">
  <button class="icon-button drawer-close" type="button" aria-label="Close navigation" data-drawer-close><span></span><span></span></button>
  <h2>One Time Menu</h2>
  <nav>${drawerLinks}</nav>
  <p>Live Mishnayos with Rabbi Eli Scheller from Eretz Yisrael.</p>
</aside>`;
}

function footer() {
  return `<footer class="site-footer">
  <p>${escapeHtml(landingContent.footer.line)}</p>
  <nav aria-label="Footer">${landingContent.footer.links
    .map(([label, href]) => `<a href="${href}">${escapeHtml(label)}</a>`)
    .join('')}</nav>
</footer>`;
}

function ticker() {
  const copy = campaignTicker();
  if (!copy) return '';
  return `<a class="campaign-ticker" href="/signup" data-campaign-deadline="2026-09-11"><span>${escapeHtml(copy)}</span></a>`;
}

function landingPage() {
  const receiveBullets = landingContent.receive.bullets
    .map((bullet) => {
      const prefix = landingContent.receive.highlightedPrefix;
      const copy = bullet.startsWith(prefix)
        ? `<span class="yellow-text">${escapeHtml(prefix)}</span>${escapeHtml(bullet.slice(prefix.length))}`
        : escapeHtml(bullet);
      return `<li>${copy}</li>`;
    })
    .join('');
  const gainCards = landingContent.gain.cards
    .map((card) => {
      const visualCard: {
        image: string | null;
        alt: string;
        assetBlocker: string | null;
      } = card;
      const visual = visualCard.image
        ? `<img src="${visualCard.image}" alt="${escapeHtml(visualCard.alt)}" loading="lazy" decoding="async">`
        : `<div class="asset-blocker" role="img" aria-label="${escapeHtml(visualCard.assetBlocker ?? 'Missing assigned asset')}">Toronto.jpg pending</div>`;
      return `<article class="benefit-card" data-benefit="${escapeHtml(card.title)}">
        <div class="benefit-visual">${visual}</div>
        <h3>${escapeHtml(card.title)}</h3>
        <p>${escapeHtml(card.body)}</p>
        ${card.provisionalCopy ? `<small>${escapeHtml(card.provisionalCopy)}</small>` : ''}
      </article>`;
    })
    .join('');
  const whoCards = landingContent.who.audiences
    .map((label) => `<li>${escapeHtml(label)}</li>`)
    .join('');
  const steps = landingContent.how.steps
    .map((label, index) => `<li><span>${index + 1}</span>${escapeHtml(label)}</li>`)
    .join('');
  const slides = landingContent.gallery.slides
    .map(
      (
        [title, caption, src],
        index,
      ) => `<figure class="gallery-slide" data-gallery-slide ${index === 0 ? '' : 'hidden'}>
        <img src="${src}" alt="${escapeHtml(caption)}" loading="${index === 0 ? 'eager' : 'lazy'}" decoding="async">
        <figcaption><strong>${escapeHtml(title)}</strong><span>${escapeHtml(caption)}</span></figcaption>
      </figure>`,
    )
    .join('');
  const dots = landingContent.gallery.slides
    .map(
      (slide, index) =>
        `<button type="button" data-gallery-dot aria-label="Show ${escapeHtml(slide[0])}" aria-pressed="${index === 0}"></button>`,
    )
    .join('');
  const press = landingContent.press
    .map(
      ([label, src]) =>
        `<span><img src="${src}" alt="${escapeHtml(label)}" loading="lazy" decoding="async"></span>`,
    )
    .join('');

  return pageShell(
    landingContent.seo.title,
    `${header()}
<main>
  ${ticker()}
  <section class="hero">
    <div class="hero-inner">
      <p class="kicker">${escapeHtml(landingContent.hero.kicker)}</p>
      <h1>${escapeHtml(landingContent.hero.heading)}</h1>
      <p class="schedule">${escapeHtml(landingContent.hero.schedule)}</p>
      <a class="button button-primary hero-cta" href="/signup">Sign Up Now</a>
    </div>
  </section>
  <section class="section receive" id="receive">
    <div class="receive-image"><img src="/assets/students/smiley-kid.png" alt="Smiling One Time Mishnayos student" width="337" height="600"></div>
    <div class="feature-panel">
      <div class="feature-icon" aria-hidden="true">7</div>
      <h2>${escapeHtml(landingContent.receive.heading)}</h2>
      <h3>${escapeHtml(landingContent.receive.title)}</h3>
      <ul>${receiveBullets}</ul>
    </div>
  </section>
  <section class="section" id="gain">
    <h2>${escapeHtml(landingContent.gain.heading)}</h2>
    <div class="benefit-grid">${gainCards}</div>
  </section>
  <section class="section how" id="how-it-works">
    <h2>${escapeHtml(landingContent.how.heading)}</h2>
    <p>${escapeHtml(landingContent.how.body)}</p>
    <ol>${steps}</ol>
  </section>
  <section class="section who" id="who">
    <div>
      <h2>${escapeHtml(landingContent.who.heading)}</h2>
      <p>${escapeHtml(landingContent.who.body)}</p>
      <ul>${whoCards}</ul>
    </div>
  </section>
  <section class="section rabbi" id="rabbi">
    <div class="rabbi-bio">
      <div>
        <p class="eyebrow">${escapeHtml(landingContent.rabbi.eyebrow)}</p>
        <h2>${escapeHtml(landingContent.rabbi.heading)}</h2>
        <p>${escapeHtml(landingContent.rabbi.body)}</p>
      </div>
      <img src="/assets/rabbi/rabbi-eli-holding-book.jpg" alt="Rabbi Eli Scheller holding the One Time book" loading="lazy" decoding="async">
    </div>
    <div class="gallery" data-gallery>
      <h3>${escapeHtml(landingContent.gallery.heading)}</h3>
      ${slides}
      <div class="gallery-controls">
        <button type="button" data-gallery-prev aria-label="Previous teaching photo">&lt;</button>
        <div>${dots}</div>
        <button type="button" data-gallery-next aria-label="Next teaching photo">&gt;</button>
      </div>
    </div>
    <div class="press-strip" aria-label="As Seen Across the Jewish World"><p>As Seen Across the Jewish World</p><div>${press}</div></div>
  </section>
  <section class="final-cta"><h2>${escapeHtml(landingContent.finalCta.heading)}</h2><a class="button button-primary" href="/signup">Sign Up Now</a></section>
</main>${footer()}`,
  );
}

function signupPage() {
  return pageShell(
    'Sign Up Now | One Time Mishnayos',
    `${header()}<main class="signup-page">
  <section class="signup-intro">
    <h1>Sign Up Now</h1>
    <p>Join the live daily Mishnayos class and choose how you want to receive class information.</p>
  </section>
  <section class="signup-shell">
    <form class="signup-form" data-signup-form novalidate>
      <div class="field"><label for="contact_name">Parent or contact name</label><input id="contact_name" name="contact_name" autocomplete="name" required><p tabindex="-1" class="error" data-error-for="contact_name"></p></div>
      <div class="field"><label for="family_or_school">Family or School</label><input id="family_or_school" name="family_or_school" required><p tabindex="-1" class="error" data-error-for="family_or_school"></p></div>
      <fieldset><legend>Signing up as</legend><label><input type="radio" name="audience_type" value="family" checked> Family</label><label><input type="radio" name="audience_type" value="school"> School</label></fieldset>
      <div class="field"><label for="location">Location</label><input id="location" name="location" autocomplete="address-level2" placeholder="City, country, ZIP/postal code, or area" required><small>Type a city, ZIP/postal code, area code, or neighborhood.</small><p tabindex="-1" class="error" data-error-for="location"></p></div>
      <input id="timezone" name="timezone" type="hidden">
      <div class="field"><label for="timezone_fallback">Time zone</label><input id="timezone_fallback" name="timezone_fallback" placeholder="America/New_York" hidden disabled><small>Use an IANA time zone such as America/New_York.</small><p tabindex="-1" class="error" data-error-for="timezone"></p></div>
      <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" inputmode="email" required><p tabindex="-1" class="error" data-error-for="email"></p></div>
      <div class="field"><label for="phone">Phone / WhatsApp</label><input id="phone" name="phone" type="tel" autocomplete="tel" inputmode="tel"><small>Required for WhatsApp reminders.</small><p tabindex="-1" class="error" data-error-for="phone"></p></div>
      <fieldset><legend>Reminder choice</legend><label><input type="radio" name="reminder_preference" value="email" checked> Email</label><label><input type="radio" name="reminder_preference" value="whatsapp"> WhatsApp</label><label><input type="radio" name="reminder_preference" value="both"> Both</label><label><input type="radio" name="reminder_preference" value="none"> No daily reminders</label></fieldset>
      <div class="consent" data-consent-wrap><label><input id="reminder_consent" name="reminder_consent" type="checkbox" required> Confirm that we may send the selected class information and reminders.</label><p tabindex="-1" class="error" data-error-for="reminder_consent"></p></div>
      <button class="button button-primary" type="submit">Sign Up Now</button>
      <p class="form-status" role="status" data-form-status></p>
    </form>
    <div class="success-panel" data-success-panel hidden tabindex="-1">
      <h2 data-success-heading>You're signed up.</h2>
      <p data-success-body>We saved your information and will send the current class details using your selected option.</p>
    </div>
  </section>
</main>${footer()}`,
  );
}

function simplePage(title: string, heading: string, body: string, robots = 'noindex, nofollow') {
  const html = pageShell(
    title,
    `${header()}<main class="simple-page"><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(body)}</p></main>${footer()}`,
  );
  return html.replace('index, follow', robots);
}

await mkdir(outDir, { recursive: true });
await mkdir(path.join(outDir, 'app'), { recursive: true });
await writeFile(path.join(outDir, 'index.html'), landingPage());
await writeFile(path.join(outDir, 'signup.html'), signupPage());
await writeFile(
  path.join(outDir, 'login.html'),
  simplePage(
    'Member Login | One Time Mishnayos',
    'Member Login',
    'Account login is reserved for the authenticated app slice.',
  ),
);
await writeFile(
  path.join(outDir, 'privacy.html'),
  simplePage(
    'Privacy | One Time Mishnayos',
    'Privacy',
    'We collect only the signup information needed to respond to your One Time Mishnayos interest request.',
  ),
);
await writeFile(
  path.join(outDir, 'terms.html'),
  simplePage(
    'Terms | One Time Mishnayos',
    'Terms',
    'This foundation slice does not sell access, process payments, or grant member accounts.',
  ),
);
await writeFile(
  path.join(outDir, '404.html'),
  simplePage(
    'Not Found | One Time Mishnayos',
    'Not found',
    'That page is not available.',
    'noindex, nofollow',
  ),
);
await writeFile(
  path.join(outDir, 'app', 'crm.html'),
  pageShell('CRM | One Time Mishnayos', `${header()}<div id="crm-root"></div>${footer()}`, {
    app: true,
    description: 'Reserved One Time CRM route.',
  }).replace('index, follow', 'noindex, nofollow'),
);
