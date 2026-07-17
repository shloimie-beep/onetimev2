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
import {
  communicationConsentNotice,
  parentStudentDataNotice,
  privacyNotice,
  termsNotice,
  type LegalNotice,
} from '../packages/domain/src/legal/policies.ts';
import { publicCanonicalUrl } from './public-page-metadata.ts';

const outDir = path.resolve(process.cwd(), 'dist/apps/web/public');

const imageDimensions = new Map<string, readonly [number, number]>([
  ['/assets/brand/onetimelogo.webp', [400, 400]],
  ['/assets/hero/hero-classroom-background.webp', [1680, 944]],
  ['/assets/students/smiley-kid.png', [337, 600]],
  ['/assets/outcomes/clarity-class.webp', [945, 2048]],
  ['/assets/outcomes/retention-review-class-480.webp', [480, 1040]],
  ['/assets/outcomes/retention-review-class-720.webp', [720, 1560]],
  ['/assets/outcomes/retention-review-class-945.webp', [945, 2048]],
  ['/assets/outcomes/excitement-learning-torah.webp', [945, 2048]],
  ['/assets/outcomes/accomplishment-toronto-class.jpg', [1200, 745]],
  ['/assets/rabbi/rabbi-eli-holding-book.jpg', [1600, 1067]],
  ['/assets/rabbi/teaching-locations/rabbi-scheller-atlanta-georgia.webp', [1600, 714]],
  ['/assets/rabbi/teaching-locations/rabbi-scheller-baltimore-maryland.webp', [1600, 1066]],
  ['/assets/rabbi/teaching-locations/rabbi-scheller-flatbush-ny.webp', [1600, 1200]],
  ['/assets/rabbi/teaching-locations/rabbi-scheller-hollywood-florida.webp', [1600, 1200]],
  ['/assets/rabbi/teaching-locations/rabbi-scheller-lakewood-nj.webp', [1600, 1200]],
  ['/assets/rabbi/teaching-locations/rabbi-scheller-miami-florida.webp', [1600, 1200]],
  ['/assets/rabbi/teaching-locations/rabbi-scheller-philadelphia.webp', [1600, 1200]],
  ['/assets/rabbi/teaching-locations/rabbi-scheller-silver-spring.webp', [1600, 1200]],
]);

function mediaSizeAttributes(src: string) {
  const dimensions = imageDimensions.get(src);
  if (!dimensions) return '';
  return ` width="${dimensions[0]}" height="${dimensions[1]}"`;
}

function srcSetAttributes(srcset?: string, sizes?: string) {
  if (!srcset) return '';
  return ` srcset="${escapeHtml(srcset)}"${sizes ? ` sizes="${escapeHtml(sizes)}"` : ''}`;
}

function fallbackImageSpan(label = 'Image unavailable') {
  return `<span class="image-fallback" aria-hidden="true">${escapeHtml(label)}</span>`;
}

