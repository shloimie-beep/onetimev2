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
  campaignTicker,
  communicationConsentNotice,
  landingContent,
  legalPolicyMetadata,
  parentGuardianStudentDataNotice,
  privacyDataCategories,
  privacyNotice,
  sharedNav,
  successCopy,
  termsOfUse,
} from '../packages/domain/src/index.ts';
import type { LegalDocument, LegalSection } from '../packages/domain/src/legal/index.ts';
import { publicCanonicalUrl } from './public-page-metadata.ts';

const outDir = path.resolve(process.cwd(), 'dist/apps/web/public');

const tishaBavDesktopImage = '/assets/events/tisha-bav-2026/tisha%20beav(1).png';
const tishaBavMobileImage = '/assets/events/tisha-bav-2026/tishea%20beav%20mobile(1).png';
const tishaBavSocialImage = '/assets/events/tisha-bav-2026/tisha-bav-whatsapp-card-v20260723.png';
const tishaBavFavicon = '/assets/events/tisha-bav-2026/tisha-bav-favicon-v20260722.png';
const tishaBavAppleTouchIcon =
  '/assets/events/tisha-bav-2026/tisha-bav-apple-touch-icon-v20260722.png';

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
    extraStylesheet?: string;
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
    ...(options.extraStylesheet === undefined ? {} : { extraStylesheet: options.extraStylesheet }),
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
    <div class="noscript-panel" role="status" data-noscript-fallback><strong>JavaScript is required for secure signup submission.</strong><span>Please use a browser with JavaScript enabled or use the contact method supplied by the One Time team. Do not send student-sensitive information through this public form.</span></div>
    <form class="signup-form" action="/api/v1/leads" method="post" data-signup-form data-consent-policy-version="${escapeHtml(legalPolicyMetadata.consentPolicyVersion)}" novalidate>
      <div class="field"><label for="contact_name">Parent or contact name</label><input id="contact_name" name="contact_name" autocomplete="name" required><p tabindex="-1" class="error" data-error-for="contact_name"></p></div>
      <div class="field"><label for="family_or_school">Family or School</label><input id="family_or_school" name="family_or_school" required><small>Do not include student names, ages, medical details, or private learner notes here.</small><p tabindex="-1" class="error" data-error-for="family_or_school"></p></div>
      <fieldset><legend>Signing up as</legend><label><input type="radio" name="audience_type" value="family" checked> Family</label><label><input type="radio" name="audience_type" value="school"> School</label></fieldset>
      <div class="field"><label for="location">Location</label><input id="location" name="location" autocomplete="address-level2" placeholder="City, country, ZIP/postal code, or area" required><small>Type a city, ZIP/postal code, area code, or neighborhood.</small><p tabindex="-1" class="error" data-error-for="location"></p></div>
      <input id="timezone" name="timezone" type="hidden">
      <div class="field"><label for="timezone_fallback">Time zone</label><input id="timezone_fallback" name="timezone_fallback" placeholder="America/New_York" hidden disabled><small>Use an IANA time zone such as America/New_York.</small><p tabindex="-1" class="error" data-error-for="timezone"></p></div>
      <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" inputmode="email" required><p tabindex="-1" class="error" data-error-for="email"></p></div>
      <div class="field"><label for="phone">Phone / WhatsApp</label><input id="phone" name="phone" type="tel" autocomplete="tel" inputmode="tel"><small>Required only if you choose WhatsApp reminders.</small><p tabindex="-1" class="error" data-error-for="phone"></p></div>
      <fieldset class="service-communications" aria-describedby="service_communications_note"><legend>Required service communications</legend><p id="service_communications_note">By submitting, you ask One Time Mishnayos to respond to this signup. Service messages about signup receipt, account/security, class access, or support may be sent when needed. Optional daily reminders are separate.</p></fieldset>
      <fieldset class="optional-reminders" aria-describedby="optional_reminders_note"><legend>Optional class reminders</legend><p id="optional_reminders_note">Choose each reminder channel separately. No optional reminders are selected by default.</p><label><input id="email_reminder_consent" name="email_reminder_consent" type="checkbox" value="yes"> Email class reminders</label><label><input id="whatsapp_reminder_consent" name="whatsapp_reminder_consent" type="checkbox" value="yes"> WhatsApp class reminders</label><p class="policy-note">Reminder consent policy version: ${escapeHtml(legalPolicyMetadata.consentPolicyVersion)}. You can stop optional messages by using unsubscribe instructions, replying STOP where supported, or contacting the One Time team.</p></fieldset>
      <p class="signup-policy-note">By submitting, you agree to the <a href="/terms">Terms</a> and acknowledge the <a href="/privacy">Privacy Notice</a>, including the <a href="/communications-consent">Communication and Reminder Consent</a> and <a href="/student-data">Parent/Guardian and Student Data Notice</a>.</p>
      <button class="button button-primary" type="submit" data-enhanced-submit hidden>Sign Up Now</button>
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

