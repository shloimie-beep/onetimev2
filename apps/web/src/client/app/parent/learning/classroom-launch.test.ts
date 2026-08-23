import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import type { ParentLearningActionDescriptor, ParentProductionBasicLaunchArtifact } from './api.ts';
import {
  createParentClassroomLaunchController,
  type ParentClassroomSdkJoinInput,
} from './classroom-launch.ts';

const action: ParentLearningActionDescriptor = {
  action_key: 'class-launch-1',
  label: 'Join class',
  kind: 'class_launch',
  method: 'POST',
  href: '/api/v1/portals/parent/classroom/production-basic/launch',
  launch_token_ref: null,
  expires_at: '2026-08-16T16:35:00.000Z',
};

const artifact: ParentProductionBasicLaunchArtifact = {
  mode: 'production_basic',
  role: 0,
  sdk_web_version: '3.11.2',
  meeting_number: '12345678901',
  meeting_password: 'private-meeting-password',
  signature: 'private-sdk-signature',
  user_name: 'Ari Levi',
  leave_path: '/app/parent',
  issued_at: '2026-08-16T15:55:00.000Z',
  expires_at: '2026-08-16T16:35:00.000Z',
  raw_join_url_present: false,
  video_start_model: 'PARTICIPANT_CONSENT',
};

describe('Parent production-basic classroom launch controller', () => {
  it('uses the ephemeral artifact directly in the SDK with one explicit provider request', async () => {
    const requestArtifact = vi.fn().mockResolvedValue(artifact);
    let onMeetingStatus: ParentClassroomSdkJoinInput['onMeetingStatus'];
    const joinMeeting = vi.fn(async (input: ParentClassroomSdkJoinInput) => {
      onMeetingStatus = input.onMeetingStatus;
      input.onMeetingStatus?.(2);
    });
    const recordAttendance = vi.fn().mockResolvedValue(undefined);
    const statuses: string[] = [];
    const controller = createParentClassroomLaunchController({
      requestArtifact,
      joinMeeting,
      recordAttendance,
      connectionLineageId: () => 'parent-connection-1',
      now: () => new Date('2026-08-16T16:00:00.000Z'),
      onStatus: (status) => statuses.push(status),
    });

    await expect(controller.launch(action, 'csrf-parent', 'occurrence-1')).resolves.toBe(
      'connected',
    );
    onMeetingStatus?.(2);
    onMeetingStatus?.(3);
    onMeetingStatus?.(3);
    await controller.flushAttendance();
    expect(requestArtifact).toHaveBeenCalledOnce();
    expect(requestArtifact).toHaveBeenCalledWith(action, 'csrf-parent');
    expect(joinMeeting).toHaveBeenCalledOnce();
    expect(joinMeeting).toHaveBeenCalledWith({
      sdkWebVersion: '3.11.2',
      meetingNumber: '12345678901',
      meetingPassword: 'private-meeting-password',
      signature: 'private-sdk-signature',
      userName: 'Ari Levi',
      leaveUrl: '/app/parent',
      onMeetingStatus: expect.any(Function),
    });
    expect(recordAttendance.mock.calls).toEqual([
      [
        {
          occurrence_id: 'occurrence-1',
          event_kind: 'joined',
          connection_lineage_id: 'parent-connection-1',
        },
        'csrf-parent',
      ],
      [
        {
          occurrence_id: 'occurrence-1',
          event_kind: 'left',
          connection_lineage_id: 'parent-connection-1',
        },
        'csrf-parent',
      ],
    ]);
    expect(statuses).toEqual(['requesting', 'joining', 'connected']);
    expect(JSON.stringify(controller)).not.toMatch(
      /private-meeting-password|private-sdk-signature/u,
    );
  });

  it('quarantines a lost or failed response as an unknown effect without a second POST', async () => {
    const requestArtifact = vi.fn().mockRejectedValue(new Error('response lost'));
    const joinMeeting = vi.fn();
    const controller = createParentClassroomLaunchController({
      requestArtifact,
      joinMeeting,
      recordAttendance: vi.fn(),
      now: () => new Date('2026-08-16T16:00:00.000Z'),
    });

    const first = controller.launch(action, 'csrf-parent', 'occurrence-1');
    const guardedConcurrentClick = controller.launch(action, 'csrf-parent', 'occurrence-1');
    await expect(first).resolves.toBe('unknown_effect');
    await expect(guardedConcurrentClick).resolves.toBe('requesting');
    await expect(controller.launch(action, 'csrf-parent', 'occurrence-1')).resolves.toBe(
      'unknown_effect',
    );
    expect(requestArtifact).toHaveBeenCalledOnce();
    expect(joinMeeting).not.toHaveBeenCalled();
  });

  it('retries only the in-memory SDK connection and never requests a second artifact', async () => {
    const requestArtifact = vi.fn().mockResolvedValue(artifact);
    const joinMeeting = vi
      .fn()
      .mockRejectedValueOnce(new Error('SDK interrupted'))
      .mockResolvedValueOnce(undefined);
    const controller = createParentClassroomLaunchController({
      requestArtifact,
      joinMeeting,
      recordAttendance: vi.fn(),
      connectionLineageId: () => 'parent-connection-1',
      now: () => new Date('2026-08-16T16:00:00.000Z'),
    });

    await expect(controller.launch(action, 'csrf-parent', 'occurrence-1')).resolves.toBe(
      'connection_error',
    );
    await expect(controller.retryConnection()).resolves.toBe('connected');
    expect(requestArtifact).toHaveBeenCalledOnce();
    expect(joinMeeting).toHaveBeenCalledTimes(2);
    expect(joinMeeting.mock.calls[1]).toEqual(joinMeeting.mock.calls[0]);
  });

  it('does not reuse an expired artifact or persist bearer material in browser state', async () => {
    let now = new Date('2026-08-16T16:00:00.000Z');
    const requestArtifact = vi.fn().mockResolvedValue(artifact);
    const joinMeeting = vi.fn().mockRejectedValue(new Error('SDK interrupted'));
    const controller = createParentClassroomLaunchController({
      requestArtifact,
      joinMeeting,
      recordAttendance: vi.fn(),
      connectionLineageId: () => 'parent-connection-1',
      now: () => now,
    });

    await expect(controller.launch(action, 'csrf-parent', 'occurrence-1')).resolves.toBe(
      'connection_error',
    );
    now = new Date('2026-08-16T16:35:00.000Z');
    await expect(controller.retryConnection()).resolves.toBe('unknown_effect');
    expect(requestArtifact).toHaveBeenCalledOnce();
    expect(joinMeeting).toHaveBeenCalledOnce();

    const source = await readFile(
      'apps/web/src/client/app/parent/learning/classroom-launch.ts',
      'utf8',
    );
    expect(source).not.toMatch(/localStorage|sessionStorage|URLSearchParams/u);
    expect(source).not.toMatch(/location\.(?:assign|replace|href|search|hash)/u);
    expect(source).not.toMatch(/console\.(?:log|info|warn|error)/u);
  });
});
