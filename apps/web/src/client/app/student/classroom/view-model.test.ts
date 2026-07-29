import { describe, expect, it } from 'vitest';
import { createStudentClassroomViewModel, nextClassroomHeartbeatAt } from './view-model.ts';

describe('Student classroom view model', () => {
  it('shows camera guidance, recording disclosure, persistent capture state, and 30-second heartbeat', () => {
    const view = createStudentClassroomViewModel({
      state: 'connected',
      denial_code: null,
      recording_capture_active: true,
      camera_permission: 'denied',
    });
    expect(view.camera_guidance).toMatch(/browser settings/i);
    expect(view.recording_disclosure).toMatch(/account-owner consent/i);
    expect(view.recording_indicator_visible).toBe(true);
    expect(view.next_heartbeat_in_ms).toBe(30_000);
    expect(nextClassroomHeartbeatAt(new Date('2026-07-28T17:00:00.000Z'))).toBe(
      '2026-07-28T17:00:30.000Z',
    );
  });

  it('gives a clear second-device denial without exposing device identity', () => {
    const view = createStudentClassroomViewModel({
      state: 'denied',
      denial_code: 'second_device_active',
      recording_capture_active: false,
      camera_permission: 'unknown',
    });
    expect(view.status_message).toMatch(/same device|Admin/i);
    expect(view.status_message).not.toMatch(/device[_ -]id|lineage|session[_ -]id/i);
    expect(view.join_enabled).toBe(false);
  });
});
