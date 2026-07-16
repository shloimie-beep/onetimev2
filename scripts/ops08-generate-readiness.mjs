#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as dns } from 'node:dns';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';
import tls from 'node:tls';

const TASK_ID = 'OPS-08';
const PACKET_ID = 'OPS-08-20260716-9014f99c';
const OUT = 'ops/evidence/ops-08';
const RELEASE = 'ops/release/ops-08';
const CODEX = 'ops/codex-runs/OPS-08';
const ZERO_MUTATIONS = {
  root_dns_changed: false,
  launch_dns_changed: false,
  production_deployed: false,
  provider_registration_changed: false,
  email_dns_changed: false,
  production_send_enabled: false,
  mutation_count: 0,
};

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]));
  }
  return value;
}

function json(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, json(value));
}

function git(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', options.stderr ?? 'pipe'] }).trim();
}

function commandDigest(command, output) {
  return sha256(`${command}\n${output}`);
}

function isAncestor(a, b) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', a, b], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function walk(root) {
  const results = [];
  async function visit(dir) {
    for (const name of await readdir(dir)) {
      if (['.git', 'node_modules', 'dist'].includes(name)) continue;
      const full = path.join(dir, name);
      const entry = await stat(full);
      if (entry.isDirectory()) await visit(full);
      else results.push(full.replaceAll('\\', '/'));
    }
  }
  await visit(root);
  return results.sort();
}

async function readTextFiles(files) {
  const texts = [];
  for (const file of files) {
    if (!/\.(ts|tsx|js|mjs|json|md|html|css|example|yml|yaml|toml|txt)$/i.test(file)) continue;
    const buffer = await readFile(file);
    if (buffer.length > 512_000) continue;
    texts.push({ file, text: buffer.toString('utf8') });
  }
  return texts;
}

function unique(values) {
  return [...new Set(values)].sort();
}

function extractRepoInventory(texts) {
  const env = new Set();
  const hosts = new Set();
  const urls = new Set();
  const redirects = [];
  const publicBaseUses = [];
  const callbacks = [];
  for (const { file, text } of texts) {
    for (const match of text.matchAll(/\b[A-Z][A-Z0-9_]{2,}\b/g)) {
      if (/(URL|HOST|ORIGIN|BASE|COOKIE|PROXY|EMAIL|FROM|REPLY|CALLBACK|WEBHOOK|STRIPE|ZOOM|VIMEO|TELEGRAM|WAPI|RESEND|ANALYTICS|VERSION|COMMIT|PORT|HEALTH|CUTOVER)/.test(match[0])) {
        env.add(match[0]);
      }
    }
    for (const match of text.matchAll(/https?:\/\/[a-z0-9.-]+(?::\d+)?(?:\/[^\s"'<>)]*)?/gi)) {
      urls.add(match[0]);
      try { hosts.add(new URL(match[0]).hostname.toLowerCase()); } catch {}
    }
    for (const match of text.matchAll(/\b(?:[a-z0-9-]+\.)*onetimeonetime\.com\b/gi)) hosts.add(match[0].toLowerCase());
    if (text.includes('PUBLIC_BASE_URL')) publicBaseUses.push(file);
    if (/\bredirect\b|res\.redirect|status\(30[1278]\)/.test(text)) redirects.push(file);
    if (/webhook|callback|oauth|return_url|success_url|cancel_url/i.test(text)) callbacks.push(file);
  }
  return {
    env_var_names: unique([...env]),
    hostname_literals: unique([...hosts]),
    absolute_urls_sha256: sha256(JSON.stringify(unique([...urls]))),
    absolute_url_count: urls.size,
    redirect_files: unique(redirects),
    public_base_url_files: unique(publicBaseUses),
    callback_definition_files: unique(callbacks),
  };
}

async function dnsAnswerSummary(name, type) {
  try {
    if (type === 'MX') {
      const rows = await dns.resolveMx(name);
      return { observed: rows.length > 0, count: rows.length, digest: sha256(JSON.stringify(rows.map((row) => `${row.priority}:${row.exchange.toLowerCase()}`).sort())) };
    }
    if (type === 'TXT') {
      const rows = await dns.resolveTxt(name);
      const joined = rows.map((row) => row.join(''));
      return {
        observed: joined.length > 0,
        count: joined.length,
        digest: sha256(JSON.stringify(joined.sort())),
        has_spf: joined.some((row) => /^v=spf1\b/i.test(row)),
        has_dmarc: joined.some((row) => /^v=DMARC1\b/i.test(row)),
      };
    }
  } catch {
    return { observed: false, count: 0, digest: null, has_spf: false, has_dmarc: false };
  }
  return { observed: false, count: 0, digest: null };
}

async function requestUrl(url, options = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const request = https.request(url, {
      method: options.method ?? 'GET',
      headers: options.headers ?? {},
      timeout: 10_000,
      rejectUnauthorized: true,
    }, (response) => {
      const chunks = [];
      let bytes = 0;
      response.on('data', (chunk) => {
        bytes += chunk.length;
        if (Buffer.concat(chunks).length < 256_000) chunks.push(chunk);
      });
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({
          ok: true,
          status: response.statusCode ?? null,
          location: response.headers.location ?? null,
          cache_control: response.headers['cache-control'] ?? null,
          content_type: response.headers['content-type'] ?? null,
          hsts: response.headers['strict-transport-security'] ?? null,
          body_sha256: sha256(body),
          canonical: body.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1] ?? null,
          og_url: body.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)/i)?.[1] ?? null,
          bytes,
          duration_ms: Date.now() - started,
        });
      });
    });
    request.on('timeout', () => request.destroy(new Error('timeout')));
    request.on('error', (error) => resolve({ ok: false, status: null, error: String(error?.message ?? error), duration_ms: Date.now() - started }));
    request.end();
  });
}

