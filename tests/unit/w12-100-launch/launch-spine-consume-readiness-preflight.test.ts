import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  exactOneTimeLaunchSpineConsumeAuthorizationStatement,
  ONE_TIME_LAUNCH_SPINE_CONSUME_CONFIRMATION,
  runLaunchSpineConsumeReadinessPreflight,
} from '../../../scripts/w12-100/launch/launch-spine-consume-readiness-preflight.ts';

describe('One Time launch-spine consume readiness preflight', () => {
  it('reports missing protected consuming inputs without raw values', async () => {
    const fixture = await fixtureWorkspace();
    const report = await runLaunchSpineConsumeReadinessPreflight({
      ...fixture.options,
      now: new Date('2026-07-19T16:00:00.000Z'),
    });

    expect(report.status).toBe('blocked');
    expect(report.checks).toMatchObject({
      route_readback_available: true,
      route_readback_status_passed: true,
      route_readback_safety_readonly: true,
      synthetic_probes_required_readonly_checks_passed: true,
      synthetic_probes_external_mutations_safe: true,
      role_baseline_status_passed: true,
      role_baseline_browser_contexts_passed: true,
      private_consume_plan_present: false,
      cleanup_instructions_present: false,
      operator_authorization_present: false,
      production_confirmation_present: false,
      no_raw_values_in_report: true,
      no_production_side_effects: true,
    });
    expect(report.blocked_reasons).toEqual(
      expect.arrayContaining([
        'BLOCKED_ADMIN_JOURNEY_INPUT_NOT_PROVIDED',
        'BLOCKED_CLEANUP_INSTRUCTIONS_NOT_PROVIDED',
        'BLOCKED_NO_CONSUMING_PROOF_PATH_READY',
        'BLOCKED_OPERATOR_AUTHORIZATION_NOT_PROVIDED',
        'BLOCKED_PRIVATE_CONSUME_PLAN_NOT_PROVIDED',
        'BLOCKED_PRODUCTION_CONFIRMATION_NOT_PROVIDED',
        'BLOCKED_PRODUCTION_SIGNUP_LEAD_INPUT_NOT_PROVIDED',
      ]),
    );
    expect(JSON.stringify(report)).not.toContain('private-admin-journey-value');
  });

  it('accepts readiness with authorized role journey inputs', async () => {
    const fixture = await fixtureWorkspace();
    const authorization = exactOneTimeLaunchSpineConsumeAuthorizationStatement({
      routeReadbackSha256: fixture.routeReadbackSha256,
      syntheticProbesSha256: fixture.syntheticProbesSha256,
      targetEnvironment: 'production',
    });
    await writeJson(fixture.privateConsumePlanFile, {
      target_environment: 'production',
      role_journeys_authorized: true,
      production_signup_submit_authorized: false,
      raw_values_included: false,
    });
    await writeJson(fixture.cleanupInstructionsFile, {
      post_run_cleanup_authorized: true,
      raw_values_included: false,
    });
    await writeFile(fixture.operatorAuthorizationFile, `${authorization}\n`, 'utf8');
    await writeFile(
      fixture.productionConfirmationFile,
      `${ONE_TIME_LAUNCH_SPINE_CONSUME_CONFIRMATION}\n`,
      'utf8',
    );
    await writeFile(fixture.adminJourneyInputFile, 'private-admin-journey-value\n', 'utf8');
    await writeFile(fixture.parentJourneyInputFile, 'private-parent-journey-value\n', 'utf8');
    await writeFile(fixture.studentJourneyInputFile, 'private-student-journey-value\n', 'utf8');

    const report = await runLaunchSpineConsumeReadinessPreflight({
      ...fixture.options,
      now: new Date('2026-07-19T16:01:00.000Z'),
    });
    const serialized = JSON.stringify(report);

    expect(report.status, report.blocked_reasons.join(', ')).toBe('ready');
    expect(report.blocked_reasons).toEqual([]);
    expect(report.consuming_paths).toMatchObject({
      role_journeys_ready: true,
      production_signup_submit_ready: false,
      at_least_one_path_ready: true,
    });
    expect(report.readonly_evidence.required_authorization_statement).toBe(authorization);
    expect(serialized).not.toContain('private-admin-journey-value');
    expect(serialized).not.toContain('private-parent-journey-value');
    expect(serialized).not.toContain('private-student-journey-value');
  });

  it('accepts readiness with an authorized production signup submit input', async () => {
    const fixture = await fixtureWorkspace();
    const authorization = exactOneTimeLaunchSpineConsumeAuthorizationStatement({
      routeReadbackSha256: fixture.routeReadbackSha256,
      syntheticProbesSha256: fixture.syntheticProbesSha256,
      targetEnvironment: 'production',
    });
    await writeJson(fixture.privateConsumePlanFile, {
      target_environment: 'production',
      role_journeys_authorized: false,
      production_signup_submit_authorized: true,
      raw_values_included: false,
    });
    await writeJson(fixture.cleanupInstructionsFile, {
      post_run_cleanup_authorized: true,
      raw_values_included: false,
    });
    await writeFile(fixture.operatorAuthorizationFile, `${authorization}\n`, 'utf8');
    await writeFile(
      fixture.productionConfirmationFile,
      `${ONE_TIME_LAUNCH_SPINE_CONSUME_CONFIRMATION}\n`,
      'utf8',
    );
    await writeFile(fixture.signupLeadInputFile, 'private-signup-lead-value\n', 'utf8');

    const report = await runLaunchSpineConsumeReadinessPreflight({
      ...fixture.options,
      now: new Date('2026-07-19T16:02:00.000Z'),
    });
    const serialized = JSON.stringify(report);

    expect(report.status, report.blocked_reasons.join(', ')).toBe('ready');
    expect(report.blocked_reasons).toEqual([]);
    expect(report.consuming_paths).toMatchObject({
      role_journeys_ready: false,
      production_signup_submit_ready: true,
      at_least_one_path_ready: true,
    });
    expect(serialized).not.toContain('private-signup-lead-value');
  });
});

