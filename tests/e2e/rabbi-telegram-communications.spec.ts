import { expect, test } from '@playwright/test';
import { W12_PORTAL_TEST_LAB } from '../../apps/web/src/server/features/portal-test-lab/router.ts';
import { RABBI_TELEGRAM_SYNTHETIC_STUDENT_ANSWER } from '../../packages/contracts/src/telegram/rabbi-communications.ts';

test('Rabbi Telegram exact synthetic Student answer reads back in only the scoped Student portal route', async ({
  browser,
}) => {
  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  await login(
    studentPage,
    W12_PORTAL_TEST_LAB.learners[0].email,
    W12_PORTAL_TEST_LAB.learners[0].defaultPassword,
    '/app/student',
  );
  const studentQuestions = await studentPage.request.get('/api/v1/portals/student/questions');
  expect(studentQuestions.status()).toBe(200);
  const studentPayload = (await studentQuestions.json()) as {
    data: Array<{ answer_preview: string | null }>;
  };
  expect(studentPayload.data.map((question) => question.answer_preview)).toContain(
    `${RABBI_TELEGRAM_SYNTHETIC_STUDENT_ANSWER} Learner 1.`,
  );
  await studentContext.close();

  const siblingContext = await browser.newContext();
  const siblingPage = await siblingContext.newPage();
  await login(
    siblingPage,
    W12_PORTAL_TEST_LAB.learners[1].email,
    W12_PORTAL_TEST_LAB.learners[1].defaultPassword,
    '/app/student',
  );
  const siblingQuestions = await siblingPage.request.get('/api/v1/portals/student/questions');
  expect(siblingQuestions.status()).toBe(200);
  const siblingPayload = (await siblingQuestions.json()) as {
    data: Array<{ answer_preview: string | null }>;
  };
  expect(siblingPayload.data.map((question) => question.answer_preview)).not.toContain(
    `${RABBI_TELEGRAM_SYNTHETIC_STUDENT_ANSWER} Learner 1.`,
  );
  await siblingContext.close();
});

async function login(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  returnTo: string,
) {
  await page.goto(`/login?return_to=${encodeURIComponent(returnTo)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL(`**${returnTo}`);
}
