import './styles.css';
import { schoolInquiryFormModel } from './school/model.js';

const schoolInquiryModel = schoolInquiryFormModel();

const analyticsTargets = document.querySelectorAll<HTMLElement>('[data-ot-analytics-event]');
for (const target of analyticsTargets) {
  target.addEventListener('click', () => {
    const eventName = target.dataset.otAnalyticsEvent;
    const destination = target.dataset.otAnalyticsDestination;
    const placement = target.dataset.otAnalyticsPlacement;
    if (!eventName || !destination || !placement) return;
    window.dispatchEvent(
      new CustomEvent('ot:analytics', {
        detail: {
          event_name: eventName,
          destination,
          placement,
        },
      }),
    );
  });
}

const drawer = document.querySelector<HTMLElement>('[data-drawer]');
const drawerOverlay = document.querySelector<HTMLElement>('[data-drawer-overlay]');
const drawerToggle = document.querySelector<HTMLButtonElement>('[data-drawer-toggle]');
const drawerClose = document.querySelector<HTMLButtonElement>('[data-drawer-close]');
const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

function openDrawer() {
  if (!drawer || !drawerToggle || !drawerOverlay) return;
  drawer.hidden = false;
  drawerOverlay.hidden = false;
  document.documentElement.dataset.drawerOpen = 'true';
  drawerToggle.setAttribute('aria-expanded', 'true');
  drawerToggle.setAttribute('aria-label', 'Close navigation');
  drawer.querySelector<HTMLElement>(focusableSelector)?.focus();
}

function closeDrawer() {
  if (!drawer || !drawerToggle || !drawerOverlay) return;
  drawer.hidden = true;
  drawerOverlay.hidden = true;
  delete document.documentElement.dataset.drawerOpen;
  drawerToggle.setAttribute('aria-expanded', 'false');
  drawerToggle.setAttribute('aria-label', 'Open navigation');
  drawerToggle.focus();
}

drawerToggle?.addEventListener('click', () => (drawer?.hidden ? openDrawer() : closeDrawer()));
drawerClose?.addEventListener('click', closeDrawer);
drawerOverlay?.addEventListener('click', closeDrawer);
drawer?.addEventListener('click', (event) => {
  if ((event.target as HTMLElement).closest('a')) closeDrawer();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && drawer && !drawer.hidden) closeDrawer();
  if (event.key !== 'Tab' || !drawer || drawer.hidden) return;
  const focusables = [...drawer.querySelectorAll<HTMLElement>(focusableSelector)];
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let serverClockOffsetMs = 0;

function serverNow() {
  return new Date(Date.now() + serverClockOffsetMs);
}

async function synchronizeServerClock() {
  const requestStartedAt = Date.now();
  try {
    const response = await fetch('/health', {
      method: 'HEAD',
      cache: 'no-store',
      credentials: 'same-origin',
    });
    const serverDate = response.headers.get('date');
    if (!serverDate) return;
    const parsed = Date.parse(serverDate);
    if (!Number.isFinite(parsed)) return;
    const midpoint = requestStartedAt + (Date.now() - requestStartedAt) / 2;
    serverClockOffsetMs = parsed - midpoint;
  } catch {
    // The local clock remains a useful display fallback. Server/domain rules
    // remain authoritative for account access and checkout.
  }
}

function renderTimedAccessState() {
  document.querySelectorAll<HTMLElement>('[data-access-boundary]').forEach((container) => {
    const boundary = Date.parse(container.dataset.accessBoundary ?? '');
    if (!Number.isFinite(boundary)) return;
    const expired = serverNow().getTime() >= boundary;
    container.querySelectorAll<HTMLElement>('[data-before-expiry]').forEach((node) => {
      node.hidden = expired;
    });
    container.querySelectorAll<HTMLElement>('[data-at-or-after-expiry]').forEach((node) => {
      node.hidden = !expired;
    });
    if (container.matches('[data-signup-form]')) {
      const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (submit && !submit.disabled) {
        submit.textContent = 'Create your Family account';
      }
    }
  });
}

const campaign = document.querySelector<HTMLElement>('[data-campaign-deadline]');
function renderCampaignCountdown() {
  if (!campaign) return;
  const shell = campaign.closest<HTMLElement>('.campaign-ticker-shell');
  const boundary = Date.parse(campaign.dataset.campaignDeadline ?? '');
  if (!Number.isFinite(boundary)) {
    if (shell) shell.hidden = true;
    return;
  }
  const remainingMs = boundary - serverNow().getTime();
  if (shell) shell.hidden = remainingMs <= 0;
  campaign.hidden = false;
}

const roleSelector = document.querySelector<HTMLElement>('[data-role-selector]');
if (roleSelector) void installRoleSelector(roleSelector);

async function installRoleSelector(root: HTMLElement) {
  const status = root.querySelector<HTMLElement>('[data-role-status]');
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-select-role]')];
  let csrfToken = '';
  try {
    const response = await fetch('/api/v2.1/auth/session', {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    });
    const payload = (await response.json()) as {
      csrf_token?: string;
      account_context?: { available_roles?: string[] };
    };
    if (!response.ok || !payload.csrf_token) throw new Error('session_unavailable');
    csrfToken = payload.csrf_token;
    const available = new Set(payload.account_context?.available_roles ?? []);
    buttons.forEach((button) => {
      button.disabled = !available.has(button.dataset.selectRole ?? '');
    });
  } catch {
    if (status)
      status.textContent = 'Your signed-in account could not be verified. Please sign in again.';
    buttons.forEach((button) => (button.disabled = true));
    return;
  }

  buttons.forEach((button) =>
    button.addEventListener('click', async () => {
      const requestedRole = button.dataset.selectRole;
      if (requestedRole !== 'admin' && requestedRole !== 'parent') return;
      buttons.forEach((candidate) => (candidate.disabled = true));
      if (status)
        status.textContent = `Opening the ${requestedRole === 'admin' ? 'Admin' : 'Parent'} workspace…`;
      try {
        const response = await fetch('/api/v2.1/account-context/role', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'x-csrf-token': csrfToken,
          },
          body: JSON.stringify({ requested_role: requestedRole, csrf_token: csrfToken }),
        });
        const payload = (await response.json()) as { return_to?: string; message?: string };
        if (!response.ok || !payload.return_to) {
          throw new Error(payload.message ?? 'Role switch failed.');
        }
        window.location.assign(payload.return_to);
      } catch (error) {
        if (status) {
          status.textContent =
            error instanceof Error ? error.message : 'Role switching is unavailable right now.';
        }
        buttons.forEach((candidate) => (candidate.disabled = false));
      }
    }),
  );
}

