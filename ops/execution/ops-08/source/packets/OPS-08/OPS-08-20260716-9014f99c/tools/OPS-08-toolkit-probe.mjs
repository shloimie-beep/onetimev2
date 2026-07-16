/** OPS-08 read-only HTTPS and TLS probe module. */
import { readFile } from 'node:fs/promises';
import https from 'node:https';
import tls from 'node:tls';
import {
  TASK_ID,
  PACKET_ID,
  sha256,
  stableJson,
  atomicWrite,
  now,
  assertNoSecrets,
  requireTaskPacket,
} from './OPS-08-toolkit-core.mjs';

function requestOnce(url, options = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const request = https.request(
      url,
      {
        method: options.method ?? 'GET',
        headers: options.headers ?? {},
        timeout: options.timeoutMs ?? 10_000,
        rejectUnauthorized: true,
      },
      (response) => {
        const chunks = [];
        let bytes = 0;
        response.on('data', (chunk) => {
          bytes += chunk.length;
          if (chunks.reduce((sum, item) => sum + item.length, 0) < 256_000) chunks.push(chunk);
        });
        response.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: true,
            status: response.statusCode ?? null,
            headers: {
              location: response.headers.location ?? null,
              cache_control: response.headers['cache-control'] ?? null,
              content_type: response.headers['content-type'] ?? null,
              strict_transport_security: response.headers['strict-transport-security'] ?? null,
              vary: response.headers.vary ?? null,
            },
            body_sha256: sha256(body),
            canonical: body.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1] ?? null,
            og_url: body.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)/i)?.[1] ?? null,
            bytes,
            duration_ms: Date.now() - started,
          });
        });
      },
    );
    request.on('timeout', () => request.destroy(new Error('timeout')));
    request.on('error', (error) =>
      resolve({
        ok: false,
        status: null,
        error: String(error?.message ?? error),
        duration_ms: Date.now() - started,
      }),
    );
    request.end();
  });
}

function tlsProbe(hostname) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: hostname,
        port: 443,
        servername: hostname,
        rejectUnauthorized: true,
        timeout: 10_000,
      },
      () => {
        const cert = socket.getPeerCertificate(true);
        const identityError = tls.checkServerIdentity(hostname, cert);
        resolve({
          state: identityError ? 'invalid' : 'valid',
          san_match: !identityError,
          chain_valid: socket.authorized,
          authorization_error: socket.authorizationError ?? null,
          subject_cn: cert?.subject?.CN ?? null,
          issuer_cn: cert?.issuer?.CN ?? null,
          valid_from: cert?.valid_from ? new Date(cert.valid_from).toISOString() : null,
          not_after: cert?.valid_to ? new Date(cert.valid_to).toISOString() : null,
          fingerprint256: cert?.fingerprint256?.replaceAll(':', '').toLowerCase() ?? null,
          protocol: socket.getProtocol(),
        });
        socket.end();
      },
    );
    socket.on('timeout', () => socket.destroy(new Error('timeout')));
    socket.on('error', (error) =>
      resolve({
        state: 'invalid',
        san_match: false,
        chain_valid: false,
        error: String(error?.message ?? error),
      }),
    );
  });
}

async function probeHost(hostname, routes) {
  const routeResults = [];
  for (const route of routes) {
    if (!['GET', 'HEAD'].includes(route.method)) {
      routeResults.push({
        route_id: route.route_id,
        method: route.method,
        path: route.path,
        result: 'not_run_destructive_or_signed_fixture_required',
      });
      continue;
    }
    const url = new URL(route.path, `https://${hostname}`);
    const result = await requestOnce(url, { method: route.method });
    routeResults.push({
      route_id: route.route_id,
      method: route.method,
      path: route.path,
      expected_status: route.expected_status,
      result,
      status_matches: result.status !== null && route.expected_status.includes(result.status),
      redirect_policy: route.redirect_policy,
      redirect_observed: Boolean(result.headers?.location),
    });
  }

  const unknownHost = await requestOnce(`https://${hostname}/health`, {
    headers: { host: 'ops08.invalid' },
  });

  return {
    hostname,
    captured_at: now(),
    tls: await tlsProbe(hostname),
    routes: routeResults,
    unknown_host_probe: {
      expected_status: 421,
      observed_status: unknownHost.status,
      pass: unknownHost.status === 421,
    },
  };
}

export async function commandProbe(args) {
  if (!args.inventory || !args.out) throw new Error('probe requires --inventory and --out');
  const text = await readFile(args.inventory, 'utf8');
  assertNoSecrets(text, args.inventory);
  const inventory = JSON.parse(text);
  requireTaskPacket(inventory, 'inventory');
  const hostnames = new Set(
    inventory.domains
      .filter((domain) => ['observed', 'partially_observed'].includes(domain.evidence_state))
      .map((domain) => domain.hostname),
  );
  for (const service of inventory.railway_services) {
    if (service.public_domain) hostnames.add(service.public_domain);
    for (const custom of service.custom_domains ?? []) hostnames.add(custom);
  }
  const results = [];
  for (const hostname of hostnames) {
    results.push(await probeHost(hostname, inventory.routes));
  }
  const report = {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    captured_at: now(),
    mode: 'read_only',
    inventory_sha256: sha256(text),
    results,
  };
  await atomicWrite(args.out, stableJson(report));
  process.stdout.write(`${TASK_ID} probe report: ${args.out}\n`);
}

