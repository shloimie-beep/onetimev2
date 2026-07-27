import './styles.css';

import { COMMUNICATION_CONSENT_POLICY_VERSION } from '../../../../../packages/domain/src/legal/policies.ts';

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
const campaign = document.querySelector<HTMLElement>('[data-campaign-deadline]');
if (campaign) {
  const deadlineParts = campaign.dataset.campaignDeadline?.split('-').map(Number);
  const deadline =
    deadlineParts?.length === 3 && deadlineParts.every(Number.isFinite)
      ? (deadlineParts as [number, number, number])
      : null;
  const initialLabel = campaign.getAttribute('aria-label') ?? '';
  const label =
    initialLabel.replace(/\s+—\s+\d+\s+DAYS?\s+TO ROSH HASHANAH$/u, '').trim() ||
    'FREE UNTIL ROSH HASHANAH';
  const jerusalemDate = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const renderCountdown = () => {
    if (!deadline) return;
    const dateParts = { year: 0, month: 0, day: 0 };
    for (const part of jerusalemDate.formatToParts(new Date())) {
      if (part.type === 'year' || part.type === 'month' || part.type === 'day') {
        dateParts[part.type] = Number(part.value);
      }
    }
    const todayIndex = Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day) / 86_400_000;
    const [deadlineYear, deadlineMonth, deadlineDay] = deadline;
    const deadlineIndex = Date.UTC(deadlineYear, deadlineMonth - 1, deadlineDay) / 86_400_000;
    const days = deadlineIndex - todayIndex;
    campaign.hidden = days <= 0;
    if (days <= 0) return;
    const copy = `${label} — ${days} ${days === 1 ? 'DAY' : 'DAYS'} TO ROSH HASHANAH`;
    campaign.setAttribute('aria-label', `${copy}. Sign up now.`);
    campaign
      .querySelectorAll<HTMLElement>('.campaign-ticker-item')
      .forEach((item) => (item.textContent = copy));
  };
  renderCountdown();
  window.setInterval(renderCountdown, 60_000);
}

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

const form = document.querySelector<HTMLFormElement>('[data-signup-form]');
if (form) {
  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const success = document.querySelector<HTMLElement>('[data-success-panel]');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const phone = form.querySelector<HTMLInputElement>('#phone');
  const emailReminder = form.querySelector<HTMLInputElement>('#email_reminder_consent');
  const whatsappReminder = form.querySelector<HTMLInputElement>('#whatsapp_reminder_consent');
  const timezone = form.querySelector<HTMLInputElement>('#timezone');
  const timezoneFallback = form.querySelector<HTMLInputElement>('#timezone_fallback');
  const idempotencyKey = crypto.randomUUID();
  if (submit) submit.hidden = false;

  const setError = (name: string, message: string) => {
    const field = form.querySelector<HTMLElement>(`[data-error-for="${name}"]`);
    if (field) field.textContent = message;
  };
  const clearErrors = () =>
    form
      .querySelectorAll<HTMLElement>('[data-error-for]')
      .forEach((node) => (node.textContent = ''));
  const reminderChannels = () => [
    ...(emailReminder?.checked ? (['email'] as const) : []),
    ...(whatsappReminder?.checked ? (['whatsapp'] as const) : []),
  ];
  const currentReminder = () => {
    const channels = reminderChannels();
    if (channels.includes('email') && channels.includes('whatsapp')) return 'both';
    if (channels.includes('email')) return 'email';
    if (channels.includes('whatsapp')) return 'whatsapp';
    return 'none';
  };

  const syncConditionalFields = () => {
    const reminder = currentReminder();
    const needsPhone = reminder === 'whatsapp' || reminder === 'both';
    if (phone) {
      phone.required = needsPhone;
      phone.setAttribute('aria-required', String(needsPhone));
    }
  };

  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timezone && detectedTimezone) {
    timezone.value = detectedTimezone;
  } else if (timezoneFallback) {
    timezoneFallback.hidden = false;
    timezoneFallback.required = true;
    timezoneFallback.disabled = false;
  }

  emailReminder?.addEventListener('change', syncConditionalFields);
  whatsappReminder?.addEventListener('change', syncConditionalFields);
  syncConditionalFields();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const reminder = currentReminder();
    const optionalReminderConsent = reminder !== 'none';
    const payload = {
      contact_name: String(data.get('contact_name') ?? ''),
      family_or_school: String(data.get('family_or_school') ?? ''),
      audience_type: String(data.get('audience_type') ?? 'family'),
      location: String(data.get('location') ?? ''),
      timezone: String(data.get('timezone') || data.get('timezone_fallback') || ''),
      browser_timezone: detectedTimezone || undefined,
      email: String(data.get('email') ?? ''),
      phone: String(data.get('phone') ?? ''),
      reminder_preference: reminder,
      reminder_consent: optionalReminderConsent,
      consent_context: {
        policy_version: COMMUNICATION_CONSENT_POLICY_VERSION,
        purpose: 'optional_class_reminders',
        source: 'public_signup',
        channels: reminderChannels(),
        captured_at: new Date().toISOString(),
        withdrawal_state: 'not_withdrawn',
        suppression_state: 'active',
      },
      idempotency_key: idempotencyKey,
      attribution: {
        landing_path: '/signup',
        referrer: document.referrer.slice(0, 500),
      },
    };

    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Signing you up...';
    }
    if (status) status.textContent = '';

    try {
      const response = await fetch('/api/v1/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        if (json.field_errors) {
          Object.entries(json.field_errors as Record<string, string>).forEach(([name, message]) =>
            setError(name, message),
          );
          form.querySelector<HTMLElement>('[data-error-for]:not(:empty)')?.focus();
        } else if (status) {
          status.textContent = json.message ?? 'We could not save that signup yet.';
        }
        return;
      }
      form.hidden = true;
      if (success) {
        success.hidden = false;
        success.querySelector('[data-success-heading]')!.textContent = json.message.heading;
        success.querySelector('[data-success-body]')!.textContent = json.message.body;
        success.focus();
      }
    } catch {
      if (status) status.textContent = 'We could not save that signup yet.';
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Sign Up Now';
      }
    }
  });
}

