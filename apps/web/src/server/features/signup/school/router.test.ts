import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../../../../../../packages/config/src/index.ts';
import {
  SCHOOL_INQUIRY_COPY,
  type SchoolInquiryCommand,
  type SchoolInquiryResult,
  type SchoolSignupScope,
} from '../../../../../../../packages/contracts/src/signup/school/index.ts';
import type { DbPool } from '../../../../../../../packages/db/src/index.ts';
import { SchoolSignupError } from '../../../../../../../packages/domain/src/signup/school/index.ts';
import {
  createSchoolInquiryRouter,
  schoolInquiryFeatureRegistration,
  type SchoolInquirySubmitter,
} from './router.ts';

const servers: Array<ReturnType<express.Express['listen']>> = [];
const scope: SchoolSignupScope = {
  product: 'one_time_mishnayos',
  runtime_tier: 'isolated_staging',
  verification_environment_id: 'ci',
};

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    if (!server) continue;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe('P09 School-inquiry route', () => {
  it('publishes a task-owned descriptor for the exact v2.1 POST route', () => {
    expect(schoolInquiryFeatureRegistration).toMatchObject({
      featureId: 'onetime.signup-school-inquiry',
      contractVersion: '1.0.0',
      mountPath: '/api/v2.1/signup/school-inquiry',
    });
    expect(typeof schoolInquiryFeatureRegistration.createRouter).toBe('function');
  });

  it('accepts exactly the four required fields and reports only durable local intent', async () => {
    const submit = vi.fn(async () => createdResult());
    const harness = await startHarness({ submitter: { submit } });
    const payload = command();
    const response = await post(harness.baseUrl, payload);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(body).toEqual({
      success: true,
      code: 'SCHOOL_INQUIRY_ACCEPTED',
      disposition: 'created',
      sales_state: 'pending_manual_follow_up',
      acknowledgment_state: 'pending',
      manual_follow_up_required: true,
      provider_effects_completed_inline: 0,
      product_accounts_created: 0,
      households_created: 0,
      student_accounts_created: 0,
      subscriptions_created: 0,
      access_grants_created: 0,
      nurture_workflow_intent_ids: [],
      message: SCHOOL_INQUIRY_COPY.success,
    });
    expect(submit).toHaveBeenCalledWith({ scope, command: payload });
    expect(JSON.stringify(body)).not.toMatch(/student contact|whatsapp|stripe|checkout|portal/iu);
  });

  it('accepts only optional phone and note in addition to the four required fields', async () => {
    const submit = vi.fn(async () => createdResult());
    const harness = await startHarness({ submitter: { submit } });
    const payload: SchoolInquiryCommand = {
      ...command(),
      phone: '+1 555 555 0100',
      note: 'Please follow up after 3 PM.',
    };

    await expect(post(harness.baseUrl, payload)).resolves.toMatchObject({ status: 201 });
    expect(submit).toHaveBeenCalledWith({ scope, command: payload });
  });

  it('rejects extra account, role, access, consent, campaign, nurture, Student, WhatsApp, and Stripe fields before submission', async () => {
    const submit = vi.fn(async () => createdResult());
    const harness = await startHarness({ submitter: { submit } });
    const extras = [
      { product_account: true },
      { role: 'school' },
      { access: 'free' },
      { portal: 'school' },
      { marketing_consent: true },
      { campaign: 'school_nurture' },
      { nurture: true },
      { student: { name: 'Child' } },
      { whatsapp: true },
      { stripe_payment_method: 'pm_not_allowed' },
      { arbitrary: 'field' },
    ];

    for (const extra of extras) {
      const response = await post(harness.baseUrl, { ...command(), ...extra });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        success: false,
        code: 'VALIDATION_ERROR',
      });
    }
    expect(submit).not.toHaveBeenCalled();
  });

  it('rejects missing required fields and non-POST aliases before submission', async () => {
    const submit = vi.fn(async () => createdResult());
    const harness = await startHarness({ submitter: { submit } });
    const missingEmail = { ...command() } as Record<string, unknown>;
    delete missingEmail.email;

    const invalid = await post(harness.baseUrl, missingEmail);
    const wrongMethod = await fetch(`${harness.baseUrl}/api/v2.1/signup/school-inquiry`);
    const wrongAlias = await fetch(`${harness.baseUrl}/api/v1/signup/school`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(command()),
    });

    expect(invalid.status).toBe(400);
    expect(wrongMethod.status).toBe(404);
    expect(wrongAlias.status).toBe(404);
    expect(submit).not.toHaveBeenCalled();
  });

  it('blocks production_read_only before repository/service submission', async () => {
    const submit = vi.fn(async () => createdResult());
    const harness = await startHarness({
      submitter: { submit },
      runtimeBinding: {
        product: 'one_time_mishnayos',
        runtime_tier: 'production',
        verification_environment_id: 'production_read_only',
      },
    });

    const response = await post(harness.baseUrl, command());
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'VERIFICATION_ENVIRONMENT_READ_ONLY',
    });
    expect(submit).not.toHaveBeenCalled();
  });

  it('returns deduplication and canonical-request conflicts without claiming provider effects', async () => {
    const deduplicatedHarness = await startHarness({
      submitter: {
        submit: vi.fn(async (): Promise<SchoolInquiryResult> => ({
          ...createdResult(),
          disposition: 'deduplicated',
        })),
      },
    });
    const deduplicated = await post(deduplicatedHarness.baseUrl, command());
    expect(deduplicated.status).toBe(200);
    expect(await deduplicated.json()).toMatchObject({
      code: 'SCHOOL_INQUIRY_DEDUPLICATED',
      disposition: 'deduplicated',
      provider_effects_completed_inline: 0,
    });

    const conflictHarness = await startHarness({
      submitter: {
        submit: vi.fn(async () => {
          throw new SchoolSignupError('school_inquiry_conflict');
        }),
      },
    });
    const conflict = await post(conflictHarness.baseUrl, command());
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({
      success: false,
      code: 'SCHOOL_INQUIRY_CONFLICT',
    });
  });
});

