import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('parent-first learning-participant migration', () => {
  const sql = readFileSync(
    'packages/db/migrations/2286_parent_first_learning_participant.sql',
    'utf8',
  );

  it('models the Parent as learner one without manufacturing a Student', () => {
    expect(sql).toContain('CREATE TABLE onetime.parent_learning_participants');
    expect(sql).toContain("participant_kind text NOT NULL DEFAULT 'parent'");
    expect(sql).toContain('learner_ordinal smallint NOT NULL DEFAULT 1');
    expect(sql).toContain('CHECK (learner_ordinal = 1)');
    expect(sql).toContain('CREATE TABLE onetime.parent_learning_class_entitlements');
    expect(sql).not.toMatch(/INSERT INTO onetime\.(?:portal_learners|v21_student_profiles)/u);
    expect(sql).not.toMatch(/ALTER TABLE onetime\.v21_households[\s\S]*seat_limit/u);
  });

  it('keeps Parent attendance, progress, and questions out of Student facts', () => {
    expect(sql).toContain('CREATE TABLE onetime.parent_learning_attendance_events');
    expect(sql).toContain('CREATE TABLE onetime.parent_learning_content_progress_events');
    expect(sql).toContain('CREATE TABLE onetime.parent_learning_questions');
    expect(sql).toContain("actor_kind text NOT NULL DEFAULT 'parent'");
    expect(sql).not.toMatch(/student_id text/u);
    expect(sql).not.toMatch(/learner_key text/u);
    expect(sql).toContain(
      'REFERENCES onetime.content_items(account_key, product_key, content_item_key)',
    );
    expect(sql).toContain('REFERENCES onetime.content_revisions(revision_key)');
    expect(sql).toContain('CREATE TRIGGER parent_learning_content_scope_guard');
    expect(sql).toContain('CREATE TRIGGER parent_learning_attendance_scope_guard');
    expect(sql).toContain('CREATE TRIGGER parent_learning_question_scope_guard');
    expect(sql).toContain("content_entitlement.audience = 'all_active_learners'");
    expect(sql).toContain("content_entitlement.audience = 'household'");
  });

  it('backfills every active Family Parent and fails closed without one canonical entitlement', () => {
    expect(sql).toContain("WHERE household.classification = 'family'");
    expect(sql).toContain("AND household.state = 'active'");
    expect(sql).toContain("'existing_family_backfill'");
    expect(sql).toContain(
      'COALESCE(contact.account_key, portal.account_key, singleton.account_key)',
    );
    expect(sql).toContain('HAVING count(*) = 1');
    expect(sql).toContain('active Family Parent has conflicting canonical account scope');
    expect(sql).toContain(
      'active Parent learning participant lacks one canonical class entitlement',
    );
  });

  it('normalizes only Family child-seat counts around preserved legacy self profiles', () => {
    expect(sql).toContain('UPDATE onetime.v21_households AS household');
    expect(sql).toContain("WHERE household.classification = 'family'");
    expect(sql).toContain("child_student.relationship = 'dependent'");
    expect(sql).toContain("child_student.state = 'active'");
    expect(sql).toContain('version = household.version + 1');
    expect(sql).toContain('Family active seat count does not match active dependent Students');
    expect(sql).not.toMatch(/WHERE household\.classification = 'school'[\s\S]*active_seat_count/u);
  });
});
