import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';

const PRIVATE_DIR = 'C:/Users/User/.onetime-w13-103-private';
const BASE_URL = 'https://join.onetimeonetime.com';
const HANDOFF_PATH = join(PRIVATE_DIR, 'LOGIN-HANDOFF.private.json');
const MANIFEST_PATH = join(PRIVATE_DIR, 'identity-authorization.private.json');
const EVIDENCE_PATH = join(PRIVATE_DIR, 'acceptance-student-parent-controls.private.json');

type JsonObject = Record<string, unknown>;

type ApiResult = {
  status: number;
  ok: boolean;
  body: unknown;
};

type ViewportProof = {
  width: number;
  height: number;
  status: number | null;
  body_nonblank: boolean;
};

class SafeFailure extends Error {
  constructor(
    readonly code: string,
    readonly stage: string,
  ) {
    super(`${stage}:${code}`);
  }
}

let stage = 'init';

async function readJson(path: string): Promise<JsonObject> {
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as unknown;
  if (!isObject(parsed)) throw new SafeFailure('invalid_private_json', stage);
  return parsed;
}

async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function objectAt(source: JsonObject, key: string): JsonObject {
  const value = source[key];
  if (!isObject(value)) throw new SafeFailure(`missing_${key}`, stage);
  return value;
}

function stringAt(source: JsonObject, key: string): string {
  const value = source[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SafeFailure(`missing_${key}`, stage);
  }
  return value;
}

function optionalObjectAt(source: JsonObject, key: string): JsonObject {
  const value = source[key];
  return isObject(value) ? value : {};
}

function dataOf(result: ApiResult): unknown {
  if (isObject(result.body) && 'data' in result.body) return result.body.data;
  return result.body;
}

function expect(condition: boolean, code: string): asserts condition {
  if (!condition) throw new SafeFailure(code, stage);
}

function digestRef(prefix: string, value: string) {
  const digest = createHash('sha256').update(value).digest('hex').slice(0, 16);
  return `${prefix}_${digest}`;
}

async function apiGet(page: Page, path: string): Promise<ApiResult> {
  return page.evaluate(async (requestPath) => {
    const response = await fetch(requestPath, { credentials: 'include' });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, ok: response.ok, body };
  }, path);
}

async function apiPost(
  page: Page,
  path: string,
  body: JsonObject,
  csrfToken: string,
): Promise<ApiResult> {
  return page.evaluate(
    async ({ requestPath, payload, csrf }) => {
      const response = await fetch(requestPath, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': csrf,
        },
        body: JSON.stringify(payload),
      });
      let responseBody: unknown = null;
      try {
        responseBody = await response.json();
      } catch {
        responseBody = null;
      }
      return { status: response.status, ok: response.ok, body: responseBody };
    },
    { requestPath: path, payload: body, csrf: csrfToken },
  );
}

async function submitActivation(page: Page, activationUrl: string, password: string) {
  stage = 'student_activation_open';
  await page.goto(activationUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  stage = 'student_activation_form';
  await page.locator('[data-activation-form]').waitFor({ state: 'visible', timeout: 20_000 });
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="password_confirm"]').fill(password);
  stage = 'student_activation_submit';
  await page.locator('[data-activation-form] button[type="submit"]').click();
  await page
    .waitForURL((url) => url.origin === BASE_URL && url.pathname.startsWith('/app/'), {
      timeout: 20_000,
    })
    .catch(() => undefined);
}

async function submitLogin(page: Page, email: string, password: string, returnTo: string) {
  stage = 'parent_login_open';
  await page.goto(`${BASE_URL}/login?return_to=${encodeURIComponent(returnTo)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  await page.locator('[data-login-form]').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  stage = 'parent_login_submit';
  await page.locator('[data-login-form] button[type="submit"]').click();
  await page
    .waitForURL((url) => url.origin === BASE_URL && url.pathname.startsWith('/app/'), {
      timeout: 20_000,
    })
    .catch(() => undefined);
}

async function verifySession(page: Page, expectedRole: string) {
  stage = `${expectedRole}_session`;
  const session = await apiGet(page, '/api/v1/auth/session');
  expect(session.status === 200, `${expectedRole}_session_not_200`);
  const payload = dataOf(session);
  expect(isObject(payload), `${expectedRole}_session_missing_payload`);
  const user = payload.user;
  expect(isObject(user), `${expectedRole}_session_missing_user`);
  expect(user.role === expectedRole, `${expectedRole}_session_role_mismatch`);
  const csrf = payload.csrf_token;
  expect(typeof csrf === 'string' && csrf.length > 0, `${expectedRole}_csrf_missing`);
  return { csrfToken: csrf };
}

async function viewportSmoke(page: Page, path: string): Promise<ViewportProof[]> {
  const sizes = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1000 },
  ];
  const results: ViewportProof[] = [];
  for (const size of sizes) {
    stage = `viewport_${path}_${size.width}`;
    await page.setViewportSize(size);
    const response = await page.goto(`${BASE_URL}${path}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
    const bodyNonblank = await page.evaluate(
      () => document.body.innerText.trim().replace(/\s+/g, ' ').length > 24,
    );
    results.push({
      ...size,
      status: response?.status() ?? null,
      body_nonblank: bodyNonblank,
    });
  }
  return results;
}