function pageShell(
  title: string,
  body: string,
  options: {
    description?: string;
    canonicalPath?: string;
    app?: boolean;
    appEntry?: 'crm' | 'portal';
  } = {},
) {
  const description = options.description ?? landingContent.seo.description;
  return renderPageShell({
    title,
    body,
    description,
    canonical: publicCanonicalUrl(options.canonicalPath ?? '/'),
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
        srcset?: string;
        sizes?: string;
        alt: string;
        assetBlocker: string | null;
        visualTreatment?: string;
      } = card;
      const visual =
        visualCard.visualTreatment === 'memory-review'
          ? `<div class="retention-visual" role="img" aria-label="Review rhythm, memory, and retention">
              <span class="review-card review-card-one"><b>1</b><em>Learn</em></span>
              <span class="review-card review-card-two"><b>2</b><em>Review</em></span>
              <span class="review-card review-card-three"><b>3</b><em>Remember</em></span>
            </div>`
          : visualCard.image
            ? `<img src="${visualCard.image}" alt="${escapeHtml(visualCard.alt)}"${mediaSizeAttributes(visualCard.image)}${srcSetAttributes(visualCard.srcset, visualCard.sizes)} loading="lazy" decoding="async" data-image-watch>${fallbackImageSpan()}`
            : `<div class="asset-blocker" role="img" aria-label="${escapeHtml(visualCard.assetBlocker ?? 'Missing assigned asset')}">Missing approved asset</div>`;
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
      ) => `<figure class="gallery-slide" data-gallery-slide data-gallery-index="${index}" ${index === 0 ? 'data-active="true"' : 'aria-hidden="true"'} tabindex="${index === 0 ? '0' : '-1'}">
        <img src="${src}" alt="${escapeHtml(title)}"${mediaSizeAttributes(src)} loading="${index === 0 ? 'eager' : 'lazy'}" decoding="async" data-image-watch>
        ${fallbackImageSpan('Photo unavailable')}
        <figcaption>${escapeHtml(title)}</figcaption>
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
  const gallerySection = `<section class="section gallery-section" id="world">
    <div class="gallery" data-gallery role="region" aria-roledescription="carousel" aria-label="${escapeHtml(landingContent.gallery.heading)}">
      <h2 id="gallery-heading">${escapeHtml(landingContent.gallery.heading)}</h2>
      <div class="gallery-viewport" data-gallery-viewport aria-labelledby="gallery-heading">
        <div class="gallery-track" data-gallery-track>${slides}</div>
      </div>
      <p class="sr-only" aria-live="polite" data-gallery-status>Showing ${escapeHtml(landingContent.gallery.slides[0][0])}</p>
      <div class="gallery-controls">
        <button type="button" data-gallery-prev aria-label="Previous teaching photo">&lt;</button>
        <div>${dots}</div>
        <button type="button" data-gallery-next aria-label="Next teaching photo">&gt;</button>
      </div>
    </div>
    <div class="press-strip" aria-label="Torah media and publication logos"><p>Torah media and publication mentions</p><div>${press}</div></div>
  </section>`;
  const assistant = landingContent.whatsappAssistant;
  const whatsappAssistant = `<aside class="whatsapp-assistant" data-whatsapp-assistant data-state="${escapeHtml(assistant.state)}">
    <button class="whatsapp-assistant-button" type="button" data-whatsapp-toggle aria-expanded="false" aria-controls="whatsapp-assistant-panel">
      <span aria-hidden="true">WA</span><span class="sr-only">${escapeHtml(assistant.buttonLabel)}</span>
    </button>
    <div class="whatsapp-assistant-panel" id="whatsapp-assistant-panel" data-whatsapp-panel hidden>
      <button class="whatsapp-assistant-close" type="button" data-whatsapp-close aria-label="${escapeHtml(assistant.dismissLabel)}">x</button>
      <p class="whatsapp-assistant-state">${escapeHtml(assistant.state === 'offline' ? 'Offline readiness' : 'Available')}</p>
      <h2>${escapeHtml(assistant.heading)}</h2>
      <p>${escapeHtml(assistant.body)}</p>
      <a class="button button-primary" href="${escapeHtml(assistant.ctaHref)}">${escapeHtml(assistant.ctaLabel)}</a>
    </div>
  </aside>`;

  return pageShell(
    landingContent.seo.title,
    `${header()}
<main>
  <section class="hero">
    <div class="hero-inner">
      <p class="kicker">${landingContent.hero.kickerLines.map((line) => `<span>${escapeHtml(line)}</span>`).join('')}</p>
      <h1>${escapeHtml(landingContent.hero.heading)}</h1>
      <a class="button button-primary hero-cta" href="/signup">Sign Up Now</a>
    </div>
  </section>
  <section class="section receive" id="receive">
    <h2 class="receive-heading">${escapeHtml(landingContent.receive.heading)}</h2>
    <p class="receive-detail">${escapeHtml(landingContent.receive.detailLine)}</p>
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
  ${gallerySection}
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
      <img src="/assets/rabbi/rabbi-eli-holding-book.jpg" alt="Rabbi Eli Scheller holding the One Time book"${mediaSizeAttributes('/assets/rabbi/rabbi-eli-holding-book.jpg')} loading="lazy" decoding="async">
    </div>
  </section>
  <section class="final-cta"><h2>${escapeHtml(landingContent.finalCta.heading)}</h2><a class="button button-primary" href="/signup">Sign Up Now</a></section>
</main>${whatsappAssistant}${ticker()}${footer()}`,
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
      <div class="field"><label for="phone">Phone / WhatsApp</label><input id="phone" name="phone" type="tel" autocomplete="tel" inputmode="tel"><small>Required only if you choose WhatsApp reminders.</small><p tabindex="-1" class="error" data-error-for="phone"></p></div>
      <input type="hidden" name="reminder_preference" value="none" data-reminder-preference>
      <input type="hidden" name="reminder_consent" value="false" data-reminder-consent>
      <div class="consent"><p>We may email you required service follow-up about this signup. Optional class reminders are separate choices below.</p><p><a href="/communications-consent">Communication consent</a> and <a href="/privacy">privacy notice</a>.</p></div>
      <fieldset data-reminder-channels><legend>Optional class reminders</legend><label><input id="reminder_email" type="checkbox" name="reminder_channel_email" value="email"> Email reminders</label><label><input id="reminder_whatsapp" type="checkbox" name="reminder_channel_whatsapp" value="whatsapp"> WhatsApp reminders</label><p tabindex="-1" class="error" data-error-for="reminder_consent"></p></fieldset>
      <p class="consent"><a href="/student-data">Parent, guardian, and student data notice</a>. Please do not put student-sensitive details in this public form.</p>
      <button class="button button-primary" type="submit">Sign Up Now</button>
      <p class="form-status" role="status" data-form-status></p>
    </form>
    <div class="success-panel" data-success-panel hidden tabindex="-1">
      <h2 data-success-heading>${escapeHtml(fallbackSuccess.heading)}</h2>
      <p data-success-body>${escapeHtml(fallbackSuccess.body)}</p>
    </div>
  </section>
</main>${footer()}`,
    { canonicalPath: '/signup' },
  );
}

