import { createHash } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  fingerprintIdentityForW12100,
  runW12100SourcePreflight,
  W12_100_04_MANUAL_REVIEW_CATEGORIES,
  type ApprovedSource,
} from '../../../scripts/w12-100/data/real-source-preflight.ts';

describe('W12-100-04 real source preflight runner', () => {
  it('returns a precise blocked result when the sanitized source packet is unavailable', async () => {
    const result = await runW12100SourcePreflight({
      sourceDir: path.join(os.tmpdir(), 'missing-w12-100-source-packet'),
      approvedSources: [syntheticApproval('synthetic-audience.csv', '')],
      now: new Date('2026-07-17T12:00:00.000Z'),
    });

    expect(result.status).toBe('blocked');
    expect(result.blocked_reasons).toContain('BLOCKED_SANITIZED_SOURCE_PACKET_NOT_FOUND');
    expect(result.privacy_and_safety.production_database_connected).toBe(false);
    expect(result.privacy_and_safety.database_writes_performed).toBe(false);
    expect(result.privacy_and_safety.external_actions_count).toBe(0);
  });

  it('stops before parsing when an approved filename has a hash mismatch', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'w12-100-hash-mismatch-'));
    const privateCsv = [
      'Name,Email,Phone,Subscription Status',
      'Private Fixture,private.fixture@example.test,052-555-0199,subscribed',
    ].join('\n');
    await writeFile(path.join(directory, 'synthetic-audience.csv'), privateCsv, 'utf8');

    const result = await runW12100SourcePreflight({
      sourceDir: directory,
      approvedSources: [syntheticApproval('synthetic-audience.csv', 'not the csv')],
      now: new Date('2026-07-17T12:00:00.000Z'),
    });
    const serialized = JSON.stringify(result);

    expect(result.status).toBe('blocked');
    expect(result.blocked_reasons).toContain('BLOCKED_APPROVED_SOURCE_HASH_MISMATCH:SYNTH-1');
    expect(result.summary.total_rows).toBe(0);
    expect(serialized).not.toContain('Private Fixture');
    expect(serialized).not.toContain('private.fixture@example.test');
    expect(serialized).not.toContain('052-555-0199');
  });

  it('classifies synthetic rows counts-only with suppression before eligibility', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'w12-100-preflight-'));
    const csv = [
      'Name,Email,Phone,Subscription Status,Tags',
      'Matched Person,matched@example.test,052-555-0101,subscribed,family',
      'New Person,new@example.test,052-555-0102,subscribed,family',
      'Duplicate Person,new@example.test,052-555-0102,subscribed,family',
      'Suppressed Person,suppressed@example.test,052-555-0103,unsubscribed,family',
      'Missing Identity,,,subscribed,family',
      'Student Person,student@example.test,052-555-0104,subscribed,student',
    ].join('\n');
    await writeFile(path.join(directory, 'synthetic-audience.csv'), csv, 'utf8');

    const result = await runW12100SourcePreflight({
      sourceDir: directory,
      approvedSources: [syntheticApproval('synthetic-audience.csv', csv, 6)],
      existingIdentitySnapshot: [
        {
          identity_fingerprint:
            fingerprintIdentityForW12100({
              email: 'matched@example.test',
              phone: '+972525550101',
            }) ?? '',
          contact_fingerprint: createHash('sha256').update('synthetic-contact').digest('hex'),
          suppression_state: 'active',
          new_system_activated: false,
        },
      ],
      now: new Date('2026-07-17T12:00:00.000Z'),
    });
    const serialized = JSON.stringify(result);

    expect(result.status).toBe('done');
    expect(result.summary.total_rows).toBe(6);
    expect(result.summary.disposition_counts).toMatchObject({
      matched_existing_contact: 1,
      stage_new_contact: 2,
      duplicate_input: 1,
      no_op: 0,
      manual_review: 2,
    });
    expect(result.summary.communication_eligible_rows).toBe(2);
    expect(result.summary.crm_importable).toBe(3);
    expect(result.summary.email_campaign_eligible).toBe(2);
    expect(result.summary.whatsapp_campaign_eligible).toBe(0);
    expect(result.summary.suppressed).toBe(1);
    expect(result.summary.invalid).toBe(1);
    expect(result.summary.duplicate).toBe(1);
    expect(result.summary.identity_conflict).toBe(0);
    expect(result.summary.quarantined).toBe(1);
    expect(result.summary.do_not_contact_rows).toBe(1);
    for (const category of W12_100_04_MANUAL_REVIEW_CATEGORIES) {
      expect(result.manual_review_categories[category]).toBeDefined();
    }
    expect(result.manual_review_categories.missing_email_and_missing_phone.count).toBe(1);
    expect(result.manual_review_categories.duplicate_input_same_identity.count).toBe(1);
    expect(result.manual_review_categories.minor_or_student_safety_unclear.count).toBe(1);
    expect(result.source_ownership_and_consent_blockers.consent_blocker_counts).toMatchObject({
      suppressed_or_opted_out: 1,
      channel_specific_consent_absent: 1,
    });
    expect(serialized).not.toContain('Matched Person');
    expect(serialized).not.toContain('matched@example.test');
    expect(serialized).not.toContain('052-555-0101');
    expect(serialized).not.toContain('Student Person');
  });

  it('allows private CRM storage when campaign channel consent is unknown', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'w12-100-unknown-consent-'));
    const csv = [
      'Name,Email,Phone,Tags',
      'Unknown Consent,unknown@example.test,052-555-0201,family',
    ].join('\n');
    await writeFile(path.join(directory, 'synthetic-audience.csv'), csv, 'utf8');

    const result = await runW12100SourcePreflight({
      sourceDir: directory,
      approvedSources: [syntheticApproval('synthetic-audience.csv', csv)],
      now: new Date('2026-07-17T12:00:00.000Z'),
    });
    const serialized = JSON.stringify(result);

    expect(result.status).toBe('done');
    expect(result.summary.crm_importable).toBe(1);
    expect(result.summary.email_campaign_eligible).toBe(0);
    expect(result.summary.whatsapp_campaign_eligible).toBe(0);
    expect(result.summary.manual_review_rows).toBe(0);
    expect(result.summary.disposition_counts.stage_new_contact).toBe(1);
    expect(result.manual_review_categories.legacy_member_without_current_consent.count).toBe(0);
    expect(serialized).not.toContain('Unknown Consent');
    expect(serialized).not.toContain('unknown@example.test');
    expect(serialized).not.toContain('052-555-0201');
  });
});

function syntheticApproval(fileName: string, content: string, expectedRows = 1): ApprovedSource {
  return {
    id: 'SYNTH-1',
    fileName,
    classification: 'email_audience_export',
    sha256: createHash('sha256').update(content).digest('hex'),
    expectedRows,
    expectedColumns: 5,
    sourceOwner: 'operator local Downloads',
    readiness: 'dry_run_candidate_only',
    defaultConsentState: 'unknown',
    defaultSuppressionState: 'active',
  };
}
