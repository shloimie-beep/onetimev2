import { createSign, generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const port = '3112';
const tlsDirectory = mkdtempSync(path.join(tmpdir(), 'onetime-parent-credentials-tls-'));
const tls = generateLoopbackCertificate(tlsDirectory);
process.env.P12_PARENT_CREDENTIALS_HTTPS = 'true';

export default defineConfig({
  testDir: '../..',
  testMatch: /tests[\\/]e2e[\\/]parent-student-credentials[.]spec[.]ts/u,
  timeout: 45_000,
  fullyParallel: false,
  use: {
    baseURL: `https://127.0.0.1:${port}`,
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: 'node --import tsx tests/support/test-server.ts',
    cwd: '../..',
    url: `https://127.0.0.1:${port}/health`,
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    timeout: 30_000,
    env: {
      NODE_ENV: 'test',
      OT_TEST_DATABASE: 'memory',
      RUN_MIGRATIONS_ON_STARTUP: 'true',
      PORT: port,
      PUBLIC_BASE_URL: `https://127.0.0.1:${port}`,
      LOGIN_IDENTIFIER_RATE_LIMIT_MAX: '50',
      LOGIN_IP_RATE_LIMIT_MAX: '100',
      ZOOM_CLASSROOM_ENABLED: 'true',
      ZOOM_CLASSROOM_PROVIDER_MODE: 'sink',
      PORTAL_TEST_LAB_ENABLED: 'true',
      OT_TEST_CLOCK: '2026-07-16T16:05:00.000Z',
      ONE_TIME_FIRST_CLASS_AT: '2026-08-16T19:00:00+03:00',
      ONE_TIME_FREE_ACCESS_EXPIRES_AT: '2026-09-11T18:00:00+03:00',
      ...tls,
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

function generateLoopbackCertificate(directory: string) {
  const keyPath = path.join(directory, 'loopback-key.pem');
  const certificatePath = path.join(directory, 'loopback-cert.pem');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const algorithm = sequence(oid('1.2.840.113549.1.1.11'), der(0x05));
  const name = sequence(set(sequence(oid('2.5.4.3'), utf8('127.0.0.1'))));
  const now = new Date();
  const validity = sequence(
    utcTime(new Date(now.getTime() - 60_000)),
    utcTime(new Date(now.getTime() + 86_400_000)),
  );
  const subjectAlternativeName = sequence(
    oid('2.5.29.17'),
    octetString(
      sequence(
        contextPrimitive(7, Buffer.from([127, 0, 0, 1])),
        contextPrimitive(2, Buffer.from('localhost')),
      ),
    ),
  );
  const certificateBody = sequence(
    explicit(0, integer(2)),
    integer(1),
    algorithm,
    name,
    validity,
    name,
    publicKey.export({ format: 'der', type: 'spki' }),
    explicit(3, sequence(subjectAlternativeName)),
  );
  const signer = createSign('SHA256');
  signer.update(certificateBody);
  signer.end();
  const certificate = sequence(certificateBody, algorithm, bitString(signer.sign(privateKey)));
  writeFileSync(keyPath, privateKey.export({ format: 'pem', type: 'pkcs8' }));
  writeFileSync(certificatePath, pem('CERTIFICATE', certificate));
  return {
    OT_TEST_TLS_KEY_PATH: keyPath,
    OT_TEST_TLS_CERT_PATH: certificatePath,
  };
}

function der(tag: number, ...parts: Buffer[]) {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([tag]), derLength(body.length), body]);
}

function derLength(length: number) {
  if (length < 128) return Buffer.from([length]);
  const bytes: number[] = [];
  for (let value = length; value > 0; value >>= 8) bytes.unshift(value & 0xff);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function sequence(...parts: Buffer[]) {
  return der(0x30, ...parts);
}

function set(...parts: Buffer[]) {
  return der(0x31, ...parts);
}

function integer(value: number) {
  return der(0x02, Buffer.from([value]));
}

function oid(value: string) {
  const values = value.split('.').map(Number);
  const bytes = [values[0]! * 40 + values[1]!];
  for (const part of values.slice(2)) {
    const encoded = [part & 0x7f];
    for (let remainder = part >> 7; remainder > 0; remainder >>= 7) {
      encoded.unshift(0x80 | (remainder & 0x7f));
    }
    bytes.push(...encoded);
  }
  return der(0x06, Buffer.from(bytes));
}

function utf8(value: string) {
  return der(0x0c, Buffer.from(value));
}

function utcTime(value: Date) {
  const text = value
    .toISOString()
    .replace(/^\d{2}(\d{2}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})[.]\d{3}Z$/u, '$1$2Z')
    .replace(/[-:]/gu, '');
  return der(0x17, Buffer.from(text));
}

function octetString(value: Buffer) {
  return der(0x04, value);
}

function bitString(value: Buffer) {
  return der(0x03, Buffer.from([0]), value);
}

function explicit(tag: number, value: Buffer) {
  return der(0xa0 + tag, value);
}

function contextPrimitive(tag: number, value: Buffer) {
  return der(0x80 + tag, value);
}

function pem(label: string, value: Buffer) {
  const encoded =
    value
      .toString('base64')
      .match(/.{1,64}/gu)
      ?.join('\n') ?? '';
  return `-----BEGIN ${label}-----\n${encoded}\n-----END ${label}-----\n`;
}