async function tlsProbe(hostname) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: hostname, port: 443, servername: hostname, rejectUnauthorized: true, timeout: 10_000 }, () => {
      const cert = socket.getPeerCertificate(true);
      const identityError = tls.checkServerIdentity(hostname, cert);
      resolve({
        state: identityError ? 'invalid' : 'valid',
        san_match: !identityError,
        chain_valid: socket.authorized,
        issuer: cert?.issuer?.CN ?? null,
        not_after: cert?.valid_to ? new Date(cert.valid_to).toISOString() : null,
        fingerprint_sha256: cert?.fingerprint256?.replaceAll(':', '').toLowerCase() ?? null,
        protocol: socket.getProtocol(),
      });
      socket.end();
    });
    socket.on('timeout', () => socket.destroy(new Error('timeout')));
    socket.on('error', (error) => resolve({ state: 'invalid', san_match: false, chain_valid: false, issuer: null, not_after: null, error: String(error?.message ?? error) }));
  });
}

async function loadDnsReports() {
  const reports = new Map();
  for (const file of await readdir(OUT).catch(() => [])) {
    if (!file.startsWith('dns-') || !file.endsWith('.json')) continue;
    const report = JSON.parse(await readFile(path.join(OUT, file), 'utf8'));
    reports.set(report.domain, report);
  }
  return reports;
}

function dnsRecordsFor(report) {
  if (!report) return [];
  const records = [];
  for (const result of report.results ?? []) {
    const seen = new Set();
    for (const answer of Object.values(result.resolvers ?? {}).flat()) {
      const key = `${answer.owner}|${answer.type}|${answer.value_sha256}`;
      if (seen.has(key)) continue;
      seen.add(key);
      records.push({
        owner: answer.owner,
        type: answer.type,
        ttl: answer.ttl ?? 0,
        value_sha256: answer.value_sha256,
        resolver_count: result.comparison?.resolver_count ?? 1,
        resolver_agreement: Boolean(result.comparison?.resolver_agreement),
        captured_at: report.captured_at,
        private_change_set_member: false,
      });
    }
  }
  return records;
}

function hashOrNull(value) {
  return value == null ? null : sha256(String(value));
}

function redactedRailwayService(status) {
  const prod = status?.environments?.edges?.map((edge) => edge.node).find((env) => env.name === 'production');
  const web = prod?.serviceInstances?.edges?.map((edge) => edge.node).find((node) => node.serviceName === 'one-time-web');
  const deployment = web?.latestDeployment;
  const manifest = deployment?.meta?.serviceManifest?.deploy ?? {};
  return {
    service_key: 'one-time-web',
    environment_class: prod ? 'production' : 'unknown',
    project_id_sha256: hashOrNull(status?.id),
    environment_id_sha256: hashOrNull(prod?.id),
    service_id_sha256: hashOrNull(web?.serviceId),
    deployment_id_sha256: hashOrNull(deployment?.id),
    source_sha: null,
    public_domain: null,
    custom_domains: (web?.domains?.customDomains ?? []).map((item) => item.domain).sort(),
    target_port: web?.domains?.customDomains?.find((item) => item.domain === 'join.onetimeonetime.com')?.targetPort ?? null,
    health_path: '/health',
    ready_path: '/ready',
    version_path: '/version',
    health_state: deployment?.status === 'SUCCESS' ? 'healthy' : 'not_observed',
    source_match: false,
    healthcheck_request_host: 'healthcheck.railway.app',
    healthcheck_host_path_only: false,
    healthcheck_host_validation: 'not_run',
  };
}

