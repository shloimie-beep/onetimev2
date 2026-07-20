import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  botActionWorkflows,
  businessWorkflows,
  contactFields,
  tags as canonicalTags,
} from './canonical-registry-data.ts';

type Args = {
  apply: boolean;
  createPipeline: boolean;
  privateDir: string;
  privateReportFile?: string | undefined;
};

type GhlResult<T> =
  | { ok: true; status: number; body: T }
  | { ok: false; status: number; code: string; message: string };

type GhlCustomField = {
  id?: string;
  name?: string;
  fieldKey?: string;
  dataType?: string;
};

type GhlTag = {
  id?: string;
  name?: string;
};

type GhlPipeline = {
  id?: string;
  name?: string;
  stages?: Array<{ id?: string; name?: string; position?: number }>;
};

type GhlWorkflow = {
  id?: string;
  name?: string;
  status?: string;
};

const args = parseArgs(process.argv.slice(2));

const requiredCustomFields = contactFields
  .filter((field) => field.deprecationState !== 'deprecated_existing')
  .map((field) => field.canonicalName);

const requiredTags = canonicalTags
  .filter((tag) => tag.deprecationState !== 'deprecated_existing')
  .map((tag) => tag.canonicalName);

const requiredWorkflows = [...businessWorkflows, ...botActionWorkflows].map(
  (workflow) => workflow.canonicalName,
);

const oneTimePipeline = {
  name: 'One Time Business',
  stages: [
    { name: 'Lead', position: 0 },
    { name: 'Checkout Started', position: 1 },
    { name: 'Active Customer', position: 2 },
    { name: 'Grace', position: 3 },
    { name: 'Canceled', position: 4 },
    { name: 'Former', position: 5 },
  ],
};

class HighLevelActivationClient {
  constructor(
    private readonly credentials: {
      locationId: string;
      pit: string;
      outboundWebhookSecret: string;
      testContactEmail: string | null;
      testContactPhone: string | null;
    },
  ) {}

  fingerprint(value: string) {
    return createHash('sha256').update(value).digest('hex').slice(0, 16);
  }

  async request<T>(method: string, apiPath: string, body?: unknown): Promise<GhlResult<T>> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      authorization: `Bearer ${this.credentials.pit}`,
      version: '2021-07-28',
    };
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const response = await fetch(`https://services.leadconnectorhq.com${apiPath}`, init);
    const parsed = await parseJson(response);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        code: providerErrorCode(parsed),
        message: providerErrorMessage(parsed),
      };
    }
    return { ok: true, status: response.status, body: parsed as T };
  }

  locationId() {
    return this.credentials.locationId;
  }

  safeCredentialState() {
    return {
      locationConfigured: true,
      locationFingerprint: this.fingerprint(this.credentials.locationId),
      pitConfigured: true,
      pitFingerprint: this.fingerprint(this.credentials.pit),
      outboundWebhookSecretConfigured: Boolean(this.credentials.outboundWebhookSecret),
      outboundWebhookSecretFingerprint: this.fingerprint(this.credentials.outboundWebhookSecret),
    };
  }

  testContactState() {
    return {
      emailConfigured: Boolean(this.credentials.testContactEmail),
      phoneConfigured: Boolean(this.credentials.testContactPhone),
    };
  }
}

