import { expect, test, type Page } from '@playwright/test';
import { W12_E2E_ADMIN_SESSION_TOKEN } from '../support/w12-portal-test-lab-session.ts';

test('Rabbi live console fake flow: Student Ready -> Rabbi Feature -> Done', async ({
  browser,
}) => {
  const studentContext = await browser.newContext();
  const ownerContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  const ownerPage = await ownerContext.newPage();
  const questionText = 'Browser live question alpha marker';

  await loginAs(
    studentPage,
    'ot-zoom-student@example.test',
    'ZoomStudentPassword!234',
    '/app/student',
  );
  await expect(studentPage.getByLabel('Question for class')).toBeVisible();

  const questionResponse = studentPage.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/live-class/questions') &&
      response.request().method() === 'POST',
  );
  await studentPage.getByLabel('Question for class').fill(questionText);
  await studentPage.getByRole('button', { name: 'Send question' }).click();
  const questionJson = (await (await questionResponse).json()) as {
    data: { question: { occurrence_key: string; question_key: string } };
  };
  const questionKey = questionJson.data.question.question_key;
  const occurrenceKey = questionJson.data.question.occurrence_key;

  await useAdminSession(
    ownerPage,
    `/app/live-console?occurrence_key=${encodeURIComponent(occurrenceKey)}`,
  );
  await expect(ownerPage.getByRole('heading', { name: 'Live Console' })).toBeVisible();
  const consoleSnapshot = await ownerPage.request.get(
    `/api/v1/live-class/questions?occurrence_key=${encodeURIComponent(occurrenceKey)}`,
  );
  const consoleText = await consoleSnapshot.text();
  expect(consoleSnapshot.status(), consoleText).toBe(200);
  expect(consoleText).toContain(questionText);
  await ownerPage
    .locator('.live-question-item', { hasText: questionText })
    .getByRole('button', { name: 'Select' })
    .click();

  await expect(studentPage.getByText('Rabbi selected your question.')).toBeVisible({
    timeout: 7000,
  });
  await studentPage.getByRole('button', { name: "I'm ready" }).click();
  await expect(studentPage.getByText('Ready sent')).toBeVisible();

  await expect(ownerPage.locator('.live-panel--selected')).toContainText('student ready', {
    timeout: 7000,
  });
  await ownerPage.getByRole('button', { name: 'Feature', exact: true }).click();
  await expect
    .poll(async () => {
      const liveSnapshot = await ownerPage.request.get('/api/v1/live-class/questions');
      const liveJson = await liveSnapshot.json();
      const activeQuestion = liveJson.data.questions.find(
        (question: { question_key: string }) => question.question_key === questionKey,
      );
      return `${activeQuestion.status}:${liveJson.data.stage.current_scene}`;
    })
    .toBe('live:OT - Featured Student');

  await ownerPage.getByRole('button', { name: 'Done' }).click();
  await expect
    .poll(async () => {
      const doneSnapshot = await ownerPage.request.get('/api/v1/live-class/questions');
      const doneJson = await doneSnapshot.json();
      const answeredQuestion = doneJson.data.questions.find(
        (question: { question_key: string }) => question.question_key === questionKey,
      );
      return `${answeredQuestion.status}:${doneJson.data.stage.current_scene}`;
    })
    .toBe('answered:OT - Slides');

  await studentContext.close();
  await ownerContext.close();
});

async function loginAs(page: Page, email: string, password: string, returnTo: string) {
  await page.goto(`/login?return_to=${encodeURIComponent(returnTo)}`);
  const csrfToken = await page.locator('input[name="csrf_token"]').inputValue();
  const response = await page.evaluate(
    async (payload) => {
      const result = await fetch('/api/v1/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'x-csrf-token': payload.csrfToken },
        body: JSON.stringify({
          email: payload.email,
          password: payload.password,
          csrf_token: payload.csrfToken,
          return_to: payload.returnTo,
        }),
      });
      return { status: result.status, text: await result.text() };
    },
    { email, password, csrfToken, returnTo },
  );
  expect(response.status, response.text).toBe(200);
  await page.goto(returnTo);
  await page.waitForLoadState('domcontentloaded');
}

async function useAdminSession(page: Page, returnTo: string) {
  await page.context().addCookies([
    {
      name: 'otcrm_session',
      value: W12_E2E_ADMIN_SESSION_TOKEN,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  await page.goto(returnTo);
  await page.waitForLoadState('domcontentloaded');
}
