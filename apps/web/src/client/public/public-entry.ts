import './styles.css';

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

const campaign = document.querySelector<HTMLElement>('[data-campaign-deadline]');
if (campaign) {
  const deadline = campaign.dataset.campaignDeadline;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  if (deadline && today >= deadline) campaign.hidden = true;
}

const carousel = document.querySelector<HTMLElement>('[data-gallery]');
if (carousel) {
  const slides = [...carousel.querySelectorAll<HTMLElement>('[data-gallery-slide]')];
  const buttons = [...carousel.querySelectorAll<HTMLButtonElement>('[data-gallery-dot]')];
  let index = 0;
  const show = (next: number) => {
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      slide.hidden = slideIndex !== index;
    });
    buttons.forEach((button, buttonIndex) => {
      button.setAttribute('aria-pressed', String(buttonIndex === index));
    });
  };
  buttons.forEach((button, buttonIndex) =>
    button.addEventListener('click', () => show(buttonIndex)),
  );
  carousel
    .querySelector<HTMLButtonElement>('[data-gallery-prev]')
    ?.addEventListener('click', () => show(index - 1));
  carousel
    .querySelector<HTMLButtonElement>('[data-gallery-next]')
    ?.addEventListener('click', () => show(index + 1));
  show(0);
}

const form = document.querySelector<HTMLFormElement>('[data-signup-form]');
if (form) {
  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const success = document.querySelector<HTMLElement>('[data-success-panel]');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const phone = form.querySelector<HTMLInputElement>('#phone');
  const consentWrap = form.querySelector<HTMLElement>('[data-consent-wrap]');
  const consent = form.querySelector<HTMLInputElement>('#reminder_consent');
  const timezone = form.querySelector<HTMLInputElement>('#timezone');
  const timezoneFallback = form.querySelector<HTMLInputElement>('#timezone_fallback');
  const idempotencyKey = crypto.randomUUID();

  const setError = (name: string, message: string) => {
    const field = form.querySelector<HTMLElement>(`[data-error-for="${name}"]`);
    if (field) field.textContent = message;
  };
  const clearErrors = () =>
    form
      .querySelectorAll<HTMLElement>('[data-error-for]')
      .forEach((node) => (node.textContent = ''));
  const currentReminder = () =>
    form.querySelector<HTMLInputElement>('input[name="reminder_preference"]:checked')?.value ??
    'email';

  const syncConditionalFields = () => {
    const reminder = currentReminder();
    const needsPhone = reminder === 'whatsapp' || reminder === 'both';
    const needsConsent = reminder !== 'none';
    if (phone) {
      phone.required = needsPhone;
      phone.setAttribute('aria-required', String(needsPhone));
    }
    if (consentWrap && consent) {
      consentWrap.hidden = !needsConsent;
      consent.disabled = !needsConsent;
      consent.required = needsConsent;
      if (!needsConsent) consent.checked = false;
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

  form.querySelectorAll<HTMLInputElement>('input[name="reminder_preference"]').forEach((input) => {
    input.addEventListener('change', syncConditionalFields);
  });
  syncConditionalFields();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const payload = {
      contact_name: String(data.get('contact_name') ?? ''),
      family_or_school: String(data.get('family_or_school') ?? ''),
      audience_type: String(data.get('audience_type') ?? 'family'),
      location: String(data.get('location') ?? ''),
      timezone: String(data.get('timezone') || data.get('timezone_fallback') || ''),
      browser_timezone: detectedTimezone || undefined,
      email: String(data.get('email') ?? ''),
      phone: String(data.get('phone') ?? ''),
      reminder_preference: String(data.get('reminder_preference') ?? 'email'),
      reminder_consent: data.get('reminder_consent') === 'on',
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

const loginForm = document.querySelector<HTMLFormElement>('[data-login-form]');
if (loginForm) {
  const status = loginForm.querySelector<HTMLElement>('[data-form-status]');
  const submit = loginForm.querySelector<HTMLButtonElement>('button[type="submit"]');
  const setError = (name: string, message: string) => {
    const field = loginForm.querySelector<HTMLElement>(`[data-error-for="${name}"]`);
    if (field) field.textContent = message;
  };
  const clearErrors = () =>
    loginForm
      .querySelectorAll<HTMLElement>('[data-error-for]')
      .forEach((node) => (node.textContent = ''));

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();
    if (!loginForm.reportValidity()) return;
    const data = new FormData(loginForm);
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Logging in...';
    }
    if (status) status.textContent = '';
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': String(data.get('csrf_token') ?? ''),
        },
        body: JSON.stringify({
          email: String(data.get('email') ?? ''),
          password: String(data.get('password') ?? ''),
          csrf_token: String(data.get('csrf_token') ?? ''),
          return_to: String(data.get('return_to') ?? '/app/crm'),
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        if (json.code === 'MFA_REQUIRED' && json.challenge_token) {
          const code = window.prompt('Enter your authenticator or recovery code.');
          if (!code) {
            if (status) status.textContent = 'Authenticator or recovery code is required.';
            return;
          }
          const trimmedCode = code.trim();
          const mfaResponse = await fetch(
            /^\d{6}$/.test(trimmedCode)
              ? '/api/v1/auth/mfa/challenge'
              : '/api/v1/auth/mfa/recovery',
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(
                /^\d{6}$/.test(trimmedCode)
                  ? { challenge_token: json.challenge_token, totp_code: trimmedCode }
                  : { challenge_token: json.challenge_token, recovery_code: trimmedCode },
              ),
            },
          );
          const mfaJson = await mfaResponse.json();
          if (!mfaResponse.ok || !mfaJson.success) {
            if (status)
              status.textContent = mfaJson.message ?? 'Authenticator code was not accepted.';
            return;
          }
          window.location.assign(mfaJson.return_to ?? '/app/crm');
          return;
        }
        if (json.field_errors) {
          Object.entries(json.field_errors as Record<string, string>).forEach(([name, message]) =>
            setError(name, message),
          );
        } else if (status) {
          status.textContent = json.message ?? 'Email or password is not correct.';
        }
        return;
      }
      window.location.assign(json.return_to ?? '/app/crm');
    } catch {
      if (status) status.textContent = 'Login is unavailable right now.';
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Login';
      }
    }
  });
}