const eventRegistrationForm = document.querySelector<HTMLFormElement>(
  '[data-event-registration-form]',
);
const eventModal = document.querySelector<HTMLElement>('[data-event-modal]');
const eventModalBackdrop = document.querySelector<HTMLElement>('[data-event-modal-backdrop]');
const eventModalOpen = document.querySelector<HTMLButtonElement>('[data-event-open-modal]');
const eventRegistrationContent = document.querySelector<HTMLElement>(
  '[data-event-registration-content]',
);
let eventModalPreviousFocus: HTMLElement | null = null;

function closeEventModal() {
  if (!eventModal || !eventModalBackdrop) return;
  eventModal.hidden = true;
  eventModalBackdrop.hidden = true;
  delete document.documentElement.dataset.eventModalOpen;
  eventModalOpen?.setAttribute('aria-expanded', 'false');
  (eventModalPreviousFocus ?? eventModalOpen)?.focus();
}

function openEventModal() {
  if (!eventModal || !eventModalBackdrop) return;
  eventModalPreviousFocus = document.activeElement as HTMLElement | null;
  eventModal.hidden = false;
  eventModalBackdrop.hidden = false;
  document.documentElement.dataset.eventModalOpen = 'true';
  eventModalOpen?.setAttribute('aria-expanded', 'true');
  window.setTimeout(() => {
    eventModal.querySelector<HTMLElement>('input[name="email"], button, a')?.focus();
  }, 0);
}

eventModalOpen?.addEventListener('click', openEventModal);
eventModalBackdrop?.addEventListener('click', closeEventModal);
document
  .querySelectorAll<HTMLButtonElement>('[data-event-close-modal]')
  .forEach((button) => button.addEventListener('click', closeEventModal));
eventModal?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeEventModal();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusables = [...eventModal.querySelectorAll<HTMLElement>(focusableSelector)].filter(
    (node) => !node.hidden && node.offsetParent !== null,
  );
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

