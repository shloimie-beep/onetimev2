import { expect, test, type Page, type Request } from '@playwright/test';

test.describe('OT-88 mocked Zoom classroom launch', () => {
  test('runs the mocked SDK lifecycle on desktop component view without provider network calls', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    const requests = monitorRequests(page);
    await loginStudent(page);

    await page.getByRole('button', { name: 'Join class' }).click();
    await page.waitForURL('**/classroom/launch');
    await expect(page.locator('[data-mocked-zoom-sdk="true"]')).toBeVisible();
    await expect(page.locator('[data-mocked-zoom-sdk="true"]')).toHaveAttribute(
      'data-selected-view',
      'component',
    );
    await expect(page.locator('[data-classroom-status]')).toContainText(
      'Classroom is ready. View mode: desktop.',
    );

    await assertNoRawZoomLeakage(page, requests);
  });

  test('runs the mocked SDK lifecycle on mobile client view without provider network calls', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const requests = monitorRequests(page);
    await loginStudent(page);

    await page.getByRole('button', { name: 'Join class' }).click();
    await page.waitForURL('**/classroom/launch');
    await expect(page.locator('[data-mocked-zoom-sdk="true"]')).toBeVisible();
    await expect(page.locator('[data-mocked-zoom-sdk="true"]')).toHaveAttribute(
      'data-selected-view',
      'client',
    );
    await expect(page.locator('[data-classroom-status]')).toContainText(
      'Classroom is ready. View mode: client.',
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);

    await assertNoRawZoomLeakage(page, requests);
  });

  test('surfaces mocked bootstrap fallback, retries, and records leave', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    let failedOnce = false;
    await page.route('**/api/v1/classroom/launch/bootstrap', async (route) => {
      if (!failedOnce) {
        failedOnce = true;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            code: 'ADAPTER_UNAVAILABLE',
            message: 'Mock provider temporarily unavailable.',
          }),
        });
        return;
      }
      await route.continue();
    });

    await loginStudent(page);
    await page.getByRole('button', { name: 'Join class' }).click();
    await page.waitForURL('**/classroom/launch');
    await expect(page.locator('[data-classroom-status]')).toContainText(
      'Mock provider temporarily unavailable.',
    );
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();

    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.locator('[data-mocked-zoom-sdk="true"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Leave' })).toBeVisible();

    await page.getByRole('button', { name: 'Leave' }).click();
    await page.waitForURL('**/app/student');
  });

  test('retries a consumed real-shaped bootstrap from memory without a second bootstrap POST', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    let bootstrapPosts = 0;
    const unexpectedZoomRequests: string[] = [];

    await page.route('**/classroom/launch', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: {
          ...response.headers(),
          'content-security-policy': [
            "default-src 'self'",
            "img-src 'self' data: blob: https://source.zoom.us",
            "script-src 'self' https://source.zoom.us 'unsafe-eval' 'wasm-unsafe-eval'",
            "style-src 'self' 'unsafe-inline' https://source.zoom.us",
            "connect-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "frame-ancestors 'none'",
          ].join('; '),
        },
      });
    });
    await page.route('**/api/v1/classroom/launch/bootstrap', async (route) => {
      bootstrapPosts += 1;
      const response = await route.fetch();
      const json = (await response.json()) as {
        success: true;
        data: {
          selected_view: 'client' | 'component';
          attempt_key: string;
          sdk: { user_display_name: string; leave_url: string };
        };
      };
      await route.fulfill({
        status: response.status(),
        contentType: 'application/json',
        body: JSON.stringify({
          ...json,
          data: {
            ...json.data,
            selected_view: 'client',
            sdk: {
              mode: 'real',
              sdk_web_version: '6.2.0',
              meeting_number: '987654321',
              signature: fakeZoomSignature('sdk-client-e2e'),
              meeting_password: 'protected-test-passcode',
              registrant_token: 'registrant-token-e2e',
              user_email: 'zoom-registration@example.test',
              customer_key: 'zoom_ck_1234567890abcdef12345678',
              role: 0,
              user_display_name: json.data.sdk.user_display_name,
              user_email_required: true,
              leave_url: json.data.sdk.leave_url,
              video_start_model: 'PARTICIPANT_CONSENT',
            },
            provider: {
              mode: 'real',
              state: 'ready',
              raw_join_url_present: false,
            },
          },
        }),
      });
    });
    await page.route('https://source.zoom.us/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/zoom-meeting-6.2.0.min.js')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: `
            window.__zoomJoinCalls = [];
            window.__zoomMeetingStatusListener = undefined;
            window.ZoomMtg = {
              setZoomJSLib() {},
              preLoadWasm() {},
              prepareWebSDK() {},
              inMeetingServiceListener(name, listener) {
                if (name === 'onMeetingStatus') {
                  window.__zoomMeetingStatusListener = listener;
                }
              },
              removeInMeetingServiceListener(name, listener) {
                if (
                  name === 'onMeetingStatus' &&
                  window.__zoomMeetingStatusListener === listener
                ) {
                  window.__zoomMeetingStatusListener = undefined;
                }
              },
              init(options) { options.success(); },
              join(options) {
                window.__zoomJoinCalls.push({
                  sdkKeyPresent: Object.prototype.hasOwnProperty.call(options, 'sdkKey'),
                  meetingNumber: options.meetingNumber,
                  passWord: options.passWord,
                  customerKey: options.customerKey,
                  userName: options.userName
                });
                if (window.__zoomJoinCalls.length === 1) {
                  options.error({ errorCode: 1, reason: 'deterministic test rejection' });
                } else {
                  options.success();
                  window.__zoomMeetingStatusListener?.({ status: 2 });
                }
              }
            };
          `,
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript',
        body: '',
      });
    });
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (
        /zoom\.(?:us|com)$/i.test(url.hostname) &&
        url.hostname.toLowerCase() !== 'source.zoom.us'
      ) {
        unexpectedZoomRequests.push(url.origin);
      }
    });

    await loginStudent(page);
    await page.getByRole('button', { name: 'Join class' }).click();
    await page.waitForURL('**/classroom/launch');
    await expect(page.locator('[data-classroom-status]')).toContainText(
      'Meeting SDK participant join was rejected',
    );
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    expect(bootstrapPosts).toBe(1);
    expect(await zoomJoinCalls(page)).toHaveLength(1);

    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.locator('[data-real-zoom-sdk="true"]')).toBeVisible();
    await expect(page.locator('[data-classroom-status]')).toContainText(
      'Classroom is ready. View mode: client.',
    );
    expect(bootstrapPosts).toBe(1);
    expect(await zoomJoinCalls(page)).toEqual([
      {
        sdkKeyPresent: false,
        meetingNumber: '987654321',
        passWord: 'protected-test-passcode',
        customerKey: 'zoom_ck_1234567890abcdef12345678',
        userName: 'E2E Zoom Learner',
      },
      {
        sdkKeyPresent: false,
        meetingNumber: '987654321',
        passWord: 'protected-test-passcode',
        customerKey: 'zoom_ck_1234567890abcdef12345678',
        userName: 'E2E Zoom Learner',
      },
    ]);
    expect(unexpectedZoomRequests).toEqual([]);

    await page.getByRole('button', { name: 'Leave' }).click();
    await page.waitForURL('**/app/student');
  });

  test('checks provider routes without receiving a classroom launch reference', () => {
    const target = providerSafeRequestTarget('http://127.0.0.1:3100/classroom/launch');
    expect(target).toBe('http://127.0.0.1:3100/classroom/launch');
    expect(new URL(target).search).toBe('');
    expect(new URL(target).hash).toBe('');
    expect(target).not.toMatch(/bna|operations/i);
    expect(providerSafeRequestTarget('http://127.0.0.1:3100/operations/jobs')).toMatch(
      /operations/i,
    );
  });
});

