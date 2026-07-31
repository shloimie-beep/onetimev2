import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  STUDENT_ACTUAL_NAME_INSTRUCTIONS,
  type ParentHouseholdSnapshot,
} from '../../../../../../../packages/contracts/src/portals/parent-household/index.ts';
import { ParentHouseholdWorkspace } from './ParentHouseholdWorkspace.tsx';
import { createParentHouseholdApi } from './api.ts';

const snapshot: ParentHouseholdSnapshot = {
  contract_version: '1.2.0',
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

describe('P12 persisted Parent household client workspace', () => {
  it('shows owned-seat state and exact actual-name guidance without a stored password', () => {
    const html = renderToStaticMarkup(
      <ParentHouseholdWorkspace snapshot={snapshot} relationship="dependent" />,
    );
    expect(html).toContain('1 of 3 active Student seats used');
    expect(html).toContain(STUDENT_ACTUAL_NAME_INSTRUCTIONS.dependent);
    expect(html).toContain('/app/parent/students/student-1');
    expect(html).not.toMatch(/password_hash|current password/i);
  });

  it('renders a persisted create form with actual/display names and no legacy identity fields', () => {
    const html = renderToStaticMarkup(
      <ParentHouseholdWorkspace
        snapshot={snapshot}
        csrfToken="csrf-token"
        view={{ kind: 'create' }}
      />,
    );
    expect(html).toContain('name="actual_name"');
    expect(html).toContain('name="display_name"');
    expect(html).toContain('name="relationship"');
    expect(html).toContain('name="username"');
    expect(html).toContain('name="new_password"');
    expect(html).toContain('minLength="12"');
    expect(html).toContain('Someone I manage');
    expect(html).toContain('Myself');
    expect(html).toContain(STUDENT_ACTUAL_NAME_INSTRUCTIONS.dependent);
    expect(html).not.toMatch(/name="(?:hebrew_name|grade_label|date_of_birth|age|email)"/u);
  });

  it('renders edit, archive and reset flows without disclosing the existing password', () => {
    const html = renderToStaticMarkup(
      <ParentHouseholdWorkspace
        snapshot={snapshot}
        csrfToken="csrf-token"
        view={{ kind: 'student', student_id: 'student-1' }}
      />,
    );
    expect(html).toContain('Save Student');
    expect(html).toContain('Archive Student');
    expect(html).toContain('Reset Student password');
    expect(html).toContain('existing password is never displayed');
    expect(html).not.toContain('value="safe-password');
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
    expect(html).toContain(STUDENT_ACTUAL_NAME_INSTRUCTIONS.self);
    expect(html).toContain('one-time-visible');
    expect(html).toContain('shown only now');
    expect(html).toContain('Credentials are not emailed');
  });

  it('retains only the status overview for inactive access and removes fourth-seat creation', () => {
    const inactive = renderToStaticMarkup(
      <ParentHouseholdWorkspace
        snapshot={{ ...snapshot, access_state: 'inactive', can_manage_students: false }}
        relationship="dependent"
        view={{ kind: 'create' }}
      />,
    );
    expect(inactive).toContain('Our household');
    expect(inactive).not.toContain('/app/parent/students/new');
    expect(inactive).toContain('management is unavailable');
    expect(inactive).not.toContain('name="actual_name"');
    expect(inactive).not.toContain('Student One');
    expect(inactive).not.toContain('<h2>Students</h2>');

    const full = renderToStaticMarkup(
      <ParentHouseholdWorkspace
        snapshot={{ ...snapshot, active_student_count: 3, available_student_seats: 0 }}
        relationship="dependent"
      />,
    );
    expect(full).toContain('aria-disabled="true"');
    expect(full).not.toContain('href="/app/parent/students/new"');
  });

  it('sends CSRF and an exact idempotency key without request-selected household scope', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { snapshot, credential_handoff: null },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );
    const api = createParentHouseholdApi({ fetcher });
    await api.createStudent(
      {
        expected_revision: 3,
        actual_name: 'Student Two',
        display_name: null,
        username: 'student.two',
        relationship: 'dependent',
        new_password: 'safe-password-123',
        password_confirmation: 'safe-password-123',
      },
      'csrf-token',
      'parent-browser-replay-0001',
    );
    const [url, request] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/app/parent/students');
    expect(request.headers).toMatchObject({
      'x-csrf-token': 'csrf-token',
      'x-idempotency-key': 'parent-browser-replay-0001',
    });
    expect(request.body).not.toContain('household_id');
    expect(request.body).not.toContain('adult_id');
  });
});