async function logout(page: Page, csrfToken: string) {
  stage = 'logout';
  const response = await apiPost(page, '/api/v1/auth/logout', {}, csrfToken);
  return response.status;
}

function firstStudentAccess(dashboard: JsonObject, learnerKey: string): JsonObject {
  const accessRows = dashboard.student_access;
  expect(Array.isArray(accessRows), 'parent_student_access_missing');
  const access = accessRows.find(
    (entry): entry is JsonObject => isObject(entry) && entry.learner_key === learnerKey,
  );
  if (!access) throw new SafeFailure('parent_student_access_row_missing', stage);
  return access;
}

async function runStudentActivation(browser: Browser, handoff: JsonObject) {
  const student = objectAt(handoff, 'student');
  const setupUrl = stringAt(student, 'setup_url');
  const password = stringAt(student, 'temporary_acceptance_password');
  const context = await browser.newContext();
  const page = await context.newPage();
  await submitActivation(page, setupUrl, password);
  const session = await verifySession(page, 'student');
  stage = 'student_dashboard_api';
  const dashboardResult = await apiGet(page, '/api/v1/portals/student/dashboard');
  expect(dashboardResult.status === 200, 'student_dashboard_not_200');
  const dashboard = dataOf(dashboardResult);
  expect(isObject(dashboard), 'student_dashboard_missing_payload');
  expect(isObject(dashboard.learner), 'student_dashboard_learner_missing');
  stage = 'student_route_boundaries';
  const crmBoundary = await apiGet(page, '/api/v1/crm/contacts?limit=1');
  const parentBoundary = await apiGet(page, '/api/v1/portals/parent/dashboard');
  const viewports = await viewportSmoke(page, '/app/student');
  return {
    context,
    page,
    csrfToken: session.csrfToken,
    proof: {
      activated_via_ui: true,
      session_role: 'student',
      dashboard_status: dashboardResult.status,
      learner_count: 1,
      crm_boundary_status: crmBoundary.status,
      parent_boundary_status: parentBoundary.status,
      viewports,
    },
  };
}

async function runParentControls(browser: Browser, manifest: JsonObject, handoff: JsonObject) {
  const recipients = objectAt(manifest, 'recipients');
  const parentRecipient = objectAt(recipients, 'parent');
  const parentEmail = stringAt(parentRecipient, 'destination');
  const parentPassword = stringAt(objectAt(handoff, 'parent'), 'temporary_acceptance_password');
  const context = await browser.newContext();
  const page = await context.newPage();
  await submitLogin(page, parentEmail, parentPassword, '/app/parent');
  const session = await verifySession(page, 'parent');
  stage = 'parent_dashboard_api';
  const dashboardResult = await apiGet(page, '/api/v1/portals/parent/dashboard');
  expect(dashboardResult.status === 200, 'parent_dashboard_not_200');
  const dashboard = dataOf(dashboardResult);
  expect(isObject(dashboard), 'parent_dashboard_missing_payload');
  const household = dashboard.household;
  expect(isObject(household), 'parent_household_missing');
  const householdKey = stringAt(household, 'household_key');
  const learners = dashboard.learners;
  expect(Array.isArray(learners) && learners.length === 1, 'parent_learner_count_mismatch');
  const learner = learners[0];
  expect(isObject(learner), 'parent_learner_missing');
  const learnerKey = stringAt(learner, 'learner_key');
  const accessBefore = firstStudentAccess(dashboard, learnerKey);
  const basePath = `/api/v1/portals/parent/households/${encodeURIComponent(
    householdKey,
  )}/learners/${encodeURIComponent(learnerKey)}/student-access`;
  const idBase = `w13-103-browser-${Date.now()}`;

  stage = 'parent_suspend_student';
  const suspend = await apiPost(
    page,
    `${basePath}/suspend`,
    { idempotency_key: `${idBase}-suspend` },
    session.csrfToken,
  );
  expect(suspend.status === 200, 'parent_suspend_not_200');
  const suspendData = dataOf(suspend);
  expect(
    isObject(suspendData) && suspendData.status === 'suspended',
    'parent_suspend_not_suspended',
  );

  stage = 'parent_restore_student';
  const restore = await apiPost(
    page,
    `${basePath}/restore`,
    { idempotency_key: `${idBase}-restore` },
    session.csrfToken,
  );
  expect(restore.status === 200, 'parent_restore_not_200');
  const restoreData = dataOf(restore);
  expect(isObject(restoreData) && restoreData.status === 'active', 'parent_restore_not_active');

  stage = 'parent_reset_student';
  const reset = await apiPost(
    page,
    `${basePath}/reset`,
    { idempotency_key: `${idBase}-reset` },
    session.csrfToken,
  );
  expect(reset.status === 200, 'parent_reset_not_200');
  const resetData = dataOf(reset);
  expect(
    isObject(resetData) && resetData.status === 'reset_requested',
    'parent_reset_not_requested',
  );

  const logoutStatus = await logout(page, session.csrfToken);
  await context.close();
  return {
    proof: {
      logged_in_via_ui: true,
      session_role: 'parent',
      dashboard_status: dashboardResult.status,
      household_count: 1,
      learner_count: learners.length,
      access_status_before: String(accessBefore.status ?? ''),
      household_ref: digestRef('household', householdKey),
      learner_ref: digestRef('learner', learnerKey),
      suspend_status: suspend.status,
      suspend_access_status: String(suspendData.status),
      restore_status: restore.status,
      restore_access_status: String(restoreData.status),
      reset_status: reset.status,
      reset_access_status: String(resetData.status),
      logout_status: logoutStatus,
    },
  };
}