const householdSelector = document.querySelector<HTMLElement>('[data-household-selector]');
if (householdSelector) void installHouseholdSelector(householdSelector);

async function installHouseholdSelector(root: HTMLElement) {
  const status = root.querySelector<HTMLElement>('[data-household-status]');
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-select-household]')];
  let csrfToken = '';
  try {
    const response = await fetch('/api/v2.1/account-context/households', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    const payload = (await response.json()) as {
      csrf_token?: string;
      households?: { householdId?: string }[];
    };
    if (!response.ok || !payload.csrf_token) throw new Error('session_unavailable');
    csrfToken = payload.csrf_token;
    const available = new Set(
      (payload.households ?? []).map((household) => household.householdId).filter(Boolean),
    );
    buttons.forEach((button) => {
      button.disabled = !available.has(button.dataset.selectHousehold ?? '');
    });
  } catch {
    if (status)
      status.textContent = 'Your household access could not be verified. Please sign in again.';
    buttons.forEach((button) => (button.disabled = true));
    return;
  }

  buttons.forEach((button) =>
    button.addEventListener('click', async () => {
      const selectedHouseholdId = button.dataset.selectHousehold;
      if (!selectedHouseholdId) return;
      buttons.forEach((candidate) => (candidate.disabled = true));
      if (status) status.textContent = 'Opening the selected Parent workspace…';
      try {
        const response = await fetch('/api/v2.1/account-context/household', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'x-csrf-token': csrfToken,
          },
          body: JSON.stringify({
            selected_household_id: selectedHouseholdId,
            csrf_token: csrfToken,
          }),
        });
        const payload = (await response.json()) as { return_to?: string; message?: string };
        if (!response.ok || !payload.return_to) {
          throw new Error(payload.message ?? 'Household selection failed.');
        }
        window.location.assign(payload.return_to);
      } catch (error) {
        if (status) {
          status.textContent =
            error instanceof Error
              ? error.message
              : 'Household selection is unavailable right now.';
        }
        buttons.forEach((candidate) => (candidate.disabled = false));
      }
    }),
  );
}

function renderLocalClassTime() {
  const target = document.querySelector<HTMLElement>('[data-local-class-time]');
  if (!target) return;
  const firstClassAt = Date.parse(target.dataset.firstClassAt ?? '');
  if (!Number.isFinite(firstClassAt)) {
    target.textContent = '';
    return;
  }
  target.textContent = ` — first class: ${new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(firstClassAt))}`;
}

function renderTimedPublicState() {
  renderCampaignCountdown();
  renderTimedAccessState();
  renderLocalClassTime();
}

renderTimedPublicState();
void synchronizeServerClock().finally(renderTimedPublicState);
window.setInterval(renderTimedPublicState, 60_000);

