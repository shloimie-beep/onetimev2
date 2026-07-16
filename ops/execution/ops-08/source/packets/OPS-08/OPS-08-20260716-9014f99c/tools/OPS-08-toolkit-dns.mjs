/** OPS-08 read-only DNS evidence module. */
import { promises as dns, Resolver } from 'node:dns';
import {
  TASK_ID,
  PACKET_ID,
  sha256,
  stable,
  stableJson,
  atomicWrite,
  now,
} from './OPS-08-toolkit-core.mjs';

const DNS_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'CAA'];

function normalizeTxtRdata(data) {
  const parts = [];
  const quoted = /"((?:\\.|[^"\\])*)"/g;
  let match;
  while ((match = quoted.exec(data)) !== null) {
    try {
      parts.push(JSON.parse(`"${match[1]}"`));
    } catch {
      parts.push(match[1]);
    }
  }
  return parts.length > 0 ? parts.join('') : data;
}

function normalizeDnsRdata(type, rawValue) {
  const data = String(rawValue ?? '').trim();
  if (type === 'TXT') return normalizeTxtRdata(data);
  if (['CNAME', 'NS'].includes(type)) return data.replace(/\.$/, '').toLowerCase();
  if (type === 'MX') {
    const match = data.match(/^(\d+)\s+(.+)$/);
    return match
      ? `${match[1]} ${match[2].replace(/\.$/, '').toLowerCase()}`
      : data.replace(/\.$/, '').toLowerCase();
  }
  if (type === 'CAA') {
    const match = data.match(/^(\d+)\s+([A-Za-z0-9]+)\s+"?([^"\s]+)"?$/);
    return match ? `${match[1]} ${match[2].toLowerCase()} ${match[3]}` : data;
  }
  return data.replace(/\.$/, '');
}

function normalizeDnsAnswer(name, type, ttl, value) {
  return {
    owner: String(name || '').replace(/\.$/, '').toLowerCase(),
    type,
    ttl: Number.isFinite(Number(ttl)) ? Number(ttl) : 0,
    value_sha256: sha256(normalizeDnsRdata(type, value)),
  };
}

function dnsJsonValue(answer) {
  return String(answer.data ?? '').trim();
}

async function queryJsonResolver(resolver, domain, type) {
  const base =
    resolver === 'google'
      ? 'https://dns.google/resolve'
      : 'https://cloudflare-dns.com/dns-query';
  const url = `${base}?name=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`;
  const response = await fetch(url, {
    headers: resolver === 'cloudflare' ? { accept: 'application/dns-json' } : {},
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`${resolver} ${type}: HTTP ${response.status}`);
  const body = await response.json();
  return (body.Answer ?? []).map((answer) =>
    normalizeDnsAnswer(answer.name, type, answer.TTL, dnsJsonValue(answer)),
  );
}

async function querySystem(domain, type) {
  try {
    if (type === 'A') {
      return (await dns.resolve4(domain, { ttl: true })).map((r) =>
        normalizeDnsAnswer(domain, type, r.ttl, r.address),
      );
    }
    if (type === 'AAAA') {
      return (await dns.resolve6(domain, { ttl: true })).map((r) =>
        normalizeDnsAnswer(domain, type, r.ttl, r.address),
      );
    }
    if (type === 'CNAME') {
      return (await dns.resolveCname(domain)).map((r) => normalizeDnsAnswer(domain, type, 0, r));
    }
    if (type === 'MX') {
      return (await dns.resolveMx(domain)).map((r) =>
        normalizeDnsAnswer(domain, type, 0, `${r.priority} ${r.exchange}`),
      );
    }
    if (type === 'TXT') {
      return (await dns.resolveTxt(domain)).map((r) =>
        normalizeDnsAnswer(domain, type, 0, r.join('')),
      );
    }
    if (type === 'NS') {
      return (await dns.resolveNs(domain)).map((r) => normalizeDnsAnswer(domain, type, 0, r));
    }
    if (type === 'CAA') {
      return (await dns.resolveCaa(domain)).map((record) => {
        const tag = ['issue', 'issuewild', 'iodef'].find((key) => record[key] !== undefined);
        return normalizeDnsAnswer(
          domain,
          type,
          0,
          `${record.critical ?? 0} ${tag ?? 'unknown'} ${tag ? record[tag] : ''}`,
        );
      });
    }
    return [];
  } catch (error) {
    if (['ENODATA', 'ENOTFOUND', 'ENOTIMP', 'ESERVFAIL', 'ETIMEOUT'].includes(error?.code)) return [];
    throw error;
  }
}

function compareResolverSets(byResolver) {
  const canonical = Object.fromEntries(
    Object.entries(byResolver).map(([resolver, answers]) => [
      resolver,
      answers
        .map((answer) => `${answer.owner}|${answer.type}|${answer.value_sha256}`)
        .sort(),
    ]),
  );
  const sets = Object.values(canonical).map((values) => JSON.stringify(values));
  return {
    resolver_count: sets.length,
    resolver_agreement: sets.length >= 2 && sets.every((value) => value === sets[0]),
    answer_set_sha256: sha256(JSON.stringify(stable(canonical))),
  };
}

export async function commandDns(args) {
  if (!args.domain || !args.out) throw new Error('dns requires --domain and --out');
  const domain = args.domain.toLowerCase().replace(/\.$/, '');
  const results = [];
  for (const type of DNS_TYPES) {
    const byResolver = {};
    const errors = {};
    for (const resolver of ['google', 'cloudflare']) {
      try {
        byResolver[resolver] = await queryJsonResolver(resolver, domain, type);
      } catch (error) {
        errors[resolver] = String(error?.message ?? error);
        byResolver[resolver] = [];
      }
    }
    try {
      byResolver.system = await querySystem(domain, type);
    } catch (error) {
      errors.system = String(error?.message ?? error);
      byResolver.system = [];
    }
    results.push({
      owner: domain,
      type,
      resolvers: byResolver,
      comparison: compareResolverSets(byResolver),
      errors,
    });
  }
  const report = {
    task_id: TASK_ID,
    packet_id: PACKET_ID,
    captured_at: now(),
    mode: 'read_only_digest_only',
    domain,
    results,
    root_fingerprint_sha256: sha256(
      JSON.stringify(
        stable(
          results.map(({ owner, type, resolvers }) => ({
            owner,
            type,
            values: Object.values(resolvers)
              .flat()
              .map((answer) => answer.value_sha256)
              .sort(),
          })),
        ),
      ),
    ),
    raw_rdata_embedded: false,
  };
  await atomicWrite(args.out, stableJson(report));
  process.stdout.write(`${TASK_ID} dns report: ${args.out}\n`);
}