function noticePage(notice: LegalNotice, canonicalPath: string) {
  const sections = notice.sections
    .map(
      (section) =>
        `<section><h2>${escapeHtml(section.heading)}</h2>${section.body
          .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
          .join('')}</section>`,
    )
    .join('');
  return pageShell(
    notice.title,
    `${header()}<main class="simple-page"><h1>${escapeHtml(notice.heading)}</h1><p><strong>Version:</strong> ${escapeHtml(notice.version)}. <strong>Effective:</strong> ${escapeHtml(notice.effectiveDate)}. <strong>Review:</strong> ${escapeHtml(notice.reviewStatus)}. <strong>Contact:</strong> ${escapeHtml(notice.contactLabel)}.</p>${sections}</main>${footer()}`,
    { canonicalPath },
  ).replace('index, follow', 'noindex, nofollow');
}

function simplePage(
  title: string,
  heading: string,
  body: string,
  robots = 'noindex, nofollow',
  canonicalPath = '/',
) {
  const html = pageShell(
    title,
    `${header()}<main class="simple-page"><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(body)}</p></main>${footer()}`,
    { canonicalPath },
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
    'noindex, nofollow',
    '/login',
  ),
);
await writeFile(path.join(outDir, 'privacy.html'), noticePage(privacyNotice, '/privacy'));
await writeFile(path.join(outDir, 'terms.html'), noticePage(termsNotice, '/terms'));
await writeFile(
  path.join(outDir, 'communications-consent.html'),
  noticePage(communicationConsentNotice, '/communications-consent'),
);
await writeFile(
  path.join(outDir, 'student-data.html'),
  noticePage(parentStudentDataNotice, '/student-data'),
);
await writeFile(
  path.join(outDir, '404.html'),
  simplePage(
    'Not Found | One Time Mishnayos',
    'Not found',
    'That page is not available.',
    'noindex, nofollow',
    '/404',
  ),
);
await writeFile(
  path.join(outDir, 'app', 'crm.html'),
  pageShell('CRM | One Time Mishnayos', `<div id="crm-root"></div>`, {
    app: true,
    canonicalPath: '/app/crm',
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
      canonicalPath: `/app/${fileName.replace('.html', '')}`,
      description,
    }).replace('index, follow', 'noindex, nofollow'),
  );
}
await writeFile(
  path.join(outDir, 'app', 'parent.html'),
  pageShell('Parent Portal | One Time Mishnayos', `<div id="portal-root"></div>`, {
    app: true,
    appEntry: 'portal',
    canonicalPath: '/app/parent',
    description: 'One Time protected parent portal.',
  }).replace('index, follow', 'noindex, nofollow'),
);
await writeFile(
  path.join(outDir, 'app', 'student.html'),
  pageShell('Student Portal | One Time Mishnayos', `<div id="portal-root"></div>`, {
    app: true,
    appEntry: 'portal',
    canonicalPath: '/app/student',
    description: 'One Time protected student portal.',
  }).replace('index, follow', 'noindex, nofollow'),
);
