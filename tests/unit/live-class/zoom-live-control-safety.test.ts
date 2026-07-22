import { describe, expect, it } from 'vitest';
import {
  liveClassZoomParticipantSyncPayloadSchema,
  liveClassZoomTestParticipantBootstrapResponseSchema,
} from '../../../packages/contracts/src/live-class/index.ts';
import {
  sdkErrorSummary,
  zoomProviderOffSummary,
  zoomSpotlightOptions,
} from '../../../apps/web/src/client/app/zoom-sdk-safety.ts';

describe('Zoom live-control client safety', () => {
  it('uses the current Meeting SDK spotlight operation payload', () => {
    expect(zoomSpotlightOptions(17, 'spotlight_replace')).toEqual({
      userId: 17,
      operate: 'replace',
    });
    expect(zoomSpotlightOptions(17, 'spotlight_remove')).toEqual({
      userId: 17,
      operate: 'remove',
    });
    expect(zoomSpotlightOptions(17, 'spotlight_replace')).not.toHaveProperty('action');
  });

  it('reports the exact provider-off readiness layer without exposing values', () => {
    const summary = zoomProviderOffSummary({
      ready: false,
      provider_gate_blockers: [],
      phases: {
        sdk_app: { ready: true },
        s2s_meeting_provisioning: { ready: false },
        host_authorization: { ready: false },
        real_control_canary_authorization: { ready: false },
      },
    });

    expect(summary).toBe(
      'Provider off: protected S2S meeting provisioning is not ready. Controlled fake execution remains active.',
    );
    expect(summary).not.toMatch(/client|secret|passcode|meeting\s+\d/i);
  });

  it('renders only allowlisted SDK code and category values', () => {
    const sensitive = 'private-token-value meeting 987654321 https://private.example.test';
    expect(sdkErrorSummary({ errorCode: 1, reason: sensitive, message: sensitive })).toBe(
      'code 1 / category provider_rejected',
    );
    expect(sdkErrorSummary({ error_code: '1<script>', reason: sensitive })).toBe(
      'code unknown / category unknown',
    );
    expect(sdkErrorSummary({ errorCode: 9999, reason: sensitive })).toBe(
      'code unknown / category unknown',
    );
    expect(sdkErrorSummary({ errorCode: 1, reason: sensitive })).not.toContain('private');
  });

  it('rejects provider-facing customer keys over the Zoom Web SDK limit', () => {
    const customerKey = `zoom_ck_${'a'.repeat(24)}`;
    expect(customerKey.length).toBeLessThanOrEqual(36);
    expect(() =>
      liveClassZoomTestParticipantBootstrapResponseSchema.parse({
        success: true,
        data: {
          occurrence_key: 'occurrence_test',
          sdk_web_version: '6.2.0',
          meeting_number: '123456789',
          signature: 'signature_test_value',
          password: '',
          customer_key: `${customerKey}extra`,
          user_name: 'Student 1',
          leave_url: '/app/live-console',
          video_start_model: 'PARTICIPANT_CONSENT',
        },
      }),
    ).toThrow();
    expect(() =>
      liveClassZoomParticipantSyncPayloadSchema.parse({
        occurrence_key: 'occurrence_test',
        participants: [
          {
            customer_key: `${customerKey}extra`,
            provider_user_id: '17',
            join_state: 'joined',
            audio_state: 'muted',
            video_state: 'off',
            active_speaker: false,
            spotlighted: false,
          },
        ],
      }),
    ).toThrow();
  });
});
