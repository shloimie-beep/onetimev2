import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('embedded classroom mounted runtime', () => {
  it('centrally mounts one P18 composition with the existing P22 projection callback', async () => {
    const app = await source('apps/web/src/server/app.ts');
    expect(occurrences(app, 'createEmbeddedClassroomFeatureComposition({')).toBe(1);
    expect(app).toContain(
      'attendanceProjectionChanges: learningComposition.attendanceProjectionChanges',
    );
    expect(app).toContain('createPostgresAdminAttendanceRecordReader');
    expect(app).toContain('createPostgresAdminAttendanceSubjectResolver');
    expect(app).toContain('registrations: [embeddedClassroomComposition.registration]');
    expect(app).toContain(
      'app.locals.embeddedClassroomInstalledRuntimeReceipt = embeddedClassroomInstalledReceipt',
    );
    expect(app).not.toContain('createPostgresEmbeddedClassroomRepository(');
  });

  it('keeps the exact occurrence Student route protected and candidate-bound provider work fail closed', async () => {
    const [app, composition, adapters] = await Promise.all([
      source('apps/web/src/server/app.ts'),
      source('apps/web/src/server/features/classroom/embedded/composition.ts'),
      source('apps/web/src/server/features/classroom/embedded/adapters.ts'),
    ]);
    expect(app).toContain("route.routeId === 'RT-STU-012'");
    expect(app).toContain('serveEmbeddedClassroomAppShell(req, res');
    expect(app).toContain("session.user.role !== 'student'");
    expect(composition).toContain("'/api/app/classroom'");
    expect(composition).toContain('createUnavailableEmbeddedJoinContextResolver()');
    expect(composition).toContain('createUnavailableMeetingSdkBootstrapPort()');
    expect(composition).toContain('createUnavailableProviderAttendanceResolver()');
    expect(adapters).not.toMatch(/process\.env|ZOOM_(?:SDK|WEBHOOK)|https?:\/\//u);
  });

  it('keeps client identity and bootstrap bearer data out of URLs and browser storage', async () => {
    const [portal, api, workspace] = await Promise.all([
      source('apps/web/src/client/app/portal-entry.tsx'),
      source('apps/web/src/client/app/student/classroom/api.ts'),
      source('apps/web/src/client/app/student/classroom/StudentClassroomWorkspace.tsx'),
    ]);
    const classroomClient = `${api}\n${workspace}`;
    expect(portal).toContain('studentClassroomOccurrenceFromLocation(routeLocation.pathname)');
    expect(portal).toContain("history.replaceState({}, '', routeLocation.pathname)");
    expect(classroomClient).not.toMatch(/localStorage|sessionStorage|URLSearchParams/u);
    expect(classroomClient).not.toMatch(
      /[?&](?:student|household|occurrence|registrant|device|session|token|signature)=/iu,
    );
    expect(api).toContain("const CLASSROOM_API_BASE = '/api/app/classroom'");
    expect(api).toContain("'/bootstrap'");
    expect(api).toContain('occurrence_id: exactOccurrenceId');
  });

  it('publishes the exact contracts, domain, database, and P18 server roots', async () => {
    const [contracts, domain, database, server] = await Promise.all([
      source('packages/contracts/src/index.ts'),
      source('packages/domain/src/index.ts'),
      source('packages/db/src/index.ts'),
      source('apps/web/src/server/features/classroom/embedded/index.ts'),
    ]);
    expect(contracts).toContain("export * from './classroom/embedded/index.ts'");
    expect(domain).toContain("export * from './classroom/embedded/index.ts'");
    expect(database).toContain("export * from './classroom/attendance/index.ts'");
    expect(server).toContain("export * from './composition.ts'");
    expect(server).toContain("export * from './router.ts'");
  });
});

async function source(relativePath: string): Promise<string> {
  return readFile(path.join(root, relativePath), 'utf8');
}

function occurrences(value: string, needle: string): number {
  return value.split(needle).length - 1;
}