async function runActivation(input: {
  client: HighLevelActivationClient;
  apply: boolean;
  createPipeline: boolean;
}) {
  const location = await verifyLocation(input.client);
  const customFields = await ensureCustomFields(input.client, input.apply);
  const tags = await ensureTags(input.client, input.apply);
  const pipeline = await ensurePipeline(input.client, input.apply && input.createPipeline);
  const workflows = await verifyWorkflows(input.client);
  const blockers = [
    ...customFields.filter((entry) => entry.status === 'blocked').map((entry) => entry.blocker),
    ...tags.filter((entry) => entry.status === 'blocked').map((entry) => entry.blocker),
    ...(pipeline.status === 'blocked' ? [pipeline.blocker] : []),
    ...(workflows.missing.length ? ['workflow_ui_setup_required'] : []),
    ...(!input.client.testContactState().emailConfigured
      ? ['operator_test_contact_email_missing']
      : []),
    ...(!input.client.testContactState().phoneConfigured
      ? ['operator_test_contact_phone_missing']
      : []),
  ].filter((blocker): blocker is string => Boolean(blocker));

  return {
    location,
    pit: input.client.safeCredentialState(),
    customFields,
    tags,
    pipeline,
    workflows,
    testContact: input.client.testContactState(),
    externalEffects: {
      highLevelCustomFieldsCreated: customFields.filter((entry) => entry.status === 'created')
        .length,
      highLevelTagsCreated: tags.filter((entry) => entry.status === 'created').length,
      highLevelPipelinesCreated: pipeline.status === 'created' ? 1 : 0,
      contactsCreated: 0,
      workflowEnrollments: 0,
      stripeMutations: 0,
      resendReads: 0,
      productionDatabaseWrites: 0,
      deployments: 0,
    },
    blockers,
  };
}

async function verifyLocation(client: HighLevelActivationClient) {
  const location = await client.request<Record<string, unknown>>(
    'GET',
    `/locations/${encodeURIComponent(client.locationId())}`,
  );
  if (!location.ok) {
    return {
      status: 'blocked' as const,
      blocker: `location_verify_failed:${location.status}:${location.code}`,
    };
  }
  const body = objectAt(location.body, 'location') ?? location.body;
  return {
    status: 'verified' as const,
    safeRef: client.fingerprint(client.locationId()),
    timezone: stringAt(body, 'timezone'),
    country: stringAt(body, 'country'),
  };
}

async function ensureCustomFields(client: HighLevelActivationClient, apply: boolean) {
  const fields = await listCustomFields(client);
  const entries = [];
  for (const name of requiredCustomFields) {
    const existing = findByName(fields, name);
    if (existing) {
      entries.push(fieldEntry('verified', name, existing));
      continue;
    }
    if (!apply) {
      entries.push({ name, status: 'missing' as const, id: null, fieldKey: null });
      continue;
    }
    const created = await client.request<{ customField?: GhlCustomField }>(
      'POST',
      `/locations/${encodeURIComponent(client.locationId())}/customFields`,
      {
        name,
        placeholder: name,
        dataType: 'TEXT',
      },
    );
    if (created.ok) {
      entries.push(
        fieldEntry('created', name, created.body.customField ?? (created.body as GhlCustomField)),
      );
      continue;
    }
    const refreshed = findByName(await listCustomFields(client), name);
    if (refreshed) {
      entries.push(fieldEntry('verified', name, refreshed));
      continue;
    }
    entries.push({
      name,
      status: 'blocked' as const,
      id: null,
      fieldKey: null,
      blocker: `custom_field_create_failed:${created.status}:${created.code}`,
    });
  }
  return entries;
}

async function ensureTags(client: HighLevelActivationClient, apply: boolean) {
  const tags = await listTags(client);
  const entries = [];
  for (const name of requiredTags) {
    const existing = findByName(tags, name);
    if (existing) {
      entries.push(tagEntry('verified', name, existing));
      continue;
    }
    if (!apply) {
      entries.push({ name, status: 'missing' as const, id: null });
      continue;
    }
    const created = await client.request<{ tag?: GhlTag }>(
      'POST',
      `/locations/${encodeURIComponent(client.locationId())}/tags`,
      { name },
    );
    if (created.ok) {
      entries.push(tagEntry('created', name, created.body.tag ?? (created.body as GhlTag)));
      continue;
    }
    const refreshed = findByName(await listTags(client), name);
    if (refreshed) {
      entries.push(tagEntry('verified', name, refreshed));
      continue;
    }
    entries.push({
      name,
      status: 'blocked' as const,
      id: null,
      blocker: `tag_create_failed:${created.status}:${created.code}`,
    });
  }
  return entries;
}

