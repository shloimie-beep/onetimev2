export const RESEND_SECURITY_TEMPLATE_VERSION = '1.0.0';

export type SecurityEmailKind = 'account_setup' | 'password_reset';

export type RenderedSecurityEmail = Readonly<{
  provider: 'resend';
  senderKey: 'security_resend';
  subject: string;
  text: string;
  ctaLabel: string;
  ctaUrl: string;
}>;

export function renderSecurityEmail(
  input: Readonly<{
    kind: SecurityEmailKind;
    firstName: string;
    expiresAtLocal: string;
    opaqueToken: string;
    appOrigin: string;
  }>,
): RenderedSecurityEmail {
  const origin = new URL(input.appOrigin);
  if (origin.protocol !== 'https:') throw new Error('security email requires an HTTPS app origin');
  if (!input.opaqueToken.trim()) throw new Error('security email requires an opaque token');
  if (!input.firstName.trim() || !input.expiresAtLocal.trim())
    throw new Error('security email variables are required');

  const isSetup = input.kind === 'account_setup';
  const action = isSetup ? 'set your One Time password' : 'reset your One Time password';
  const ctaLabel = isSetup ? 'Set up my account' : 'Reset my password';
  const path = isSetup ? '/account/setup' : '/account/reset-password';
  const ctaUrl = new URL(path, origin);
  ctaUrl.searchParams.set('token', input.opaqueToken);

  return {
    provider: 'resend',
    senderKey: 'security_resend',
    subject: isSetup ? 'Set up your One Time account' : 'Reset your One Time password',
    text: `Hi ${input.firstName},\n\nUse the button below to ${action}.\n\nThis link can be used once and expires on ${input.expiresAtLocal}. If it expires, request a new link from the sign-in page.\n\nIf you did not request this ${isSetup ? 'account' : 'password reset'}, you can ignore this email.`,
    ctaLabel,
    ctaUrl: ctaUrl.toString(),
  };
}
