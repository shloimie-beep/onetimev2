import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OPS05_ALLOWED_LABELS,
  OPS05_METRIC_CATALOG,
  applyRuntimeReadbackHeaders,
  buildRuntimeReadback,
  routeFamilyForPath,
  sanitizeTelemetryFields,
  statusClass,
  telemetrySafetyFindings,
} from '../../../packages/observability/src/index.ts';

const root = process.cwd();
const ops05Root = 'ops/observability/ops05';

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(path.resolve(root, filePath), 'utf8')) as T;
}

function readText(filePath: string): string {
  return readFileSync(path.resolve(root, filePath), 'utf8');
}

describe('OPS-05 observability contract', () => {
  it('keeps metric labels low-cardinality and aligned with the JSON contract', () => {
    const allowed = new Set<string>(OPS05_ALLOWED_LABELS);
    const jsonContract = readJson<{ metrics: Array<{ name: string; labels: string[] }> }>(
      `${ops05Root}/telemetry-privacy-contract.json`,
    );
    const jsonMetricNames = new Set(jsonContract.metrics.map((metric) => metric.name));
    for (const metric of OPS05_METRIC_CATALOG) {
      expect(jsonMetricNames.has(metric.name), `${metric.name} exists in JSON contract`).toBe(true);
      expect(metric.labels.length).toBeGreaterThan(0);
      for (const label of metric.labels) {
        expect(allowed.has(label), `${metric.name}.${label} is approved`).toBe(true);
        expect(label).not.toMatch(
          /email|phone|name|url|token|secret|cookie|message|child|student/i,
        );
      }
    }
  });

  it('classifies route families and status classes without high-cardinality paths', () => {
    expect(routeFamilyForPath('/')).toBe('public_signup');
    expect(routeFamilyForPath('/signup?utm_source=test')).toBe('public_signup');
    expect(routeFamilyForPath('/api/v1/auth/login')).toBe('auth');
    expect(routeFamilyForPath('/app/crm/contacts/abc123')).toBe('crm');
    expect(routeFamilyForPath('/app/parent')).toBe('parent_portal');
    expect(routeFamilyForPath('/app/student')).toBe('student_portal');
    expect(routeFamilyForPath('/internal/social-publishing/v1/events')).toBe('social_publishing');
    expect(routeFamilyForPath('/healthz')).toBe('health');
    expect(routeFamilyForPath('/readyz')).toBe('readiness');
    expect(statusClass(200)).toBe('2xx');
    expect(statusClass(503)).toBe('5xx');
  });

  it('builds exact source SHA and mode readback without exposing config values', () => {
    const readback = buildRuntimeReadback({
      serviceKey: 'onetime-web',
      appVersion: '1.2.3',
      commitSha: 'ABC1234',
      nodeEnv: 'production',
      providerMode: 'sink',
      bnaSupportMode: 'async_only',
      now: new Date('2026-07-16T05:00:00.000Z'),
    });
    expect(readback).toMatchObject({
      service_key: 'onetime-web',
      target_app: 'one-time',
      app_version: '1.2.3',
      source_sha: 'abc1234',
      release_id: 'abc1234',
      config_mode: 'production',
      provider_mode: 'sink',
      bna_support_mode: 'async_only',
    });

    const headers: Record<string, string | number | readonly string[]> = {};
    applyRuntimeReadbackHeaders(
      { setHeader: (key, value) => void (headers[key] = value) },
      readback,
    );
    expect(headers['x-onetime-source-sha']).toBe('abc1234');
    expect(headers['x-onetime-config-mode']).toBe('production');

    expect(
      buildRuntimeReadback({
        serviceKey: 'web service',
        appVersion: 'local dev',
        commitSha: 'not a sha',
        nodeEnv: 'test',
      }).source_sha,
    ).toBe('unknown');
  });

  it('sanitizes telemetry fields and reports unsafe raw inputs', () => {
    const unsafe = {
      event_name: 'delivery_completed',
      raw_email: 'person@example.test',
      raw_phone: '+1 202 555 0123',
      raw_message_body: 'private child note',
      provider_token: 'secret',
      trace_id: 'trace-1',
      route: '/app/crm/contacts/123',
      error_code: 'token=abc1234567890 https://example.invalid/full/path',
      duration_ms: 42,
    };
    const sanitized = sanitizeTelemetryFields(unsafe);
    expect(sanitized).toEqual({
      event_name: 'delivery_completed',
      trace_id: 'trace-1',
      error_code: 'token=[redacted] [url]',
      duration_ms: 42,
    });
    expect(telemetrySafetyFindings(unsafe)).toContain('forbidden_key:raw_email');
    expect(telemetrySafetyFindings(unsafe)).toContain('sensitive_value:error_code');
    expect(JSON.stringify(sanitized)).not.toContain('person@example.test');
    expect(JSON.stringify(sanitized)).not.toContain('202 555');
    expect(JSON.stringify(sanitized)).not.toContain('example.invalid');
  });

  it('keeps OPS-05 dashboards, alerts, and synthetic checks privacy-safe', () => {
    const alerts = readJson<{ alerts: Array<{ id: string; runbook: string }> }>(
      `${ops05Root}/slo-alert-matrix.json`,
    );
    const synthetic = readJson<{ checks: Array<{ id: string; external_write_allowed: boolean }> }>(
      `${ops05Root}/synthetic-checks.json`,
    );
    expect(alerts.alerts.length).toBeGreaterThanOrEqual(10);
    expect(alerts.alerts.every((alert) => alert.id.startsWith('OPS05-'))).toBe(true);
    expect(alerts.alerts.every((alert) => alert.runbook.includes('operator-runbooks.md'))).toBe(
      true,
    );
    expect(synthetic.checks.length).toBeGreaterThanOrEqual(10);
    expect(synthetic.checks.every((check) => check.external_write_allowed === false)).toBe(true);

    const searchableText = [
      readText(`${ops05Root}/telemetry-privacy-contract.json`),
      readText(`${ops05Root}/slo-alert-matrix.json`),
      readText(`${ops05Root}/dashboards/operator-health.dashboard.json`),
      readText(`${ops05Root}/synthetic-checks.json`),
      readText(`${ops05Root}/runbooks/operator-runbooks.md`),
      readText(`${ops05Root}/configuration-checkpoint.md`),
    ].join('\n');
    expect(searchableText).not.toMatch(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(searchableText).not.toMatch(/https?:\/\/\S+/i);
    expect(searchableText).not.toMatch(/\bsk_(live|test)_/i);
    expect(searchableText).not.toMatch(/\bBearer\s+[a-z0-9._=-]{12,}/i);
    expect(searchableText).not.toMatch(/TODO|TBD|PLACEHOLDER/i);
  });
});
