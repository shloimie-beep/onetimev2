import { describe, expect, it } from 'vitest';
import {
  createOps04DryRun,
  createSyntheticOps04Fixture,
  normalizeOps04Phone,
  sha256,
} from '../../packages/domain/src/ops04/service.ts';

describe('OPS-04 reconciliation dry run', () => {
  it('is deterministic and binds the full source-file manifest', () => {
    const request = createSyntheticOps04Fixture();
    const first = createOps04DryRun(request);
    const second = createOps04DryRun(JSON.parse(JSON.stringify(request)));
    expect(second.dry_run_hash).toBe(first.dry_run_hash);
    expect(second.batch_key).toBe(first.batch_key);

    const changedSource = createSyntheticOps04Fixture();
    changedSource.source_files[0] = {
      ...changedSource.source_files[0]!,
      file_sha256: sha256('changed full-byte source file'),
    };
    const changed = createOps04DryRun(changedSource);
    expect(changed.manifest_sha256).not.toBe(first.manifest_sha256);
    expect(changed.dry_run_hash).not.toBe(first.dry_run_hash);
  });

  it('keeps raw row contents out of the report and uses HMAC identities', () => {
    const report = createOps04DryRun(createSyntheticOps04Fixture());
    const serialized = JSON.stringify(report);
    expect(report.raw_row_contents_included).toBe(false);
    expect(report.sends_allowed).toBe(false);
    expect(serialized).not.toContain('eligible@example.test');
    expect(serialized).not.toContain('OPS04 Synthetic');
    expect(serialized).not.toContain('+1 415');
    expect(row(report, 2).email_hmac).toMatch(/^[a-f0-9]{64}$/);
    expect(row(report, 2).row_hmac).toMatch(/^[a-f0-9]{64}$/);
  });

  it('normalizes phones without assuming a country for ambiguous local numbers', () => {
    expect(normalizeOps04Phone('050-123-4567')).toEqual({
      status: 'ambiguous_local_phone',
      e164: null,
    });
    expect(normalizeOps04Phone('050-123-4567', 'IL')).toEqual({
      status: 'valid',
      e164: '+972501234567',
    });
  });

  it('deduplicates, quarantines conflicts, and preserves independent facts', () => {
    const report = createOps04DryRun(createSyntheticOps04Fixture());
    expect(report.totals.rows.total).toBe(18);
    expect(report.totals.rows.duplicate_occurrences).toBe(1);
    expect(report.totals.equations_balanced).toBe(true);

    const eligible = row(report, 2);
    expect(eligible.primary_disposition).toBe('migration_invitation_eligible');
    expect(eligible.independent_facts.active_old_app_user).toBe(true);
    expect(eligible.independent_facts.lead).toBe(true);
    expect(eligible.sends_allowed).toBe(false);
    expect(eligible.channel_snapshots.email.sends_allowed).toBe(false);
    expect(eligible.channel_snapshots.whatsapp.sends_allowed).toBe(false);

    const currentSubscriber = row(report, 4);
    expect(currentSubscriber.primary_disposition).toBe('already_migrated');
    expect(currentSubscriber.independent_facts.current_subscriber).toBe(true);
    expect(currentSubscriber.planned_actions).toContain('no_op_unchanged');
    expect(currentSubscriber.planned_actions).not.toContain('create_contact');

    const suppressed = row(report, 5);
    expect(suppressed.primary_disposition).toBe('suppressed');
    expect(suppressed.channel_snapshots.email.eligibility).toBe('suppressed');
    expect(suppressed.channel_snapshots.whatsapp.eligibility).toBe('suppressed');

    const shared = row(report, 6);
    expect(shared.primary_disposition).toBe('manual_review');
    expect(shared.quarantine_reasons).toContain('shared_email_without_relationship');

    const localPhone = row(report, 7);
    expect(localPhone.primary_disposition).toBe('manual_review');
    expect(localPhone.quarantine_reasons).toContain('ambiguous_local_phone');

    const school = row(report, 9);
    expect(school.independent_facts.school).toBe(true);
    expect(school.independent_facts.lead).toBe(true);
    expect(school.tag_keys).toContain('ops04:audience:school');

    const conflict = row(report, 11);
    expect(conflict.primary_disposition).toBe('manual_review');
    expect(conflict.quarantine_reasons).toContain('email_phone_target_conflict');
  });
});

function row(report: ReturnType<typeof createOps04DryRun>, rowNumber: number) {
  const found = report.rows.find((candidate) => candidate.source_row_number === rowNumber);
  expect(found).toBeDefined();
  return found!;
}
