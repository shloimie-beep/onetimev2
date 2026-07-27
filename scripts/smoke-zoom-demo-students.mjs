import { loadConfig } from '../packages/config/src/index.ts';
import { createMemoryPool, runMigrations } from '../packages/db/src/index.ts';
import { runFullAppProvision } from './full-app-staging-live/provision-preview.ts';

const pool = createMemoryPool();

try {
  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    DELIVERY_ENVIRONMENT: 'test',
    ONE_TIME_RUNTIME_ENVIRONMENT: 'test',
    ONE_TIME_ACCOUNT_KEY: 'rabbi_sheller_provider',
    ONE_TIME_PRODUCT_KEY: 'one_time_mishnah_class',
    PUBLIC_BASE_URL: 'https://ot99-web-staging.example.test',
    AUTH_CSRF_SECRET: 'full-app-preview-local-csrf-secret-value',
    MFA_SECRET_ENCRYPTION_KEY: 'full-app-preview-local-mfa-secret-value',
    ZOOM_CLASSROOM_ENABLED: 'true',
    ZOOM_CLASSROOM_PROVIDER_MODE: 'sink',
    ZOOM_CLASSROOM_REAL_PROVIDER_ENABLED: 'false',
    PORTAL_TEST_LAB_ENABLED: 'false',
  });
  await runMigrations(pool);
  const result = await runFullAppProvision({
    pool,
    config,
    publicBaseUrl: 'https://ot99-web-staging.example.test',
    writePrivateHandoff: false,
    requirePrivateDestinations: false,
    now: new Date('2026-07-21T16:00:00.000Z'),
  });
  const summary = {
    student_count: result.students.length,
    all_students_have_protected_launch: result.students.every(
      (student) => student.protected_launch_ready,
    ),
    all_students_have_vimeo_lesson: result.students.every((student) => student.lesson_ready),
    fourth_student_cap_rejection: result.fourth_student_cap_rejection,
    zoom_provider_mode: result.zoom_provider_mode,
    raw_zoom_url_printed: false,
    raw_vimeo_url_printed: false,
    credentials_printed: false,
  };
  if (
    summary.student_count !== 3 ||
    !summary.all_students_have_protected_launch ||
    !summary.all_students_have_vimeo_lesson ||
    !summary.fourth_student_cap_rejection
  ) {
    throw new Error('Zoom demo student preview smoke failed.');
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} finally {
  await pool.end();
}
