import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  escapeHtml,
  renderCampaignTicker,
  renderPageShell,
  renderPublicFooter,
  renderPublicHeader,
} from '@onetime/brand-system/static';
import {
  campaign,
  campaignTicker,
  landingContent,
  sharedNav,
  successCopy,
} from '../packages/domain/src/index.ts';

const outDir = path.resolve(process.cwd(), 'dist/apps/web/public');

function pageShell(
  title: string,
  body: string,
  options: { description?: string; app?: boolean; appEntry?: 'crm' | 'portal' } = {},
) {
  const description = options.description ?? landingContent.seo.description;
  return renderPageShell({
    title,
    body,
    description,
    canonical: landingContent.seo.canonical,
    ogTitle: landingContent.seo.ogTitle,
    ogDescription: landingContent.seo.ogDescription,
    ...(options.app === undefined ? {} : { app: options.app }),
    ...(options.appEntry === undefined ? {} : { appEntry: options.appEntry }),
  });
}

function header() {
  return renderPublicHeader(sharedNav);
}

function footer() {
  return renderPublicFooter(landingContent.footer.links, landingContent.footer.line);
}

function ticker() {
  return renderCampaignTicker(campaignTicker(), campaign.deadlineDate);
}

function landingPage() {
  const receiveBullets = landingContent.receive.bullets
    .map(
      (bullet) =>
        `<li><span class="feature-marker" aria-hidden="true"></span><p><strong>${escapeHtml(bullet.lead)}</strong><span>${escapeHtml(bullet.body)}</span></p></li>`,
    )
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
    .map(
      (audience) =>
        `<li><strong>${escapeHtml(audience.lead)}</strong><span>${escapeHtml(audience.body)}</span></li>`,
    )
    .join('');
  const steps = landingContent.how.steps
    .map((label, index) => `<li><span>${index + 1}</span>${escapeHtml(label)}</li>`)
    .join('');
  const slides = landingContent.gallery.slides
    .map(
      (
        [title, src],
        index,
      ) => `<figure class="gallery-slide" data-gallery-slide ${index === 0 ? '' : 'hidden'}>
        <img src="${src}" alt="${escapeHtml(title)}" loading="${index === 0 ? 'eager' : 'lazy'}" decoding="async">
        <figcaption><strong>${escapeHtml(title)}</strong></figcaption>
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
    `${ticker()}${header()}
<main>
  <section class="hero">
    <div class="hero-inner">
      <p class="kicker">${landingContent.hero.kickerLines.map((line) => `<span>${escapeHtml(line)}</span>`).join('')}</p>
      <h1>${escapeHtml(landingContent.hero.heading)}</h1>
      <p class="schedule">${escapeHtml(landingContent.hero.schedule)}</p>
      <a class="button button-primary hero-cta" href="/signup">Sign Up Now</a>
    </div>
  </section>
  <section class="section receive" id="receive">
    <h2 class="receive-heading">${escapeHtml(landingContent.receive.heading)}</h2>
    <div class="receive-image"><img src="/assets/students/smiley-kid.png" alt="Smiling One Time Mishnayos student" width="337" height="600"></div>
    <div class="feature-panel">
      <div class="feature-icon" aria-hidden="true">7</div>
      <p class="feature-eyebrow">${escapeHtml(landingContent.receive.eyebrow)}</p>
      <h3>${escapeHtml(landingContent.receive.title)}</h3>
      <ul>${receiveBullets}</ul>
    </div>
  </section>
  <section class="section" id="gain">
    <h2>${escapeHtml(landingContent.gain.heading)}</h2>
    <p class="section-intro">${escapeHtml(landingContent.gain.intro)}</p>
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
  const fallbackSuccess = successCopy('family');
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
      <h2 data-success-heading>${escapeHtml(fallbackSuccess.heading)}</h2>
      <p data-success-body>${escapeHtml(fallbackSuccess.body)}</p>
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
  pageShell('CRM | One Time Mishnayos', `<div id="crm-root"></div>`, {
    app: true,
    description: 'One Time authenticated CRM.',
  }).replace('index, follow', 'noindex, nofollow'),
);
for (const [fileName, title, description] of [
  ['dashboard.html', 'Dashboard | One Time Mishnayos', 'One Time owner/admin dashboard.'],
  ['classes.html', 'Classes | One Time Mishnayos', 'One Time class occurrence status.'],
  ['content.html', 'Content Library | One Time Mishnayos', 'One Time content library status.'],
  ['billing.html', 'Products/Billing | One Time Mishnayos', 'One Time billing status.'],
] as const) {
  await writeFile(
    path.join(outDir, 'app', fileName),
    pageShell(title, `<div id="crm-root"></div>`, {
      app: true,
      description,
    }).replace('index, follow', 'noindex, nofollow'),
  );
}
await writeFile(
  path.join(outDir, 'app', 'parent.html'),
  pageShell('Parent Portal | One Time Mishnayos', `<div id="portal-root"></div>`, {
    app: true,
    appEntry: 'portal',
    description: 'One Time protected parent portal.',
  }).replace('index, follow', 'noindex, nofollow'),
);
await writeFile(
  path.join(outDir, 'app', 'student.html'),
  pageShell('Student Portal | One Time Mishnayos', `<div id="portal-root"></div>`, {
    app: true,
    appEntry: 'portal',
    description: 'One Time protected student portal.',
  }).replace('index, follow', 'noindex, nofollow'),
);
