import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('P22 web learning composition boundary', () => {
  it('mounts only authenticated app learning and keeps attendance/consent writers absent', async () => {
    const [app, router, composition] = await Promise.all([
      readFile('apps/web/src/server/app.ts', 'utf8'),
      readFile('apps/web/src/server/features/learning/router.ts', 'utf8'),
      readFile('apps/web/src/server/features/learning/composition.ts', 'utf8'),
    ]);
    expect(app).toContain("'/api/app/learning'");
    expect(app).toContain('createPostgresLearningActorResolver');
    expect(router).not.toMatch(/router\.(?:post|put|patch|delete)\('\/attendance/);
    expect(router).not.toMatch(/router\.(?:post|put|patch|delete)\([^\n]*consent/);
    expect(composition).toContain('binding.repository === binding.mountedRepository');
    expect(composition).not.toContain('createPostgresEmbeddedClassroomRepository');
  });
});
