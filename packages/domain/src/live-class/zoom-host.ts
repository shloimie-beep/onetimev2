import type { AppConfig } from '../../../config/src/index.ts';
import type { ZoomHostLaunchPort } from './service.ts';
import { createHostZoomSdkSignature, createZoomRestClient } from '../providers/zoom-rest.ts';

export function createZoomHostLaunchPort(config: AppConfig): ZoomHostLaunchPort | undefined {
  const sdkKey = config.zoomMeetingSdkClientId;
  const sdkSecret = config.zoomMeetingSdkClientSecret;
  const accountId = config.zoomAccountId;
  const clientId = config.zoomServerToServerClientId;
  const clientSecret = config.zoomServerToServerClientSecret;
  const hostUserId = config.zoomHostUserId;
  const meetingNumber = config.zoomRealControlMeetingId;
  const password = config.zoomRealControlMeetingPasscode;
  if (
    !sdkKey ||
    !sdkSecret ||
    !accountId ||
    !clientId ||
    !clientSecret ||
    !hostUserId ||
    !meetingNumber ||
    password === undefined
  ) {
    return undefined;
  }

  const rest = createZoomRestClient({
    credentials: { accountId, clientId, clientSecret },
    environment: config.oneTimeRuntimeEnvironment === 'production' ? 'production' : 'staging',
    enabled: true,
  });

  return {
    async resolveHostLaunch({ occurrenceKey, now }) {
      const [signature, zak] = await Promise.all([
        Promise.resolve(
          createHostZoomSdkSignature({
            credentials: { sdkKey, sdkSecret },
            meetingNumber,
            issuedAt: now,
            ttlSeconds: 30 * 60,
          }),
        ),
        rest.getHostZakToken(hostUserId),
      ]);
      return {
        occurrence_key: occurrenceKey,
        sdk_web_version: config.zoomMeetingSdkWebVersion,
        meeting_number: meetingNumber,
        signature,
        password,
        zak,
        user_name: 'One Time Zoom Stage Host',
        leave_url: '/app/live-console',
        video_start_model: 'PARTICIPANT_CONSENT',
      };
    },
  };
}