const carousel = document.querySelector<HTMLElement>('[data-gallery]');
if (carousel) {
  const slides = [...carousel.querySelectorAll<HTMLElement>('[data-gallery-slide]')];
  const buttons = [...carousel.querySelectorAll<HTMLButtonElement>('[data-gallery-dot]')];
  const track = carousel.querySelector<HTMLElement>('[data-gallery-track]');
  const viewport = carousel.querySelector<HTMLElement>('[data-gallery-viewport]');
  const status = carousel.querySelector<HTMLElement>('[data-gallery-status]');
  const toggle = carousel.querySelector<HTMLButtonElement>('[data-gallery-toggle]');
  let index = 0;
  let pointerStartX: number | null = null;
  let autoplayTimer: number | undefined;
  let userPaused = reducedMotion;
  let pointerInside = false;
  let focusInside = false;
  const positionTrack = () => {
    if (!track || !viewport) return;
    const offset = index * viewport.getBoundingClientRect().width;
    track.style.transform = `translate3d(${-offset}px, 0, 0)`;
  };
  const show = (next: number, announce = true) => {
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === index;
      if (active) {
        slide.setAttribute('data-active', 'true');
      } else {
        slide.removeAttribute('data-active');
      }
      slide.setAttribute('aria-hidden', String(!active));
      slide.tabIndex = active ? 0 : -1;
    });
    buttons.forEach((button, buttonIndex) => {
      button.setAttribute('aria-pressed', String(buttonIndex === index));
    });
    positionTrack();
    const current = slides[index];
    const caption = current?.querySelector('figcaption')?.textContent?.trim();
    if (announce && status && caption) status.textContent = `Showing ${caption}`;
  };
  const stopAutoplay = () => {
    window.clearInterval(autoplayTimer);
    autoplayTimer = undefined;
  };
  const syncAutoplay = () => {
    stopAutoplay();
    if (
      reducedMotion ||
      userPaused ||
      pointerInside ||
      focusInside ||
      document.hidden ||
      slides.length < 2
    ) {
      return;
    }
    autoplayTimer = window.setInterval(() => show(index + 1, false), 6000);
  };
  const showFromControl = (next: number) => {
    show(next);
    syncAutoplay();
  };
  buttons.forEach((button, buttonIndex) =>
    button.addEventListener('click', () => showFromControl(buttonIndex)),
  );
  carousel
    .querySelector<HTMLButtonElement>('[data-gallery-prev]')
    ?.addEventListener('click', () => showFromControl(index - 1));
  carousel
    .querySelector<HTMLButtonElement>('[data-gallery-next]')
    ?.addEventListener('click', () => showFromControl(index + 1));
  carousel.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showFromControl(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      showFromControl(index + 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      showFromControl(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      showFromControl(slides.length - 1);
    }
  });
  viewport?.addEventListener('pointerdown', (event) => {
    pointerStartX = event.clientX;
  });
  viewport?.addEventListener('pointerup', (event) => {
    if (pointerStartX === null) return;
    const delta = event.clientX - pointerStartX;
    pointerStartX = null;
    if (Math.abs(delta) < 36) return;
    showFromControl(index + (delta < 0 ? 1 : -1));
  });
  viewport?.addEventListener('pointercancel', () => (pointerStartX = null));
  viewport?.addEventListener('click', () => showFromControl(index + 1));
  carousel.addEventListener('mouseenter', () => {
    pointerInside = true;
    syncAutoplay();
  });
  carousel.addEventListener('mouseleave', () => {
    pointerInside = false;
    syncAutoplay();
  });
  carousel.addEventListener('focusin', () => {
    focusInside = true;
    syncAutoplay();
  });
  carousel.addEventListener('focusout', () => {
    window.requestAnimationFrame(() => {
      focusInside = carousel.contains(document.activeElement);
      syncAutoplay();
    });
  });
  document.addEventListener('visibilitychange', syncAutoplay);
  if (toggle) {
    if (reducedMotion) {
      toggle.textContent = 'Slideshow paused';
      toggle.setAttribute('aria-pressed', 'true');
      toggle.disabled = true;
    } else {
      toggle.addEventListener('click', () => {
        userPaused = !userPaused;
        toggle.textContent = userPaused ? 'Play slideshow' : 'Pause slideshow';
        toggle.setAttribute('aria-pressed', String(userPaused));
        syncAutoplay();
      });
    }
  }
  if (reducedMotion) track?.classList.add('is-reduced-motion');
  window.addEventListener('resize', positionTrack);
  show(0, false);
  syncAutoplay();
}

const pressCarousel = document.querySelector<HTMLElement>('[data-press-carousel]');
if (pressCarousel) {
  const slides = [...pressCarousel.querySelectorAll<HTMLElement>('span')];
  const status = document.querySelector<HTMLElement>('[data-press-status]');
  let index = 0;
  let timer: number | undefined;
  let paused = reducedMotion;
  const show = (next: number, announce = true) => {
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      slide.toggleAttribute('data-active', slideIndex === index);
      slide.setAttribute('aria-hidden', String(slideIndex !== index));
    });
    const label = slides[index]?.querySelector('img')?.alt;
    if (announce && label && status) status.textContent = `Showing ${label}`;
  };
  const sync = () => {
    window.clearInterval(timer);
    if (!paused && !document.hidden && slides.length > 1) timer = window.setInterval(() => show(index + 1, false), 3500);
  };
  pressCarousel.addEventListener('click', () => { show(index + 1); sync(); });
  pressCarousel.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      show(index + (event.key === 'ArrowRight' ? 1 : -1));
      sync();
    }
  });
  pressCarousel.addEventListener('mouseenter', () => { paused = true; sync(); });
  pressCarousel.addEventListener('mouseleave', () => { paused = reducedMotion; sync(); });
  pressCarousel.addEventListener('focusin', () => { paused = true; sync(); });
  pressCarousel.addEventListener('focusout', () => { paused = reducedMotion; sync(); });
  document.addEventListener('visibilitychange', sync);
  show(0, false);
  sync();
}

