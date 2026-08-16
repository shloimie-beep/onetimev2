import { describe, expect, it } from 'vitest';

import {
  CANONICAL_COPY_CATALOG,
  COPY_CATALOG_SEMANTIC_VERSION,
  findCanonicalCopy,
} from '../../../packages/domain/src/communications/copy/catalog.ts';
import {
  findGhlCopyFragment,
  GHL_COPY_FRAGMENT_VERSION,
} from '../../../integrations/highlevel/v21/copy/catalog.ts';

const LAUNCH_COPY = [
  {
    id: 'ghl.signup_confirmation.v1',
    workflowId: 'OT-01',
    sender: 'office',
    subject: 'Your One Time Family account is ready',
    preheader: 'Free access is available now, with room for up to three Student seats.',
    ctaLabel: 'Open My Family Account',
    ctaDestination: 'one_time_member_login_url',
  },
  {
    id: 'ghl.legacy_member_migration.step_1.v1',
    workflowId: 'OT-02A',
    sender: 'rabbi_campaign',
    subject: 'A new zman for One Time Mishnayos',
    preheader: 'A personal update from Rabbi Eli about what is beginning in Elul.',
    ctaLabel: "See What's New",
    ctaDestination: 'one_time_home_url',
  },
  {
    id: 'ghl.legacy_member_migration.step_2.v1',
    workflowId: 'OT-02A',
    sender: 'rabbi_campaign',
    subject: 'A steady way to begin Mishnah again',
    preheader: 'Live learning, on-demand review, and a clear routine for the new zman.',
    ctaLabel: 'See How One Time Works',
    ctaDestination: 'one_time_home_url',
  },
  {
    id: 'ghl.legacy_member_migration.step_3.v1',
    workflowId: 'OT-02A',
    sender: 'rabbi_campaign',
    subject: 'Activate your new One Time Family account',
    preheader: 'Restart with immediate free access and room for up to three Student seats.',
    ctaLabel: 'Activate My Family Account',
    ctaDestination: 'one_time_signup_url',
  },
  {
    id: 'ghl.former_member_reactivation.step_1.v1',
    workflowId: 'OT-15',
    sender: 'rabbi_campaign',
    subject: 'Help your son remember what he learns',
    preheader: 'Build clarity, consistency, and lasting Mishnah knowledge.',
    ctaLabel: 'See the Learning Experience',
    ctaDestination: 'one_time_home_url',
  },
  {
    id: 'ghl.former_member_reactivation.step_2.v1',
    workflowId: 'OT-15',
    sender: 'rabbi_campaign',
    subject: 'Live Mishnah learning, with recordings ready for review',
    preheader: 'Join live, return on demand, and keep building steady progress.',
    ctaLabel: 'Explore Live and On-Demand Learning',
    ctaDestination: 'one_time_home_url',
  },
  {
    id: 'ghl.former_member_reactivation.step_3.v1',
    workflowId: 'OT-15',
    sender: 'rabbi_campaign',
    subject: 'Come back to One Time with free access now',
    preheader: 'Restart without a card or an automatic charge.',
    ctaLabel: 'Restart with Free Access',
    ctaDestination: 'one_time_signup_url',
  },
  {
    id: 'ghl.prelaunch_nurture.step_1.v1',
    workflowId: 'OT-02B',
    sender: 'rabbi_campaign',
    subject: 'Build clarity, memory, and consistency in Mishnah',
    preheader: 'A steady learning experience designed to help Mishnah last.',
    ctaLabel: 'See How One Time Works',
    ctaDestination: 'one_time_home_url',
  },
  {
    id: 'ghl.prelaunch_nurture.step_2.v1',
    workflowId: 'OT-02B',
    sender: 'rabbi_campaign',
    subject: 'Live learning when it is time to learn - recordings when it is time to review',
    preheader: 'One secure Family account for live class and on-demand review.',
    ctaLabel: 'Explore Live and On-Demand Learning',
    ctaDestination: 'one_time_home_url',
  },
  {
    id: 'ghl.prelaunch_nurture.step_3.v1',
    workflowId: 'OT-02B',
    sender: 'rabbi_campaign',
    subject: 'Begin One Time with free access now',
    preheader: 'Start without a card and add up to three Student seats.',
    ctaLabel: 'Start with Free Access',
    ctaDestination: 'one_time_signup_url',
  },
] as const;

describe('canonical launch copy', () => {
  it('registers the exact ten office/Rabbi messages and registered CTA destinations', () => {
    expect(COPY_CATALOG_SEMANTIC_VERSION).toBe('1.2.0');
    expect(GHL_COPY_FRAGMENT_VERSION).toBe('1.2.0');

    for (const expected of LAUNCH_COPY) {
      expect(findCanonicalCopy(expected.id)).toMatchObject(expected);
      expect(findGhlCopyFragment(expected.id)).toMatchObject({
        ...expected,
        adultOnly: true,
        tokenBearing: false,
      });
    }

    expect(LAUNCH_COPY.filter((message) => message.sender === 'office')).toHaveLength(1);
    expect(LAUNCH_COPY.filter((message) => message.sender === 'rabbi_campaign')).toHaveLength(9);
  });

  it('keeps the four requested workflow counts and every corrected claim', () => {
    const messages = LAUNCH_COPY.map(({ id }) => findCanonicalCopy(id)!);
    expect(messages.filter(({ workflowId }) => workflowId === 'OT-01')).toHaveLength(1);
    expect(messages.filter(({ workflowId }) => workflowId === 'OT-02A')).toHaveLength(3);
    expect(messages.filter(({ workflowId }) => workflowId === 'OT-15')).toHaveLength(3);
    expect(messages.filter(({ workflowId }) => workflowId === 'OT-02B')).toHaveLength(3);

    const receipt = findCanonicalCopy('ghl.signup_confirmation.v1')!;
    expect(receipt.body).toContain('durable One Time Family account');
    expect(receipt.body).toContain('immediate free access');
    expect(receipt.body).toContain('up to three Student seats');
    expect(receipt.body).toContain('no card was collected');
    expect(receipt.body).toContain('there is no automatic charge');

    const parentActivated = findCanonicalCopy('ghl.parent_portal_activated.v1')!;
    expect(parentActivated.body).toContain('learn immediately from your Parent account');
    expect(parentActivated.body).toContain('add up to three Student accounts');
    expect(parentActivated.body).not.toMatch(/use one of those three Student seats/iu);

    const campaignText = messages
      .map(({ subject, preheader, body }) => `${subject}\n${preheader ?? ''}\n${body}`)
      .join('\n');
    expect(campaignText).not.toMatch(/\bpilot\b/iu);
    expect(campaignText).not.toMatch(/September\s+1[0-9]|20[0-9]{2}-09-1[0-9]|[0-9]{1,2}:24/iu);
    expect(campaignText).toContain('new zman begins in Elul');
    expect(campaignText).toContain('on-demand recording library');
  });

  it('does not leak launch copy into unrelated workflow slots', () => {
    const launchIds = new Set<string>(LAUNCH_COPY.map(({ id }) => id));
    const launchCatalog = CANONICAL_COPY_CATALOG.filter(({ id }) => launchIds.has(id));
    expect(launchCatalog).toHaveLength(10);
    expect(new Set(launchCatalog.map(({ id }) => id)).size).toBe(10);
  });
});
