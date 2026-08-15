import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('Parent welcome video framework migration', () => {
  it('creates an empty governed binding and append-only household event ledger', async () => {
    const migration = await readFile(
      'packages/db/migrations/2284_parent_welcome_video_framework.sql',
      'utf8',
    );

    expect(migration).toContain('CREATE TABLE onetime.parent_welcome_video_slots_v21');
    expect(migration).toContain('CREATE TABLE onetime.parent_activation_events_v21');
    expect(migration).toContain("slot_key = 'parent_companion_welcome'");
    expect(migration).toContain("state <> 'approved' OR (captions_available AND poster_available)");
    expect(migration).toContain('parent_activation_events_append_only');
    expect(migration).not.toMatch(/INSERT\s+INTO\s+onetime\.parent_welcome_video_slots_v21/iu);
    expect(migration).not.toMatch(/14-xsw|20260623_190244_1|388a318d/iu);
  });

  it('reports every adjacent Parent activation step without mutating Student truth', async () => {
    const [migration, repository, service] = await Promise.all([
      readFile('packages/db/migrations/2284_parent_welcome_video_framework.sql', 'utf8'),
      readFile(
        'apps/web/src/server/features/portals/parent-welcome/postgres-repository.ts',
        'utf8',
      ),
      readFile('apps/web/src/server/features/portals/parent-welcome/service.ts', 'utf8'),
    ]);

    expect(migration).toContain('CREATE VIEW onetime.parent_welcome_activation_funnel_v21');
    expect(migration).toContain("(14, 'family.engaged', 'Engaged Family')");
    expect(migration).toContain('adjacent_conversion_percent');
    expect(migration).toContain('parent_welcome_household_projection_v21');
    const implementation = `${migration}\n${repository}\n${service}`;
    expect(implementation).not.toMatch(
      /(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+onetime\.(?:v21_student|classroom_attendance|learning_badge|student_progress)/iu,
    );
    expect(implementation).not.toMatch(/onetime\.(?:highlevel|ghl_contact)/iu);
  });

  it('records the exact candidate evidence as rejected and blocked', async () => {
    const evidence = await readFile(
      'ops/launch/2026-08-15-parent-welcome-video-candidate-evidence.md',
      'utf8',
    );
    expect(evidence).toContain('**REJECTED / BLOCKED**');
    expect(evidence).toContain('14-xswLUSSQbQLljrR0GWpGbk10HZVvKU');
    expect(evidence).toContain('20260623_190244_1.mp4');
    expect(evidence).toContain('93.0 seconds');
    expect(evidence).toContain('1600 × 900');
    expect(evidence).toContain('153,415,000 bytes');
    expect(evidence).toContain('388a318d78cf0ab8ba62a4d8f40f55fd2d2151ada663d7380f1aca6a682d4719');
    expect(evidence).toContain('child/Student is clearly visible');
    expect(evidence).toContain('captions control disabled');
  });
});
