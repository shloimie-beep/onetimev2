import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  escapeHtml,
  renderCampaignTicker,
  renderPageShell,
  renderPublicFooter,
  renderPublicHeader,
} from '@onetime/brand-system/static';
import {
  cancellationRefundPolicy,
  communicationConsentNotice,
  landingContent,
  legalPolicyMetadata,
  parentGuardianStudentDataNotice,
  privacyDataCategories,
  privacyNotice,
  sharedNav,
  termsOfUse,
} from '../packages/domain/src/index.ts';
import type { LegalDocument, LegalSection } from '../packages/domain/src/legal/index.ts';
import { schoolInquiryFormModel } from '../apps/web/src/client/public/school/model.ts';
import { publicCanonicalUrl } from './public-page-metadata.ts';

const outDir = path.resolve(process.cwd(), 'dist/apps/web/public');

const landingSocialImage = '/assets/social/mishnayos-made-memorable.png';
const freeAccessExpiresAtPlaceholder = '__ONE_TIME_FREE_ACCESS_EXPIRES_AT__';
const canonicalApplicationOrigin = 'https://app.onetimeonetime.com';

const imageDimensions = new Map<string, readonly [number, number]>([
  ['/assets/brand/onetimelogo.webp', [400, 400]],
  [landingSocialImage, [2060, 763]],
  ['/assets/hero/hero-classroom-background.webp', [1680, 944]],
  ['/assets/how-it-works/family-learning-overview-480.webp', [480, 600]],
  ['/assets/how-it-works/family-learning-overview-800.webp', [800, 1000]],
  ['/assets/how-it-works/family-learning-overview-1254.webp', [1122, 1402]],
  ['/assets/how-it-works/student-learning-mishnayos-480.webp', [480, 480]],
  ['/assets/how-it-works/student-learning-mishnayos-800.webp', [800, 800]],
  ['/assets/how-it-works/student-learning-mishnayos-1254.webp', [1254, 1254]],
  ['/assets/students/smiley-kid.png', [337, 600]],
  ['/assets/outcomes/clarity-class.webp', [945, 2048]],
  ['/assets/outcomes/retention-review-class-480.webp', [480, 1040]],
  ['/assets/outcomes/retention-review-class-720.webp', [720, 1560]],
  ['/assets/outcomes/retention-review-class-945.webp', [945, 2048]],
  ['/assets/outcomes/excitement-learning-torah.webp', [945, 2048]],
  ['/assets/outcomes/accomplishment-toronto-class.jpg', [1200, 745]],
  ['/assets/rabbi/rabbi-eli-holding-book.jpg', [1600, 1067]],
  ['/assets/how-it-works/family-learning-overview.png', [1122, 1402]],
  ['/assets/how-it-works/parent-manages-students.png', [1265, 712]],
  ['/assets/how-it-works/student-opens-live-class.png', [1265, 712]],
  ['/assets/how-it-works/student-opens-library.png', [1265, 712]],
  ['/assets/press/torah-anytime.png', [133, 100]],
  ['/assets/press/24six.png', [131, 100]],
  ['/assets/press/the-loop.png', [202, 100]],
  ['/assets/press/naki.webp', [244, 100]],
  ['/assets/press/mishpacha.webp', [338, 100]],
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
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    ogImageSecureUrl?: string;
    ogImageType?: string;
    ogImageWidth?: number;
    ogImageHeight?: number;
    ogImageAlt?: string;
    twitterImage?: string;
    icon?: string;
    appleTouchIcon?: string;
    app?: boolean;
    appEntry?: 'crm' | 'live' | 'portal';
  } = {},
) {
  const description = options.description ?? landingContent.seo.description;
  return renderPageShell({
    title,
    body,
    description,
    canonical: publicCanonicalUrl(options.canonicalPath ?? '/'),
    ogTitle: options.ogTitle ?? landingContent.seo.ogTitle,
    ogDescription: options.ogDescription ?? landingContent.seo.ogDescription,
    ...(options.ogImage === undefined ? {} : { ogImage: options.ogImage }),
    ...(options.ogImageSecureUrl === undefined
      ? {}
      : { ogImageSecureUrl: options.ogImageSecureUrl }),
    ...(options.ogImageType === undefined ? {} : { ogImageType: options.ogImageType }),
    ...(options.ogImageWidth === undefined ? {} : { ogImageWidth: options.ogImageWidth }),
    ...(options.ogImageHeight === undefined ? {} : { ogImageHeight: options.ogImageHeight }),
    ...(options.ogImageAlt === undefined ? {} : { ogImageAlt: options.ogImageAlt }),
    ...(options.twitterImage === undefined ? {} : { twitterImage: options.twitterImage }),
    ...(options.icon === undefined ? {} : { icon: options.icon }),
    ...(options.appleTouchIcon === undefined ? {} : { appleTouchIcon: options.appleTouchIcon }),
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
  return renderCampaignTicker(
    'CLASSES START AUG 16 · 7 PM · FREE ACCESS THROUGH SEP 11 · 6 PM · JERUSALEM TIME',
    freeAccessExpiresAtPlaceholder,
  ).replace('class="campaign-ticker-shell"', 'class="campaign-ticker-shell" hidden');
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
      return `<article class="benefit-card" data-benefit="${escapeHtml(card.title)}" data-scroll-reveal>
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
  const howFlows = landingContent.how.flows
    .map(
      (flow, index) => `<figure class="how-flow" data-how-step="${index + 1}">
        <img src="${flow.image}" srcset="${escapeHtml(flow.srcset)}" sizes="${escapeHtml(flow.sizes)}" width="${flow.width}" height="${flow.height}" alt="${escapeHtml(flow.alt)}" loading="lazy" decoding="async" data-image-watch>
        ${fallbackImageSpan('Family learning image unavailable')}
        <figcaption><span>${index + 1}</span><strong>${escapeHtml(flow.title)}</strong><small>${escapeHtml(flow.body)}</small></figcaption>
      </figure>`,
    )
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
        `<span><img src="${src}" alt="${escapeHtml(label)}"${mediaSizeAttributes(src)} loading="lazy" decoding="async"></span>`,
    )
    .join('');
  const gallerySection = `<section class="section gallery-section" id="world">
    <div class="gallery" data-gallery role="region" aria-roledescription="carousel" aria-label="${escapeHtml(landingContent.gallery.heading)}">
      <h2 id="gallery-heading">${escapeHtml(landingContent.gallery.heading)}</h2>
      <div class="gallery-viewport" data-gallery-viewport aria-labelledby="gallery-heading">
        <div class="gallery-track" data-gallery-track>${slides}</div>
      </div>
      <p class="sr-only" aria-live="polite" data-gallery-status>Showing ${escapeHtml(landingContent.gallery.slides[0][0])}</p>
      <div class="gallery-controls sr-only" inert aria-hidden="true">
        <button type="button" data-gallery-prev aria-label="Previous teaching photo">&lt;</button>
        <div>${dots}</div>
        <button type="button" data-gallery-next aria-label="Next teaching photo">&gt;</button>
        <button type="button" class="gallery-playback" data-gallery-toggle aria-pressed="false">Pause slideshow</button>
      </div>
    </div>
  </section>`;
  const pressSection = `<section class="section press-section">
    <h2 id="press-heading">Seen Across the Jewish World</h2>
    <div class="press-strip" data-press-carousel role="region" aria-roledescription="carousel" aria-label="Torah media and publication logos" tabindex="0"><div data-press-track>${press}</div></div>
    <p class="sr-only" aria-live="polite" data-press-status>Showing TorahAnytime</p>
  </section>`;

  return pageShell(
    landingContent.seo.title,
    `${header()}${ticker()}
<main class="landing-page">
  <section class="hero" aria-labelledby="landing-hero-heading">
    <div class="hero-inner">
      <p class="hero-eyebrow">${escapeHtml(landingContent.hero.eyebrow)}</p>
      <h1 id="landing-hero-heading">${escapeHtml(landingContent.hero.headline)}</h1>
      <p class="hero-subheadline">${escapeHtml(landingContent.hero.subheadline)}</p>
      <p class="hero-access-detail">${escapeHtml(landingContent.hero.accessDetail)}</p>
      <a class="button button-primary hero-cta" href="${escapeHtml(landingContent.hero.cta.href)}" data-ot-analytics-event="${escapeHtml(landingContent.hero.cta.analyticsEvent)}" data-ot-analytics-destination="${escapeHtml(landingContent.hero.cta.href)}" data-ot-analytics-placement="${escapeHtml(landingContent.hero.cta.analyticsPlacement)}">${escapeHtml(landingContent.hero.cta.label)}</a>
    </div>
    <figure class="hero-photo"><img src="${landingContent.hero.image}" alt="${escapeHtml(landingContent.hero.imageAlt)}"${mediaSizeAttributes(landingContent.hero.image)} decoding="async" fetchpriority="high"></figure>
  </section>
  <section class="section" id="gain">
    <h2>${escapeHtml(landingContent.gain.heading)}</h2>
    <p class="section-intro">${escapeHtml(landingContent.gain.intro)}</p>
    <div class="benefit-grid">${gainCards}</div>
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
  <section class="section who" id="who">
    <div>
      <h2>${escapeHtml(landingContent.who.heading)}</h2>
      <ul>${whoCards}</ul>
    </div>
  </section>
  <section class="section how" id="how-it-works">
    <div class="how-intro">
      <div><h2>${escapeHtml(landingContent.how.heading)}</h2><p>${escapeHtml(landingContent.how.body)}</p></div>
    </div>
    <div class="how-flow-grid">${howFlows}</div>
  </section>
  ${pressSection}
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
  ${gallerySection}
  <section class="final-cta"><h2>${escapeHtml(landingContent.finalCta.heading)}</h2><a class="button button-primary" href="${escapeHtml(landingContent.hero.cta.href)}">Create your Family account</a></section>
</main>${footer()}`,
    {
      canonicalPath: '/',
      ogTitle: landingContent.seo.ogTitle,
      ogDescription: landingContent.seo.ogDescription,
      ogImage: publicCanonicalUrl(landingSocialImage),
      ogImageSecureUrl: publicCanonicalUrl(landingSocialImage),
      ogImageType: 'image/png',
      ogImageWidth: 2060,
      ogImageHeight: 763,
      ogImageAlt: 'Mishnayos Made Memorable with Rabbi Eli Scheller',
      twitterImage: publicCanonicalUrl(landingSocialImage),
    },
  );
}

function signupPage() {
  return pageShell(
    'Create Your Family Account | One Time Mishnayos',
    `${header()}<main class="signup-page">
  <section class="signup-intro">
    <h1>Create your Family account</h1>
    <p>Create one adult-managed Family account, then add up to three Students without supplying Student email addresses.</p>
    <p>Free access ends Friday, September 11, 2026 at 6:00 PM Asia/Jerusalem. No card is collected and there is no automatic charge.</p>
  </section>
  <section class="signup-shell">
    <noscript><div class="noscript-panel" role="status"><strong>JavaScript is required for secure signup submission.</strong><span>Please use a browser with JavaScript enabled or use the Support path. Do not send Student names or other Student information through this public form.</span></div></noscript>
    <form class="signup-form" action="/api/v1/signup/family" method="post" data-signup-form data-access-boundary="${freeAccessExpiresAtPlaceholder}" data-consent-policy-version="${escapeHtml(legalPolicyMetadata.consentPolicyVersion)}" novalidate>
      <section data-family-fields aria-labelledby="family-fields-heading">
        <h2 id="family-fields-heading">Create the adult Family account</h2>
        <p class="section-note">One adult account can manage up to three separate learner seats. An adult who wants to learn as a Student must use a separate Student seat. Student email is not required.</p>
        <div class="field-grid">
          <div class="field"><label for="first_name">First name</label><input id="first_name" name="first_name" autocomplete="given-name" required><p tabindex="-1" class="error" data-error-for="first_name"></p></div>
          <div class="field"><label for="last_name">Last name</label><input id="last_name" name="last_name" autocomplete="family-name" required><p tabindex="-1" class="error" data-error-for="last_name"></p></div>
        </div>
        <div class="field"><label for="email">Adult account email</label><input id="email" name="email" type="email" autocomplete="email" inputmode="email" required><p tabindex="-1" class="error" data-error-for="email"></p></div>
        <div class="field"><label for="timezone">Time zone</label><input id="timezone" name="timezone" autocomplete="off" placeholder="America/New_York" required><small>Use an IANA time zone. Your browser suggestion remains editable.</small><p tabindex="-1" class="error" data-error-for="timezone"></p></div>
        <div class="field-grid">
          <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="new-password" minlength="12" required><p tabindex="-1" class="error" data-error-for="password"></p></div>
          <div class="field"><label for="password_confirmation">Confirm password</label><input id="password_confirmation" name="password_confirmation" type="password" autocomplete="new-password" minlength="12" required><p tabindex="-1" class="error" data-error-for="password_confirmation"></p></div>
        </div>
        <fieldset class="required-acceptances"><legend>Required agreements</legend>
          <label><input id="terms_accepted" name="terms_accepted" type="checkbox" required><span>I agree to the <a href="/terms">Terms</a> and the <a href="/cancellation-refund">Cancellation and Refund Policy</a>.</span></label>
          <label><input id="privacy_accepted" name="privacy_accepted" type="checkbox" required><span>I acknowledge the <a href="/privacy">Privacy Notice</a> and <a href="/student-data">Student Data Notice</a>.</span></label>
        </fieldset>
        <fieldset class="optional-reminders"><legend>Optional adult communications</legend>
          <p>No optional choice is selected by default. WhatsApp is not an active launch channel.</p>
          <label><input id="general_marketing_consent" name="general_marketing_consent" type="checkbox"> General marketing</label>
          <label><input id="parent_newsletter_consent" name="parent_newsletter_consent" type="checkbox"> Parent newsletter</label>
        </fieldset>
        <div class="signup-access-state" data-before-expiry hidden><p data-signup-helper>No credit card required. Free access ends September 11, 2026 at 6:00 PM Asia/Jerusalem.</p></div>
        <div class="signup-access-state" data-at-or-after-expiry><p>$67/month after account creation through secure hosted checkout. No charge is made by this form.</p></div>
      </section>
      <button class="button button-primary" type="submit" data-enhanced-submit hidden>Create your Family account</button>
      <p class="form-status" role="status" data-form-status></p>
    </form>
    <div class="success-panel" data-success-panel hidden tabindex="-1">
      <h2 data-success-heading>You’re all set.</h2>
      <p data-success-body>Your Family account is ready. You can continue now while we finish sending your confirmation email.</p>
      <a class="button button-primary" href="/parent" data-success-continue>Go to Parent dashboard</a>
    </div>
  </section>
</main>${footer()}`,
    {
      canonicalPath: '/signup',
      description:
        'Create an adult-managed One Time Mishnayos Family account and begin free access through September 11, 2026 at 6:00 PM Asia/Jerusalem.',
    },
  );
}

function schoolPage() {
  const model = schoolInquiryFormModel();
  const required = new Set<string>(model.required_fields);
  const descriptors: Record<
    (typeof model.fields)[number],
    { label: string; type: string; autocomplete: string; help?: string }
  > = {
    school_name: {
      label: 'School name',
      type: 'text',
      autocomplete: 'organization',
      help: 'Do not include Student names, ages, medical details, or private learner notes.',
    },
    contact_first_name: {
      label: 'Contact first name',
      type: 'text',
      autocomplete: 'given-name',
    },
    contact_last_name: {
      label: 'Contact last name',
      type: 'text',
      autocomplete: 'family-name',
    },
    email: { label: 'School contact email', type: 'email', autocomplete: 'email' },
    phone: { label: 'Phone (optional)', type: 'tel', autocomplete: 'tel' },
    note: { label: 'Note (optional)', type: 'text', autocomplete: 'off' },
  };
  const fields = model.fields
    .map((name) => {
      const descriptor = descriptors[name];
      const requiredAttribute = required.has(name) ? ' required' : '';
      const lengthAttribute =
        name === 'phone' ? ' maxlength="40"' : name === 'note' ? ' maxlength="1000"' : '';
      return `<div class="field">
        <label for="school_${escapeHtml(name)}">${escapeHtml(descriptor.label)}</label>
        <input id="school_${escapeHtml(name)}" name="${escapeHtml(name)}" type="${escapeHtml(descriptor.type)}" autocomplete="${escapeHtml(descriptor.autocomplete)}"${requiredAttribute}${lengthAttribute}>
        ${descriptor.help ? `<small>${escapeHtml(descriptor.help)}</small>` : ''}
        <p tabindex="-1" class="error" data-error-for="${escapeHtml(name)}"></p>
      </div>`;
    })
    .join('');

  return pageShell(
    'School Inquiry | One Time Mishnayos',
    `${header()}<main class="signup-page school-inquiry-page">
  <section class="signup-shell" aria-labelledby="school-inquiry-title">
    <p class="eyebrow">For School administrators</p>
    <h1 id="school-inquiry-title">Send a School inquiry</h1>
    <p>Ask the One Time team to follow up personally about School pricing, Student seats, and setup.</p>
    <p class="section-note">This inquiry creates no account, access, subscription, credentials, nurture enrollment, School role, portal, roster, or provider effect.</p>
    <form action="${escapeHtml(model.submission.endpoint)}" method="post" data-signup-form data-signup-entry="school" novalidate>
      <section data-school-fields aria-label="School inquiry details">
        ${fields}
      </section>
      <button class="button button-primary" type="submit">${escapeHtml(model.cta)}</button>
      <p class="form-status" role="status" data-form-status></p>
    </form>
    <div class="success-panel" data-success-panel hidden tabindex="-1">
      <h2 data-success-heading>Thank you â€” we received your School inquiry.</h2>
      <p data-success-body>${escapeHtml(model.success)}</p>
    </div>
  </section>
</main>${footer()}`,
    {
      canonicalPath: model.route,
      description:
        'Send a manual-follow-up School inquiry to the One Time Mishnayos team without creating an account or access.',
    },
  );
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

function signupReceivedPage() {
  const html = pageShell(
    'Signup received | One Time Mishnayos',
    `${header()}<main class="simple-page" data-signup-received tabindex="-1">
      <p class="eyebrow">Family signup</p>
      <h1 data-signup-received-heading>Signup received</h1>
      <p data-signup-received-body>Your Family signup was saved. Sign in to continue.</p>
      <p data-signup-received-charge>No card was charged by this signup form.</p>
      <div class="form-actions">
        <a class="button button-primary" href="${canonicalApplicationOrigin}/login" data-signup-received-primary>Sign in</a>
        <a class="button button-secondary" href="/">Return home</a>
      </div>
    </main>${footer()}`,
    {
      canonicalPath: '/signup/received',
      description: 'Safe confirmation that a One Time Family signup was received.',
    },
  );
  return html.replace('index, follow', 'noindex, nofollow');
}

function renderParagraphs(paragraphs: readonly string[] | undefined) {
  return (paragraphs ?? []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
}

function renderBullets(bullets: readonly string[] | undefined) {
  if (!bullets?.length) return '';
  return `<ul>${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>`;
}

function renderLegalSections(sections: readonly LegalSection[]) {
  return sections
    .map(
      (section) => `<section class="legal-section">
        <h2>${escapeHtml(section.heading)}</h2>
        ${renderParagraphs(section.paragraphs)}
        ${renderBullets(section.bullets)}
      </section>`,
    )
    .join('');
}

function renderLegalDocument(document: LegalDocument, headingLevel: 'h1' | 'h2' = 'h1') {
  const Heading = headingLevel;
  return `<article class="legal-document" id="${escapeHtml(document.id)}" data-policy-version="${escapeHtml(document.version)}">
    <div class="legal-document-header">
      <p class="eyebrow">Policy version ${escapeHtml(document.version)}</p>
      <${Heading}>${escapeHtml(document.title)}</${Heading}>
      <p>${escapeHtml(document.summary)}</p>
      <dl class="legal-meta">
        <div><dt>Effective date</dt><dd>${escapeHtml(document.effectiveDate)}</dd></div>
        <div><dt>Last updated</dt><dd>${escapeHtml(document.effectiveDate)}</dd></div>
        <div><dt>Review status</dt><dd>counsel_review_required</dd></div>
      </dl>
    </div>
    ${renderLegalSections(document.sections)}
  </article>`;
}

function renderPrivacyDataCategories() {
  const items = privacyDataCategories
    .map(
      (category) => `<article class="legal-category">
        <h3>${escapeHtml(category.label)}</h3>
        <p><strong>Examples:</strong> ${escapeHtml(category.examples.join('; '))}.</p>
        <p><strong>Purpose:</strong> ${escapeHtml(category.purpose)}</p>
        <p><strong>Handling:</strong> ${escapeHtml(category.handling)}</p>
      </article>`,
    )
    .join('');
  return `<section class="legal-section" id="data-categories">
    <h2>Data We May Process</h2>
    <p>These categories reflect records visible in the current system. They are listed at a high level and do not expose private rows, secrets, credentials, private links, or internal database details.</p>
    <div class="legal-category-grid">${items}</div>
  </section>`;
}

function legalPage(
  title: string,
  document: LegalDocument,
  canonicalPath: string,
  extraDocuments: readonly LegalDocument[] = [],
  includePrivacyCategories = false,
) {
  const extra = extraDocuments
    .map((extraDocument) => renderLegalDocument(extraDocument, 'h2'))
    .join('');
  const body = `${header()}<main class="legal-page">
    ${renderLegalDocument(document)}
    ${includePrivacyCategories ? renderPrivacyDataCategories() : ''}
    ${extra}
    <section class="legal-section legal-contact" aria-labelledby="policy-contact">
      <h2 id="policy-contact">Policy Contact Metadata</h2>
      <dl class="legal-meta">
        <div><dt>Organization</dt><dd>${escapeHtml(legalPolicyMetadata.contact.organization)}</dd></div>
        <div><dt>Contact role</dt><dd>${escapeHtml(legalPolicyMetadata.contact.role)}</dd></div>
        <div><dt>Public contact path</dt><dd><a href="${escapeHtml(legalPolicyMetadata.contact.publicPath)}">${escapeHtml(legalPolicyMetadata.contact.publicPath)}</a></dd></div>
        <div><dt>Policy set version</dt><dd>${escapeHtml(legalPolicyMetadata.policySetVersion)}</dd></div>
      </dl>
    </section>
  </main>${footer()}`;
  return pageShell(title, body, {
    canonicalPath,
    description: document.summary,
  }).replace('index, follow', 'index, follow');
}

await mkdir(outDir, { recursive: true });
await mkdir(path.join(outDir, 'app'), { recursive: true });
await mkdir(path.join(outDir, 'signup'), { recursive: true });
await mkdir(path.join(outDir, 'school'), { recursive: true });
await Promise.all([
  rm(path.join(outDir, 'tisha-bav.html'), { force: true }),
  rm(path.join(outDir, 'tisha-bav-live.html'), { force: true }),
]);
await writeFile(path.join(outDir, 'index.html'), landingPage());
await writeFile(path.join(outDir, 'signup.html'), signupPage());
await writeFile(path.join(outDir, 'signup', 'received.html'), signupReceivedPage());
await writeFile(path.join(outDir, 'school.html'), schoolPage());
await writeFile(
  path.join(outDir, 'school', 'received.html'),
  simplePage(
    'School inquiry received | One Time Mishnayos',
    'School inquiry received',
    'Your inquiry was saved. Our team will follow up manually.',
    'noindex, nofollow',
    '/school/received',
  ),
);
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
await writeFile(
  path.join(outDir, 'privacy.html'),
  legalPage(
    'Privacy Notice | One Time Mishnayos',
    privacyNotice,
    '/privacy',
    [communicationConsentNotice, parentGuardianStudentDataNotice],
    true,
  ),
);
await writeFile(
  path.join(outDir, 'terms.html'),
  legalPage('Terms of Use | One Time Mishnayos', termsOfUse, '/terms', [
    communicationConsentNotice,
  ]),
);
await writeFile(
  path.join(outDir, 'cancellation-refund.html'),
  legalPage(
    'Cancellation and Refund Policy | One Time Mishnayos',
    cancellationRefundPolicy,
    '/cancellation-refund',
  ),
);
await writeFile(
  path.join(outDir, 'communications-consent.html'),
  legalPage(
    'Communication and Reminder Consent | One Time Mishnayos',
    communicationConsentNotice,
    '/communications-consent',
  ),
);
await writeFile(
  path.join(outDir, 'student-data.html'),
  legalPage(
    'Parent/Guardian and Student Data Notice | One Time Mishnayos',
    parentGuardianStudentDataNotice,
    '/student-data',
  ),
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
await writeFile(
  path.join(outDir, 'app', 'live.html'),
  pageShell('Live Console | One Time Mishnayos', `<div id="live-root"></div>`, {
    app: true,
    appEntry: 'live',
    canonicalPath: '/app/live-console',
    description: 'One Time protected live classroom console and stage.',
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