document.querySelectorAll<HTMLImageElement>('[data-image-watch]').forEach((image) => {
  image.addEventListener(
    'error',
    () => {
      image
        .closest<HTMLElement>('[data-gallery-slide], .benefit-visual')
        ?.setAttribute('data-image-error', 'true');
    },
    { once: true },
  );
});

if (!reducedMotion && 'IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const target = entry.target as HTMLElement;
        target.dataset.scrollReveal = 'visible';
        revealObserver.unobserve(target);
      });
    },
    { threshold: 0.18 },
  );
  document.querySelectorAll<HTMLElement>('[data-scroll-reveal]').forEach((target) => {
    if (target.getBoundingClientRect().top < window.innerHeight * 0.92) {
      target.dataset.scrollReveal = 'visible';
      return;
    }
    target.dataset.scrollReveal = 'pending';
    revealObserver.observe(target);
  });
}

const signupReceived = document.querySelector<HTMLElement>('[data-signup-received]');
if (signupReceived) configureSignupReceivedPage(signupReceived);

const form = document.querySelector<HTMLFormElement>('[data-signup-form]');
if (form) {
  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const success = document.querySelector<HTMLElement>('[data-success-panel]');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const timezone = form.querySelector<HTMLInputElement>('#timezone');
  const schoolOnly = form.dataset.signupEntry === 'school';
  const familyBootstrap: {
    idempotency_key: string;
    csrf_token: string;
    expires_at: string;
    writes_allowed: boolean;
  }[] = [];
  if (submit) submit.hidden = false;

  const setError = (name: string, message: string) => {
    const field = form.querySelector<HTMLElement>(`[data-error-for="${name}"]`);
    if (field) field.textContent = message;
  };
  const clearErrors = () =>
    form
      .querySelectorAll<HTMLElement>('[data-error-for]')
      .forEach((node) => (node.textContent = ''));
  const currentEntry = () => (schoolOnly ? 'school' : 'family');
  const familyButtonCopy = () => 'Create your Family account';

  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timezone && detectedTimezone) timezone.value = detectedTimezone;
  if (submit) submit.textContent = schoolOnly ? schoolInquiryModel.cta : familyButtonCopy();

  const loadFamilyBootstrap = async () => {
    const current = familyBootstrap[0];
    if (current && Date.parse(current.expires_at) > serverNow().getTime() + 10_000) return current;
    const response = await fetch('/api/v1/signup/family/bootstrap', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    });
    const json = (await response.json()) as (typeof familyBootstrap)[number] & {
      success?: boolean;
      message?: string;
    };
    if (!response.ok || !json.success) {
      throw new Error(json.message ?? 'Refresh the page and try again.');
    }
    familyBootstrap.splice(0, familyBootstrap.length, json);
    return json;
  };
  if (!schoolOnly) {
    void loadFamilyBootstrap().catch(() => {
      if (status)
        status.textContent = 'Secure Family signup is still loading. You can retry shortly.';
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();
    const entry = currentEntry();
    const password = form.querySelector<HTMLInputElement>('#password');
    const passwordConfirmation = form.querySelector<HTMLInputElement>('#password_confirmation');
    if (
      entry === 'family' &&
      password &&
      passwordConfirmation &&
      password.value !== passwordConfirmation.value
    ) {
      setError('password_confirmation', 'Passwords must match.');
      passwordConfirmation.focus();
      return;
    }
    if (!form.reportValidity()) return;
    const data = new FormData(form);

    if (submit) {
      submit.disabled = true;
      submit.textContent = entry === 'family' ? 'Creating account…' : 'Sending inquiry…';
    }
    if (status) status.textContent = '';

    try {
      let response: Response;
      if (entry === 'family') {
        const bootstrap = await loadFamilyBootstrap();
        if (!bootstrap.writes_allowed) {
          throw new Error('Signup writes are disabled in this verification environment.');
        }
        response = await fetch('/api/v1/signup/family', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            'x-csrf-token': bootstrap.csrf_token,
          },
          body: JSON.stringify({
            classification: 'family',
            idempotency_key: bootstrap.idempotency_key,
            first_name: String(data.get('first_name') ?? ''),
            last_name: String(data.get('last_name') ?? ''),
            email: String(data.get('email') ?? ''),
            password: String(data.get('password') ?? ''),
            password_confirmation: String(data.get('password_confirmation') ?? ''),
            timezone: String(data.get('timezone') ?? ''),
            terms_accepted: data.get('terms_accepted') === 'on',
            privacy_accepted: data.get('privacy_accepted') === 'on',
            general_marketing_consent: data.get('general_marketing_consent') === 'on',
            parent_newsletter_consent: data.get('parent_newsletter_consent') === 'on',
          }),
        });
      } else {
        const phone = String(data.get('phone') ?? '').trim();
        const note = String(data.get('note') ?? '').trim();
        response = await fetch('/api/v2.1/signup/school-inquiry', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({
            school_name: String(data.get('school_name') ?? ''),
            contact_first_name: String(data.get('contact_first_name') ?? ''),
            contact_last_name: String(data.get('contact_last_name') ?? ''),
            email: String(data.get('email') ?? ''),
            ...(phone ? { phone } : {}),
            ...(note ? { note } : {}),
          }),
        });
      }
      const json = (await response.json()) as {
        success?: boolean;
        message?: string | { heading?: string; body?: string };
        field_errors?: Record<string, string>;
        code?: string;
        session_established?: boolean;
        continue_to?: string;
        provider_projection_state?: string;
      };
      if (!response.ok || !json.success) {
        if (json.field_errors) {
          Object.entries(json.field_errors).forEach(([name, message]) => setError(name, message));
          form.querySelector<HTMLElement>('[data-error-for]:not(:empty)')?.focus();
        } else if (status) {
          status.textContent =
            typeof json.message === 'string'
              ? json.message
              : (json.code ?? 'We could not save that request yet.');
        }
        return;
      }
      if (entry === 'family') {
        const search = new URLSearchParams(window.location.search);
        const requestedContinueTo = search.get('continue_to');
        window.location.assign(
          familySignupReceiptLocation(
            json,
            search.has('continue_to') ? requestedContinueTo : undefined,
          ),
        );
        return;
      }
      form.hidden = true;
      if (success) {
        success.hidden = false;
        const heading = success.querySelector<HTMLElement>('[data-success-heading]');
        const body = success.querySelector<HTMLElement>('[data-success-body]');
        const parentDashboard = success.querySelector<HTMLAnchorElement>('[data-success-continue]');
        if (heading) {
          heading.textContent =
            (typeof json.message === 'object' && json.message.heading) ||
            'Thank you — we received your School inquiry.';
        }
        if (body) {
          body.textContent =
            typeof json.message === 'string'
              ? json.message
              : (json.message?.body ?? schoolInquiryModel.success);
        }
        if (parentDashboard) parentDashboard.hidden = true;
        success.focus();
      }
    } catch (error) {
      if (status) {
        status.textContent =
          error instanceof Error ? error.message : 'We could not save that request yet.';
      }
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = entry === 'family' ? familyButtonCopy() : schoolInquiryModel.cta;
      }
    }
  });
}

