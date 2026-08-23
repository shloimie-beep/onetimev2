export function shouldPlayForegroundNotificationSound(input: {
  preferenceEnabled: boolean;
  disposition: 'created' | 'replayed' | 'stale';
  notificationUnread: boolean;
  portalVisibility: 'foreground' | 'background';
  browserInteractionPermitsAudio: boolean;
  visualNoticeRendered: boolean;
}) {
  return (
    input.preferenceEnabled &&
    input.disposition === 'created' &&
    input.notificationUnread &&
    input.portalVisibility === 'foreground' &&
    input.browserInteractionPermitsAudio &&
    input.visualNoticeRendered
  );
}
