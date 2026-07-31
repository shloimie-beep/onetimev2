import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ApprovedSchoolConfiguration,
  ApprovedSchoolConfigurationResult,
  SchoolSignupScope,
} from '../../../../../../../packages/contracts/src/signup/school/index.ts';
import {
  createApprovedSchoolAdminRouter,
  type ApprovedSchoolAdminSession,
  type ApprovedSchoolConfigurator,
} from './approved-school-router.ts';

const servers: Array<ReturnType<express.Express['listen']>> = [];
const scope: SchoolSignupScope = {
  product: 'one_time_mishnayos',
  runtime_tier: 'isolated_staging',
  verification_environment_id: 'ci',
};
const admin: ApprovedSchoolAdminSession = {
  human_account_id: 'admin-1',
  role: 'admin',
};

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe('P09 approved-School Admin route', () => {
  it('derives exact Admin authority, scope, time, audit reference, and hash inputs server-side', async () => {
    const configureApprovedSchool = vi.fn(async () => result('created'));
    const harness = await startHarness({
      configurator: configurator({ configureApprovedSchool }),
    });
    const response = await post(harness.baseUrl, payload());
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      success: true,
      disposition: 'created',
      provider_effects_completed_inline: 0,
      product_accounts_created: 0,
      student_accounts_created: 0,
      access_grants_created: 0,
      subscriptions_created: 0,
      nurture_workflow_intent_ids: [],
    });
    expect(configureApprovedSchool).toHaveBeenCalledWith({
      actor: { ...scope, human_account_id: 'admin-1', role: 'admin' },
      authorized_at: '2026-07-31T14:00:00.000Z',
      command: {
        ...payload(),
        audit_ref: 'approved-school:school-config-1',
      },
    });
  });

  it('rejects body-supplied actor, scope, authorization, hash, audit, and unknown fields', async () => {
    const configureApprovedSchool = vi.fn(async () => result('created'));
    const harness = await startHarness({
      configurator: configurator({ configureApprovedSchool }),
    });
    for (const field of [
      'authorized_by_human_account_id',
      'authorized_at',
      'canonical_request_hash',
      'runtime_tier',
      'verification_environment_id',
      'audit_ref',
      'school_role',
    ]) {
      const response = await post(harness.baseUrl, { ...payload(), [field]: 'untrusted' });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ success: false, code: 'VALIDATION_ERROR' });
    }
    expect(configureApprovedSchool).not.toHaveBeenCalled();
  });

  it('requires an authenticated Admin and CSRF before configuration', async () => {
    for (const input of [
      { session: null, csrf: true, status: 401, code: 'UNAUTHENTICATED' },
      {
        session: { human_account_id: 'parent-1', role: 'parent' } as const,
        csrf: true,
        status: 403,
        code: 'APPROVED_SCHOOL_FORBIDDEN',
      },
      { session: admin, csrf: false, status: 403, code: 'CSRF_REQUIRED' },
    ]) {
      const configureApprovedSchool = vi.fn(async () => result('created'));
      const harness = await startHarness({
        session: input.session,
        csrf: input.csrf,
        configurator: configurator({ configureApprovedSchool }),
      });
      const response = await post(harness.baseUrl, payload());
      expect(response.status).toBe(input.status);
      expect(await response.json()).toMatchObject({ success: false, code: input.code });
      expect(configureApprovedSchool).not.toHaveBeenCalled();
    }
  });

  it('denies production_read_only before service or repository configuration', async () => {
    const configureApprovedSchool = vi.fn(async () => result('created'));
    const harness = await startHarness({
      runtimeBinding: {
        product: 'one_time_mishnayos',
        runtime_tier: 'production',
        verification_environment_id: 'production_read_only',
      },
      configurator: configurator({ configureApprovedSchool }),
    });
    const response = await post(harness.baseUrl, payload());
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'VERIFICATION_ENVIRONMENT_READ_ONLY',
    });
    expect(configureApprovedSchool).not.toHaveBeenCalled();
  });

  it('allows Admin-only canonical readback, including production_read_only', async () => {
    const readApprovedSchool = vi.fn(async () => configuration());
    const harness = await startHarness({
      runtimeBinding: {
        product: 'one_time_mishnayos',
        runtime_tier: 'production',
        verification_environment_id: 'production_read_only',
      },
      configurator: configurator({ readApprovedSchool }),
    });
    const response = await fetch(
      `${harness.baseUrl}/api/v2.1/admin/approved-schools/approved-school-1`,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      configuration: { approved_school_id: 'approved-school-1' },
    });
    expect(readApprovedSchool).toHaveBeenCalledWith({
      actor: {
        product: 'one_time_mishnayos',
        runtime_tier: 'production',
        verification_environment_id: 'production_read_only',
        human_account_id: 'admin-1',
        role: 'admin',
      },
      approved_school_id: 'approved-school-1',
    });
  });
});

