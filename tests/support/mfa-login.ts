import type { Page } from '@playwright/test';
import { base32Decode, totp } from '../../packages/domain/src/auth/totp.ts';

const secrets = new Map<string, Buffer>();
const recoveryCodes = new Map<string, string[]>();
const lastTotpCounter = new Map<string, number>();

export async function login(page: Page, email = 'ot-admin@example.test') {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('TestPassword!234');
  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/auth/login') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Login' }).click();
  const loginJson = await (await loginResponse).json();
  if (!loginJson.mfa_required) {
    await page.waitForURL('**/app/crm');
    return;
  }

  const verifyButton = page.getByRole('button', { name: 'Verify' });
  await verifyButton.waitFor({ state: 'visible' });

  const setupUri = page.getByLabel('Authenticator setup URI');
  const hasEnrollment = await setupUri.isVisible().catch(() => false);
  if (hasEnrollment) {
    const secret = secretFromOtpAuth(await setupUri.inputValue());
    secrets.set(email, secret);
    await page.getByLabel('Authenticator code').fill(await nextTotpCode(page, email, secret));
  } else {
    const recovery = recoveryCodes.get(email)?.shift();
    if (recovery) {
      await page.locator('#recovery_code').fill(recovery);
    } else {
      const secret = secrets.get(email);
      if (!secret) throw new Error(`No MFA factor is known for ${email}.`);
      await page.getByLabel('Authenticator code').fill(await nextTotpCode(page, email, secret));
    }
  }

  const verification = page.waitForResponse((response) =>
    response.url().endsWith('/api/v1/auth/mfa/verify'),
  );
  await verifyButton.click();
  await verification;
  const continueButton = page.getByRole('button', { name: 'Continue' });
  const needsRecoverySave = await continueButton
    .waitFor({ state: 'visible', timeout: 1500 })
    .then(() => true)
    .catch(() => false);
  if (needsRecoverySave) {
    const codes = (await page.locator('#recovery_codes').inputValue())
      .split('\n')
      .map((code) => code.trim())
      .filter(Boolean);
    recoveryCodes.set(email, codes);
    await continueButton.click();
  }
  await page.waitForURL('**/app/crm');
}

function secretFromOtpAuth(uri: string) {
  const secret = new URL(uri).searchParams.get('secret');
  if (!secret) throw new Error('Missing otpauth secret.');
  return base32Decode(secret);
}

async function nextTotpCode(page: Page, email: string, secret: Buffer) {
  const counter = currentCounter();
  const last = lastTotpCounter.get(email);
  if (last !== undefined && counter <= last) {
    await page.waitForTimeout((last + 1) * 30_000 - Date.now() + 250);
  }
  lastTotpCounter.set(email, currentCounter());
  return totp({ secret });
}

function currentCounter() {
  return Math.floor(Date.now() / 30_000);
}