async function startHarness(input: {
  submitter: SchoolInquirySubmitter;
  runtimeBinding?: SchoolSignupScope;
}) {
  const config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    AUTH_CSRF_SECRET: 'test-school-inquiry-route-secret-value',
  });
  const app = express();
  app.use(express.json({ limit: '16kb' }));
  app.use(
    schoolInquiryFeatureRegistration.mountPath,
    createSchoolInquiryRouter({
      config,
      pool: unusedPool(),
      submitter: input.submitter,
      rateLimit: false,
      ...(input.runtimeBinding ? { runtimeBinding: input.runtimeBinding } : {}),
    }),
  );
  const server = await listen(app);
  const address = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${address.port}` };
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

function post(baseUrl: string, payload: unknown) {
  return fetch(`${baseUrl}/api/v2.1/signup/school-inquiry`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

function command(): SchoolInquiryCommand {
  return {
    school_name: 'Yeshiva One',
    contact_first_name: 'Ari',
    contact_last_name: 'Levi',
    email: 'ari@example.com',
  };
}

function createdResult(): SchoolInquiryResult {
  return {
    disposition: 'created',
    sales_state: 'pending_manual_follow_up',
    safe_message: SCHOOL_INQUIRY_COPY.success,
    acknowledgment_intent_id: 'school-lead-1:acknowledgment',
    provider_effects_completed_inline: 0,
    product_accounts_created: 0,
    households_created: 0,
    student_accounts_created: 0,
    subscriptions_created: 0,
    access_grants_created: 0,
    nurture_workflow_intent_ids: [],
  };
}

function unusedPool(): DbPool {
  const unavailable = async () => {
    throw new Error('School route test attempted unexpected database access.');
  };
  return {
    connect: unavailable,
    query: unavailable,
    end: async () => undefined,
  } as unknown as DbPool;
}
