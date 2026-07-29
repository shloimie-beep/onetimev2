import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  AdminDirectoryWorkspace,
  directoryActionConsequence,
  directoryUrl,
  parseDirectoryQuery,
} from './AdminDirectoryWorkspace.tsx';

const scope = {
  product: 'one_time_mishnayos',
  runtimeTier: 'isolated_staging',
  verificationEnvironmentId: 'ci',
} as const;
const timestamps = {
  createdAt: '2026-07-29T01:00:00.000Z',
  updatedAt: '2026-07-29T01:00:00.000Z',
};

describe('P10 Admin directory workspace', () => {
  it('renders accessible English/LTR adult, household, and Student lifecycle controls', () => {
    const html = renderToStaticMarkup(
      <AdminDirectoryWorkspace
        url="/admin/directory?status=all&sort=name_asc&page=1"
        adults={[
          {
            adult: {
              ...scope,
              ...timestamps,
              adultId: 'adult-one',
              normalizedEmail: 'admin@example.test',
              displayName: 'מנהל One',
              state: 'active',
              version: 1,
            },
            account: {
              ...scope,
              ...timestamps,
              humanAccountId: 'account-one',
              adultId: 'adult-one',
              memberships: ['admin', 'parent'],
              state: 'active',
              securityVersion: 1,
              version: 1,
            },
            ownedHouseholdCount: 2,
          },
        ]}
        households={[
          {
            ...scope,
            ...timestamps,
            householdId: 'household-one',
            ownerAdultId: 'adult-one',
            ownerHumanAccountId: 'account-one',
            classification: 'family',
            displayName: 'משפחת One',
            seatLimit: 3,
            activeSeatCount: 1,
            state: 'active',
            accessState: 'active',
            schoolSeatAllowance: null,
            version: 1,
          },
        ]}
        students={[
          {
            ...scope,
            ...timestamps,
            studentId: 'student-one',
            householdId: 'household-one',
            relationship: 'dependent',
            selfAdultId: null,
            state: 'active',
            credentialId: 'credential-one',
            immutableHistoryReference: 'history-one',
            displayName: 'תלמיד One',
            username: 'student.one',
            credentialVersion: 1,
            credentialState: 'active',
            version: 1,
          },
        ]}
        onNavigate={() => undefined}
        onCreate={() => undefined}
        onEdit={() => undefined}
        onTransition={() => undefined}
        onResetStudentCredential={() => undefined}
        onTransferOwnership={() => undefined}
      />,
    );
    expect(html).toContain('lang="en"');
    expect(html).toContain('Skip to main content');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('dir="auto"');
    expect(html).toContain('Create Admin');
    expect(html).toContain('Create Parent');
    expect(html).toContain('Review ownership transfer');
    expect(html).toContain('Review password reset');
    expect(html).not.toContain('Confirm consequence and continue');
    expect(html).toContain('student.one');
    expect(html).not.toContain('student@example');
  });

  it('announces an empty directory and keeps a clear first action', () => {
    const html = renderToStaticMarkup(
      <AdminDirectoryWorkspace
        url="/admin/directory"
        adults={[]}
        households={[]}
        students={[]}
        state="empty"
        onNavigate={() => undefined}
        onCreate={() => undefined}
        onEdit={() => undefined}
        onTransition={() => undefined}
        onResetStudentCredential={() => undefined}
        onTransferOwnership={() => undefined}
      />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Create first Parent');
  });

  it('uses URL-backed search, sort, filter, archived visibility, and pagination state', () => {
    expect(
      parseDirectoryQuery(
        '/admin/directory?q=Levi&kind=student&status=archived&sort=updated_desc&page=2',
      ),
    ).toEqual({
      search: 'Levi',
      kind: 'student',
      status: 'archived',
      sort: 'updated_desc',
      page: 2,
    });
    expect(
      directoryUrl('/admin/directory?status=active', {
        search: 'Student One',
        status: 'all',
        page: 3,
      }),
    ).toContain('q=Student+One');
    expect(
      directoryUrl('/admin/directory?status=active', {
        search: 'Student One',
        status: 'all',
        page: 3,
      }),
    ).toContain('status=all');
  });

  it('defines explicit consequences before destructive and credential actions', () => {
    expect(
      directoryActionConsequence({
        kind: 'credential_reset',
        id: 'student-one',
        label: 'Student One',
      }),
    ).toMatch(/every active session.*existing password is never displayed/iu);
    expect(
      directoryActionConsequence({
        kind: 'household_transition',
        id: 'household-one',
        label: 'Household One',
        to: 'archived',
      }),
    ).toMatch(/revokes every affected active session and access grant/iu);
    expect(
      directoryActionConsequence({
        kind: 'ownership_transfer',
        id: 'household-one',
        label: 'Household One',
      }),
    ).toMatch(/changes the sole household owner/iu);
  });
});
