import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { OperatorLaunchStatusProjection } from '../../packages/contracts/src/ops/index.ts';
import { LaunchStatusContent } from '../../apps/web/src/client/app/launch-status/LaunchStatus.tsx';

describe('OT-LAUNCH-01 Launch Status UI', () => {
  it('renders the milestone ratio, exact blocker, safe routes, and one next task', () => {
    const html = renderToStaticMarkup(
      React.createElement(LaunchStatusContent, { projection: projection() }),
    );

    expect(html).toContain('Launch Status');
    expect(html).toContain('2 of 4 assigned acceptance checks are complete.');
    expect(html).toContain('value="2"');
    expect(html).toContain('max="4"');
    expect(html).toContain('One exact dependency remains.');
    expect(html).toContain('Remaining and in progress');
    expect(html).toContain('Open the bounded staging task.');
    expect(html).toContain('href="/app/dashboard"');
    expect(html).toContain('Launch readiness');
    expect(html).not.toMatch(/controlled[ -]?(?:launch|live)?[ -]?pilot/iu);
    expect(html).not.toMatch(/https?:\/\/|operator@example|password|provider_secret/iu);
  });
});

function projection(): OperatorLaunchStatusProjection {
  return {
    schema_version: 'ot.operator-launch-status.v1',
    goal_id: 'OT-LAUNCH-01',
    generated_from_board: 'ops/goals/OT-LAUNCH-01/BOARD.yaml',
    board_source_hash: `sha256:${'a'.repeat(64)}`,
    generated_at: '2026-07-23T10:32:47.000Z',
    current_milestone: {
      label: 'Controlled pilot',
      acceptance_complete: 2,
      acceptance_total: 4,
      percentage: 50,
    },
    what_changed: 'The secure role preview is ready.',
    works_now: [
      {
        track_id: 'ready_track',
        label: 'Ready track',
        status: 'done',
        acceptance_ids: ['READY-001'],
      },
    ],
    remaining: [
      {
        track_id: 'active_track',
        label: 'Active track',
        status: 'active',
        next_action: 'Open the bounded staging task.',
      },
    ],
    blockers: [
      {
        track_id: 'blocked_track',
        label: 'Blocked track',
        status: 'blocked',
        code: 'EXACT_DEPENDENCY',
        reason: 'One exact dependency remains.',
      },
    ],
    safe_links: [{ id: 'dashboard', label: 'Admin Dashboard', href: '/app/dashboard' }],
    next_executable_task: {
      track_id: 'active_track',
      label: 'Active track',
      action: 'Open the bounded staging task.',
    },
  };
}
