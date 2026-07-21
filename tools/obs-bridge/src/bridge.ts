export const OBS_BRIDGE_ALLOWED_SCENES = [
  'OT - Slides',
  'OT - Featured Student',
  'OT - Break',
] as const;

export type ObsBridgeScene = (typeof OBS_BRIDGE_ALLOWED_SCENES)[number];

export type ObsBridgeCommand = {
  command_key: string;
  command_type: string;
  occurrence_key: string;
  obs_scene: ObsBridgeScene | null;
  nonce: string;
  signature: string;
  expires_at: string;
};

export type ObsBridgeClient = {
  switchScene(scene: ObsBridgeScene): Promise<void>;
};

export class ObsBridgeReplayWindow {
  private readonly seen = new Set<string>();

  accept(
    command: Pick<ObsBridgeCommand, 'command_key' | 'nonce' | 'expires_at'>,
    now = new Date(),
  ) {
    if (new Date(command.expires_at).getTime() <= now.getTime()) return false;
    const replayKey = `${command.command_key}:${command.nonce}`;
    if (this.seen.has(replayKey)) return false;
    this.seen.add(replayKey);
    return true;
  }
}

export function sceneForBridgeCommand(command: ObsBridgeCommand): ObsBridgeScene {
  if (command.command_type !== 'obs_switch_scene') {
    throw new Error('OBS bridge received a non-OBS command.');
  }
  if (!command.obs_scene || !isAllowedObsScene(command.obs_scene)) {
    throw new Error('OBS bridge rejected a non-allowlisted scene.');
  }
  return command.obs_scene;
}

export async function executeObsBridgeCommand(
  client: ObsBridgeClient,
  replay: ObsBridgeReplayWindow,
  command: ObsBridgeCommand,
  now = new Date(),
) {
  if (!replay.accept(command, now))
    return { status: 'rejected' as const, result: 'stale_or_replay' };
  const scene = sceneForBridgeCommand(command);
  await client.switchScene(scene);
  return { status: 'executed' as const, result: `scene:${scene}` };
}

export function createFakeObsClient(log: string[] = []): ObsBridgeClient & { log: string[] } {
  return {
    log,
    async switchScene(scene: ObsBridgeScene) {
      log.push(scene);
    },
  };
}

export function isAllowedObsScene(value: string): value is ObsBridgeScene {
  return OBS_BRIDGE_ALLOWED_SCENES.includes(value as ObsBridgeScene);
}

export function isTrustedObsWebSocketUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') return false;
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1') {
      return true;
    }
    return /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(url.hostname);
  } catch {
    return false;
  }
}
