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
  const viewport = carousel.querySelector<HTMLElement>('[data-gallery-viewport]');
  const status = carousel.querySelector<HTMLElement>('[data-gallery-status]');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let index = 0;
  let pointerStartX: number | null = null;
  const show = (next: number) => {
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
    const current = slides[index];
    current?.scrollIntoView({
      block: 'nearest',
      inline: 'center',
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
    const caption = current?.querySelector('figcaption')?.textContent?.trim();
    if (status && caption) status.textContent = `Showing ${caption}`;
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
  carousel.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      show(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      show(index + 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      show(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      show(slides.length - 1);
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
    show(index + (delta < 0 ? 1 : -1));
  });
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
  const mfaPanel = loginForm.querySelector<HTMLElement>('[data-login-mfa]');
  const mfaInput = loginForm.querySelector<HTMLInputElement>('#mfa_code');
  let challengeToken = '';
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
      submit.textContent = challengeToken ? 'Verifying...' : 'Logging in...';
    }
    if (status) status.textContent = '';
    try {
      if (challengeToken) {
        const trimmedCode = String(data.get('mfa_code') ?? '').trim();
        if (!trimmedCode) {
          setError('mfa_code', 'Enter an authenticator or recovery code.');
          mfaInput?.focus();
          return;
        }
        const endpoint = /^\d{6}$/.test(trimmedCode)
          ? '/api/v1/auth/mfa/challenge'
          : '/api/v1/auth/mfa/recovery';
        const mfaResponse = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(
            endpoint.endsWith('/challenge')
              ? { challenge_token: challengeToken, totp_code: trimmedCode }
              : { challenge_token: challengeToken, recovery_code: trimmedCode },
          ),
        });
        const mfaJson = await mfaResponse.json();
        if (!mfaResponse.ok || !mfaJson.success) {
          if (status)
            status.textContent = mfaJson.message ?? 'Authenticator code was not accepted.';
          return;
        }
        window.location.assign(mfaJson.return_to ?? '/app/crm');
        return;
      }
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
          challengeToken = String(json.challenge_token);
          if (mfaPanel) mfaPanel.hidden = false;
          if (mfaInput) {
            mfaInput.required = true;
            mfaInput.focus();
          }
          if (status) status.textContent = 'Enter your authenticator or recovery code.';
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

const activationRoot = document.querySelector<HTMLElement>('[data-activation-root]');
if (activationRoot) {
  const token = consumeFragmentToken();
  const status = activationRoot.querySelector<HTMLElement>('[data-activation-status]');
  const error = activationRoot.querySelector<HTMLElement>('[data-activation-error]');
  const form = activationRoot.querySelector<HTMLFormElement>('[data-activation-form]');
  const mfaPanel = activationRoot.querySelector<HTMLElement>('[data-activation-mfa]');
  const mfaForm = activationRoot.querySelector<HTMLFormElement>('[data-activation-mfa-form]');
  const secretNode = activationRoot.querySelector<HTMLElement>('[data-mfa-secret]');
  const otpauthLink = activationRoot.querySelector<HTMLAnchorElement>('[data-otpauth-link]');
  const recoveryPanel = activationRoot.querySelector<HTMLElement>('[data-recovery-panel]');
  const recoveryList = activationRoot.querySelector<HTMLOListElement>('[data-recovery-codes]');
  const recoveryAck = activationRoot.querySelector<HTMLInputElement>('[data-recovery-ack]');
  const recoveryContinue = activationRoot.querySelector<HTMLButtonElement>(
    '[data-recovery-continue]',
  );
  const recoveryStatus = activationRoot.querySelector<HTMLElement>('[data-recovery-status]');
  let handoffToken = '';
  let enrollmentToken = '';

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
    setSubmitBusy(form, true, 'Continuing...');
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
      if (response.json.mfa_required) {
        handoffToken = String(response.json.handoff_token ?? '');
        enrollmentToken = String(response.json.enrollment_token ?? '');
        form.hidden = true;
        if (mfaPanel) mfaPanel.hidden = false;
        if (secretNode) secretNode.textContent = String(response.json.totp_secret ?? '');
        if (otpauthLink) {
          otpauthLink.href = String(response.json.otpauth_url ?? '#');
        }
        mfaForm?.querySelector<HTMLInputElement>('#activation_totp')?.focus();
        if (status) status.textContent = 'Set up MFA to finish activation.';
        return;
      }
      window.location.assign(String(response.json.return_to ?? '/app/parent'));
    } finally {
      setSubmitBusy(form, false, 'Continue');
    }
  });

  mfaForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(mfaForm);
    if (!mfaForm.reportValidity() || !handoffToken || !enrollmentToken) return;
    const data = new FormData(mfaForm);
    setSubmitBusy(mfaForm, true, 'Verifying...');
    try {
      const response = await postJson('/api/v1/account-lifecycle/mfa/activate', {
        handoff_token: handoffToken,
        enrollment_token: enrollmentToken,
        totp_code: String(data.get('totp_code') ?? '').trim(),
      });
      if (!response.ok || !response.json.success) {
        applyApiErrors(mfaForm, response.json, error);
        return;
      }
      const codes = Array.isArray(response.json.recovery_codes)
        ? response.json.recovery_codes.map(String)
        : [];
      if (recoveryList) {
        recoveryList.replaceChildren(...codes.map((code) => recoveryCodeItem(code)));
      }
      if (mfaPanel) mfaPanel.hidden = true;
      if (recoveryPanel) recoveryPanel.hidden = false;
      recoveryAck?.focus();
    } finally {
      setSubmitBusy(mfaForm, false, 'Verify code');
    }
  });

  recoveryAck?.addEventListener('change', () => {
    if (recoveryContinue) recoveryContinue.disabled = !recoveryAck.checked;
  });
  recoveryContinue?.addEventListener('click', async () => {
    if (!recoveryAck?.checked || !handoffToken) return;
    recoveryContinue.disabled = true;
    if (recoveryStatus) recoveryStatus.textContent = 'Finishing setup...';
    const response = await postJson('/api/v1/account-lifecycle/mfa/ack', {
      handoff_token: handoffToken,
      recovery_codes_saved: true,
    });
    if (!response.ok || !response.json.success) {
      if (recoveryStatus)
        recoveryStatus.textContent = String(response.json.message ?? 'Setup expired.');
      recoveryContinue.disabled = false;
      return;
    }
    window.location.assign(String(response.json.return_to ?? '/app/dashboard'));
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
  const token = consumeFragmentToken();
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

function consumeFragmentToken() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token = params.get('token') ?? '';
  if (window.location.hash) {
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

function recoveryCodeItem(code: string) {
  const item = document.createElement('li');
  const codeNode = document.createElement('code');
  codeNode.textContent = code;
  item.append(codeNode);
  return item;
}