function familyConfirmationCopy(providerProjectionState: string | undefined): string {
  return providerProjectionState === 'ready'
    ? 'Your Family account is ready, and we sent your confirmation email.'
    : 'Your Family account is ready. You can continue now while we finish sending your confirmation email.';
}

type FamilySignupReceiptState =
  'ready' | 'session_pending' | 'sign_in' | 'identity_review' | 'checkout_queued' | 'received';

type FamilySignupReceiptResponse = {
  code?: string;
  session_established?: boolean;
  continue_to?: string;
  provider_projection_state?: string;
};

function familySignupReceiptLocation(
  response: FamilySignupReceiptResponse,
  requestedContinueTo?: string | null,
): string {
  const state = familySignupReceiptState(response);
  const search = new URLSearchParams({
    state,
    email: response.provider_projection_state === 'ready' ? 'sent' : 'pending',
  });
  if (state === 'ready') {
    const continueTo = safeParentContinueTo(requestedContinueTo ?? response.continue_to);
    if (continueTo) search.set('continue_to', continueTo);
  }
  return `/signup/received?${search.toString()}`;
}

function familySignupReceiptState(response: FamilySignupReceiptResponse): FamilySignupReceiptState {
  if (response.session_established === true) return 'ready';
  if (response.code === 'SIGN_IN_OR_RESET') return 'sign_in';
  if (response.code === 'SIGNUP_COMMITTED_IDENTITY_REVIEW') return 'identity_review';
  if (response.code === 'SIGNUP_COMMITTED_CHECKOUT_HANDOFF_QUEUED') return 'checkout_queued';
  if (response.code === 'SIGNUP_COMMITTED_SESSION_UNAVAILABLE') return 'session_pending';
  return 'received';
}