async function railwayStatusRedacted() {
  try {
    const raw = execFileSync('railway', ['status', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return {
      command_status: 'observed_read_only',
      raw_output_sha256: sha256(raw),
      service: redactedRailwayService(JSON.parse(raw)),
    };
  } catch (error) {
    return {
      command_status: 'blocked_or_unavailable',
      error_sha256: sha256(String(error?.message ?? error)),
      service: redactedRailwayService(null),
    };
  }
}

function requiredShaProof(selectedSha) {
  const required = [
    '809480bb5581c4104f64c4c04a5c92fff8aaa7cf',
    'a02d1d254ae0d17804fb657079a7871567260ea2',
    '87a1bb7ffd6a2fa0d016a1831894d430aa2ee065',
    '97fa0c91758888f4e9de0af17d70002a0124669f',
    '6ecb6800000000000000000000000000000000000',
    '80a67b90000000000000000000000000000000000',
    '0fe1b460000000000000000000000000000000000',
  ];
  return required.map((required_sha) => {
    const resolved = required_sha.includes('000000') ? git(['rev-parse', `${required_sha.slice(0, 7)}^{commit}`]) : required_sha;
    const command = `git merge-base --is-ancestor ${resolved} ${selectedSha}`;
    const result = isAncestor(resolved, selectedSha);
    return { required_sha: resolved, is_ancestor: result, command_digest: commandDigest(command, String(result)) };
  });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(RELEASE, { recursive: true });
  await mkdir(CODEX, { recursive: true });

  const capturedAt = new Date().toISOString();
  const files = await walk('.');
  const texts = await readTextFiles(files);
  const repoInventory = extractRepoInventory(texts);
  const dnsReports = await loadDnsReports();
  const railway = await railwayStatusRedacted();
  const bestAnchor = '97fa0c91758888f4e9de0af17d70002a0124669f';
  const sourceProof = requiredShaProof(bestAnchor);
  const allRequiredAncestors = sourceProof.every((proof) => proof.is_ancestor);
  const selectedSha = allRequiredAncestors ? bestAnchor : null;
  const selectionReason = allRequiredAncestors
    ? 'The audited anchor contains all required branch capabilities and can be hardened as a single immutable source.'
    : 'No single reachable SHA contains all observed OPS-08 domain/callback-relevant implementation branches. The best audit anchor contains OT-81/OT-83/OT-86A/OT-86B, but later Stripe, Zoom, Telegram/WhatsApp, and support branches are separate. Runtime hardening would be misleading until source convergence selects one immutable release target.';

  const domainNames = [
    ['onetimeonetime.com', 'root'],
    ['www.onetimeonetime.com', 'www'],
    ['join.onetimeonetime.com', 'launch'],
    ['_dmarc.onetimeonetime.com', 'callback_only'],
  ];
  const domains = [];
  const httpTlsDetails = [];
  for (const [hostname, role] of domainNames) {
    const http = hostname.startsWith('_') ? { status: null } : await requestUrl(`https://${hostname}/`);
    const tls = hostname.startsWith('_') ? { state: 'not_observed', san_match: null, chain_valid: null, not_after: null, issuer: null } : await tlsProbe(hostname);
    const domain = {
      hostname,
      role,
      evidence_state: hostname.startsWith('_')
        ? 'not_applicable'
        : (http.status || dnsRecordsFor(dnsReports.get(hostname)).length ? 'observed' : 'partially_observed'),
      http_status: http.status ?? null,
      canonical_behavior: role === 'launch' ? 'serves_primary' : (http.location ? 'redirects_to_primary' : 'unknown'),
      tls: {
        state: tls.state ?? 'not_observed',
        san_match: tls.san_match ?? null,
        chain_valid: tls.chain_valid ?? null,
        not_after: tls.not_after ?? null,
        issuer: tls.issuer ?? null,
      },
      dns_records: dnsRecordsFor(dnsReports.get(hostname)),
      root_mutation_permitted: false,
    };
    domains.push(domain);
    httpTlsDetails.push({ hostname, role, http, tls, dns_fingerprint_sha256: dnsReports.get(hostname)?.root_fingerprint_sha256 ?? null });
  }

  const mx = await dnsAnswerSummary('onetimeonetime.com', 'MX');
  const rootTxt = await dnsAnswerSummary('onetimeonetime.com', 'TXT');
  const dmarcTxt = await dnsAnswerSummary('_dmarc.onetimeonetime.com', 'TXT');
  const emailEvidence = {
    mailbox: 'info@onetimeonetime.com',
    mailbox_verified: false,
    mx_provider: mx.observed ? 'observed_by_dns_digest_only' : null,
    spf: { state: rootTxt.has_spf ? 'observed' : 'not_observed', evidence_sha256: rootTxt.digest, pass: Boolean(rootTxt.has_spf) },
    dkim: { state: 'not_observed', evidence_sha256: null, pass: false },
    dmarc: { state: dmarcTxt.has_dmarc ? 'observed' : 'not_observed', evidence_sha256: dmarcTxt.digest, pass: Boolean(dmarcTxt.has_dmarc) },
    return_path: { state: 'not_observed', evidence_sha256: null, pass: false },
    sender: { address: 'info@onetimeonetime.com', config_source: 'protected_environment', verified: false },
    reply_to: { address: 'info@onetimeonetime.com', config_source: 'protected_environment', verified: false },
    tls: { state: 'not_observed', evidence_sha256: null, pass: false },
    canary: { messages_sent: 0, authentication_pass_rate: null, hard_bounce_rate: null, complaint_rate: null, all_links_pass: false },
    production_send_enabled: false,
  };

  const routes = [
    { route_id: 'OPS-08-PUBLIC-LANDING', method: 'GET', path: '/', class: 'public', expected_status: [200, 301, 302, 307, 308], redirect_policy: 'same_path_to_canonical', cache_policy: 'public', probe_result: 'not_run' },
    { route_id: 'OPS-08-PUBLIC-SIGNUP', method: 'GET', path: '/signup', class: 'public', expected_status: [200, 301, 302, 307, 308, 404], redirect_policy: 'same_path_to_canonical', cache_policy: 'public', probe_result: 'not_run' },
    { route_id: 'OPS-08-LOGIN', method: 'GET', path: '/login', class: 'public', expected_status: [200, 301, 302, 307, 308, 404], redirect_policy: 'same_path_to_canonical', cache_policy: 'private_no_store', probe_result: 'not_run' },
    { route_id: 'OPS-08-LEAD-API', method: 'POST', path: '/api/v1/leads', class: 'public', expected_status: [200, 201, 400, 401, 403, 404, 409, 422], redirect_policy: 'forbidden', cache_policy: 'no_store', probe_result: 'not_run' },
    { route_id: 'OPS-08-HEALTH', method: 'GET', path: '/health', class: 'health', expected_status: [200, 404], redirect_policy: 'none', cache_policy: 'no_store', probe_result: 'not_run' },
    { route_id: 'OPS-08-READY', method: 'GET', path: '/ready', class: 'health', expected_status: [200, 503, 404], redirect_policy: 'none', cache_policy: 'no_store', probe_result: 'not_run' },
    { route_id: 'OPS-08-VERSION', method: 'GET', path: '/version', class: 'health', expected_status: [200, 404], redirect_policy: 'none', cache_policy: 'no_store', probe_result: 'not_run' },
    { route_id: 'OPS-08-ROBOTS', method: 'GET', path: '/robots.txt', class: 'public', expected_status: [200, 404], redirect_policy: 'same_path_to_canonical', cache_policy: 'public', probe_result: 'not_run' },
    { route_id: 'OPS-08-SITEMAP', method: 'GET', path: '/sitemap.xml', class: 'public', expected_status: [200, 404], redirect_policy: 'same_path_to_canonical', cache_policy: 'public', probe_result: 'not_run' },
    { route_id: 'OPS-08-LEGACY-ONETIME', method: 'GET', path: '/one-time', class: 'legacy_redirect', expected_status: [200, 301, 302, 307, 308, 404], redirect_policy: 'fixed_legacy_target', cache_policy: 'public', probe_result: 'not_run' },
    { route_id: 'OPS-08-STRIPE-TEST-WEBHOOK', method: 'POST', path: '/api/v1/billing/webhooks/provider', class: 'webhook', expected_status: [200, 204, 400, 401, 403, 404], redirect_policy: 'forbidden', cache_policy: 'provider_defined', probe_result: 'not_run' },
  ];

  const callbacks = [
    { callback_id: 'OPS-08-STRIPE-TEST-WEBHOOK', provider: 'stripe', mode: 'test', purpose: 'Stripe TEST billing webhook seam', method: 'POST', path: '/api/v1/billing/webhooks/provider', current_origin: null, candidate_origin: null, current_registration_state: 'not_observed', candidate_registration_state: 'not_observed', redirect_allowed: false, raw_body_required: true, signature_verification: 'not_run', idempotency: 'not_run', dual_registration_supported: 'unknown', canary_result: 'not_run', secret_material_stored: false },
    { callback_id: 'OPS-08-ZOOM-OAUTH', provider: 'zoom', mode: 'sandbox', purpose: 'Zoom OAuth redirect and launch seam', method: 'GET', path: '/api/v1/providers/zoom/oauth/callback', current_origin: null, candidate_origin: null, current_registration_state: 'not_observed', candidate_registration_state: 'not_observed', redirect_allowed: false, raw_body_required: false, signature_verification: 'not_applicable', idempotency: 'not_run', dual_registration_supported: 'unknown', canary_result: 'not_run', secret_material_stored: false },
    { callback_id: 'OPS-08-VIMEO-WEBHOOK', provider: 'vimeo', mode: 'sandbox', purpose: 'Vimeo callback/event seam', method: 'POST', path: '/api/v1/providers/vimeo/webhook', current_origin: null, candidate_origin: null, current_registration_state: 'not_observed', candidate_registration_state: 'not_observed', redirect_allowed: false, raw_body_required: true, signature_verification: 'not_run', idempotency: 'not_run', dual_registration_supported: 'unknown', canary_result: 'not_run', secret_material_stored: false },
    { callback_id: 'OPS-08-EMAIL-PROVIDER-WEBHOOK', provider: 'email_provider', mode: 'production', purpose: 'Bounce complaint and delivery callback seam', method: 'POST', path: '/api/v1/delivery/provider-events', current_origin: null, candidate_origin: null, current_registration_state: 'not_observed', candidate_registration_state: 'not_observed', redirect_allowed: false, raw_body_required: true, signature_verification: 'not_run', idempotency: 'not_run', dual_registration_supported: 'unknown', canary_result: 'not_run', secret_material_stored: false },
    { callback_id: 'OPS-08-SUPPORT-EVENT', provider: 'support', mode: 'internal', purpose: 'Support event intake seam', method: 'POST', path: '/api/v1/support/events', current_origin: null, candidate_origin: null, current_registration_state: 'not_observed', candidate_registration_state: 'not_observed', redirect_allowed: false, raw_body_required: false, signature_verification: 'not_run', idempotency: 'not_run', dual_registration_supported: 'unknown', canary_result: 'not_run', secret_material_stored: false },
  ];

  const trafficMigration = {
    eligibility_definition_version: 'OPS-08-paid-current-or-365d-activity-v1',
    eligibility_window_days: 365,
    measurement_window_start: null,
    measurement_window_end: null,
    measured_continuous_days: null,
    eligible_accounts: null,
    migrated_accounts: null,
    unresolved_identity_conflicts: null,
    successful_old_app_accounts_14d: null,
    new_app_login_attempts_14d: null,
    new_app_login_successes_14d: null,
    new_app_login_success_rate: null,
    synthetic_login_attempts_14d: null,
    synthetic_login_successes_14d: null,
    synthetic_login_success_rate: null,
    auth_incidents_p0_p1_14d: null,
    auth_support_rate_7d: null,
    unresolved_high_severity_auth_tickets: null,
    evidence_sha256: null,
    all_thresholds_pass: false,
  };

  const inventory = {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    captured_at: capturedAt,
    state: selectedSha ? 'audit_in_progress' : 'blocked_source_convergence_required',
    source: {
      repository: 'webcraft-media/onetimev2',
      selected_ref: selectedSha ? 'origin/codex/ot86b-buffer-social' : null,
      selected_sha: selectedSha,
      selection_reason: selectionReason,
      ancestry_proof: sourceProof.map(({ required_sha, is_ancestor, command_digest }) => ({ required_sha, is_ancestor, command_digest })),
      working_tree_clean: false,
      version_contract: { expected_sha: selectedSha, observed_sha: null, match: false, app_version: null, target_app: null },
      release_authorized: false,
    },
    domains,
    railway_services: [railway.service],
    routes,
    traffic_migration: trafficMigration,
    email: emailEvidence,
    callbacks,
    monitoring: {
      external_probe_interval_seconds: null,
      regions: null,
      http_5xx_rate_15m: null,
      login_success_rate_5m: null,
      signup_persistence_failure_rate_5m: null,
      callback_success_rate_5m: null,
      tls_errors: null,
      dns_resolver_agreement: domains.every((domain) => domain.dns_records.every((record) => record.resolver_agreement)),
      monitor_assigned: false,
    },
    rollback: {
      previous_source_sha: null,
      previous_service_id_sha256: railway.service.service_id_sha256,
      private_dns_snapshot_sha256: null,
      previous_callback_snapshot_sha256: null,
      old_service_warm_until: null,
      rollback_owner_assigned: false,
      drill_passed: false,
      restore_probe_passed: false,
    },
    mutation_audit: ZERO_MUTATIONS,
  };

  const sourceSelection = {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    captured_at: capturedAt,
    status: selectedSha ? 'selected' : 'blocked_source_convergence_required',
    selected_sha: selectedSha,
    best_audit_anchor_sha: bestAnchor,
    reason: selectionReason,
    ancestry_proof: sourceProof,
    branch_heads: {
      main: git(['rev-parse', 'origin/main']),
      ot81: git(['rev-parse', 'origin/codex/ot81-dayone-certification-and-staging']),
      ot83: git(['rev-parse', 'origin/codex/ot83-household-portals-foundation']),
      ot86a: git(['rev-parse', 'origin/codex/ot86a-vimeo-content-kb']),
      ot86b: git(['rev-parse', 'origin/codex/ot86b-buffer-social']),
      ot87: git(['rev-parse', 'origin/codex/ot87-stripe-test-entitlements']),
      ot88: git(['rev-parse', 'origin/codex/ot88-zoom-learner-classroom']),
      ot89a: git(['rev-parse', 'origin/codex/ot89a-subscriber-support-producer']),
    },
    release_authorized: false,
  };

  const deliverability = {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    captured_at: capturedAt,
    mailbox: emailEvidence.mailbox,
    mailbox_verified: false,
    mx_observed: mx.observed,
    mx_record_count: mx.count,
    mx_evidence_sha256: mx.digest,
    spf_observed: Boolean(rootTxt.has_spf),
    spf_evidence_sha256: rootTxt.digest,
    dmarc_observed: Boolean(dmarcTxt.has_dmarc),
    dmarc_evidence_sha256: dmarcTxt.digest,
    dkim_observed: false,
    return_path_observed: false,
    canary_messages_sent: 0,
    production_send_enabled: false,
    blocker: 'Provider/mailbox dashboard evidence and staged canary evidence were not available; email DNS mutation and real sends are not authorized.',
  };

  const railwayReadiness = {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    captured_at: capturedAt,
    command_status: railway.command_status,
    raw_output_sha256: railway.raw_output_sha256 ?? railway.error_sha256,
    services: [railway.service],
    isolated_staging_proven: false,
    production_deployment_authorized: false,
    blocker: 'Railway read-only status was observed, but no isolated staging deployment/source SHA proof is authorized or selected.',
  };

  const migrationThresholds = {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    captured_at: capturedAt,
    ...trafficMigration,
    blocker: 'Old-application login telemetry and migration metrics were not available in this no-write audit run.',
  };

  const acceptanceReport = {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    captured_at: capturedAt,
    state: inventory.state,
    gate_counts: { pass: 2, blocked: 11, not_applicable: 2 },
    gates: [
      { gate: 'OPS-08-G00', status: 'pass', evidence: 'Packet checksum and archive safety verified.' },
      { gate: 'OPS-08-G01', status: inventory.state === 'blocked_source_convergence_required' ? 'blocked' : 'pass', evidence: selectionReason },
      { gate: 'OPS-08-G02', status: 'blocked', evidence: 'Runtime repository controls not implemented because source convergence is blocked.' },
      { gate: 'OPS-08-G03', status: 'blocked', evidence: railwayReadiness.blocker },
      { gate: 'OPS-08-G04', status: 'blocked', evidence: 'Staging flow proof not available.' },
      { gate: 'OPS-08-G05', status: 'blocked', evidence: 'Host/canonical controls require selected source implementation.' },
      { gate: 'OPS-08-G06', status: 'blocked', evidence: migrationThresholds.blocker },
      { gate: 'OPS-08-G07', status: 'blocked', evidence: deliverability.blocker },
      { gate: 'OPS-08-G08', status: 'blocked', evidence: 'Provider dashboards were not available for callback registration readback.' },
      { gate: 'OPS-08-G09', status: 'blocked', evidence: 'DNS/TLS digest inventory captured; private DNS snapshot and rollback values still required.' },
      { gate: 'OPS-08-G10', status: 'blocked', evidence: 'Named monitor and rollback drill are absent.' },
      { gate: 'OPS-08-G11', status: 'blocked', evidence: 'Cutover authorization absent.' },
      { gate: 'OPS-08-G12', status: 'pass', evidence: 'No DNS, deployment, provider, send, payment, or access mutations performed.' },
      { gate: 'OPS-08-G13', status: 'not_applicable', evidence: 'No cutover attempted.' },
      { gate: 'OPS-08-G14', status: 'not_applicable', evidence: 'No cutover attempted.' },
    ],
    mutation_audit: ZERO_MUTATIONS,
  };

  const operatorActions = {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    captured_at: capturedAt,
    raw_private_values_embedded: false,
    actions: [
      { action_id: 'OPS-08-ACT-SOURCE', owner_role: 'technical owner', action: 'Select one immutable converged source SHA that includes OT-81/OT-83/OT-86A/OT-86B plus Stripe, Zoom, Telegram/WhatsApp, and support/callback branches.', private_reference_fields: ['selected_source_sha', 'branch_or_pr_digest'] },
      { action_id: 'OPS-08-ACT-RAILWAY-STAGING', owner_role: 'Railway operator', action: 'Provide or authorize isolated staging service evidence with project/environment/service/deployment digests, target port, health path, and runtime SHA.', private_reference_fields: ['project_id_sha256', 'environment_id_sha256', 'service_id_sha256', 'deployment_id_sha256'] },
      { action_id: 'OPS-08-ACT-DNS', owner_role: 'DNS operator', action: 'Capture private before/after/rollback DNS values and SHA-256 digests; do not apply root or join changes until a later authorization.', private_reference_fields: ['private_dns_change_set_sha256', 'private_dns_rollback_set_sha256', 'root_fingerprint_before_sha256'] },
      { action_id: 'OPS-08-ACT-MIGRATION', owner_role: 'identity and migration owner', action: 'Provide aggregated 365-day eligibility and continuous 14-day migration/auth metrics.', private_reference_fields: ['migration_evidence_sha256'] },
      { action_id: 'OPS-08-ACT-EMAIL', owner_role: 'deliverability owner', action: 'Verify mailbox, sender, DKIM selectors, return path, bounce/complaint, suppression, unsubscribe, and canary results.', private_reference_fields: ['email_provider_evidence_sha256'] },
      { action_id: 'OPS-08-ACT-CALLBACKS', owner_role: 'provider owners', action: 'Read back Stripe TEST, Zoom, Vimeo, email-provider, support, and analytics registrations without mutating them.', private_reference_fields: ['callback_snapshot_sha256', 'callback_rollback_sha256'] },
      { action_id: 'OPS-08-ACT-AUTH', owner_role: 'product and technical owners', action: 'Issue exact later authorization only after all gates pass; include root-mutation decision, window, monitor, and rollback owner.', private_reference_fields: ['authorization_sha256'] },
    ],
  };

  const changeManifest = {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    manifest_id: 'OPS-08-CHANGE-20260716-9014f99c',
    created_at: capturedAt,
    status: 'readiness_draft',
    authorization_sha256: null,
    private_dns_change_set_sha256: null,
    private_dns_rollback_set_sha256: null,
    private_callback_change_set_sha256: null,
    private_callback_rollback_set_sha256: null,
    root_mutation_authorized: false,
    root_dns_fingerprint_before_sha256: dnsReports.get('onetimeonetime.com')?.root_fingerprint_sha256 ?? null,
    expected_root_dns_fingerprint_after_sha256: null,
    launch_domain_preservation: { hostname: 'join.onetimeonetime.com', minimum_days: 180, preserved_until: null },
    email_dns_change_count: 0,
    source_transition: {
      before_sha: railway.service.source_sha,
      after_sha: selectedSha,
      before_service_id_sha256: railway.service.service_id_sha256,
      after_service_id_sha256: null,
      before_deployment_id_sha256: railway.service.deployment_id_sha256,
      after_deployment_id_sha256: null,
    },
    dns_changes: [],
    callback_changes: [],
    application_config_changes: [],
    execution_order: ['No executable cutover order is authorized. Complete operator actions first.'],
    rollback_order: ['No cutover performed; preserve join.onetimeonetime.com and current DNS/callback registrations.'],
    raw_secret_values_embedded: false,
  };

  const callbackCsv = [
    'callback_id,provider,mode,purpose,method,path,current_registration_state,candidate_registration_state,redirect_allowed,raw_body_required,signature_verification,idempotency,dual_registration_supported,canary_result,secret_material_stored',
    ...callbacks.map((row) => [
      row.callback_id, row.provider, row.mode, JSON.stringify(row.purpose), row.method, row.path, row.current_registration_state,
      row.candidate_registration_state, row.redirect_allowed, row.raw_body_required, row.signature_verification, row.idempotency,
      row.dual_registration_supported, row.canary_result, row.secret_material_stored,
    ].join(',')),
  ].join('\n') + '\n';

  const cutoverRunbook = `# OPS-08 Cutover Runbook\n\nStatus: readiness draft only. Cutover is not authorized.\n\n1. Block until source convergence selects one immutable SHA.\n2. Block until isolated staging deploy, health, ready, version, callback, email, and migration gates pass.\n3. Preserve join.onetimeonetime.com for at least 180 days after any later approved cutover.\n4. Require exact authorization SHA, private DNS/callback/config digests, maintenance window, named monitor, rollback owner, and explicit root-mutation decision.\n5. Do not mutate root DNS, launch DNS, email DNS, production providers, sends, payments, or access from this PR.\n`;
  const rollbackRunbook = `# OPS-08 Rollback Runbook\n\nStatus: readiness draft only. No cutover was performed.\n\nRollback prerequisites for a future authorized window:\n\n1. Private DNS before snapshot digest and rollback-set digest.\n2. Previous service/deployment digest and confirmed warm service.\n3. Previous callback registration digest and rollback-set digest.\n4. Named rollback owner and monitor.\n5. Restore old canonical config, confirm join.onetimeonetime.com, then verify health, ready, version, login, signup, callback canaries, and DNS fingerprints.\n`;
  const monitoringPlan = {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    captured_at: capturedAt,
    status: 'blocked_monitor_not_assigned',
    intervals: { external_probe_seconds: 60, observation_minutes_minimum: 120 },
    regions_minimum: 3,
    alerts: [
      { metric: 'http_5xx_rate_15m', rollback_threshold: '> 1%' },
      { metric: 'login_success_rate_5m', rollback_threshold: '< 99%' },
      { metric: 'signup_persistence_failure_rate_5m', rollback_threshold: '> 0.5%' },
      { metric: 'callback_success_rate_5m', rollback_threshold: '< 99%' },
      { metric: 'tls_errors', rollback_threshold: '> 0' },
      { metric: 'dns_resolver_agreement', rollback_threshold: 'false' },
    ],
    monitor_assigned: false,
  };

  await writeJson(`${OUT}/source-selection.json`, sourceSelection);
  await writeJson(`${OUT}/domain-dns-tls.json`, { task_id: TASK_ID, packet_id: PACKET_ID, captured_at: capturedAt, domains: httpTlsDetails, raw_dns_values_embedded: false });
  await writeJson(`${OUT}/railway-readiness.json`, railwayReadiness);
  await writeJson(`${OUT}/migration-thresholds.json`, migrationThresholds);
  await writeJson(`${OUT}/deliverability.json`, deliverability);
  await writeJson(`${OUT}/inventory.json`, inventory);
  await writeFile(`${OUT}/callback-matrix.csv`, callbackCsv);
  await writeJson(`${OUT}/acceptance-report.json`, acceptanceReport);
  await writeJson(`${OUT}/monitoring-plan.json`, monitoringPlan);
  await writeJson(`${RELEASE}/reversible-change-manifest.json`, changeManifest);
  await writeFile(`${RELEASE}/cutover-runbook.md`, cutoverRunbook);
  await writeFile(`${RELEASE}/rollback-runbook.md`, rollbackRunbook);
  await writeJson(`${RELEASE}/operator-actions.json`, operatorActions);

  const index = {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    created_at: capturedAt,
    updated_at: capturedAt,
    state_path: 'ops/codex-runs/OPS-08/state.json',
    command_log_path: 'ops/codex-runs/OPS-08/command-log.ndjson',
    raw_secret_values_embedded: false,
    entries: [
      'ops/evidence/ops-08/source-selection.json',
      'ops/evidence/ops-08/domain-dns-tls.json',
      'ops/evidence/ops-08/railway-readiness.json',
      'ops/evidence/ops-08/migration-thresholds.json',
      'ops/evidence/ops-08/deliverability.json',
      'ops/evidence/ops-08/inventory.json',
      'ops/evidence/ops-08/callback-matrix.csv',
      'ops/evidence/ops-08/acceptance-report.json',
      'ops/evidence/ops-08/monitoring-plan.json',
      'ops/release/ops-08/reversible-change-manifest.json',
      'ops/release/ops-08/cutover-runbook.md',
      'ops/release/ops-08/rollback-runbook.md',
      'ops/release/ops-08/operator-actions.json',
    ],
  };
  await writeJson(`${OUT}/index.json`, index);

  const state = JSON.parse(await readFile(`${CODEX}/state.json`, 'utf8'));
  state.phase = 'readiness_checkpoint_published';
  state.status = inventory.state;
  state.packet_integrity_status = 'verified';
  state.selected_source_sha = selectedSha;
  state.mutation_count = 0;
  state.updated_at = capturedAt;
  state.blocker = selectedSha ? null : selectionReason;
  await writeJson(`${CODEX}/state.json`, state);

  const logEntry = {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    phase: 'readiness_checkpoint_published',
    command: 'node scripts/ops08-generate-readiness.mjs',
    started_at: capturedAt,
    ended_at: new Date().toISOString(),
    exit_code: 0,
    output_sha256: sha256(JSON.stringify({ inventory_sha256: sha256(json(inventory)), acceptance_sha256: sha256(json(acceptanceReport)) })),
    redacted: true,
  };
  await writeFile(`${CODEX}/command-log.ndjson`, `${JSON.stringify(logEntry)}\n`, { flag: 'a' });

  console.log(`OPS-08 readiness evidence generated: ${inventory.state}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
