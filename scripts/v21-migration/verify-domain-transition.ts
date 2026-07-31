import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HOST_ONLY_SESSION_REQUIREMENTS,
  decideDomainTransition,
  evaluateCutoverGate,
} from '../../apps/web/src/server/features/domain-transition/policy.ts';
import {
  assertLegacyImportBoundary,
  normalizeAdultEmail,
  planLegacyAdultReregistration,
} from '../../apps/web/src/server/features/domain-transition/legacy-adult.ts';
import {
  applicationLoginUrl,
  transitionSignupUrl,
} from '../../apps/web/src/client/public/domain-transition/links.ts';

const login = decideDomainTransition({
  host: 'join.onetimeonetime.com',
  method: 'GET',
  path: '/login',
  query: {
    utm_source: 'legacy-list',
    email: 'person@example.com',
    token: 'secret-value',
    return_to: 'https://wrong.example',
  },
});
assert.deepEqual(login, {
  action: 'redirect',
  status: 302,
  location: 'https://app.onetimeonetime.com/login?utm_source=legacy-list',
});

const signup = decideDomainTransition({
  host: 'www.onetimeonetime.com',
  method: 'GET',
  path: '/one-time/signup',
  query: { source: 'old-bookmark', utm_campaign: 'migration_2026' },
  mode: 'retired',
});
assert.deepEqual(signup, {
  action: 'redirect',
  status: 308,
  location:
    'https://join.onetimeonetime.com/signup?source=old-bookmark&utm_campaign=migration_2026',
});

for (const path of ['/tisha-bav', '/tisha-bav.html', '/tisha-bav/live', '/tisha-bav/success']) {
  for (const method of ['GET', 'HEAD']) {
    assert.deepEqual(
      decideDomainTransition({ host: 'join.onetimeonetime.com', method, path }),
      { action: 'gone', status: 410, reason: 'tisha_bav_archived' },
      `${method} ${path} must remain retired`,
    );
  }
}
for (const probe of [
  { method: 'POST', path: '/api/v1/events/tisha-bav-2026/register' },
  { method: 'POST', path: '/api/v1/events/tisha-bav-2026/join' },
  { method: 'GET', path: '/api/v1/events/tisha-bav-2026/redirect' },
]) {
  assert.deepEqual(
    decideDomainTransition({ host: 'join.onetimeonetime.com', ...probe }),
    { action: 'gone', status: 410, reason: 'tisha_bav_archived' },
    `${probe.method} ${probe.path} must remain retired`,
  );
}
assert.deepEqual(
  decideDomainTransition({
    host: 'preview.example.test',
    method: 'GET',
    path: '/login',
  }),
  { action: 'not_found', status: 404, reason: 'unknown_host' },
);

assert.equal(HOST_ONLY_SESSION_REQUIREMENTS.domainAttribute, null);
assert.equal(HOST_ONLY_SESSION_REQUIREMENTS.secure, true);
assert.equal(HOST_ONLY_SESSION_REQUIREMENTS.httpOnly, true);
assert.equal(HOST_ONLY_SESSION_REQUIREMENTS.sameSite, 'strict');

assert.deepEqual(
  evaluateCutoverGate({
    immutableCandidateVerified: true,
    productionAcceptancePassed: false,
    rollbackTargetHealthy: true,
    backupAndRestoreProofCurrent: true,
    unexpectedExternalEffects: 0,
  }),
  { allowed: false, blockers: ['production_acceptance_not_passed'] },
);

assert.equal(
  normalizeAdultEmail('  Adult.Name+family@Example.COM  '),
  'adult.name+family@example.com',
);
assert.throws(
  () =>
    assertLegacyImportBoundary({
      email: 'adult@example.com',
      nested: { child_profiles: [{ name: 'prohibited' }] },
    }),
  /Prohibited legacy import field/u,
);

