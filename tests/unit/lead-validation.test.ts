import { describe, expect, it } from 'vitest';
import { leadPayloadSchema } from '../../packages/contracts/src/index.ts';
import {
  campaign,
  campaignTicker,
  landingContent,
  normalizePhone,
  successCopy,
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
    expect(successCopy('family').heading).toBe('Thank you - we received your Family signup.');
    expect(successCopy('family').body).toContain('Class access and member login details');
    expect(successCopy('school').heading).toBe('Thank you - we received your school inquiry.');
    expect(successCopy('school').body).toContain('does not create class access');
  });

  it('keeps the approved campaign countdown without stale pricing copy', () => {
    const publicCopy = JSON.stringify({ campaign, landingContent });
    expect(campaign.id).toBe('free-until-rosh-hashanah-2026');
    expect(campaign.deadlineDate).toBe('2026-09-11');
    expect(campaign.timezone).toBe('Asia/Jerusalem');
    expect(campaignTicker(new Date('2026-09-10T20:59:00Z'))).toContain(
      'JOIN NOW — FREE UNTIL ROSH HASHANAH',
    );
    expect(campaignTicker(new Date('2026-09-11T00:01:00+03:00'))).toBeNull();
    expect(publicCopy).not.toMatch(/\$67|monthly price|No card today|trial/i);
  });

  it('keeps the receive panel exact and scoped', () => {
    expect(landingContent.receive.heading).toBe(
      'Everything He Needs to Learn, Review, and Remember',
    );
    expect(landingContent.receive.title).toBe(
      'Live Daily Mishnayos—plus the tools to make it stick.',
    );
    expect(landingContent.receive.bullets.map((bullet) => bullet.lead)).toEqual([
      'LIVE EVERY DAY',
      'REVIEW ANYTIME',
      'REMEMBER THE LEARNING',
      'STAY ON TRACK',
      'STUDENT PORTAL',
      'PARENT PORTAL',
    ]);
    expect(JSON.stringify(landingContent)).not.toContain('Monitored platform');
    expect(JSON.stringify(landingContent)).not.toContain('Questions with Rabbi Scheller');
  });

  it('assigns approved gain assets and avoids duplicate student imagery', () => {
    const clarity = landingContent.gain.cards.find((card) => card.title === 'Clarity');
    const retention = landingContent.gain.cards.find((card) => card.title === 'Retention');
    const progress = landingContent.gain.cards.find((card) => card.title === 'Progress');
    expect(clarity?.image).toBe('/assets/outcomes/clarity-class.webp');
    expect(retention?.image).toBeNull();
    expect(retention && 'visualTreatment' in retention ? retention.visualTreatment : null).toBe(
      'memory-review',
    );
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
});
