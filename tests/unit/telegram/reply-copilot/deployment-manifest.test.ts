import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('OT-LIVE-003 deployment descriptor', () => {
  it('keeps the distinct service descriptor-only and every effect flag default-off', () => {
    const descriptor = json<{
      http_contract: { polling: boolean };
      [key: string]: unknown;
    }>('ops/release/ot-live-003/deployment-descriptor.json');
    const environment = json<{
      defaults: Record<string, string>;
      prohibited_inputs: string[];
    }>('ops/release/ot-live-003/environment-schema.json');
    expect(descriptor).toMatchObject({
      service_key: 'one-time-rabbi-reply-copilot',
      runtime_identity: 'one_time_rabbi_torah_console',
      mode: 'descriptor_only_not_deployed',
      production_deployment_authority: 'OT-LIVE-001_only',
      provider_boundaries: {
        bna_token_allowed: false,
        bna_webhook_or_poller_allowed: false,
        shared_database_or_session_with_bna_allowed: false,
      },
    });
    expect(descriptor.http_contract.polling).toBe(false);
    expect(Object.values(environment.defaults).filter((value) => value === 'false')).toHaveLength(
      5,
    );
    expect(environment.prohibited_inputs).toContain('BNA_TELEGRAM_BOT_TOKEN');
  });
});

function json<T>(path: string) {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}
