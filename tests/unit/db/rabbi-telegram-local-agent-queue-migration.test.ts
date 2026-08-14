import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Rabbi Telegram bounded local-agent queue migration', () => {
  it('requires fenced leases and bounded retry/dead-letter state only for agent tasks', () => {
    const sql = readFileSync(
      'packages/db/migrations/2283_rabbi_telegram_local_agent_queue.sql',
      'utf8',
    );
    expect(sql).toContain('attempts integer NOT NULL DEFAULT 0');
    expect(sql).toContain('max_attempts integer NOT NULL DEFAULT 3');
    expect(sql).toContain('lease_generation integer NOT NULL DEFAULT 0');
    expect(sql).toContain(
      "status IN ('queued', 'in_progress', 'blocked', 'completed', 'cancelled', 'dead_letter')",
    );
    expect(sql).toContain("task_key NOT LIKE 'rabbi_agent_%'");
    expect(sql).toContain('lease_owner IS NOT NULL');
    expect(sql).toContain('dead_lettered_at IS NOT NULL');
    expect(sql).toContain('rabbi_internal_tasks_agent_claim_idx');
  });
});
