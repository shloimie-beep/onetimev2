import { describe, expect, it } from 'vitest';
import { leadPayloadSchema } from '../../packages/contracts/src/index.ts';
import {
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
    expect(successCopy('family').heading).toBe("You're signed up.");
    expect(successCopy('school').body).toBe("We saved your information and we'll be in touch.");
  });

  it('suppresses the campaign after the Asia/Jerusalem deadline', () => {
    expect(campaignTicker(new Date('2026-09-10T20:59:00Z'))).toContain(
      'JOIN FREE UNTIL ROSH HASHANAH',
    );
    expect(campaignTicker(new Date('2026-09-11T00:01:00+03:00'))).toBeNull();
  });

  it('keeps the receive panel exact and scoped', () => {
    expect(landingContent.receive.title).toBe('Live Daily Mishnayos');
    expect(landingContent.receive.bullets).toContain(
      'Secure student portal - gamified access to Rabbi Scheller and student-scoped updates',
    );
    expect(JSON.stringify(landingContent)).not.toContain('Monitored platform');
    expect(JSON.stringify(landingContent)).not.toContain('Questions with Rabbi Scheller');
  });

  it('records the Toronto accomplishment asset blocker without substituting Lakewood', () => {
    const accomplishment = landingContent.gain.cards.find(
      (card) => card.title === 'Accomplishment',
    );
    expect(accomplishment?.image).toBeNull();
    expect(accomplishment?.assetBlocker).toContain('Toronto.jpg');
    expect(landingContent.gain.cards.some((card) => card.image?.includes('lakewood'))).toBe(false);
  });
});