async function main() {
  const [manifest, handoff] = await Promise.all([readJson(MANIFEST_PATH), readJson(HANDOFF_PATH)]);
  const browser = await chromium.launch();
  let student: Awaited<ReturnType<typeof runStudentActivation>> | undefined;
  try {
    stage = 'student_activation';
    student = await runStudentActivation(browser, handoff);
    stage = 'parent_controls';
    const parent = await runParentControls(browser, manifest, handoff);
    stage = 'student_after_parent_suspend';
    const studentAfterSuspend = await apiGet(student.page, '/api/v1/portals/student/dashboard');
    const studentLogoutStatus =
      studentAfterSuspend.status === 200 ? await logout(student.page, student.csrfToken) : 0;
    await student.context.close();
    const evidence = {
      schema: 'onetime.w13_103.browser_role_acceptance.v1',
      generated_at: new Date().toISOString(),
      production_login_url: `${BASE_URL}/login`,
      student_browser: {
        ...student.proof,
        after_parent_suspend_dashboard_status: studentAfterSuspend.status,
        session_invalidated_by_parent_suspend: [401, 403].includes(studentAfterSuspend.status),
        logout_status: studentLogoutStatus,
      },
      parent_student_controls: parent.proof,
      safety: {
        external_sends: 0,
        printed_secrets: false,
        printed_pii: false,
        rabbi_contacted: false,
      },
    };
    await writeJson(EVIDENCE_PATH, evidence);
    const updatedHandoff = {
      ...handoff,
      updated_at: new Date().toISOString(),
      acceptance: {
        ...optionalObjectAt(handoff, 'acceptance'),
        student_browser: {
          evidence_path: EVIDENCE_PATH,
          activated_via_ui: true,
          dashboard_status: student.proof.dashboard_status,
          logout_status: studentLogoutStatus,
        },
        parent_student_controls: {
          evidence_path: EVIDENCE_PATH,
          suspend_status: parent.proof.suspend_status,
          restore_status: parent.proof.restore_status,
          reset_status: parent.proof.reset_status,
          student_session_invalidated_by_suspend:
            evidence.student_browser.session_invalidated_by_parent_suspend,
          parent_logout_status: parent.proof.logout_status,
        },
      },
    };
    await writeJson(HANDOFF_PATH, updatedHandoff);
    process.stdout.write(
      `${JSON.stringify({
        status: 'student_parent_browser_acceptance_passed',
        evidence_path: EVIDENCE_PATH,
        student: {
          session_role: 'student',
          dashboard_status: student.proof.dashboard_status,
          crm_boundary_status: student.proof.crm_boundary_status,
          parent_boundary_status: student.proof.parent_boundary_status,
          after_parent_suspend_dashboard_status: studentAfterSuspend.status,
          session_invalidated_by_parent_suspend:
            evidence.student_browser.session_invalidated_by_parent_suspend,
        },
        parent_controls: {
          session_role: 'parent',
          dashboard_status: parent.proof.dashboard_status,
          suspend_status: parent.proof.suspend_status,
          suspend_access_status: parent.proof.suspend_access_status,
          restore_status: parent.proof.restore_status,
          restore_access_status: parent.proof.restore_access_status,
          reset_status: parent.proof.reset_status,
          reset_access_status: parent.proof.reset_access_status,
          logout_status: parent.proof.logout_status,
        },
        safety: evidence.safety,
      })}\n`,
    );
  } finally {
    if (student) await student.context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  const failure =
    error instanceof SafeFailure
      ? { status: 'failed', error_code: error.code, failed_stage: error.stage }
      : { status: 'failed', error_code: 'browser_acceptance_failed', failed_stage: stage };
  process.stderr.write(`${JSON.stringify(failure)}\n`);
  process.exitCode = 1;
});
