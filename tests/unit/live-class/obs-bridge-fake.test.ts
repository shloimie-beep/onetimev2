import { describe, expect, it } from 'vitest';
import {
  ObsBridgeReplayWindow,
  createFakeObsClient,
  executeObsBridgeCommand,
  isTrustedObsWebSocketUrl,
  sceneForBridgeCommand,
  type ObsBridgeCommand,
} from '../../../tools/obs-bridge/src/bridge.ts';

describe('OBS bridge fake adapter', () => {
  it('switches only allowlisted scenes and rejects command replay', async () => {
    const client = createFakeObsClient();
    const replay = new ObsBridgeReplayWindow();
    const command = bridgeCommand('OT - Featured Student');

    await expect(executeObsBridgeCommand(client, replay, command)).resolves.toEqual({
      status: 'executed',
      result: 'scene:OT - Featured Student',
    });
    expect(client.log).toEqual(['OT - Featured Student']);

    await expect(executeObsBridgeCommand(client, replay, command)).resolves.toEqual({
      status: 'rejected',
      result: 'stale_or_replay',
    });
    expect(() => sceneForBridgeCommand({ ...command, obs_scene: 'Other' as never })).toThrow(
      /allowlisted/,
    );
  });

  it('allows localhost and trusted classroom LAN websocket addresses only', () => {
    expect(isTrustedObsWebSocketUrl('ws://127.0.0.1:4455')).toBe(true);
    expect(isTrustedObsWebSocketUrl('ws://192.168.1.10:4455')).toBe(true);
    expect(isTrustedObsWebSocketUrl('wss://obs.example.com')).toBe(false);
  });
});

function bridgeCommand(scene: ObsBridgeCommand['obs_scene']): ObsBridgeCommand {
  return {
    command_key: 'live_command_test',
    command_type: 'obs_switch_scene',
    occurrence_key: 'class_occurrence_test',
    obs_scene: scene,
    nonce: 'live_nonce_test',
    signature: 'signed-test-command',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  };
}
