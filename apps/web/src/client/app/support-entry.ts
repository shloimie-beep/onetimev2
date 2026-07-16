const form = document.querySelector<HTMLFormElement>('[data-support-form]');
const statusNode = document.querySelector<HTMLElement>('[data-support-status]');
const idempotencyInput = document.querySelector<HTMLInputElement>('[data-idempotency-key]');

if (form && statusNode && idempotencyInput) {
  idempotencyInput.value = supportIdempotencyKey();
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitSupportForm(form, statusNode, idempotencyInput);
  });
}

async function submitSupportForm(
  form: HTMLFormElement,
  statusNode: HTMLElement,
  idempotencyInput: HTMLInputElement,
) {
  statusNode.textContent = 'Saving support request...';
  const formData = new FormData(form);
  const csrfToken = String(formData.get('csrf_token') ?? '');
  const attachments = await readAttachments(formData.getAll('attachments'));
  const payload = {
    category: stringValue(formData, 'category'),
    title: stringValue(formData, 'title'),
    message: stringValue(formData, 'message'),
    reply_preference: stringValue(formData, 'reply_preference') || 'in_app',
    issue_details: {
      steps_to_reproduce: stringValue(formData, 'steps_to_reproduce')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 10),
      expected_behavior: nullableString(formData, 'expected_behavior'),
      actual_behavior: nullableString(formData, 'actual_behavior'),
      occurrence: stringValue(formData, 'occurrence') || 'not_applicable',
      first_observed_at: null,
      error_code: nullableString(formData, 'error_code'),
      provider: stringValue(formData, 'provider') || 'none',
    },
    client_context: {
      route_template: normalizedRouteTemplate(location.pathname),
      app_release: stringValue(formData, 'app_release') || 'local',
      locale: navigator.language || 'en-US',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    },
    attachments,
    idempotency_key: idempotencyInput.value,
  };
  const response = await fetch('/api/v1/support/tickets', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    status_path?: string;
    message?: string;
  };
  if (!response.ok || body.success !== true || !body.status_path) {
    statusNode.textContent = body.message ?? 'Support request was not saved.';
    return;
  }
  statusNode.textContent = 'Support request saved.';
  window.location.assign(body.status_path);
}

async function readAttachments(values: FormDataEntryValue[]) {
  const files = values.filter((value): value is File => value instanceof File && value.size > 0);
  const output: Array<{ filename: string; media_type: string; content_base64: string }> = [];
  for (const file of files.slice(0, 3)) {
    const buffer = await file.arrayBuffer();
    output.push({
      filename: file.name,
      media_type: file.type || 'application/octet-stream',
      content_base64: arrayBufferToBase64(buffer),
    });
  }
  return output;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function stringValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function nullableString(formData: FormData, name: string) {
  const value = stringValue(formData, name);
  return value ? value : null;
}

function normalizedRouteTemplate(pathname: string) {
  return pathname
    .replace(/[?#].*$/u, '')
    .replace(/[A-Za-z0-9_-]{16,}/gu, '[id]')
    .slice(0, 255);
}

function supportIdempotencyKey() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `support-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}