async function startHarness(input: {
  runtimeBinding?: SchoolSignupScope;
  session?: ApprovedSchoolAdminSession | null;
  csrf?: boolean;
  configurator: ApprovedSchoolConfigurator;
}) {
  const app = express();
  app.use(express.json({ limit: '16kb' }));
  app.use((req, _res, next) => {
    (req as typeof req & { traceId: string }).traceId = 'request-1';
    next();
  });
  app.use(
    '/api/v2.1/admin/approved-schools',
    createApprovedSchoolAdminRouter({
      runtimeBinding: input.runtimeBinding ?? scope,
      resolveSession: async () => (input.session === undefined ? admin : input.session),
      verifyCsrf: async () => input.csrf ?? true,
      now: () => '2026-07-31T14:00:00.000Z',
      configurator: input.configurator,
    }),
  );
  const server = await listen(app);
  const address = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${address.port}` };
}

function configurator(overrides: Partial<ApprovedSchoolConfigurator>): ApprovedSchoolConfigurator {
  return {
    configureApprovedSchool: async () => result('created'),
    readApprovedSchool: async () => null,
    ...overrides,
  };
}

function post(baseUrl: string, body: unknown) {
  return fetch(`${baseUrl}/api/v2.1/admin/approved-schools/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-csrf-token': 'valid' },
    body: JSON.stringify(body),
  });
}

function payload() {
  return {
    approved_school_id: 'approved-school-1',
    adult_account_manager_id: 'adult-manager-1',
    household_id: 'household-1',
    seat_allowance: 75,
    price_minor_units: 125_000,
    currency: 'USD' as const,
    billing_starts_at: '2026-09-01T00:00:00.000Z',
    terms_reference: 'terms/school-2026-v1',
    immutable_contract_reference: 'contract/school-1',
    authorization_reason: 'Approved contractual School terms',
    idempotency_key: 'school-config-1',
    expected_configuration_version: 0,
  };
}

function result(
  disposition: ApprovedSchoolConfigurationResult['disposition'],
): ApprovedSchoolConfigurationResult {
  return {
    disposition,
    configuration: configuration(),
    provider_effects_completed_inline: 0,
    product_accounts_created: 0,
    households_created: 0,
    student_accounts_created: 0,
    access_grants_created: 0,
    subscriptions_created: 0,
    nurture_workflow_intent_ids: [],
  };
}

function configuration(): ApprovedSchoolConfiguration {
  return {
    request_binding: {
      scope,
      operation: 'admin_approved_school_configuration',
      idempotency_key: 'school-config-1',
      canonical_request_hash: 'a'.repeat(64),
    },
    approved_school_id: 'approved-school-1',
    adult_account_manager_id: 'adult-manager-1',
    household_id: 'household-1',
    seat_allowance: 75,
    price_minor_units: 125_000,
    currency: 'USD',
    billing_starts_at: '2026-09-01T00:00:00.000Z',
    terms_reference: 'terms/school-2026-v1',
    immutable_contract_reference: 'contract/school-1',
    authorization_reason: 'Approved contractual School terms',
    authorized_by_human_account_id: 'admin-1',
    authorized_at: '2026-07-31T14:00:00.000Z',
    expected_prior_version: 0,
    configuration_version: 1,
    audit_ref: 'approved-school:school-config-1',
    created_at: '2026-07-31T14:00:00.000Z',
    updated_at: '2026-07-31T14:00:00.000Z',
    account_model: 'parent_student',
    adult_account_manager_role: 'parent',
    student_account_role: 'student',
    school_role_created: false,
    school_portal_created: false,
    bulk_roster_created: false,
    automated_nurture_created: false,
  };
}

async function listen(app: express.Express) {
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listening = app.listen(0, '127.0.0.1', (error?: Error) => {
      if (error) reject(error);
      else resolve(listening);
    });
  });
  servers.push(server);
  return server;
}