function configureSignupReceivedPage(receipt: HTMLElement): void {
  const heading = receipt.querySelector<HTMLElement>('[data-signup-received-heading]');
  const body = receipt.querySelector<HTMLElement>('[data-signup-received-body]');
  const primary = receipt.querySelector<HTMLAnchorElement>('[data-signup-received-primary]');
  if (!heading || !body || !primary) return;

  const search = new URLSearchParams(window.location.search);
  const state = search.get('state');
  primary.hidden = false;
  if (state === 'ready') {
    heading.textContent = 'You’re all set.';
    body.textContent = familyConfirmationCopy(search.get('email') === 'sent' ? 'ready' : undefined);
    primary.textContent = 'Go to Parent dashboard';
    primary.href = safeParentContinueTo(search.get('continue_to')) ?? '/app/parent';
  } else if (state === 'session_pending') {
    heading.textContent = 'Signup received';
    body.textContent =
      'Your Family account was saved. Sign in to continue while we finish sending your confirmation email.';
    primary.textContent = 'Sign in';
    primary.href = '/login';
  } else if (state === 'sign_in') {
    heading.textContent = 'Your account already exists';
    body.textContent = 'Sign in or reset your password to continue.';
    primary.textContent = 'Sign in';
    primary.href = '/login';
  } else if (state === 'identity_review') {
    heading.textContent = 'Signup received';
    body.textContent =
      'Your inactive account was saved. Checkout remains unavailable pending identity review.';
    primary.hidden = true;
  } else if (state === 'checkout_queued') {
    heading.textContent = 'Signup received';
    body.textContent =
      'Your inactive account was saved. The standard hosted-checkout handoff is queued; no charge was made by this form.';
    primary.hidden = true;
  } else {
    heading.textContent = 'Signup received';
    body.textContent = 'Your Family signup was saved. Sign in to continue.';
    primary.textContent = 'Sign in';
    primary.href = '/login';
  }
  receipt.focus();
}

function safeParentContinueTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1) {
    if (unsafeContinuationText(decoded)) return null;
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return null;
    }
  }
  if (unsafeContinuationText(decoded)) return null;
  try {
    if (decodeURIComponent(decoded) !== decoded) return null;
  } catch {
    return null;
  }
  try {
    const target = new URL(decoded, window.location.origin);
    if (
      target.origin !== window.location.origin ||
      target.username ||
      target.password ||
      (target.pathname !== '/app/parent' && !target.pathname.startsWith('/app/parent/'))
    ) {
      return null;
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

function unsafeContinuationText(value: string) {
  return (
    value.startsWith('//') ||
    value.includes('\\') ||
    [...value].some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
    })
  );
}