function tishaBavLandingPage() {
  const shareUrl = 'https://join.onetimeonetime.com/tisha-bav';
  const shareText = `Reserve your spot for the live Tisha B'Av event with Rabbi Eli Scheller: ${shareUrl}`;
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const emailShareUrl = `mailto:?subject=${encodeURIComponent("Live Tisha B'Av Event")}&body=${encodeURIComponent(shareText)}`;

  return pageShell(
    "Live Tisha B'Av Event with Rabbi Eli Scheller | One Time Mishnayos",
    `<main class="event-page tisha-bav-page">
  <section class="tisha-page" aria-labelledby="tisha-bav-title">
    <header class="tisha-heading">
      <p class="event-pasuk" lang="he" dir="rtl">כי מלאה הארץ דעה את השם</p>
    </header>
    <div class="tisha-artwork" data-event-artwork>
      <picture class="tisha-picture">
        <source media="(max-width: 820px), (orientation: portrait) and (max-width: 900px)" srcset="${tishaBavMobileImage}">
        <img src="${tishaBavDesktopImage}" alt=""${mediaSizeAttributes(tishaBavDesktopImage)} decoding="async" fetchpriority="high" data-event-hero-image>
      </picture>
      <div class="tisha-copy">
        <h1 id="tisha-bav-title" aria-label="Live Tisha B'Av Event with Rabbi Eli Scheller">
          <span class="tisha-title-line tisha-title-event">Live Tisha B'Av Event</span>
          <span class="tisha-title-line tisha-title-rabbi">with Rabbi Eli Scheller</span>
        </h1>
      </div>
    </div>
    <div class="tisha-details" aria-label="Event details">
      <div class="event-schedule">
        <p class="event-date">Thursday, July 23, 2026</p>
        <p class="event-time"><strong>3:00 p.m. Eastern Time</strong></p>
      </div>
      <p class="event-charge">No charge</p>
      <button class="button button-primary tisha-primary-cta" type="button" data-event-open-modal aria-haspopup="dialog" aria-controls="event-register-modal" aria-expanded="false">Reserve My Spot</button>
    </div>
  </section>
  <div class="event-modal-backdrop" data-event-modal-backdrop hidden></div>
  <section class="event-modal" id="event-register-modal" role="dialog" aria-modal="true" aria-label="Tisha B'Av registration" data-event-modal data-event-share-url="${escapeHtml(shareUrl)}" hidden tabindex="-1">
    <div class="event-register-shell">
      <button class="event-modal-close" type="button" data-event-close-modal aria-label="Close registration modal"><span aria-hidden="true">&times;</span></button>
      <div class="event-registration-content" data-event-registration-content>
        <h2 id="event-register-title">Reserve My Spot</h2>
        <p class="event-form-note">Join this live Tisha B'Av event and receive the private link by email.</p>
        <div class="noscript-panel" role="status" data-event-noscript><strong>JavaScript is required for secure event registration.</strong><span>Please use a browser with JavaScript enabled.</span></div>
        <form class="event-form" action="/api/v1/events/tisha-bav-2026/register" method="post" data-event-registration-form novalidate>
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
          <p data-event-success-message>The link was sent to your email.</p>
        </div>
        <div class="event-share-actions" aria-label="Share this event">
          <a class="button event-share-button" href="${escapeHtml(whatsappShareUrl)}" data-event-share-link target="_blank" rel="noopener" aria-label="Share on WhatsApp"><svg class="event-share-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M20 11.6a8 8 0 0 1-11.8 7l-4.2 1.1 1.1-4A8 8 0 1 1 20 11.6Z"/><path d="M8.5 8.2c.2 3 2.4 5.2 5.4 5.6"/></svg><span>WhatsApp</span></a>
          <a class="button event-share-button" href="${escapeHtml(emailShareUrl)}" data-event-share-link aria-label="Email a friend"><svg class="event-share-icon" aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg><span>Email</span></a>
          <button class="button event-share-button" type="button" data-event-copy-link aria-label="Copy link"><svg class="event-share-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/></svg><span>Copy</span></button>
          <button class="button event-share-button" type="button" data-event-native-share hidden><svg class="event-share-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.2"/><circle cx="6" cy="12" r="2.2"/><circle cx="18" cy="19" r="2.2"/><path d="m8 11 8-5M8 13l8 5"/></svg><span>Share</span></button>
        </div>
        <p class="form-status event-copy-status" role="status" data-event-copy-status></p>
      </div>
    </div>
  </section>
</main>`,
    {
      canonicalPath: '/tisha-bav',
      description: "Reserve a spot for a live Tisha B'Av event with Rabbi Eli Scheller.",
      ogTitle: "Live Interactive Tisha B'Av Zoom Class with Rabbi Eli Scheller",
      ogDescription: '3:00 p.m. Eastern. No charge. Reserve your spot now.',
      ogImage: publicCanonicalUrl(tishaBavSocialImage),
      ogImageSecureUrl: publicCanonicalUrl(tishaBavSocialImage),
      ogImageType: 'image/png',
      ogImageWidth: 1200,
      ogImageHeight: 630,
      ogImageAlt:
        "Live interactive Tisha B'Av Zoom class with Rabbi Eli Scheller at 3:00 p.m. Eastern, no charge",
      twitterImage: publicCanonicalUrl(tishaBavSocialImage),
      icon: tishaBavFavicon,
      appleTouchIcon: tishaBavAppleTouchIcon,
      extraStylesheet: '/assets/events/tisha-bav-2026/tisha-bav.css',
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
