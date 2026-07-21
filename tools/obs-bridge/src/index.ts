import { createHash, randomUUID } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  ObsBridgeReplayWindow,
  createFakeObsClient,
  executeObsBridgeCommand,
  isTrustedObsWebSocketUrl,
  type ObsBridgeClient,
  type ObsBridgeCommand,
  type ObsBridgeScene,
} from './bridge.ts';

const fake = process.argv.includes('--fake');
const baseUrl = requiredEnv('ONETIME_BASE_URL');
const bridgeToken = requiredEnv('ONETIME_OBS_BRIDGE_TOKEN');
const occurrenceKey = requiredEnv('LIVE_CLASS_OCCURRENCE_KEY');
const replay = new ObsBridgeReplayWindow();
const client = fake ? createFakeObsClient() : createObsWebSocketClient();

await mkdir(path.resolve('tools/obs-bridge/logs'), { recursive: true });

for (;;) {
  await pollOnce(client).catch((error) => logLine(`poll_error ${redact(String(error))}`));
  await delay(1500);
}

async function pollOnce(obsClient: ObsBridgeClient) {
  const response = await fetch(
    `${baseUrl}/api/v1/live-class/obs/commands?occurrence_key=${encodeURIComponent(
      occurrenceKey,
    )}`,
    { headers: { 'x-ot-live-bridge-token': bridgeToken } },
  );
  if (!response.ok) {
    throw new Error(`command_poll_failed:${response.status}`);
  }
  const json = (await response.json()) as { data?: { commands?: ObsBridgeCommand[] } };
  for (const command of json.data?.commands ?? []) {
    const result = await executeObsBridgeCommand(obsClient, replay, command).catch((error) => ({
      status: 'failed' as const,
      result: redact(String(error)),
    }));
    await report(command, result.status, result.result);
    await logLine(`${command.command_key} ${result.status} ${redact(result.result)}`);
  }
}

async function report(command: ObsBridgeCommand, status: 'executed' | 'failed' | 'rejected', result: string) {
  await fetch(`${baseUrl}/api/v1/live-class/obs/commands`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-ot-live-bridge-token': bridgeToken,
    },
    body: JSON.stringify({
      command_key: command.command_key,
      nonce: command.nonce,
      signature: command.signature,
      status,
      result,
    }),
  });
}

function createObsWebSocketClient(): ObsBridgeClient {
  const obsUrl = requiredEnv('OBS_WEBSOCKET_URL');
  if (!isTrustedObsWebSocketUrl(obsUrl)) {
    throw new Error('OBS WebSocket URL must be localhost or trusted classroom LAN.');
  }
  return {
    async switchScene(scene: ObsBridgeScene) {
      const password = process.env.OBS_WEBSOCKET_PASSWORD ?? '';
      await obsSetCurrentProgramScene(obsUrl, password, scene);
    },
  };
}

async function obsSetCurrentProgramScene(url: string, password: string, scene: ObsBridgeScene) {
  const WebSocketCtor = globalThis.WebSocket;
  if (!WebSocketCtor) throw new Error('Node WebSocket runtime is unavailable.');
  const socket = new WebSocketCtor(url);
  const requestId = randomUUID();
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('OBS WebSocket timeout.')), 5000);
    socket.addEventListener('message', (event) => {
      const packet = JSON.parse(String(event.data)) as { op?: number; d?: Record<string, unknown> };
      if (packet.op === 0) {
        const auth = authentication(packet.d?.authentication, password);
        socket.send(JSON.stringify({ op: 1, d: { rpcVersion: 1, ...(auth ? { authentication: auth } : {}) } }));
      }
      if (packet.op === 2) {
        socket.send(
          JSON.stringify({
            op: 6,
            d: {
              requestType: 'SetCurrentProgramScene',
              requestId,
              requestData: { sceneName: scene },
            },
          }),
        );
      }
      if (packet.op === 7 && packet.d?.requestId === requestId) {
        clearTimeout(timeout);
        socket.close();
        resolve();
      }
    });
    socket.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error('OBS WebSocket connection failed.'));
    });
  });
}

function authentication(value: unknown, password: string) {
  if (!value || typeof value !== 'object') return null;
  const auth = value as { salt?: string; challenge?: string };
  if (!auth.salt || !auth.challenge) return null;
  const secret = createHash('sha256')
    .update(`${password}${auth.salt}`)
    .digest('base64');
  return createHash('sha256')
    .update(`${secret}${auth.challenge}`)
    .digest('base64');
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function redact(value: string) {
  return value.replace(/[A-Za-z0-9+/=_-]{24,}/g, '[redacted]');
}

async function logLine(line: string) {
  await appendFile(
    path.resolve('tools/obs-bridge/logs/bridge.log'),
    `${new Date().toISOString()} ${line}\n`,
    'utf8',
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
