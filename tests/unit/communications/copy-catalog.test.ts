import { describe, expect, it } from 'vitest';

import {
  CAMPAIGN_APPROVAL_SEMANTIC_VERSION,
  canonicalContentDigest,
  evaluateCampaignApproval,
  type CampaignApprovalInput,
} from '../../../packages/domain/src/communications/copy/approval.ts';
import {
  COPY_CATALOG_SEMANTIC_VERSION,
  findCanonicalCopy,
  SENDER_IDENTITIES,
  type CanonicalCopyMessage,
} from '../../../packages/domain/src/communications/copy/catalog.ts';
import {
  findGhlCopyFragment,
  GHL_COPY_FRAGMENT_VERSION,
} from '../../../integrations/highlevel/v21/copy/catalog.ts';

const STEP_ONE_ID = 'ghl.former_member_reactivation.step_1.v1';
const STEP_TWO_ID = 'ghl.former_member_reactivation.step_2.v1';
const STEP_THREE_ID = 'ghl.former_member_reactivation.step_3.v1';

const STEP_ONE_DIGEST = 'ff7fd5af4c77c5e9dfd62c5340ff0cb058f48d427ce407f8d6976593f1420ae2';
const STEP_TWO_DIGEST = '530df43199316af56f2227090e164c898988d24a07e2fd08998e26539b6678c4';
const STEP_THREE_DIGEST = 'e2bdbc3063431caa10bfd2ae2a2e6768a99d1f07a5b7f83d5e53b52faa0e4087';