const loginForm = document.querySelector<HTMLFormElement>('[data-login-form]');
if (loginForm) {
  const status = loginForm.querySelector<HTMLElement>('[data-form-status]');
  const submit = loginForm.querySelector<HTMLButtonElement>('button[type="submit"]');
  const emailPanel = loginForm.querySelector<HTMLElement>('[data-email-challenge]');
  const emailInput = loginForm.querySelector<HTMLInputElement>('#email_code');
  const trustDevice = loginForm.querySelector<HTMLInputElement>('input[name="trust_device"]');
  const resendButton = loginForm.querySelector<HTMLButtonElement>('[data-resend-challenge]');
  const resendStatus = loginForm.querySelector<HTMLElement>('[data-resend-status]');
  const emailLinkConfirm = loginForm.querySelector<HTMLElement>('[data-email-link-confirm]');
  const emailLinkConfirmButton = emailLinkConfirm?.querySelector<HTMLButtonElement>('button');
  let challengeToken = '';
  let resendTimer: number | undefined;
  const setError = (name: string, message: string) => {
    const field = loginForm.querySelector<HTMLElement>(`[data-error-for="${name}"]`);
    if (field) field.textContent = message;
  };
  const clearErrors = () =>
    loginForm
      .querySelectorAll<HTMLElement>('[data-error-for]')
      .forEach((node) => (node.textContent = ''));
  const returnTo = () => String(new FormData(loginForm).get('return_to') ?? '');
  const revealEmailChallenge = (token: string) => {
    challengeToken = token;
    if (emailPanel) emailPanel.hidden = false;
    if (emailInput) {
      emailInput.required = true;
      emailInput.focus();
    }
    if (submit) submit.textContent = 'Verify code';
    startResendCooldown(45);
    if (status) status.textContent = 'We sent a login code to that account if it can sign in.';
  };
  const startResendCooldown = (seconds: number) => {
    window.clearInterval(resendTimer);
    let remaining = seconds;
    if (resendButton) resendButton.disabled = true;
    const render = () => {
      if (resendStatus) {
        resendStatus.textContent =
          remaining > 0 ? `Resend available in ${remaining}s.` : 'You can request a new code.';
      }
      if (remaining <= 0) {
        if (resendButton) resendButton.disabled = false;
        window.clearInterval(resendTimer);
      }
      remaining -= 1;
    };
    render();
    resendTimer = window.setInterval(render, 1000);
  };

  const emailLinkToken = consumeFragmentValue(['email_challenge_token', 'link_token']);
  if (emailLinkToken) {
    if (emailLinkConfirm) emailLinkConfirm.hidden = false;
    if (status) status.textContent = 'Confirm this email sign-in to continue.';
    emailLinkConfirmButton?.addEventListener('click', async () => {
      emailLinkConfirmButton.disabled = true;
      if (status) status.textContent = 'Confirming email sign-in...';
      const response = await postJson('/api/v1/auth/email-challenge/link', {
        link_token: emailLinkToken,
        return_to: returnTo(),
        trust_device: false,
      });
      if (response.ok && response.json.success) {
        window.location.assign(String(response.json.return_to ?? '/app/crm'));
        return;
      }
      emailLinkConfirmButton.disabled = false;
      if (status)
        status.textContent = String(
          response.json.message ?? 'Email confirmation was not accepted.',
        );
    });
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();
    if (!loginForm.reportValidity()) return;
    const data = new FormData(loginForm);
    if (submit) {
      submit.disabled = true;
      submit.textContent = challengeToken ? 'Verifying...' : 'Logging in...';
    }
    if (status) status.textContent = '';
    try {
      if (challengeToken) {
        const trimmedCode = String(data.get('email_code') ?? '').trim();
        if (!trimmedCode) {
          setError('email_code', 'Enter the code from your email.');
          emailInput?.focus();
          return;
        }
        const challengeResponse = await postJson('/api/v1/auth/email-challenge/verify', {
          challenge_token: challengeToken,
          code: trimmedCode,
          trust_device: trustDevice?.checked === true,
          return_to: returnTo(),
        });
        if (!challengeResponse.ok || !challengeResponse.json.success) {
          if (status)
            status.textContent = String(challengeResponse.json.message ?? 'Code was not accepted.');
          return;
        }
        window.location.assign(String(challengeResponse.json.return_to ?? '/app/crm'));
        return;
      }
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': String(data.get('csrf_token') ?? ''),
        },
        body: JSON.stringify({
          identifier: String(data.get('identifier') ?? ''),
          password: String(data.get('password') ?? ''),
          csrf_token: String(data.get('csrf_token') ?? ''),
          return_to: String(data.get('return_to') ?? ''),
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        if (json.code === 'EMAIL_CHALLENGE_REQUIRED' && json.challenge_token) {
          revealEmailChallenge(String(json.challenge_token));
          return;
        }
        if (json.field_errors) {
          Object.entries(json.field_errors as Record<string, string>).forEach(([name, message]) =>
            setError(name, message),
          );
        } else if (status) {
          status.textContent =
            json.message ??
            'Email/username or password is not correct. If access was revoked, ask your Parent or an Administrator to restore it.';
        }
        return;
      }
      window.location.assign(json.return_to ?? '/app/crm');
    } catch {
      if (status) status.textContent = 'Login is unavailable right now.';
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = challengeToken ? 'Verify code' : 'Login';
      }
    }
  });

  resendButton?.addEventListener('click', async () => {
    if (!challengeToken) return;
    resendButton.disabled = true;
    if (resendStatus) resendStatus.textContent = 'Requesting a new code...';
    const response = await postJson('/api/v1/auth/email-challenge/resend', {
      challenge_token: challengeToken,
    });
    if (!response.ok || !response.json.success) {
      if (resendStatus)
        resendStatus.textContent = String(
          response.json.message ?? 'Please wait before requesting another code.',
        );
      startResendCooldown(45);
      return;
    }
    challengeToken = String(response.json.challenge_token);
    if (emailInput) emailInput.value = '';
    startResendCooldown(45);
  });
}

const activationRoot = document.querySelector<HTMLElement>('[data-activation-root]');
if (activationRoot) {
  const token = consumeFragmentValue('token');
  const status = activationRoot.querySelector<HTMLElement>('[data-activation-status]');
  const error = activationRoot.querySelector<HTMLElement>('[data-activation-error]');
  const form = activationRoot.querySelector<HTMLFormElement>('[data-activation-form]');

  if (!token) {
    showFlowError(error, status, 'This activation link is missing its secure token.');
  } else {
    void checkLifecycleToken(token, 'activation', status, form, error);
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(form);
    if (!form.reportValidity() || !token) return;
    const data = new FormData(form);
    if (!passwordsMatch(form, data)) return;
    setFormStatus(form, '');
    setSubmitBusy(form, true, 'Activating...');
    try {
      const response = await postJson('/api/v1/account-lifecycle/activate', {
        token,
        password: String(data.get('password') ?? ''),
        csrf_token: String(data.get('csrf_token') ?? ''),
      });
      if (!response.ok || !response.json.success) {
        applyApiErrors(form, response.json, error);
        return;
      }
      window.location.assign(String(response.json.return_to ?? '/app/parent'));
    } finally {
      setSubmitBusy(form, false, 'Activate account');
    }
  });
}

const forgotPasswordForm = document.querySelector<HTMLFormElement>('[data-forgot-password-form]');
if (forgotPasswordForm) {
  forgotPasswordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(forgotPasswordForm);
    if (!forgotPasswordForm.reportValidity()) return;
    const data = new FormData(forgotPasswordForm);
    setSubmitBusy(forgotPasswordForm, true, 'Sending...');
    try {
      const response = await postJson('/api/v1/account-lifecycle/forgot-password', {
        email: String(data.get('email') ?? ''),
        csrf_token: String(data.get('csrf_token') ?? ''),
        idempotency_key: `forgot-${crypto.randomUUID()}`,
      });
      if (!response.ok || !response.json.success) {
        applyApiErrors(forgotPasswordForm, response.json);
        return;
      }
      setFormStatus(
        forgotPasswordForm,
        String(response.json.message ?? 'If that email has access, a reset link will be sent.'),
      );
    } catch {
      setFormStatus(forgotPasswordForm, 'If that email has access, a reset link will be sent.');
    } finally {
      setSubmitBusy(forgotPasswordForm, false, 'Send reset link');
    }
  });
}

