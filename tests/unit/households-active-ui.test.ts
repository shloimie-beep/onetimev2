import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  HouseholdForm,
  HouseholdList,
  RecordTitle,
} from '../../apps/web/src/client/app/admin-directory/AdminDirectoryPanel.tsx';
import type { AdminHousehold } from '../../apps/web/src/client/app/admin-directory/api.ts';

const household: AdminHousehold = {
  household_key: 'household-one',
  display_name: 'One Time Operator household',
  parent_name: 'Parent One',
  status: 'active',
  version: 1,
  active_learner_count: 1,
  learner_count: 1,
  guardian_count: 1,
  access_state: 'active',
  setup_state: 'active',
  updated_at: '2026-08-13T00:00:00.000Z',
};

describe('active Households directory list', () => {
  it('shows the authoritative active Parent name and uses the household name to open its existing edit detail action', () => {
    const onEdit = vi.fn();
    const list = HouseholdList({
      households: [household],
      onEdit,
      onGuardian: vi.fn(),
      onStatus: vi.fn(),
    });

    const markup = renderToStaticMarkup(list);
    expect(markup).toContain('Parent name');
    expect(markup).toContain('Parent One');
    expect(markup).toContain('One Time Operator household');

    const rows = (list.props as { rows: React.ReactElement[][] }).rows;
    const householdTitle = rows[0]?.[0] as React.ReactElement<
      React.ComponentProps<typeof RecordTitle>
    >;
    const title = RecordTitle(householdTitle.props);
    const strong = (
      title.props.children as React.ReactElement<{
        children: React.ReactElement<{ onClick: () => void }>;
      }>[]
    )[0]!;
    const openButton = strong.props.children;

    expect(openButton.type).toBe('button');
    openButton.props.onClick();
    expect(onEdit).toHaveBeenCalledWith(household);

    const detail = renderToStaticMarkup(
      React.createElement(HouseholdForm, {
        record: household,
        onCancel: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    expect(detail).toContain('Household details');
    expect(detail).toContain('<dt>Parent</dt>');
    expect(detail).toContain('<dd>Parent One</dd>');
  });

  it('uses an honest dash when no active Parent is attached', () => {
    const list = HouseholdList({
      households: [{ ...household, parent_name: null, guardian_count: 0 }],
      onEdit: vi.fn(),
      onGuardian: vi.fn(),
      onStatus: vi.fn(),
    });

    expect(renderToStaticMarkup(list)).toContain('<td>—</td>');

    const detail = renderToStaticMarkup(
      React.createElement(HouseholdForm, {
        record: { ...household, parent_name: null, guardian_count: 0 },
        onCancel: vi.fn(),
        onSave: vi.fn(),
      }),
    );
    expect(detail).toContain('No active Parent attached');
  });
});