const ambiguous = planLegacyAdultReregistration({
  source: {
    email: 'adult@example.com',
    provenance: 'manifest:legacy-adults:v1',
    lifecycle: 'eligible_service_migration',
  },
  activeLocalAdultExists: false,
  exactNormalizedEmailGhlContactIds: ['contact-a', 'contact-b'],
  providerIdentifiersConflict: false,
});
assert.equal(ambiguous.localAccountAction, 'sign_up_again');
assert.deepEqual(ambiguous.crmProjection, {
  action: 'identity_review',
  reason: 'ambiguous_exact_email',
});
assert.equal(ambiguous.imports.childProfiles, false);
assert.equal(ambiguous.imports.password, false);
assert.equal(ambiguous.imports.productAccess, false);

assert.equal(
  applicationLoginUrl('?utm_source=legacy&email=adult@example.com'),
  'https://app.onetimeonetime.com/login?utm_source=legacy',
);
assert.equal(
  transitionSignupUrl('?source=old-bookmark&next=https://wrong.example'),
  'https://join.onetimeonetime.com/signup?source=old-bookmark',
);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [appSource, publicEntrySource, publicPageBuildSource] = await Promise.all([
  readFile(path.join(root, 'apps/web/src/server/app.ts'), 'utf8'),
  readFile(path.join(root, 'apps/web/src/client/public/public-entry.ts'), 'utf8'),
  readFile(path.join(root, 'scripts/build-public-pages.ts'), 'utf8'),
]);
const defaultRegistrations = appSource.match(
  /featureRegistrations \?\? \[([\s\S]*?)\]\s*\)\.map/u,
)?.[1];
assert.ok(defaultRegistrations, 'Central default feature registrations are missing');
const domainTransitionPosition = defaultRegistrations.indexOf(
  'domainTransitionFeatureRegistration',
);
const familySignupPosition = defaultRegistrations.indexOf('familySignupFeatureRegistration');
const schoolInquiryPosition = defaultRegistrations.indexOf('schoolInquiryFeatureRegistration');
assert.ok(domainTransitionPosition >= 0, 'P35 is not centrally registered');
assert.ok(
  domainTransitionPosition < familySignupPosition && familySignupPosition < schoolInquiryPosition,
  'P35 must be mounted before the historical feature registrations',
);
assert.ok(
  appSource.indexOf('installServerFeatureRouters({') <
    appSource.indexOf('/^\\/assets\\/events\\/tisha-bav-2026'),
  'P35 must be mounted before the archived-asset deny and public static serving',
);

for (const activeHook of [
  '[data-event-registration-form]',
  '[data-event-join-form]',
  '[data-event-open-modal]',
  '/api/v1/events/tisha-bav-2026/register',
  '/api/v1/events/tisha-bav-2026/join',
  '/api/v1/events/tisha-bav-2026/redirect',
]) {
  assert.ok(
    !publicEntrySource.includes(activeHook),
    `Active public client hook remains: ${activeHook}`,
  );
}
assert.ok(!publicPageBuildSource.includes('function tishaBavLandingPage'));
assert.ok(!publicPageBuildSource.includes('function tishaBavLivePage'));
assert.doesNotMatch(
  publicPageBuildSource,
  /writeFile\(\s*path\.join\(outDir, 'tisha-bav(?:-live)?\.html'/u,
);
for (const retiredOutput of ['tisha-bav.html', 'tisha-bav-live.html']) {
  assert.ok(
    publicPageBuildSource.includes(`rm(path.join(outDir, '${retiredOutput}'), { force: true })`),
    `Incremental public builds must remove stale ${retiredOutput}`,
  );
}

const archive = await readFile(
  path.join(root, 'ops/archive/tisha-bav-template/manifest.yaml'),
  'utf8',
);
for (const requiredLine of [
  'archive_state: inactive_historical_template',
  'active_route: false',
  'active_api: false',
  'accepts_registration: false',
  'provider_enrollment: false',
  'sends_messages: false',
  'grants_parent_or_student_access: false',
  'direct_activation_allowed: false',
  'requires_provider_authority: true',
]) {
  assert.ok(archive.includes(requiredLine), `Archive manifest is missing: ${requiredLine}`);
}

process.stdout.write('P35 domain-transition contract verification passed.\n');