async function ensurePipeline(client: HighLevelActivationClient, apply: boolean) {
  const pipelines = await listPipelines(client);
  const existing = findByName(pipelines, oneTimePipeline.name);
  if (existing) return pipelineEntry('verified', existing);
  if (!apply) {
    return {
      name: oneTimePipeline.name,
      status: 'missing' as const,
      id: null,
      stages: [],
    };
  }
  const created = await client.request<{ pipeline?: GhlPipeline }>(
    'POST',
    '/opportunities/pipelines',
    {
      locationId: client.locationId(),
      name: oneTimePipeline.name,
      stages: oneTimePipeline.stages,
    },
  );
  if (created.ok)
    return pipelineEntry('created', created.body.pipeline ?? (created.body as GhlPipeline));
  const refreshed = findByName(await listPipelines(client), oneTimePipeline.name);
  if (refreshed) return pipelineEntry('verified', refreshed);
  return {
    name: oneTimePipeline.name,
    status: 'blocked' as const,
    id: null,
    stages: [],
    blocker: `pipeline_create_failed:${created.status}:${created.code}`,
  };
}

async function verifyWorkflows(client: HighLevelActivationClient) {
  const result = await client.request<{ workflows?: GhlWorkflow[] }>(
    'GET',
    `/workflows/?locationId=${encodeURIComponent(client.locationId())}`,
  );
  if (!result.ok) {
    return {
      status: 'blocked' as const,
      present: [],
      missing: requiredWorkflows,
      blocker: `workflow_read_failed:${result.status}:${result.code}`,
    };
  }
  const workflows = Array.isArray(result.body.workflows) ? result.body.workflows : [];
  const present = requiredWorkflows
    .map((name) => {
      const workflow = findByName(workflows, name);
      return workflow
        ? {
            name,
            id: workflow.id ?? null,
            status: workflow.status ?? null,
          }
        : null;
    })
    .filter((workflow): workflow is { name: string; id: string | null; status: string | null } =>
      Boolean(workflow),
    );
  return {
    status:
      present.length === requiredWorkflows.length
        ? ('verified' as const)
        : ('ui_required' as const),
    present,
    missing: requiredWorkflows.filter(
      (name) => !present.some((workflow) => workflow.name === name),
    ),
  };
}

async function listCustomFields(client: HighLevelActivationClient) {
  const response = await client.request<{ customFields?: GhlCustomField[] }>(
    'GET',
    `/locations/${encodeURIComponent(client.locationId())}/customFields`,
  );
  return response.ok && Array.isArray(response.body.customFields) ? response.body.customFields : [];
}

async function listTags(client: HighLevelActivationClient) {
  const response = await client.request<{ tags?: GhlTag[] }>(
    'GET',
    `/locations/${encodeURIComponent(client.locationId())}/tags`,
  );
  return response.ok && Array.isArray(response.body.tags) ? response.body.tags : [];
}

async function listPipelines(client: HighLevelActivationClient) {
  const response = await client.request<{ pipelines?: GhlPipeline[] }>(
    'GET',
    `/opportunities/pipelines?locationId=${encodeURIComponent(client.locationId())}`,
  );
  return response.ok && Array.isArray(response.body.pipelines) ? response.body.pipelines : [];
}

function fieldEntry(status: 'verified' | 'created', name: string, field: GhlCustomField) {
  return {
    name,
    status,
    id: field.id ?? null,
    fieldKey: field.fieldKey ?? null,
    dataType: field.dataType ?? null,
  };
}

function tagEntry(status: 'verified' | 'created', name: string, tag: GhlTag) {
  return {
    name,
    status,
    id: tag.id ?? null,
  };
}

function pipelineEntry(status: 'verified' | 'created', pipeline: GhlPipeline) {
  return {
    name: oneTimePipeline.name,
    status,
    id: pipeline.id ?? null,
    stages: (pipeline.stages ?? []).map((stage) => ({
      name: stage.name ?? null,
      id: stage.id ?? null,
      position: stage.position ?? null,
    })),
  };
}