const resetRoot = document.querySelector<HTMLElement>('[data-reset-root]');
if (resetRoot) {
  const token = consumeFragmentValue('token');
  const status = resetRoot.querySelector<HTMLElement>('[data-reset-status]');
  const form = resetRoot.querySelector<HTMLFormElement>('[data-reset-password-form]');
  if (!token) {
    if (status) status.textContent = 'This reset link is missing its secure token.';
  } else {
    void checkLifecycleToken(token, 'password_reset', status, form);
  }
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(form);
    if (!form.reportValidity() || !token) return;
    const data = new FormData(form);
    if (!passwordsMatch(form, data)) return;
    setSubmitBusy(form, true, 'Resetting...');
    try {
      const response = await postJson('/api/v1/account-lifecycle/reset-password', {
        token,
        password: String(data.get('password') ?? ''),
        csrf_token: String(data.get('csrf_token') ?? ''),
      });
      if (!response.ok || !response.json.success) {
        applyApiErrors(form, response.json);
        return;
      }
      setFormStatus(form, 'Password reset. You can sign in now.');
      window.setTimeout(() => window.location.assign('/login'), 650);
    } finally {
      setSubmitBusy(form, false, 'Reset password');
    }
  });
}

type JsonResponse = { ok: boolean; json: Record<string, unknown> };

async function postJson(path: string, body: Record<string, unknown>): Promise<JsonResponse> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, json };
}

async function checkLifecycleToken(
  token: string,
  flow: 'activation' | 'password_reset',
  status: HTMLElement | null,
  form: HTMLFormElement | null,
  error?: HTMLElement | null,
) {
  const response = await postJson('/api/v1/account-lifecycle/token-status', { token, flow });
  if (!response.ok || !response.json.success) {
    showFlowError(
      error ?? null,
      status,
      String(response.json.message ?? 'That link is not valid.'),
    );
    return;
  }
  if (status) status.textContent = 'Secure link verified.';
  if (form) {
    form.hidden = false;
    form.querySelector<HTMLInputElement>('input[type="password"]')?.focus();
  }
}

function consumeFragmentValue(names: string | string[] = 'token') {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const candidates = Array.isArray(names) ? names : [names];
  const fragmentToken = candidates.map((name) => params.get(name) ?? '').find(Boolean) ?? '';
  const tokenRoute = window.location.pathname.match(/^\/(setup|reset-password)\/([^/]+)$/u);
  const pathToken = tokenRoute ? decodeURIComponent(tokenRoute[2] ?? '') : '';
  const token = fragmentToken || pathToken;
  if (token && (window.location.hash || tokenRoute)) {
    window.history.replaceState(
      null,
      document.title,
      `${tokenRoute ? `/${tokenRoute[1]}` : window.location.pathname}${window.location.search}`,
    );
  }
  return token;
}

function clearFormErrors(form: HTMLFormElement) {
  form.querySelectorAll<HTMLElement>('[data-error-for]').forEach((node) => (node.textContent = ''));
}

function applyApiErrors(
  form: HTMLFormElement,
  json: Record<string, unknown>,
  fallback?: HTMLElement | null,
) {
  const fieldErrors = json.field_errors as Record<string, string> | undefined;
  if (fieldErrors) {
    Object.entries(fieldErrors).forEach(([name, message]) => {
      const field = form.querySelector<HTMLElement>(`[data-error-for="${name}"]`);
      if (field) field.textContent = message;
    });
    form.querySelector<HTMLElement>('[data-error-for]:not(:empty)')?.focus();
    return;
  }
  const message = String(json.message ?? 'We could not complete that request.');
  if (fallback) fallback.textContent = message;
  setFormStatus(form, message);
}

function setFormStatus(form: HTMLFormElement, message: string) {
  const status = form.querySelector<HTMLElement>('[data-form-status]');
  if (status) status.textContent = message;
}

function setSubmitBusy(form: HTMLFormElement, busy: boolean, label: string) {
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!button) return;
  button.disabled = busy;
  button.textContent = label;
}

function passwordsMatch(form: HTMLFormElement, data: FormData) {
  const password = String(data.get('password') ?? '');
  const confirm = String(data.get('password_confirm') ?? '');
  if (password !== confirm) {
    const field = form.querySelector<HTMLElement>('[data-error-for="password_confirm"]');
    if (field) field.textContent = 'Passwords do not match.';
    return false;
  }
  return true;
}

function showFlowError(error: HTMLElement | null, status: HTMLElement | null, message: string) {
  if (status) status.textContent = '';
  if (error) error.textContent = message;
}
