import { describe, expect, it } from 'vitest';
import {
  evaluateActionRegistry,
  validateFixtures,
  validatePacket,
} from '../../../scripts/ops06-synthetic-harness.mjs';

describe('OPS-06 synthetic harness', () => {
  it('validates the nested OPS-06 packet controls and records exact-name discrepancies', async () => {
    const result = await validatePacket();

    expect(result.valid).toBe(true);
    expect(result.task_id).toBe('OPS-06');
    expect(result.packet_id).toBe('OPS-06-20260716-d34103b1');
    expect(result.checksum_rows).toBeGreaterThan(0);
    expect(result.mismatches).toEqual([]);
    expect(result.exact_control_names.packet_json_present).toBe(false);
    expect(result.control_name_discrepancy).toContain('MANIFEST.json');
  });

  it('rejects non-fictional fixture emails or provider-like strings', () => {
    const valid = validateFixtures({
      namespace: 'ops06-test',
      schema_version: 'test',
      actor: { email: 'parent@example.test' },
    });
    const invalid = validateFixtures({
      actor: { email: 'parent@example.com' },
      url: 'https://join.onetimeonetime.com/live',
    });

    expect(valid.valid).toBe(true);
    expect(invalid.valid).toBe(false);
    expect(invalid.non_example_emails).toEqual(['parent@example.com']);
    expect(invalid.forbidden_matches).toEqual(['https://join.onetimeonetime.com/live']);
  });

  it('reports missing and unavailable action registry entries without treating them as pass', () => {
    const result = evaluateActionRegistry({
      requiredRegistry: {
        actions: [{ stable_id: 'ready.action' }, { stable_id: 'missing.action' }],
      },
      currentRegistry: {
        actions: [
          { action_id: 'ready.action', readiness_state: 'ready' },
          { action_id: 'extra.action', readiness_state: 'unavailable_by_design' },
        ],
      },
    });

    expect(result.required_count).toBe(2);
    expect(result.runtime_registry_count).toBe(2);
    expect(result.missing_required_stable_ids).toEqual(['missing.action']);
    expect(result.runtime_extra_action_ids).toEqual(['extra.action']);
    expect(result.unavailable_by_design_action_ids).toEqual(['extra.action']);
    expect(result.bijection).toBe(false);
  });
});