function summarizeEntries<T extends { status: string; id?: string | null }>(entries: T[]) {
  return {
    total: entries.length,
    verified: entries.filter((entry) => entry.status === 'verified').length,
    created: entries.filter((entry) => entry.status === 'created').length,
    missing: entries.filter((entry) => entry.status === 'missing').length,
    blocked: entries.filter((entry) => entry.status === 'blocked').length,
    idsRecorded: entries.filter((entry) => Boolean(entry.id)).length,
  };
}

function findByName<T extends { name?: string }>(items: T[], name: string) {
  return items.find((item) => normalizeName(item.name) === normalizeName(name));
}

function normalizeName(value: string | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

async function readCredentials(privateDir: string) {
  const locationId = await readPrivateTrimmed(privateDir, 'location-id.txt', true);
  const pit = await readPrivateTrimmed(privateDir, 'pit-sync.txt', true);
  const outboundWebhookSecret = await readPrivateTrimmed(
    privateDir,
    'outbound-webhook-secret.txt',
    true,
  );
  const testContactEmail = await readPrivateTrimmed(privateDir, 'test-contact-email.txt', false);
  const testContactPhone = await readPrivateTrimmed(privateDir, 'test-contact-phone.txt', false);
  return {
    locationId,
    pit,
    outboundWebhookSecret,
    testContactEmail: testContactEmail || null,
    testContactPhone: testContactPhone || null,
  };
}

async function readPrivateTrimmed(
  privateDir: string,
  fileName: string,
  required: true,
): Promise<string>;
async function readPrivateTrimmed(
  privateDir: string,
  fileName: string,
  required: false,
): Promise<string | null>;
async function readPrivateTrimmed(privateDir: string, fileName: string, required: boolean) {
  try {
    const value = (await readFile(path.join(privateDir, fileName), 'utf8')).trim();
    if (!value && required) throw new Error(`${fileName} is empty`);
    return value;
  } catch (error) {
    if (required) throw error;
    return null;
  }
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function objectAt(value: unknown, key: string) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? ((value as Record<string, unknown>)[key] as Record<string, unknown> | undefined)
    : undefined;
}

function stringAt(value: unknown, key: string) {
  const candidate =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)[key]
      : undefined;
  return typeof candidate === 'string' ? candidate : null;
}

function providerErrorCode(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'provider_error';
  const object = value as Record<string, unknown>;
  const code = object.code ?? object.error ?? object.message;
  return typeof code === 'string' ? redactProviderMessage(code) : 'provider_error';
}

function providerErrorMessage(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'provider_error';
  const object = value as Record<string, unknown>;
  const message = object.message ?? object.error ?? object.code;
  return typeof message === 'string' ? redactProviderMessage(message) : 'provider_error';
}

function redactProviderMessage(value: string) {
  return value
    .replace(/pit-[a-z0-9-]+/gi, '[REDACTED:PIT]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .slice(0, 180);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    apply: false,
    createPipeline: false,
    privateDir: 'C:/Users/User/.onetime-highlevel-private',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--apply') {
      args.apply = true;
    } else if (value === '--create-pipeline') {
      args.createPipeline = true;
    } else if (value === '--private-dir') {
      args.privateDir = argv[(index += 1)] ?? args.privateDir;
    } else if (value === '--private-report') {
      args.privateReportFile = argv[(index += 1)];
    }
  }
  return args;
}

function writeStdoutJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

const credentials = await readCredentials(args.privateDir);
const client = new HighLevelActivationClient(credentials);
const report = await runActivation({
  client,
  apply: args.apply,
  createPipeline: args.createPipeline,
});

const publicReport = {
  generatedAt: new Date().toISOString(),
  mode: args.apply ? 'apply' : 'dry_run',
  location: report.location,
  pit: report.pit,
  customFields: summarizeEntries(report.customFields),
  tags: summarizeEntries(report.tags),
  pipeline: report.pipeline,
  workflows: report.workflows,
  testContact: report.testContact,
  externalEffects: report.externalEffects,
  blockers: report.blockers,
};

writeStdoutJson(publicReport);

if (args.privateReportFile) {
  await mkdir(path.dirname(path.resolve(args.privateReportFile)), { recursive: true });
  await writeFile(args.privateReportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