async function loginStudent(page: Page) {
  await page.goto('/login?return_to=%2Fapp%2Fstudent');
  await page.getByLabel('Email').fill('ot-zoom-student@example.test');
  await page.getByLabel('Password').fill('ZoomStudentPassword!234');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/app/student');
  await expect(page.getByRole('button', { name: 'Join class' })).toBeVisible();
}

function monitorRequests(page: Page) {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  return requests;
}

async function assertNoRawZoomLeakage(page: Page, requests: Request[]) {
  const body = await page.textContent('body');
  const html = await page.content();
  expect(`${body}\n${html}`).not.toMatch(
    /https?:\/\/|zoom\.us|\/j\/|classroom_grant_|launch[_-]?secret/i,
  );
  const currentUrl = new URL(page.url());
  expect(currentUrl.pathname).toBe('/classroom/launch');
  expect(currentUrl.search).toBe('');
  expect(currentUrl.hash).toBe('');
  const navigationTargets = await page.evaluate(() =>
    performance.getEntriesByType('navigation').map((entry) => entry.name),
  );
  expect(navigationTargets.join('\n')).not.toMatch(/\/classroom\/launch\/|classroom_grant_/i);
  const externalRequests = requests
    .map((request) => new URL(request.url()))
    .filter((url) => url.origin !== 'http://127.0.0.1:3100');
  expect(externalRequests.map((url) => url.href)).toEqual([]);
  const requestTargets = requests.map((request) => providerSafeRequestTarget(request.url()));
  expect(requestTargets.join('\n')).not.toMatch(
    /zoom\.us|source\.zoom\.us|zoomcdn|bna|operations|classroom_grant_/i,
  );
  for (const target of requestTargets) {
    expect(new URL(target).pathname).not.toMatch(/^\/classroom\/launch\/.+/);
  }
}

function providerSafeRequestTarget(requestUrl: string) {
  return new URL(requestUrl).href;
}

function fakeZoomSignature(sdkKey: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sdkKey, role: 0, mn: '987654321' })).toString(
    'base64url',
  );
  return `${header}.${payload}.deterministic-test-signature`;
}

async function zoomJoinCalls(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __zoomJoinCalls?: Array<{
            sdkKeyPresent: boolean;
            meetingNumber: string;
            passWord: string;
            customerKey: string;
            userName: string;
          }>;
        }
      ).__zoomJoinCalls ?? [],
  );
}