if (eventRegistrationForm) {
  const status = eventRegistrationForm.querySelector<HTMLElement>('[data-form-status]');
  const submit = eventRegistrationForm.querySelector<HTMLButtonElement>('[data-event-submit]');
  const success = document.querySelector<HTMLElement>('[data-event-success-panel]');
  const noScriptFallback = document.querySelector<HTMLElement>('[data-event-noscript]');
  const idempotencyKey = `tisha-bav-${crypto.randomUUID()}`;
  if (noScriptFallback) noScriptFallback.hidden = true;
  if (submit) submit.hidden = false;

  eventRegistrationForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(eventRegistrationForm);
    if (!eventRegistrationForm.reportValidity()) return;
    const data = new FormData(eventRegistrationForm);
    if (submit) submit.disabled = true;
    if (status) status.textContent = '';
    try {
      const response = await postJson('/api/v1/events/tisha-bav-2026/register', {
        email: String(data.get('email') ?? ''),
        first_name: String(data.get('first_name') ?? ''),
        source: 'tisha_bav_2026_landing',
        idempotency_key: idempotencyKey,
        homepage: String(data.get('homepage') ?? ''),
      });
      if (!response.ok || !response.json.success) {
        applyApiErrors(eventRegistrationForm, response.json);
        return;
      }
      eventRegistrationForm.hidden = true;
      if (eventRegistrationContent) eventRegistrationContent.hidden = true;
      if (success) {
        success.hidden = false;
        success.focus();
      }
    } catch {
      setFormStatus(eventRegistrationForm, 'We could not save that registration yet.');
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Reserve My Spot';
      }
    }
  });
}

const eventShareUrl =
  eventModal?.dataset.eventShareUrl ?? 'https://join.onetimeonetime.com/tisha-bav';
const eventCopyLink = document.querySelector<HTMLButtonElement>('[data-event-copy-link]');
const eventCopyStatus = document.querySelector<HTMLElement>('[data-event-copy-status]');
eventCopyLink?.addEventListener('click', async () => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(eventShareUrl);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = eventShareUrl;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.append(textArea);
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
    }
    if (eventCopyStatus) eventCopyStatus.textContent = 'Link copied.';
  } catch {
    if (eventCopyStatus) eventCopyStatus.textContent = 'Copy was not available in this browser.';
  }
});

const eventNativeShare = document.querySelector<HTMLButtonElement>('[data-event-native-share]');
if (eventNativeShare && typeof navigator.share === 'function') {
  eventNativeShare.hidden = false;
  eventNativeShare.addEventListener('click', async () => {
    await navigator
      .share({
        title: "Tisha B'Av VIP Zoom Class",
        text: "Reserve your spot for the Tisha B'Av VIP Zoom class with Rabbi Eli Scheller.",
        url: eventShareUrl,
      })
      .catch(() => undefined);
  });
}

const eventJoinForm = document.querySelector<HTMLFormElement>('[data-event-join-form]');
if (eventJoinForm) {
  const submit = eventJoinForm.querySelector<HTMLButtonElement>('button[type="submit"]');
  const idempotencyKey = `tisha-bav-join-${crypto.randomUUID()}`;
  eventJoinForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(eventJoinForm);
    if (!eventJoinForm.reportValidity()) return;
    const data = new FormData(eventJoinForm);
    setSubmitBusy(eventJoinForm, true, 'Opening...');
    try {
      const response = await postJson('/api/v1/events/tisha-bav-2026/join', {
        email: String(data.get('email') ?? ''),
        idempotency_key: idempotencyKey,
        homepage: String(data.get('homepage') ?? ''),
      });
      if (!response.ok || !response.json.success) {
        applyApiErrors(eventJoinForm, response.json);
        return;
      }
      const redirectPath = String(response.json.redirect_path ?? '');
      if (redirectPath.startsWith('/api/v1/events/tisha-bav-2026/redirect')) {
        window.location.assign(redirectPath);
        return;
      }
      setFormStatus(eventJoinForm, 'Private access is not available yet.');
    } catch {
      setFormStatus(eventJoinForm, 'Private access is not available yet.');
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Join the Live Program';
      }
    }
  });
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
  const token = candidates.map((name) => params.get(name) ?? '').find(Boolean) ?? '';
  if (token && window.location.hash) {
    window.history.replaceState(
      null,
      document.title,
      window.location.pathname + window.location.search,
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
