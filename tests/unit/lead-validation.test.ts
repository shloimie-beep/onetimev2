import { describe, expect, it } from 'vitest';
import { leadPayloadSchema } from '../../packages/contracts/src/index.ts';
import {
  campaign,
  campaignTicker,
  landingContent,
  legalPolicyMetadata,
  normalizePhone,
  privacyDataCategories,
  privacyNotice,
  successCopy,
  termsOfUse,
} from '../../packages/domain/src/index.ts';

const basePayload = {
  contact_name: 'Parent Person',
  family_or_school: 'Dratler',
  audience_type: 'family',
  location: 'Jerusalem',
  timezone: 'Asia/Jerusalem',
  email: 'parent@example.com',
  phone: '',
  reminder_preference: 'email',
  reminder_consent: true,
  idempotency_key: 'unit-key-123',
};

describe('lead validation and content contracts', () => {
  it('requires phone for WhatsApp channels', () => {
    const result = leadPayloadSchema.safeParse({
      ...basePayload,
      reminder_preference: 'whatsapp',
      reminder_consent: true,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === 'phone')).toBe(true);
  });

  it('does not require consent for no daily reminders', () => {
    const result = leadPayloadSchema.safeParse({
      ...basePayload,
      reminder_preference: 'none',
      reminder_consent: false,
    });
    expect(result.success).toBe(true);
  });

  it('normalizes local Israeli phone values', () => {
    expect(normalizePhone('050-123-4567')).toBe('+972501234567');
  });

  it('uses distinct family and school success copy', () => {
    expect(successCopy('family').heading).toBe('Adult pre-registration received.');
    expect(successCopy('family').body).toContain('did not create a portal account');
    expect(successCopy('school').heading).toBe('Thank you - we received your school inquiry.');
    expect(successCopy('school').body).toContain('does not create class access');
  });

  it('renders campaign timing only from an explicit expiry', () => {
    const publicCopy = JSON.stringify({ campaign, landingContent });
    expect(campaign.id).toBe('configured-free-access');
    expect(campaign.timezone).toBe('Asia/Jerusalem');
    expect(campaignTicker(new Date('2026-09-10T20:59:00Z'))).toBeNull();
    expect(campaignTicker(new Date('2026-09-11T14:59:00Z'), '2026-09-11T18:00:00+03:00')).toContain(
      'FREE ACCESS',
    );
    expect(
      campaignTicker(new Date('2026-09-11T18:00:00+03:00'), '2026-09-11T18:00:00+03:00'),
    ).toBeNull();
    expect(landingContent.hero.eyebrow).toBe('LIVE, ONLINE + ON-DEMAND');
    expect(landingContent.hero.headline).toBe('Help your son love learning Mishnayos.');
    expect(landingContent).not.toHaveProperty('whatsappAssistant');
    expect(publicCopy).not.toMatch(/September 13|2026-09-13|LIVE EVERY DAY/i);
  });

  it('keeps the receive panel exact and scoped', () => {
    expect(landingContent.receive.heading).toBe(
      'Everything He Needs to Learn, Review, and Remember',
    );
    expect(landingContent.receive.title).toBe('Live Mishnayos—plus the tools to make it stick.');
    expect(landingContent.receive.bullets.map((bullet) => bullet.lead)).toEqual([
      'LIVE SUNDAY–THURSDAY',
      'REVIEW ANYTIME',
      'REMEMBER THE LEARNING',
      'STAY ON TRACK',
      'STUDENT PORTAL',
      'PARENT PORTAL',
    ]);
    expect(JSON.stringify(landingContent)).not.toContain('Monitored platform');
    expect(JSON.stringify(landingContent)).not.toContain('Questions with Rabbi Scheller');
  });

  it('keeps schedule and Rabbi claims bounded to approved public truth', () => {
    const publicCopy = JSON.stringify(landingContent);
    expect(publicCopy).not.toMatch(
      /world-renowned|Master Shas|guaranteed|daily reminders|daily rhythm|daily Torah-learning routine|daily learning community/i,
    );
    expect(publicCopy.match(/Sunday-through-Thursday/gi)?.length).toBeGreaterThanOrEqual(4);
  });

  it('assigns approved gain assets and avoids duplicate student imagery', () => {
    const clarity = landingContent.gain.cards.find((card) => card.title === 'Clarity');
    const retention = landingContent.gain.cards.find((card) => card.title === 'Retention');
    const progress = landingContent.gain.cards.find((card) => card.title === 'Progress');
    expect(clarity?.image).toBe('/assets/outcomes/clarity-class.webp');
    expect(retention?.image).toBe('/assets/outcomes/retention-review-class-720.webp');
    expect(retention?.alt).toContain('Rabbi Scheller teaching beside a large classroom display');
    expect(progress?.image).toBe('/assets/outcomes/accomplishment-toronto-class.jpg');
    expect(progress?.alt).toContain('Toronto');
    expect(progress?.assetBlocker).toBeNull();
    expect(
      landingContent.gain.cards.filter(
        (card) => (card.image as string | null) === '/assets/students/smiley-kid.png',
      ),
    ).toHaveLength(0);
    expect(landingContent.gain.cards.map((card) => card.title)).toEqual([
      'Clarity',
      'Retention',
      'Progress',
      'A Love of Learning',
    ]);
    expect(landingContent.gain.cards.some((card) => card.image?.includes('lakewood'))).toBe(false);
  });

  it('ships launch legal content with the current data categories and no live billing claim', () => {
    expect(legalPolicyMetadata.policySetVersion).toBe(\n      'one-time-public-legal-v2-2026-08-09',\n    );
    expect(legalPolicyMetadata.consentPolicyVersion).toBe(\n      'one-time-unified-terms-consent-v2-2026-08-09',\n    );
    expect(privacyNotice.title).toBe('Privacy Notice');
    expect(termsOfUse.title).toBe('Terms of Use');
    expect(privacyDataCategories.map((category) => category.label)).toEqual([
      'Signup records',
      'Account records',
      'Household and guardian records',
      'Learner records',
      'Class and classroom records',
      'Progress and learning records',
      'Communications records',
      'Support records',
      'Provider event records',
      'Payment and test-payment records',
      'Security records',
      'Operational records',
    ]);
    expect(JSON.stringify(privacyDataCategories)).toContain(
      'The public form is for parent, guardian, or school contact details.',
    );
    expect(JSON.stringify(termsOfUse)).toContain('fixture and Stripe test-mode evidence');
    expect(JSON.stringify(termsOfUse)).not.toMatch(
      /paid checkout is live|live paid checkout is available/i,
    );
    expect(JSON.stringify(privacyNotice)).not.toMatch(/\bCOPPA\b|\bFERPA\b|\bGDPR\b|\bHIPAA\b/);
  });
});
