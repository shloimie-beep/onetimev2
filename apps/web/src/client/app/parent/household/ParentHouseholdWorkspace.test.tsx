import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ParentHouseholdSnapshot } from '../../../../../../../packages/contracts/src/portals/parent-household/index.ts';
import { ParentHouseholdWorkspace } from './ParentHouseholdWorkspace.tsx';

const snapshot: ParentHouseholdSnapshot = {
  contract_version: '1.0.1',
  household_id: 'household-1',
  display_name: 'Our household',
  access_state: 'active',
  student_allowance: 3,
  active_student_count: 1,
  available_student_seats: 2,
  can_manage_students: true,
  revision: 3,
  students: [
    {
      student_id: 'student-1',
      household_id: 'household-1',
      actual_name: 'Student One',
      display_name: null,
      username: 'student.one',
      relationship: 'dependent',
      state: 'active',
      credential_version: 2,
      version: 2,
    },
  ],
};

describe('P12 Parent household client workspace', () => {
  it('shows owned-seat state and exact dependent actual-name guidance without passwords', () => {
    const html = renderToStaticMarkup(
      <ParentHouseholdWorkspace snapshot={snapshot} relationship="dependent" />,
    );
    expect(html).toContain('1 of 3 active Student seats used');
    expect(html).toContain(
      'Please use the Student’s actual name so Rabbi Eli can identify them during class.',
    );
    expect(html).toContain('/app/parent/students/student-1');
    expect(html).not.toMatch(/New password|password_hash|current password/i);
  });

  it('shows a new password only in the immediate copy/print handoff', () => {
    const html = renderToStaticMarkup(
      <ParentHouseholdWorkspace
        snapshot={snapshot}
        relationship="self"
        credentialHandoff={{
          student_id: 'student-1',
          student_label: 'Student One',
          username: 'student.one',
          new_password: 'one-time-visible',
          display_once: true,
          may_copy_or_print: true,
          emailed: false,
        }}
      />,
    );
    expect(html).toContain(
      'Please use your actual name so Rabbi Eli can identify you during class.',
    );
    expect(html).toContain('one-time-visible');
    expect(html).toContain('shown only now');
    expect(html).toContain('Credentials are not emailed');
  });

  it('removes Student management for inactive access and disables a fourth seat', () => {
    const inactive = renderToStaticMarkup(
      <ParentHouseholdWorkspace
        snapshot={{ ...snapshot, access_state: 'inactive', can_manage_students: false }}
        relationship="dependent"
      />,
    );
    expect(inactive).not.toContain('/app/parent/students/new');
    expect(inactive).toContain('management is unavailable');

    const full = renderToStaticMarkup(
      <ParentHouseholdWorkspace
        snapshot={{
          ...snapshot,
          active_student_count: 3,
          available_student_seats: 0,
        }}
        relationship="dependent"
      />,
    );
    expect(full).toContain('aria-disabled="true"');
    expect(full).not.toContain('href="/app/parent/students/new"');
  });
});
