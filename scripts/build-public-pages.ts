import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  escapeHtml,
  renderCampaignTicker,
  renderLogo,
  renderPageShell,
  renderPublicFooter,
  renderPublicHeader,
} from '@onetime/brand-system/static';
import {
  campaign,
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
import { publicCanonicalUrl } from './public-page-metadata.ts';

const outDir = path.resolve(process.cwd(), 'dist/apps/web/public');

const landingHeroDesktopImage = '/assets/hero/landing-hero-desktop.webp';
const landingHeroMobileImage = '/assets/hero/landing-hero-mobile.webp';
const landingSocialImage = '/assets/social/mishnayos-made-memorable.png';
const tishaBavDesktopImage = '/assets/events/tisha-bav-2026/tisha%20beav(1).png';
const tishaBavMobileImage = '/assets/events/tisha-bav-2026/tishea%20beav%20mobile(1).png';
const tishaBavSocialImage = '/assets/events/tisha-bav-2026/tisha-bav-social-card-v20260722.png';
const tishaBavFavicon = '/assets/events/tisha-bav-2026/tisha-bav-favicon-v20260722.png';
const tishaBavAppleTouchIcon =
  '/assets/events/tisha-bav-2026/tisha-bav-apple-touch-icon-v20260722.png';

const imageDimensions = new Map<string, readonly [number, number]>([
  ['/assets/brand/onetimelogo.webp', [400, 400]],
  [landingHeroDesktopImage, [1920, 1080]],
  [landingHeroMobileImage, [1080, 1920]],
  [landingSocialImage, [1200, 630]],
  ['/assets/hero/hero-classroom-background.webp', [1680, 944]],
  ['/assets/students/smiley-kid.png', [337, 600]],
  ['/assets/outcomes/clarity-class.webp', [945, 2048]],
  ['/assets/outcomes/retention-review-class-480.webp', [480, 1040]],
  ['/assets/outcomes/retention-review-class-720.webp', [720, 1560]],
  ['/assets/outcomes/retention-review-class-945.webp', [945, 2048]],
  ['/assets/outcomes/excitement-learning-torah.webp', [945, 2048]],
  ['/assets/outcomes/accomplishment-toronto-class.jpg', [1200, 745]],
  ['/assets/rabbi/rabbi-eli-holding-book.jpg', [1600, 1067]],
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
  [tishaBavDesktopImage, [1366, 768]],
  [tishaBavMobileImage, [1080, 1350]],
  [tishaBavSocialImage, [1200, 630]],
  [tishaBavFavicon, [64, 64]],
  [tishaBavAppleTouchIcon, [180, 180]],
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
    appEntry?: 'crm' | 'live' | 'portal' | 'experience-preview-student';
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
  return renderCampaignTicker('FREE ACCESS — CREATE YOUR FAMILY ACCOUNT', campaign.deadlineAt);
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
        `<span><img src="${src}" alt="${escapeHtml(label)}"${mediaSizeAttributes(src)} loading="lazy" decoding="async"></span>`,
    )
    .join('');
  const experienceCards = landingContent.experience.cards
    .map(
      (card) =>
        `<article><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.body)}</p></article>`,
    )
    .join('');
  const participationItems = landingContent.participation.bullets
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
  const assuranceCards = landingContent.assurances.items
    .map(
      (item) =>
        `<article><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`,
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
        <button type="button" class="gallery-playback" data-gallery-toggle aria-pressed="false">Pause slideshow</button>
      </div>
    </div>
    <div class="press-strip" aria-label="Torah media and publication logos"><div>${press}</div></div>
  </section>`;

  return pageShell(
    landingContent.seo.title,
    `${header()}${ticker()}
<main class="landing-page">
  <section class="hero" aria-labelledby="landing-hero-heading">
    <div class="hero-inner">
      <p class="hero-eyebrow">${escapeHtml(landingContent.hero.eyebrow)}</p>
      <h1 id="landing-hero-heading" aria-label="${escapeHtml(landingContent.hero.titleLines.join(' '))}">${landingContent.hero.titleLines.map((line) => `<span>${escapeHtml(line)}</span>`).join('')}</h1>
      <p class="hero-supporting">${escapeHtml(landingContent.hero.supporting)}</p>
      <p class="schedule">${escapeHtml(landingContent.hero.schedule)}<span data-local-class-time> Your local class time will appear here.</span></p>
      <a class="button button-primary hero-cta" href="${escapeHtml(landingContent.hero.cta.href)}" data-ot-analytics-event="${escapeHtml(landingContent.hero.cta.analyticsEvent)}" data-ot-analytics-destination="${escapeHtml(landingContent.hero.cta.href)}" data-ot-analytics-placement="${escapeHtml(landingContent.hero.cta.analyticsPlacement)}">${escapeHtml(landingContent.hero.cta.label)}</a>
      <p class="hero-note">${escapeHtml(landingContent.hero.note)}</p>
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
  <section class="section who" id="who">
    <div>
      <h2>${escapeHtml(landingContent.who.heading)}</h2>
      <ul>${whoCards}</ul>
    </div>
  </section>
  <section class="section how" id="how-it-works">
    <h2>${escapeHtml(landingContent.how.heading)}</h2>
    <p>${escapeHtml(landingContent.how.body)}</p>
    <ol>${steps}</ol>
  </section>
  <section class="section experience" id="experience">
    <h2>${escapeHtml(landingContent.experience.heading)}</h2>
    <p class="section-intro">${escapeHtml(landingContent.experience.intro)}</p>
    <div class="information-grid">${experienceCards}</div>
  </section>
  <section class="section participation" id="participation">
    <h2>${escapeHtml(landingContent.participation.heading)}</h2>
    <ul class="expectation-list">${participationItems}</ul>
  </section>
  <section class="section enrollment" id="enrollment">
    <h2>${escapeHtml(landingContent.enrollment.heading)}</h2>
    <div class="information-grid">
      <article><h3>${escapeHtml(landingContent.enrollment.family.title)}</h3><p>${escapeHtml(landingContent.enrollment.family.body)}</p><a class="text-link" href="/signup?entry=family">Create a Family account</a></article>
      <article><h3>${escapeHtml(landingContent.enrollment.school.title)}</h3><p>${escapeHtml(landingContent.enrollment.school.body)}</p><a class="text-link" href="/signup?entry=school">Send a School inquiry</a></article>
    </div>
  </section>
  <section class="section access" id="access" data-access-boundary="${escapeHtml(campaign.deadlineAt)}">
    <h2>${escapeHtml(landingContent.access.heading)}</h2>
    <div class="access-state" data-before-expiry>
      <p>${escapeHtml(landingContent.access.before)}</p>
      <a class="button button-primary" href="/signup?entry=family">Create my free family account</a>
    </div>
    <div class="access-state" data-at-or-after-expiry hidden>
      <p>${escapeHtml(landingContent.access.after)}</p>
      <a class="button button-primary" href="/signup?entry=family">$67/month — create account</a>
    </div>
  </section>
  <section class="section assurances" id="assurances">
    <h2>${escapeHtml(landingContent.assurances.heading)}</h2>
    <div class="information-grid">${assuranceCards}</div>
    <nav class="assurance-links" aria-label="Account and policy links">
      <a href="/terms">Terms, cancellation, and refunds</a>
      <a href="/privacy">Privacy Notice</a>
      <a href="/student-data">Student Data Notice</a>
      <a href="/login">Member Login</a>
      <a href="/support">Support</a>
    </nav>
  </section>
  ${gallerySection}
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
  <section class="final-cta"><h2>${escapeHtml(landingContent.finalCta.heading)}</h2><a class="button button-primary" href="/signup?entry=family">Create my family account</a></section>
</main>${footer()}`,
    {
      canonicalPath: '/',
      ogTitle: landingContent.seo.ogTitle,
      ogDescription: landingContent.seo.ogDescription,
      ogImage: publicCanonicalUrl(landingSocialImage),
      ogImageSecureUrl: publicCanonicalUrl(landingSocialImage),
      ogImageType: 'image/png',
      ogImageWidth: 1200,
      ogImageHeight: 630,
      ogImageAlt: 'Mishnayos Made Memorable with Rabbi Eli Scheller',
      twitterImage: publicCanonicalUrl(landingSocialImage),
    },
  );
}

function signupPage() {
  return pageShell(
    'Sign Up Now | One Time Mishnayos',
    `${header()}<main class="signup-page">
  <section class="signup-intro">
    <h1>Sign Up Now</h1>
    <p>Create a Family account for up to three learners, or send a separate School inquiry for manual follow-up.</p>
  </section>
  <section class="signup-shell">
    <noscript><div class="noscript-panel" role="status"><strong>JavaScript is required for secure signup submission.</strong><span>Please use a browser with JavaScript enabled or use the Support path. Do not send student-sensitive information through this public form.</span></div></noscript>
    <form class="signup-form" action="/api/v1/signup/family" method="post" data-signup-form data-access-boundary="${escapeHtml(campaign.deadlineAt)}" data-consent-policy-version="${escapeHtml(legalPolicyMetadata.consentPolicyVersion)}" novalidate>
      <fieldset class="entry-choice"><legend>Choose your entry</legend><label><input type="radio" name="classification_choice" value="family" checked> Family account</label><label><input type="radio" name="classification_choice" value="school"> School inquiry</label></fieldset>
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
          <label><input id="terms_accepted" name="terms_accepted" type="checkbox" required><span>I agree to the <a href="/terms">Terms</a>, including cancellation and refund rules.</span></label>
          <label><input id="privacy_accepted" name="privacy_accepted" type="checkbox" required><span>I acknowledge the <a href="/privacy">Privacy Notice</a> and <a href="/student-data">Student Data Notice</a>.</span></label>
        </fieldset>
        <fieldset class="optional-reminders"><legend>Optional adult communications</legend>
          <p>No optional choice is selected by default. WhatsApp is not an active launch channel.</p>
          <label><input id="general_marketing_consent" name="general_marketing_consent" type="checkbox"> General marketing</label>
          <label><input id="parent_newsletter_consent" name="parent_newsletter_consent" type="checkbox"> Parent newsletter</label>
        </fieldset>
        <div class="signup-access-state" data-before-expiry><p data-signup-helper>No credit card. Free access ends September 13, 2026 at 7:24 p.m. Jerusalem time.</p></div>
        <div class="signup-access-state" data-at-or-after-expiry hidden><p>$67/month after account creation through secure hosted checkout. No charge is made by this form.</p></div>
      </section>
      <section data-school-fields aria-labelledby="school-fields-heading" hidden>
        <h2 id="school-fields-heading">Send a School inquiry</h2>
        <p class="section-note">This is manual follow-up only. It does not create learner access, enroll an existing audience, or start WhatsApp messages.</p>
        <div class="field"><label for="school_contact_name">Parent or contact name</label><input id="school_contact_name" name="school_contact_name" autocomplete="name" required disabled><p tabindex="-1" class="error" data-error-for="contact_name"></p></div>
        <div class="field"><label for="school_name">Family or School</label><input id="school_name" name="school_name" required disabled><small>Do not include Student names, ages, medical details, or private learner notes.</small><p tabindex="-1" class="error" data-error-for="family_or_school"></p></div>
        <div class="field"><label for="school_location">Location</label><input id="school_location" name="school_location" autocomplete="address-level2" required disabled><p tabindex="-1" class="error" data-error-for="location"></p></div>
        <div class="field"><label for="school_email">School contact email</label><input id="school_email" name="school_email" type="email" autocomplete="email" inputmode="email" required disabled><p tabindex="-1" class="error" data-error-for="email"></p></div>
        <label class="consent"><input id="school_email_reminder_consent" name="school_email_reminder_consent" type="checkbox" disabled> Email follow-up about this inquiry</label>
        <p class="signup-policy-note">By submitting, you ask the One Time team to respond to this School inquiry and acknowledge the <a href="/privacy">Privacy Notice</a>.</p>
      </section>
      <button class="button button-primary" type="submit" data-enhanced-submit hidden>Create my free family account</button>
      <p class="form-status" role="status" data-form-status></p>
    </form>
    <div class="success-panel" data-success-panel hidden tabindex="-1">
      <h2 data-success-heading>Request received</h2>
      <p data-success-body>We saved your request.</p>
      <a class="text-link" href="/login">Member Login</a>
    </div>
  </section>
</main>${footer()}`,
    { canonicalPath: '/signup' },
  );
}

function tishaBavLandingPage() {
  const shareUrl = 'https://join.onetimeonetime.com/tisha-bav';
  const shareText = `Reserve your spot for the Tisha B'Av live Zoom class with Rabbi Eli Scheller: ${shareUrl}`;
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const emailShareUrl = `mailto:?subject=${encodeURIComponent("Tisha B'Av VIP Zoom Class")}&body=${encodeURIComponent(shareText)}`;

  return pageShell(
    "Bringing Knowledge of Hashem into the World | Tisha B'Av VIP Zoom Class",
    `<main class="event-page tisha-bav-page">
  <section class="tisha-page" aria-labelledby="tisha-bav-title">
    <p class="event-pasuk" lang="he" dir="rtl">כי מלאה הארץ דעה את השם</p>
    <div class="tisha-artwork" data-event-artwork>
      <picture class="tisha-picture">
        <source media="(max-width: 767px)" srcset="${tishaBavMobileImage}">
        <img src="${tishaBavDesktopImage}" alt=""${mediaSizeAttributes(tishaBavDesktopImage)} decoding="async" fetchpriority="high" data-event-hero-image>
      </picture>
      <div class="tisha-copy">
        <h1 id="tisha-bav-title">Bringing Knowledge of Hashem into the World</h1>
      </div>
    </div>
    <div class="tisha-details" aria-label="Event details">
      <p class="event-intro">Live class with Rabbi Eli Scheller</p>
      <p class="event-date">Thursday, July 23, 2026</p>
      <p class="event-time"><strong>3 p.m. Eastern Time</strong></p>
      <p class="event-charge">No charge</p>
      <button class="button button-primary tisha-primary-cta" type="button" data-event-open-modal aria-haspopup="dialog" aria-controls="event-register-modal" aria-expanded="false">Reserve My Spot</button>
    </div>
  </section>
  <div class="event-modal-backdrop" data-event-modal-backdrop hidden></div>
  <section class="event-modal" id="event-register-modal" role="dialog" aria-modal="true" aria-label="Tisha B'Av registration" data-event-modal data-event-share-url="${escapeHtml(shareUrl)}" hidden tabindex="-1">
    <div class="event-register-shell">
      <button class="event-modal-close" type="button" data-event-close-modal aria-label="Close registration modal">Close</button>
      <div class="event-registration-content" data-event-registration-content>
        <h2 id="event-register-title">Reserve My Spot</h2>
        <p class="event-form-note">Join an international live Zoom class and receive the event link by email.</p>
        <div class="noscript-panel" role="status" data-event-noscript><strong>JavaScript is required for secure event registration.</strong><span>Please use a browser with JavaScript enabled.</span></div>
        <form class="event-form" action="/api/v1/events/tisha-bav-2026/register" method="post" data-event-registration-form novalidate>
          <input type="text" name="homepage" autocomplete="off" tabindex="-1" aria-hidden="true" class="honeypot-field">
          <div class="field"><label for="event_email">Email</label><input id="event_email" name="email" type="email" inputmode="email" autocomplete="email" required><p tabindex="-1" class="error" data-error-for="email"></p></div>
          <div class="field"><label for="event_first_name">First name <span>optional</span></label><input id="event_first_name" name="first_name" autocomplete="given-name"><p tabindex="-1" class="error" data-error-for="first_name"></p></div>
          <button class="button button-primary" type="submit" data-event-submit hidden>Reserve My Spot</button>
          <p class="event-submit-disclosure">By reserving, you’ll receive emails about this event.</p>
          <p class="form-status" role="status" data-form-status></p>
        </form>
      </div>
      <div class="event-success-panel" data-event-success-panel hidden tabindex="-1">
        <div class="event-success-copy">
          <p class="event-success-eyebrow">Registration complete</p>
          <h2 lang="he" dir="rtl">שֶׁנִּזְכֶּה לִרְאוֹת אֶת יְרוּשָׁלַיִם בְּבִנְיָנָהּ</h2>
          <p>May we merit to see Jerusalem rebuilt.</p>
          <p>We'll email the private Zoom link and event details.</p>
        </div>
        <div class="event-share-actions" aria-label="Share this event">
          <a class="button button-primary event-share-button" href="${escapeHtml(whatsappShareUrl)}" data-event-share-link target="_blank" rel="noopener">WhatsApp share</a>
          <a class="button event-share-button" href="${escapeHtml(emailShareUrl)}" data-event-share-link>Email a Friend</a>
          <button class="button event-share-button" type="button" data-event-copy-link>Copy Link</button>
          <button class="button event-share-button" type="button" data-event-native-share hidden>Share</button>
        </div>
        <p class="form-status event-copy-status" role="status" data-event-copy-status></p>
      </div>
    </div>
  </section>
</main>`,
    {
      canonicalPath: '/tisha-bav',
      description:
        "Reserve a spot for a special Tisha B'Av live Zoom class with Rabbi Eli Scheller.",
      ogTitle: "Tisha B'Av Live Zoom Class",
      ogDescription: 'Live Zoom class with Rabbi Eli Scheller for boys. No charge.',
      ogImage: publicCanonicalUrl(tishaBavSocialImage),
      ogImageSecureUrl: publicCanonicalUrl(tishaBavSocialImage),
      ogImageType: 'image/png',
      ogImageWidth: 1200,
      ogImageHeight: 630,
      ogImageAlt: "One Time logo for the Tisha B'Av live Zoom class",
      twitterImage: publicCanonicalUrl(tishaBavSocialImage),
      icon: tishaBavFavicon,
      appleTouchIcon: tishaBavAppleTouchIcon,
    },
  );
}

function tishaBavLivePage() {
  return pageShell(
    "Private Access | Tisha B'Av Program",
    `<main class="event-page event-live-page">
  <section class="event-live-shell" aria-labelledby="event-live-title">
    ${renderLogo({
      label: 'One Time Mishnayos home',
      subtitle: 'Private event access',
      href: '/',
      size: 60,
    })}
    <p class="event-kicker">Private Zoom access</p>
    <h1 id="event-live-title">A Live Tisha B'Av Program with Rabbi Eli Scheller</h1>
    <p class="event-time"><span>Thursday, July 23, 2026</span><strong>3:00 PM Eastern / 10:00 PM Israel</strong></p>
    <form class="event-form event-join-form" action="/api/v1/events/tisha-bav-2026/join" method="post" data-event-join-form novalidate>
      <input type="hidden" name="idempotency_key" value="join-page-form">
      <input type="text" name="homepage" autocomplete="off" tabindex="-1" aria-hidden="true" class="honeypot-field">
      <div class="field"><label for="join_email">Registered email</label><input id="join_email" name="email" type="email" inputmode="email" autocomplete="email" required><p tabindex="-1" class="error" data-error-for="email"></p></div>
      <button class="button button-primary" type="submit">Join the Live Program</button>
      <p class="form-status" role="status" data-form-status>Access opens shortly before the program.</p>
    </form>
  </section>
</main>`,
    {
      canonicalPath: '/tisha-bav/live',
      description: "Private access page for the One Time Tisha B'Av live program.",
    },
  )
    .replace('index, follow', 'noindex, nofollow')
    .replace(
      '<meta name="theme-color"',
      '<meta name="referrer" content="no-referrer">\n  <meta name="theme-color"',
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
        <div><dt>Last updated</dt><dd>${escapeHtml(legalPolicyMetadata.lastUpdated)}</dd></div>
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
await writeFile(path.join(outDir, 'index.html'), landingPage());
await writeFile(path.join(outDir, 'signup.html'), signupPage());
await writeFile(path.join(outDir, 'tisha-bav.html'), tishaBavLandingPage());
await writeFile(path.join(outDir, 'tisha-bav-live.html'), tishaBavLivePage());
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
await writeFile(
  path.join(outDir, 'app', 'experience-preview-student.html'),
  pageShell(
    'Fictional Student Preview | One Time Mishnayos',
    `<div id="experience-preview-student-root"></div>`,
    {
      app: true,
      appEntry: 'experience-preview-student',
      canonicalPath: '/app/experience-preview/student',
      description: 'One Time isolated read-only fictional Student preview.',
    },
  ).replace('index, follow', 'noindex, nofollow'),
);
