import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EphemeralMeetingSdkBootstrap } from '../../../../../../../packages/contracts/src/classroom/embedded/index.ts';
import { createStudentClassroomViewModel } from './view-model.ts';
import {
  StudentClassroomSurface,
  classroomHeartbeatDelay,
  requestStudentClassroomFullscreen,
  toZoomParticipantJoinInput,
} from './StudentClassroomWorkspace.tsx';

describe('P18 Student classroom workspace', () => {
  it('renders the constant protected workspace with guidance and no identity-bearing link', () => {
    const html = render('ready');
    expect(html).toContain('Protected live classroom');
    expect(html).toContain('Join classroom');
    expect(html).toContain('Please enable your camera');
    expect(html).toContain('account-owner consent');
    expect(html).toContain('id="zmmtg-root"');
    expect(html).not.toMatch(/href=|https?:\/\//iu);
    expect(html).not.toMatch(
      /student[_ -]?id|household|occurrence|registrant|device[_ -]?id|lineage|session[_ -]?id/iu,
    );
  });

  it('shows the recording indicator only during an active joining or connected state', () => {
    expect(render('ready', { recording: true })).not.toContain('Recording in progress');
    expect(render('joining', { recording: true })).toContain('Recording in progress');
    expect(render('connected', { recording: true })).toContain('Recording in progress');
    expect(render('connected', { recording: false })).not.toContain('Recording in progress');
  });

  it('renders denial and unavailable states without an identity or provider oracle', () => {
    const denied = render('denied', { denialCode: 'second_device_active' });
    expect(denied).toContain('same device');
    expect(denied).toContain('Try again');
    expect(denied).not.toContain('Join classroom');
    expect(denied).not.toMatch(/zoom|meeting[_ -]?number|signature|token|device[_ -]?id|lineage/iu);

    const unavailable = render('unavailable');
    expect(unavailable).toContain('temporarily unavailable');
    expect(unavailable).toContain('Try again');
    expect(unavailable).not.toMatch(/provider|credential|https?:\/\//iu);
  });

  it('shows the production-basic Join only when server readiness is true', () => {
    const unavailable = render('ready');
    expect(unavailable).toContain('>Join classroom</button>');
    expect(unavailable).not.toContain('>Join class</button>');

    const available = render('ready', { productionBasicReady: true });
    expect(available).toContain('>Join class</button>');
    expect(available).not.toContain('>Join classroom</button>');
  });

  it('caps heartbeat scheduling at 30 seconds and sends an overdue heartbeat immediately', () => {
    const current = new Date('2026-08-02T10:00:00.000Z');
    expect(classroomHeartbeatDelay('2026-08-02T10:00:30.000Z', current)).toBe(30_000);
    expect(classroomHeartbeatDelay('2026-08-02T10:01:30.000Z', current)).toBe(30_000);
    expect(classroomHeartbeatDelay('2026-08-02T09:59:59.999Z', current)).toBe(0);
  });

  it('maps the in-memory bootstrap directly to the existing Zoom participant client', () => {
    const bootstrap: EphemeralMeetingSdkBootstrap = {
      sdk_session_ref: 'sdk-session-1',
      sdk_web_version: '3.11.2',
      sdk_signature: 'header.payload.signature',
      meeting_number: '12345678901',
      meeting_password: 'meeting-password',
      registrant_token: 'registrant-token',
      participant_email: 'student-opaque@example.invalid',
      customer_key: 'zoom_ck_0123456789abcdef01234567',
      participant_display_name: 'Student',
      recording_capture_active: true,
      leave_path: '/app/student',
      issued_at: '2026-08-02T10:00:00.000Z',
      expires_at: '2026-08-02T10:01:00.000Z',
      role: 0,
    };
    expect(toZoomParticipantJoinInput(bootstrap)).toEqual({
      sdkWebVersion: '3.11.2',
      meetingNumber: '12345678901',
      signature: 'header.payload.signature',
      meetingPassword: 'meeting-password',
      registrantToken: 'registrant-token',
      userEmail: 'student-opaque@example.invalid',
      customerKey: 'zoom_ck_0123456789abcdef01234567',
      userName: 'Student',
      leaveUrl: '/app/student',
    });
  });

  it('keeps classroom identity and bearer material out of browser persistence and URL parsing', async () => {
    const [workspaceSource, apiSource] = await Promise.all([
      readFile('apps/web/src/client/app/student/classroom/StudentClassroomWorkspace.tsx', 'utf8'),
      readFile('apps/web/src/client/app/student/classroom/api.ts', 'utf8'),
    ]);
    const source = `${workspaceSource}\n${apiSource}`;
    expect(source).not.toMatch(/\b(?:localStorage|sessionStorage|URLSearchParams)\b/u);
    expect(source).not.toMatch(/location\.(?:search|hash)/u);
    expect(source).not.toMatch(/console\.(?:log|info|warn|error)/u);
    expect(workspaceSource).toContain("lastJoinMode.current === 'production_basic'");
    expect(workspaceSource).toContain('void joinProductionBasic();');
  });

  it('starts the fullscreen request before either Student join crosses an async boundary', async () => {
    const workspaceSource = await readFile(
      'apps/web/src/client/app/student/classroom/StudentClassroomWorkspace.tsx',
      'utf8',
    );
    const legacyJoin = workspaceSource.slice(
      workspaceSource.indexOf('async function join(): Promise<void>'),
      workspaceSource.indexOf('async function leave(): Promise<void>'),
    );
    const productionJoin = workspaceSource.slice(
      workspaceSource.indexOf('async function joinProductionBasic(): Promise<void>'),
      workspaceSource.indexOf('function retry(): void'),
    );
    expect(legacyJoin.indexOf('requestStudentClassroomFullscreen()')).toBeLessThan(
      legacyJoin.indexOf('await classroomApi.bootstrap'),
    );
    expect(productionJoin.indexOf('requestStudentClassroomFullscreen()')).toBeLessThan(
      productionJoin.indexOf('await requestStudentProductionBasicLaunch'),
    );
  });

  it('fills the dynamic landscape viewport only while browser fullscreen is active', async () => {
    const css = await readFile('apps/web/src/client/app/crm.css', 'utf8');
    expect(css).toContain('@media (orientation: landscape) and (max-width: 1024px)');
    expect(css).toContain('html:fullscreen .student-classroom-sdk');
    expect(css).toContain('height: 100dvh !important');
  });

  it('requests browser-native fullscreen with hidden navigation on a mobile Join gesture', async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    await expect(
      requestStudentClassroomFullscreen(
        { fullscreenElement: null, documentElement: { requestFullscreen } },
        { matchMedia: vi.fn(() => ({ matches: true })) },
      ),
    ).resolves.toBe('active');
    expect(requestFullscreen).toHaveBeenCalledWith({ navigationUI: 'hide' });
  });

  it('keeps class entry available when fullscreen is unsupported or denied', async () => {
    await expect(
      requestStudentClassroomFullscreen(
        { fullscreenElement: null, documentElement: {} },
        { matchMedia: vi.fn(() => ({ matches: true })) },
      ),
    ).resolves.toBe('unavailable');

    const requestFullscreen = vi.fn().mockRejectedValue(new Error('browser denied fullscreen'));
    await expect(
      requestStudentClassroomFullscreen(
        { fullscreenElement: null, documentElement: { requestFullscreen } },
        { matchMedia: vi.fn(() => ({ matches: true })) },
      ),
    ).resolves.toBe('unavailable');
  });

  it('does not force fullscreen on a desktop viewport', async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    await expect(
      requestStudentClassroomFullscreen(
        { fullscreenElement: null, documentElement: { requestFullscreen } },
        { matchMedia: vi.fn(() => ({ matches: false })) },
      ),
    ).resolves.toBe('unavailable');
    expect(requestFullscreen).not.toHaveBeenCalled();
  });
});

function render(
  state: 'ready' | 'joining' | 'connected' | 'denied' | 'unavailable',
  options: {
    denialCode?: 'second_device_active';
    recording?: boolean;
    productionBasicReady?: boolean;
  } = {},
) {
  const view = createStudentClassroomViewModel({
    state,
    denial_code: options.denialCode ?? null,
    recording_capture_active: options.recording ?? false,
    camera_permission: 'unknown',
  });
  return renderToStaticMarkup(
    <StudentClassroomSurface
      view={view}
      busy={false}
      onJoin={vi.fn()}
      productionBasicReady={options.productionBasicReady ?? false}
      onJoinProductionBasic={vi.fn()}
      onRetry={vi.fn()}
      onLeave={vi.fn()}
    />,
  );
}
