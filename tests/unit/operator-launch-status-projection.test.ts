import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { operatorLaunchStatusProjectionSchema } from '../../packages/contracts/src/ops/index.ts';
import {
  buildOperatorLaunchStatusProjection,
  renderOperatorLaunchStatusModule,
} from '../../scripts/ops/operator-launch-status-projection.ts';
import { operatorLaunchStatusProjection } from '../../apps/web/src/server/generated/operator-launch-status.ts';

describe('OT-LAUNCH-01 operator launch status projection', () => {
  it('uses only the explicit current Board milestone as its denominator and source of routes', () => {
    const projection = buildOperatorLaunchStatusProjection({
      boardText: boardFixture(),
      acceptanceText: acceptanceFixture(),
    });

    expect(projection.current_milestone).toEqual({
      label: 'Controlled pilot',
      acceptance_complete: 1,
      acceptance_total: 3,
      percentage: 33,
    });
    expect(projection.works_now.map((track) => track.track_id)).toEqual(['ready_track']);
    expect(projection.remaining).toEqual([
      expect.objectContaining({
        track_id: 'active_track',
        status: 'active',
        next_action: 'Run the next bounded task.',
      }),
      expect.objectContaining({
        track_id: 'blocked_track',
        status: 'blocked',
        next_action: 'Wait for the dependency.',
      }),
    ]);
    expect(projection.blockers).toEqual([
      expect.objectContaining({
        track_id: 'blocked_track',
        code: 'EXACT_DEPENDENCY',
        reason: 'One exact external dependency remains.',
      }),
    ]);
    expect(projection.safe_links).toEqual([
      { id: 'dashboard', label: 'Admin Dashboard', href: '/app/dashboard' },
      { id: 'preview', label: 'Role previews', href: '/app/experience-preview' },
    ]);
    expect(projection.next_executable_task).toMatchObject({
      track_id: 'active_track',
      action: 'Run the next bounded task.',
    });
  });

  it('fails closed when the Board does not name exactly one current milestone', () => {
    expect(() =>
      buildOperatorLaunchStatusProjection({
        boardText: boardFixture().replace('  - id: pilot\n    current: true', '  - id: pilot'),
        acceptanceText: acceptanceFixture(),
      }),
    ).toThrow('launch_status_current_milestone_count:0');
  });

  it('ignores incomplete future milestones until activation and fails closed when activated', () => {
    const futureMilestone = `  - id: operational_automation
    current: false
    label: Operational automation
    acceptance_ids: [ACTIVE-001]
`;
    const boardWithFutureMilestone = boardFixture().replace(
      'tracks:\n',
      `${futureMilestone}tracks:\n`,
    );
    expect(
      buildOperatorLaunchStatusProjection({
        boardText: boardWithFutureMilestone,
        acceptanceText: acceptanceFixture(),
      }).current_milestone.label,
    ).toBe('Controlled pilot');

    expect(() =>
      buildOperatorLaunchStatusProjection({
        boardText: boardWithFutureMilestone
          .replace('  - id: pilot\n    current: true', '  - id: pilot\n    current: false')
          .replace(
            '  - id: operational_automation\n    current: false',
            '  - id: operational_automation\n    current: true',
          ),
        acceptanceText: acceptanceFixture(),
      }),
    ).toThrow('launch_status_array_missing:milestones.current.track_ids');
  });

  it('fails closed on private destinations or provider links in displayed Board text', () => {
    expect(() =>
      buildOperatorLaunchStatusProjection({
        boardText: boardFixture().replace(
          'Latest sanitized change.',
          'Contact operator@example.test.',
        ),
        acceptanceText: acceptanceFixture(),
      }),
    ).toThrow('launch_status_private_destination_forbidden');
    expect(() =>
      buildOperatorLaunchStatusProjection({
        boardText: boardFixture().replace(
          'Latest sanitized change.',
          'Open https://provider.example.test/private.',
        ),
        acceptanceText: acceptanceFixture(),
      }),
    ).toThrow('launch_status_external_url_forbidden');
  });

  it('keeps the checked-in projection exact to current canonical Board bytes', async () => {
    const projection = buildOperatorLaunchStatusProjection({
      boardText: await readFile('ops/goals/OT-LAUNCH-01/BOARD.yaml', 'utf8'),
      acceptanceText: await readFile('ops/goals/OT-LAUNCH-01/ACCEPTANCE.yaml', 'utf8'),
    });
    expect(operatorLaunchStatusProjectionSchema.parse(operatorLaunchStatusProjection)).toEqual(
      projection,
    );
    expect(renderOperatorLaunchStatusModule(projection)).toContain(projection.board_source_hash);
  });
});

function boardFixture() {
  return `schema_version: 1
goal_id: OT-LAUNCH-01
updated_at: 2026-07-23T10:32:47Z
outcome:
  target: Controlled pilot
  current_summary: Latest sanitized change.
milestones:
  - id: pilot
    current: true
    label: Controlled pilot
    acceptance_ids: [READY-001, ACTIVE-001, BLOCKED-001]
    track_ids: [ready_track, active_track, blocked_track]
    safe_links:
      - { id: dashboard, label: Admin Dashboard, href: /app/dashboard }
      - { id: preview, label: Role previews, href: /app/experience-preview }
tracks:
  - id: ready_track
    status: done
    acceptance_ids: [READY-001]
    blocker: null
    next_action: null
  - id: active_track
    status: active
    acceptance_ids: [ACTIVE-001]
    blocker: null
    next_action: Run the next bounded task.
  - id: blocked_track
    status: blocked
    acceptance_ids: [BLOCKED-001]
    blocker:
      code: EXACT_DEPENDENCY
      reason: One exact external dependency remains.
    next_action: Wait for the dependency.
`;
}

function acceptanceFixture() {
  return `schema_version: 1
goal_id: OT-LAUNCH-01
criteria:
  - { id: READY-001, track: ready_track }
  - { id: ACTIVE-001, track: active_track }
  - { id: BLOCKED-001, track: blocked_track }
`;
}