async function fixtureWorkspace() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'launch-spine-consume-readiness-'));
  const readonlyDirectory = path.join(directory, 'production-launch-spine-readonly');
  await mkdir(readonlyDirectory);
  const routeReadbackFile = path.join(readonlyDirectory, 'route-readback.json');
  const syntheticProbesFile = path.join(readonlyDirectory, 'synthetic-probes.json');
  const roleBaselineFile = path.join(directory, 'ROLE-ACCEPTANCE.json');
  const routeReadback = {
    status: 'passed',
    route_count: 16,
    passed_count: 16,
    safety: {
      production_database_writes: 0,
      crm_import_applies: 0,
      emails_sent: 0,
      provider_mutations: 0,
      deployments: 0,
      form_submits: 0,
      setup_or_reset_links_consumed: 0,
      response_bodies_committed: false,
    },
  };
  const syntheticProbes = {
    status: 'blocked',
    results: [
      { id: 'public_landing', status: 'passed' },
      { id: 'public_signup', status: 'passed' },
      { id: 'auth_lifecycle_login_page', status: 'passed' },
      { id: 'private_session_role_denial', status: 'passed' },
      { id: 'db_readiness', status: 'passed' },
      { id: 'worker_heartbeat_and_queue_diagnostics', status: 'blocked' },
    ],
    external_mutations: {
      production_database: false,
      providers: false,
      sends: false,
      deployment: false,
    },
  };
  const roleBaseline = {
    status: 'passed',
    browser_contexts: {
      administrator: 'passed',
      parent: 'passed',
      student: 'passed',
    },
  };
  await writeJson(routeReadbackFile, routeReadback);
  await writeJson(syntheticProbesFile, syntheticProbes);
  await writeJson(roleBaselineFile, roleBaseline);

  const privateConsumePlanFile = path.join(directory, 'CONSUME-PLAN.private.json');
  const cleanupInstructionsFile = path.join(directory, 'CLEANUP.private.json');
  const operatorAuthorizationFile = path.join(directory, 'OPERATOR-AUTH.private.txt');
  const productionConfirmationFile = path.join(directory, 'CONFIRM.private.txt');
  const adminJourneyInputFile = path.join(directory, 'ADMIN-JOURNEY.private.json');
  const parentJourneyInputFile = path.join(directory, 'PARENT-JOURNEY.private.json');
  const studentJourneyInputFile = path.join(directory, 'STUDENT-JOURNEY.private.json');
  const signupLeadInputFile = path.join(directory, 'SIGNUP-LEAD.private.json');

  return {
    adminJourneyInputFile,
    cleanupInstructionsFile,
    operatorAuthorizationFile,
    parentJourneyInputFile,
    privateConsumePlanFile,
    productionConfirmationFile,
    routeReadbackSha256: sha256(`${JSON.stringify(routeReadback, null, 2)}\n`),
    signupLeadInputFile,
    studentJourneyInputFile,
    syntheticProbesSha256: sha256(`${JSON.stringify(syntheticProbes, null, 2)}\n`),
    options: {
      adminJourneyInputFile,
      cleanupInstructionsFile,
      operatorAuthorizationFile,
      parentJourneyInputFile,
      privateConsumePlanFile,
      productionConfirmationFile,
      roleBaselineFile,
      routeReadbackFile,
      signupLeadInputFile,
      studentJourneyInputFile,
      syntheticProbesFile,
      targetEnvironment: 'production' as const,
    },
  };
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