describe('P31 OT-15 canonical copy registration', () => {
  it('publishes the exact owner-authored day-4 and day-9 messages and immutable digests', () => {
    expect(COPY_CATALOG_SEMANTIC_VERSION).toBe('1.1.0');
    expect(CAMPAIGN_APPROVAL_SEMANTIC_VERSION).toBe('1.1.0');
    expect(GHL_COPY_FRAGMENT_VERSION).toBe('1.1.0');

    const stepTwo = requireCopy(STEP_TWO_ID);
    expect(stepTwo).toEqual({
      id: STEP_TWO_ID,
      workflowId: 'OT-15',
      provider: 'ghl',
      sender: 'rabbi_campaign',
      audience: 'former_adult',
      subject: 'A separate Student portal for live class and recordings',
      body: "Hi {{contact.first_name}},\n\nOne Time Mishnayos now gives each Student a separate portal for Rabbi Eli's live class and recording library.\n\nYour Student signs in with their own username and password to join the daily class and open recordings. You manage the account and Student access from the Parent Dashboard.\n\nI would be happy to have your family learning with us again.\n\nHatzlacha,\nRabbi Eli Scheller\nOne Time Mishnayos",
      ctaLabel: 'Open One Time',
      requiresApproval: true,
      requiresCurrentConsent: true,
      launchTiming: 'approval_launch',
      daysAfterApprovalLaunch: 4,
      tokenBearing: false,
      requiredVariables: ['contact.first_name'],
    });
    expect(canonicalContentDigest(stepTwo)).toBe(STEP_TWO_DIGEST);

    const stepThree = requireCopy(STEP_THREE_ID);
    expect(stepThree).toEqual({
      id: STEP_THREE_ID,
      workflowId: 'OT-15',
      provider: 'ghl',
      sender: 'rabbi_campaign',
      audience: 'former_adult',
      subject: 'Come back free until September 13',
      body: "Hi {{contact.first_name}},\n\nYou can come back to One Time Mishnayos free until September 13, 2026 at 7:24 p.m. Jerusalem time.\n\nNo card is required, and you will not be charged automatically. Create a Parent account, then add up to three Student accounts for Rabbi Eli's live class and recordings.\n\nI hope you will join us again.\n\nHatzlacha,\nRabbi Eli Scheller\nOne Time Mishnayos",
      ctaLabel: 'Come back to One Time',
      requiresApproval: true,
      requiresCurrentConsent: true,
      launchTiming: 'approval_launch',
      daysAfterApprovalLaunch: 9,
      tokenBearing: false,
      requiredVariables: ['contact.first_name'],
    });
    expect(canonicalContentDigest(stepThree)).toBe(STEP_THREE_DIGEST);
  });

  it('keeps step 1 byte-for-byte canonical while publishing all three GHL approval contracts', () => {
    const stepOne = requireCopy(STEP_ONE_ID);
    expect(stepOne).toEqual({
      id: STEP_ONE_ID,
      workflowId: 'OT-15',
      provider: 'ghl',
      sender: 'rabbi_campaign',
      audience: 'former_adult',
      subject: 'See what is new in One Time Mishnayos',
      body: 'Hi {{contact.first_name}},\n\n{{campaign.body}}\n\nHatzlacha,\nRabbi Eli Scheller\nOne Time Mishnayos',
      ctaLabel: 'Open One Time',
      requiresApproval: true,
      requiresCurrentConsent: true,
      launchTiming: 'approval_launch',
      tokenBearing: false,
      requiredVariables: ['contact.first_name', 'campaign.body'],
    });
    expect(canonicalContentDigest(stepOne)).toBe(STEP_ONE_DIGEST);

    const expected = [
      [STEP_ONE_ID, undefined, STEP_ONE_DIGEST],
      [STEP_TWO_ID, 4, STEP_TWO_DIGEST],
      [STEP_THREE_ID, 9, STEP_THREE_DIGEST],
    ] as const;
    for (const [id, daysAfterApprovalLaunch, contentDigest] of expected) {
      const fragment = findGhlCopyFragment(id);
      expect(fragment).toMatchObject({
        id,
        workflowId: 'OT-15',
        sender: 'rabbi_campaign',
        audience: 'former_adult',
        requiresExactAdminApproval: true,
        requiresCurrentConsent: true,
        launchTiming: 'approval_launch',
        requiredVariables:
          id === STEP_ONE_ID ? ['contact.first_name', 'campaign.body'] : ['contact.first_name'],
        contentDigest,
        adultOnly: true,
        tokenBearing: false,
      });
      expect(fragment?.daysAfterApprovalLaunch).toBe(daysAfterApprovalLaunch);
      expect(JSON.stringify(fragment)).not.toContain('{{token.');
    }
  });

  it('fails closed on body, subject, or sequence-day drift and on missing named approval or consent', () => {
    const canonical = requireCopy(STEP_TWO_ID);
    const approvedContentDigest = canonicalContentDigest(canonical);

    expect(evaluateCampaignApproval(approvalInput(canonical, approvedContentDigest))).toMatchObject(
      { allowed: true, reasons: [] },
    );

    const driftedMessages: CanonicalCopyMessage[] = [
      { ...canonical, body: `${canonical.body}\nChanged.` },
      { ...canonical, subject: `${canonical.subject} changed` },
      { ...canonical, daysAfterApprovalLaunch: 5 },
    ];
    for (const message of driftedMessages) {
      expect(evaluateCampaignApproval(approvalInput(message, approvedContentDigest))).toMatchObject(
        {
          allowed: false,
          reasons: expect.arrayContaining(['content digest drift or missing approval']),
        },
      );
    }

    const missingNamedApprovalInput = approvalInput(canonical, approvedContentDigest, {
      currentConsentVerified: false,
    });
    const missingNamedApprovalAndConsent = { ...missingNamedApprovalInput };
    delete missingNamedApprovalAndConsent.namedAdminApproval;
    expect(evaluateCampaignApproval(missingNamedApprovalAndConsent)).toMatchObject({
      allowed: false,
      reasons: expect.arrayContaining([
        'missing named Admin approval',
        'current required consent was not verified',
      ]),
    });
  });
});

function requireCopy(id: string): CanonicalCopyMessage {
  const message = findCanonicalCopy(id);
  if (!message) throw new Error(`Missing canonical copy: ${id}`);
  return message;
}

function approvalInput(
  message: CanonicalCopyMessage,
  approvedContentDigest: string,
  overrides: Partial<CampaignApprovalInput> = {},
): CampaignApprovalInput {
  return {
    message,
    sender: SENDER_IDENTITIES.rabbi_campaign,
    audienceCount: 1,
    approvedAudienceCount: 1,
    suppressedCountReadBack: true,
    audienceSampleReadBack: true,
    renderedWithSeedData: true,
    linksUseProductionOrigin: true,
    operatorSeedDelivered: true,
    unexpectedEffects: 0,
    recipientKinds: ['adult'],
    approvedContentDigest,
    approvedAudienceDigest: 'approved-audience',
    actualAudienceDigest: 'approved-audience',
    namedAdminApproval: 'Rabbi Eli Scheller',
    currentConsentVerified: true,
    ...overrides,
  };
}
