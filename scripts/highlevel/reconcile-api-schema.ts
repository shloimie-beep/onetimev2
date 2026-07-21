import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  botActionWorkflows,
  businessWorkflows,
  contactFields,
  customValues,
  deprecatedWorkflows,
  lowercaseTagDeprecations,
  normalizeAssetName,
  protectedImportPaths,
  registryMetadata,
  standardContactFields,
  tags as canonicalTags,
  type AssetStatus,
  type RegistryCustomValue,
  type RegistryField,
  type RegistryTag,
  type RegistryWorkflow,
} from './canonical-registry-data.ts';

type Args = {
  apply: boolean;
  createPipeline: boolean;
  updatePipelineStages: boolean;
  privateDir: string;
  privateReportFile: string;
  publicReportFile: string;
  skipRegistryWrite: boolean;
};

type GhlResult<T> =
  | { ok: true; status: number; body: T }
  | { ok: false; status: number; code: string; message: string; retryable: boolean };

type Credentials = {
  locationId: string;
  pit: string;
  outboundWebhookSecret: string;
  testContactEmail: string | null;
  testContactPhone: string | null;
};

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

type GhlCustomValue = {
  id?: string;
  name?: string;
  value?: string;
};

type GhlPipeline = {
  id?: string;
  name?: string;
  stages?: GhlPipelineStage[];
};

type GhlPipelineStage = {
  id?: string;
  name?: string;
  position?: number;
};

type GhlWorkflow = {
  id?: string;
  name?: string;
  status?: string;
};

type PromptRecord = {
  prompt_id: string;
  semantic_version: string;
  status: string;
  title: string;
  file_path: string;
  sha256: string;
  source: string;
  created_date: string;
  approved_date: string;
  ghl_asset_id: string;
  required_fields: string[];
  required_tags: string[];
  required_custom_values: string[];
  required_workflows: string[];
  test_contact_reference: string;
  last_tested_date: string;
  supersedes: string[];
  superseded_by: string;
};

type CurrentRegistry = {
  schema_id: string;
  schema_version: string;
  status: string;
  location_id: string;
  generated_at: string;
  counts: Record<string, number>;
  standard_contact_fields: RegistryField[];
  contact_fields: RegistryField[];
  tags: RegistryTag[];
  custom_values: RegistryCustomValueRecord[];
  business_workflows: RegistryWorkflow[];
  bot_action_workflows: RegistryWorkflow[];
  deprecated_workflows: RegistryWorkflow[];
  prompts: PromptRecord[];
  knowledge_bases: PromptRecord[];
  deprecations: unknown;
  protected_import_paths: typeof protectedImportPaths;
  safety: Record<string, boolean | number>;
};

type RegistryCustomValueRecord = RegistryCustomValue & {
  blocker?: string;
  liveValueFingerprint?: string;
};

type ReconcileAssetStatus =
  | 'verified'
  | 'created'
  | 'updated'
  | 'missing'
  | 'blocked'
  | 'deprecated_existing';

type FieldEntry = {
  name: string;
  status: ReconcileAssetStatus;
  id: string | null;
  fieldKey: string | null;
  dataType: string | null;
  blocker?: string;
};

type TagEntry = {
  name: string;
  status: ReconcileAssetStatus;
  id: string | null;
  blocker?: string;
};

type CustomValueEntry = {
  name: string;
  status: ReconcileAssetStatus | 'blocked_ui_or_business_value';
  id: string | null;
  valueFingerprint: string | null;
  blocker?: string;
};

type PipelineEntry = {
  name: string;
  status: 'verified' | 'created' | 'updated' | 'missing' | 'blocked';
  id: string | null;
  stages: Array<{ name: string | null; id: string | null; position: number | null }>;
  blocker?: string;
};

type WorkflowReport = {
  status: 'verified' | 'ui_required' | 'blocked';
  present: Array<{ name: string; id: string | null; status: string | null }>;
  missing: string[];
  deprecated_present: Array<{ name: string; id: string | null; status: string | null }>;
  blocker?: string;
};

type ReconciliationReport = {
  generatedAt: string;
  mode: 'apply' | 'dry_run';
  location: {
    status: 'verified' | 'blocked';
    id: string;
    safeRef: string;
    timezone: string | null;
    country: string | null;
    blocker?: string;
  };
  credentials: ReturnType<HighLevelApiClient['safeCredentialState']>;
  customFields: FieldEntry[];
  tags: TagEntry[];
  customValues: CustomValueEntry[];
  pipeline: PipelineEntry;
  contacts: {
    status: 'verified' | 'blocked';
    count: number | null;
    blocker?: string;
  };
  workflows: WorkflowReport;
  testContact: ReturnType<HighLevelApiClient['testContactState']>;
  externalEffects: {
    highLevelCustomFieldsCreated: number;
    highLevelTagsCreated: number;
    highLevelCustomValuesCreated: number;
    highLevelCustomValuesUpdated: number;
    highLevelPipelinesCreated: number;
    highLevelPipelinesUpdated: number;
    contactsCreated: number;
    workflowEnrollments: number;
    messagesSent: number;
    stripeMutations: number;
  };
  blockers: string[];
};

const args = parseArgs(process.argv.slice(2));
const repoRoot = process.cwd();
const generatedAt = new Date().toISOString();
const today = generatedAt.slice(0, 10);

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

async function main() {
  const current = await readCurrentRegistry();
  const credentials = await readCredentials(args.privateDir);
  const client = new HighLevelApiClient(credentials);
  if (credentials.locationId !== registryMetadata.locationId) {
    throw new Error(
      `location_id_mismatch:registry=${registryMetadata.locationId}:private=${client.fingerprint(
        credentials.locationId,
      )}`,
    );
  }

  const report = await reconcileHighLevel(client, args);
  const updatedCurrent = buildUpdatedRegistry(current, report);
  const blockingErrors = hardBlockers(report);
  await writeReports(report);
  if (!args.skipRegistryWrite && blockingErrors.length === 0) {
    await writeRegistryFiles(updatedCurrent, report);
  }
  writeStdoutJson(publicReport(report));
  if (blockingErrors.length > 0) process.exitCode = 1;
}

class HighLevelApiClient {
  constructor(private readonly credentials: Credentials) {}

  async request<T>(method: string, apiPath: string, body?: unknown): Promise<GhlResult<T>> {
    let lastStatus = 0;
    let lastCode = 'retry_exhausted';
    let lastMessage = 'retry_exhausted';
    for (let attempt = 0; attempt < 6; attempt += 1) {
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
      try {
        const response = await fetch(`https://services.leadconnectorhq.com${apiPath}`, init);
        const parsed = await parseJson(response);
        if (response.ok) return { ok: true, status: response.status, body: parsed as T };
        const code = providerErrorCode(parsed);
        const message = providerErrorMessage(parsed);
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable) return { ok: false, status: response.status, code, message, retryable };
        lastStatus = response.status;
        lastCode = code;
        lastMessage = message;
        await delay(retryDelayMs(attempt, response.headers.get('retry-after')));
      } catch {
        lastStatus = 0;
        lastCode = 'network_error';
        lastMessage = 'network_error';
        await delay(retryDelayMs(attempt, null));
      }
    }
    return {
      ok: false,
      status: lastStatus,
      code: `retry_exhausted:${lastCode}`,
      message: lastMessage,
      retryable: true,
    };
  }

  locationId() {
    return this.credentials.locationId;
  }

  fingerprint(value: string) {
    return createHash('sha256').update(value).digest('hex').slice(0, 16);
  }

  safeCredentialState() {
    return {
      locationConfigured: true,
      locationFingerprint: this.fingerprint(this.credentials.locationId),
      pitConfigured: Boolean(this.credentials.pit),
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

await main();

async function reconcileHighLevel(
  client: HighLevelApiClient,
  input: Pick<Args, 'apply' | 'createPipeline' | 'updatePipelineStages'>,
): Promise<ReconciliationReport> {
  const [location, customFields, tags, customValuesReport, pipeline, contacts, workflows] =
    await sequentialReconciliation(client, input);
  const blockers = [
    ...(location.status === 'blocked' ? [location.blocker] : []),
    ...customFields.filter(hasBlocker).map((entry) => entry.blocker),
    ...tags.filter(hasBlocker).map((entry) => entry.blocker),
    ...customValuesReport.filter(hasBlocker).map((entry) => entry.blocker),
    ...(pipeline.status === 'blocked' ? [pipeline.blocker] : []),
    ...(contacts.status === 'blocked' ? [contacts.blocker] : []),
    ...(workflows.status === 'blocked' ? [workflows.blocker] : []),
    ...(workflows.missing.length ? ['workflow_ui_setup_required'] : []),
  ].filter((blocker): blocker is string => Boolean(blocker));

  return {
    generatedAt,
    mode: input.apply ? 'apply' : 'dry_run',
    location,
    credentials: client.safeCredentialState(),
    customFields,
    tags,
    customValues: customValuesReport,
    pipeline,
    contacts,
    workflows,
    testContact: client.testContactState(),
    externalEffects: {
      highLevelCustomFieldsCreated: customFields.filter((entry) => entry.status === 'created')
        .length,
      highLevelTagsCreated: tags.filter((entry) => entry.status === 'created').length,
      highLevelCustomValuesCreated: customValuesReport.filter(
        (entry) => entry.status === 'created',
      ).length,
      highLevelCustomValuesUpdated: customValuesReport.filter(
        (entry) => entry.status === 'updated',
      ).length,
      highLevelPipelinesCreated: pipeline.status === 'created' ? 1 : 0,
      highLevelPipelinesUpdated: pipeline.status === 'updated' ? 1 : 0,
      contactsCreated: 0,
      workflowEnrollments: 0,
      messagesSent: 0,
      stripeMutations: 0,
    },
    blockers,
  };
}

async function sequentialReconciliation(
  client: HighLevelApiClient,
  input: Pick<Args, 'apply' | 'createPipeline' | 'updatePipelineStages'>,
) {
  const location = await verifyLocation(client);
  await delay(250);
  const customFields = await ensureCustomFields(client, input.apply);
  await delay(250);
  const tags = await ensureTags(client, input.apply);
  await delay(250);
  const customValuesReport = await ensureCustomValues(client, input.apply);
  await delay(250);
  const pipeline = await ensurePipeline(
    client,
    input.apply && input.createPipeline,
    input.apply && input.updatePipelineStages,
  );
  await delay(250);
  const contacts = await probeContacts(client);
  await delay(250);
  const workflows = await verifyWorkflows(client);
  return [location, customFields, tags, customValuesReport, pipeline, contacts, workflows] as const;
}

async function verifyLocation(client: HighLevelApiClient): Promise<ReconciliationReport['location']> {
  const location = await client.request<Record<string, unknown>>(
    'GET',
    `/locations/${encodeURIComponent(client.locationId())}`,
  );
  if (!location.ok) {
    return {
      status: 'blocked',
      id: client.locationId(),
      safeRef: client.fingerprint(client.locationId()),
      timezone: null,
      country: null,
      blocker: `location_verify_failed:${location.status}:${location.code}`,
    };
  }
  const body = objectAt(location.body, 'location') ?? location.body;
  return {
    status: 'verified',
    id: client.locationId(),
    safeRef: client.fingerprint(client.locationId()),
    timezone: stringAt(body, 'timezone'),
    country: stringAt(body, 'country'),
  };
}

async function ensureCustomFields(client: HighLevelApiClient, apply: boolean): Promise<FieldEntry[]> {
  const listed = await listCustomFields(client);
  if (!listed.ok) {
    return contactFields.map((field) => ({
      name: field.canonicalName,
      status: 'blocked',
      id: field.ghlId || null,
      fieldKey: field.ghlKey || null,
      dataType: field.dataType || null,
      blocker: `custom_field_read_failed:${listed.status}:${listed.code}`,
    }));
  }
  const entries: FieldEntry[] = [];
  let liveFields = listed.body;
  for (const field of contactFields) {
    const existing = findCustomField(liveFields, field);
    if (existing) {
      entries.push(fieldEntry(field.deprecationState === 'deprecated_existing' ? 'deprecated_existing' : 'verified', field.canonicalName, existing));
      continue;
    }
    if (field.deprecationState === 'deprecated_existing') {
      entries.push({
        name: field.canonicalName,
        status: 'deprecated_existing',
        id: field.ghlId || null,
        fieldKey: field.ghlKey || null,
        dataType: field.dataType || null,
      });
      continue;
    }
    if (!apply) {
      entries.push({
        name: field.canonicalName,
        status: 'missing',
        id: field.ghlId || null,
        fieldKey: field.ghlKey || null,
        dataType: field.dataType || null,
      });
      continue;
    }
    const created = await client.request<{ customField?: GhlCustomField }>(
      'POST',
      `/locations/${encodeURIComponent(client.locationId())}/customFields`,
      {
        name: field.canonicalName,
        placeholder: field.canonicalName,
        dataType: 'TEXT',
      },
    );
    if (created.ok) {
      const createdField = created.body.customField ?? (created.body as GhlCustomField);
      entries.push(fieldEntry('created', field.canonicalName, createdField));
      liveFields = [...liveFields, createdField];
      await delay(300);
      continue;
    }
    const refreshed = await listCustomFields(client);
    liveFields = refreshed.ok ? refreshed.body : liveFields;
    const afterCreate = findCustomField(liveFields, field);
    if (afterCreate) {
      entries.push(fieldEntry('verified', field.canonicalName, afterCreate));
      continue;
    }
    entries.push({
      name: field.canonicalName,
      status: 'blocked',
      id: field.ghlId || null,
      fieldKey: field.ghlKey || null,
      dataType: field.dataType || null,
      blocker: `custom_field_create_failed:${created.status}:${created.code}`,
    });
  }
  return entries;
}

async function ensureTags(client: HighLevelApiClient, apply: boolean): Promise<TagEntry[]> {
  const listed = await listTags(client);
  if (!listed.ok) {
    return canonicalTags.map((tag) => ({
      name: tag.canonicalName,
      status: 'blocked',
      id: tag.ghlId || null,
      blocker: `tag_read_failed:${listed.status}:${listed.code}`,
    }));
  }
  const entries: TagEntry[] = [];
  let liveTags = listed.body;
  for (const tag of canonicalTags) {
    const existing = findTag(liveTags, tag);
    if (existing) {
      entries.push(tagEntry(tag.deprecationState === 'deprecated_existing' ? 'deprecated_existing' : 'verified', tag.canonicalName, existing));
      continue;
    }
    if (tag.deprecationState === 'deprecated_existing') {
      entries.push({
        name: tag.canonicalName,
        status: 'deprecated_existing',
        id: tag.ghlId || null,
      });
      continue;
    }
    if (!apply) {
      entries.push({ name: tag.canonicalName, status: 'missing', id: tag.ghlId || null });
      continue;
    }
    const created = await client.request<{ tag?: GhlTag }>(
      'POST',
      `/locations/${encodeURIComponent(client.locationId())}/tags`,
      { name: tag.canonicalName },
    );
    if (created.ok) {
      const createdTag = created.body.tag ?? (created.body as GhlTag);
      entries.push(tagEntry('created', tag.canonicalName, createdTag));
      liveTags = [...liveTags, createdTag];
      await delay(250);
      continue;
    }
    const refreshed = await listTags(client);
    liveTags = refreshed.ok ? refreshed.body : liveTags;
    const afterCreate = findTag(liveTags, tag);
    if (afterCreate) {
      entries.push(tagEntry('verified', tag.canonicalName, afterCreate));
      continue;
    }
    entries.push({
      name: tag.canonicalName,
      status: 'blocked',
      id: tag.ghlId || null,
      blocker: `tag_create_failed:${created.status}:${created.code}`,
    });
  }
  return entries;
}

async function ensureCustomValues(
  client: HighLevelApiClient,
  apply: boolean,
): Promise<CustomValueEntry[]> {
  const listed = await listCustomValues(client);
  if (!listed.ok) {
    return customValues.map((value) => ({
      name: value.canonicalName,
      status: 'blocked',
      id: value.ghlId || null,
      valueFingerprint: fingerprintMaybe(value.value),
      blocker: `custom_value_read_failed:${listed.status}:${listed.code}`,
    }));
  }

  const entries: CustomValueEntry[] = [];
  let liveValues = listed.body;
  for (const value of customValues) {
    const existing = findCustomValue(liveValues, value);
    const resolvedSource = isResolvedCustomValue(value.value);
    const liveValue = existing?.value?.trim() ?? '';
    const resolvedLive = isResolvedCustomValue(liveValue);
    if (existing && resolvedLive && !resolvedSource) {
      entries.push({
        name: value.canonicalName,
        status: 'verified',
        id: existing.id ?? null,
        valueFingerprint: fingerprintMaybe(liveValue),
      });
      continue;
    }
    if (existing && resolvedSource && liveValue === value.value) {
      entries.push({
        name: value.canonicalName,
        status: 'verified',
        id: existing.id ?? null,
        valueFingerprint: fingerprintMaybe(value.value),
      });
      continue;
    }
    if (existing && resolvedSource && liveValue !== value.value) {
      if (!apply) {
        entries.push({
          name: value.canonicalName,
          status: 'missing',
          id: existing.id ?? null,
          valueFingerprint: fingerprintMaybe(liveValue),
          blocker: 'custom_value_update_required',
        });
        continue;
      }
      const updated = await client.request<{ customValue?: GhlCustomValue }>(
        'PUT',
        `/locations/${encodeURIComponent(client.locationId())}/customValues/${encodeURIComponent(
          existing.id ?? '',
        )}`,
        { name: value.canonicalName, value: value.value },
      );
      if (updated.ok) {
        const updatedValue = updated.body.customValue ?? {
          ...(existing.id ? { id: existing.id } : {}),
          name: value.canonicalName,
          value: value.value,
        };
        entries.push({
          name: value.canonicalName,
          status: 'updated',
          id: updatedValue.id ?? existing.id ?? null,
          valueFingerprint: fingerprintMaybe(value.value),
        });
        liveValues = replaceCustomValue(liveValues, updatedValue);
        await delay(250);
        continue;
      }
      entries.push({
        name: value.canonicalName,
        status: 'blocked',
        id: existing.id ?? null,
        valueFingerprint: fingerprintMaybe(liveValue),
        blocker: `custom_value_update_failed:${updated.status}:${updated.code}`,
      });
      continue;
    }
    if (existing && !resolvedSource) {
      entries.push({
        name: value.canonicalName,
        status: 'blocked_ui_or_business_value',
        id: existing.id ?? null,
        valueFingerprint: resolvedLive ? fingerprintMaybe(liveValue) : null,
        blocker: customValueBlocker(value.canonicalName, liveValue),
      });
      continue;
    }
    if (!resolvedSource) {
      entries.push({
        name: value.canonicalName,
        status: 'blocked_ui_or_business_value',
        id: null,
        valueFingerprint: null,
        blocker: customValueBlocker(value.canonicalName, value.value),
      });
      continue;
    }
    if (!apply) {
      entries.push({
        name: value.canonicalName,
        status: 'missing',
        id: value.ghlId || null,
        valueFingerprint: fingerprintMaybe(value.value),
      });
      continue;
    }
    const created = await client.request<{ customValue?: GhlCustomValue }>(
      'POST',
      `/locations/${encodeURIComponent(client.locationId())}/customValues`,
      { name: value.canonicalName, value: value.value },
    );
    if (created.ok) {
      const createdValue = created.body.customValue ?? (created.body as GhlCustomValue);
      entries.push({
        name: value.canonicalName,
        status: 'created',
        id: createdValue.id ?? null,
        valueFingerprint: fingerprintMaybe(value.value),
      });
      liveValues = [...liveValues, createdValue];
      await delay(250);
      continue;
    }
    const refreshed = await listCustomValues(client);
    liveValues = refreshed.ok ? refreshed.body : liveValues;
    const afterCreate = findCustomValue(liveValues, value);
    if (afterCreate) {
      entries.push({
        name: value.canonicalName,
        status: 'verified',
        id: afterCreate.id ?? null,
        valueFingerprint: fingerprintMaybe(afterCreate.value ?? value.value),
      });
      continue;
    }
    entries.push({
      name: value.canonicalName,
      status: 'blocked',
      id: value.ghlId || null,
      valueFingerprint: fingerprintMaybe(value.value),
      blocker: `custom_value_create_failed:${created.status}:${created.code}`,
    });
  }
  return entries;
}

async function ensurePipeline(
  client: HighLevelApiClient,
  createPipeline: boolean,
  updatePipelineStages: boolean,
): Promise<PipelineEntry> {
  const listed = await listPipelines(client);
  if (!listed.ok) {
    return {
      name: oneTimePipeline.name,
      status: 'blocked',
      id: null,
      stages: [],
      blocker: `pipeline_read_failed:${listed.status}:${listed.code}`,
    };
  }
  const existing = findByCanonicalName(listed.body, oneTimePipeline.name);
  if (!existing) {
    if (!createPipeline) {
      return { name: oneTimePipeline.name, status: 'missing', id: null, stages: [] };
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
    if (created.ok) return pipelineEntry('created', created.body.pipeline ?? (created.body as GhlPipeline));
    return {
      name: oneTimePipeline.name,
      status: 'blocked',
      id: null,
      stages: [],
      blocker: `pipeline_create_failed:${created.status}:${created.code}`,
    };
  }
  const missingStageNames = oneTimePipeline.stages
    .map((stage) => stage.name)
    .filter((name) => !findByCanonicalName(existing.stages ?? [], name));
  if (missingStageNames.length === 0) return pipelineEntry('verified', existing);
  if (!updatePipelineStages) {
    return {
      ...pipelineEntry('missing', existing),
      blocker: `pipeline_stages_missing:${missingStageNames.map(normalizeAssetName).join(',')}`,
    };
  }
  const mergedStages = mergePipelineStages(existing.stages ?? []);
  const updated = await client.request<{ pipeline?: GhlPipeline }>(
    'PUT',
    `/opportunities/pipelines/${encodeURIComponent(existing.id ?? '')}`,
    { locationId: client.locationId(), name: oneTimePipeline.name, stages: mergedStages },
  );
  if (updated.ok) return pipelineEntry('updated', updated.body.pipeline ?? (updated.body as GhlPipeline));
  return {
    ...pipelineEntry('blocked', existing),
    blocker: `pipeline_stage_update_failed:${updated.status}:${updated.code}`,
  };
}

async function probeContacts(
  client: HighLevelApiClient,
): Promise<ReconciliationReport['contacts']> {
  const contacts = await client.request<Record<string, unknown>>(
    'GET',
    `/contacts/?locationId=${encodeURIComponent(client.locationId())}&limit=1`,
  );
  if (!contacts.ok) {
    return {
      status: 'blocked',
      count: null,
      blocker: `contact_read_failed:${contacts.status}:${contacts.code}`,
    };
  }
  return {
    status: 'verified',
    count: numericProperty(contacts.body, ['total', 'totalCount', 'count']),
  };
}

async function verifyWorkflows(client: HighLevelApiClient): Promise<WorkflowReport> {
  const result = await client.request<{ workflows?: GhlWorkflow[] }>(
    'GET',
    `/workflows/?locationId=${encodeURIComponent(client.locationId())}`,
  );
  if (!result.ok) {
    return {
      status: 'blocked',
      present: [],
      missing: [...businessWorkflows, ...botActionWorkflows].map((workflow) => workflow.canonicalName),
      deprecated_present: [],
      blocker: `workflow_read_failed:${result.status}:${result.code}`,
    };
  }
  const liveWorkflows = Array.isArray(result.body.workflows) ? result.body.workflows : [];
  const activeWorkflows = [...businessWorkflows, ...botActionWorkflows];
  const present = activeWorkflows
    .map((workflow) => {
      const match = findWorkflow(liveWorkflows, workflow);
      return match
        ? {
            name: workflow.canonicalName,
            id: match.id ?? null,
            status: match.status ?? null,
          }
        : null;
    })
    .filter((workflow): workflow is { name: string; id: string | null; status: string | null } =>
      Boolean(workflow),
    );
  const deprecatedPresent = deprecatedWorkflows
    .map((workflow) => {
      const match = findWorkflow(liveWorkflows, workflow);
      return match
        ? {
            name: workflow.canonicalName,
            id: match.id ?? null,
            status: match.status ?? null,
          }
        : null;
    })
    .filter((workflow): workflow is { name: string; id: string | null; status: string | null } =>
      Boolean(workflow),
    );
  return {
    status: present.length === activeWorkflows.length ? 'verified' : 'ui_required',
    present,
    missing: activeWorkflows
      .filter((workflow) => !present.some((entry) => entry.name === workflow.canonicalName))
      .map((workflow) => workflow.canonicalName),
    deprecated_present: deprecatedPresent,
  };
}

async function listCustomFields(client: HighLevelApiClient): Promise<GhlResult<GhlCustomField[]>> {
  const response = await client.request<{ customFields?: GhlCustomField[] }>(
    'GET',
    `/locations/${encodeURIComponent(client.locationId())}/customFields`,
  );
  if (!response.ok) return response;
  return {
    ok: true,
    status: response.status,
    body: Array.isArray(response.body.customFields) ? response.body.customFields : [],
  };
}

async function listTags(client: HighLevelApiClient): Promise<GhlResult<GhlTag[]>> {
  const response = await client.request<{ tags?: GhlTag[] }>(
    'GET',
    `/locations/${encodeURIComponent(client.locationId())}/tags`,
  );
  if (!response.ok) return response;
  return {
    ok: true,
    status: response.status,
    body: Array.isArray(response.body.tags) ? response.body.tags : [],
  };
}

async function listCustomValues(client: HighLevelApiClient): Promise<GhlResult<GhlCustomValue[]>> {
  const response = await client.request<{ customValues?: GhlCustomValue[] }>(
    'GET',
    `/locations/${encodeURIComponent(client.locationId())}/customValues`,
  );
  if (!response.ok) return response;
  return {
    ok: true,
    status: response.status,
    body: Array.isArray(response.body.customValues) ? response.body.customValues : [],
  };
}

async function listPipelines(client: HighLevelApiClient): Promise<GhlResult<GhlPipeline[]>> {
  const response = await client.request<{ pipelines?: GhlPipeline[] }>(
    'GET',
    `/opportunities/pipelines?locationId=${encodeURIComponent(client.locationId())}`,
  );
  if (!response.ok) return response;
  return {
    ok: true,
    status: response.status,
    body: Array.isArray(response.body.pipelines) ? response.body.pipelines : [],
  };
}

function buildUpdatedRegistry(current: CurrentRegistry, report: ReconciliationReport): CurrentRegistry {
  const reportFields = byName(report.customFields);
  const reportTags = byName(report.tags);
  const reportCustomValues = byName(report.customValues);
  const reportWorkflowIds = workflowIdMap(report.workflows);
  const contactFieldRecords = contactFields.map((field) => {
    const entry = reportFields.get(field.canonicalName);
    const isLive = entry?.status === 'verified' || entry?.status === 'created';
    const id = entry?.id ?? field.ghlId;
    const fieldKey = entry?.fieldKey ?? field.ghlKey;
    const deprecationState: AssetStatus =
      field.deprecationState === 'deprecated_existing'
        ? 'deprecated_existing'
        : isLive
          ? 'active'
          : field.deprecationState;
    return {
      ...field,
      ghlId: id ?? '',
      ghlKey: fieldKey ?? field.ghlKey,
      deprecationState,
      lastVerifiedDate: isLive ? today : field.lastVerifiedDate,
      lastTestedDate: isLive ? today : field.lastTestedDate,
    };
  });
  const tagRecords = canonicalTags.map((tag) => {
    const entry = reportTags.get(tag.canonicalName);
    const isLive = entry?.status === 'verified' || entry?.status === 'created';
    const deprecationState: AssetStatus =
      tag.deprecationState === 'deprecated_existing'
        ? 'deprecated_existing'
        : isLive
          ? 'active'
          : tag.deprecationState;
    return {
      ...tag,
      ghlId: entry?.id ?? tag.ghlId,
      deprecationState,
      lastVerifiedDate: isLive ? today : tag.lastVerifiedDate,
      lastTestedDate: isLive ? today : tag.lastTestedDate,
    };
  });
  const customValueRecords = customValues.map((value) => {
    const entry = reportCustomValues.get(value.canonicalName);
    const currentValue = current.custom_values.find(
      (candidate) => candidate.canonicalName === value.canonicalName,
    );
    const liveResolvedValue = currentValue?.value && isResolvedCustomValue(currentValue.value)
      ? currentValue.value
      : value.value;
    const isLive = entry?.status === 'verified' || entry?.status === 'created' || entry?.status === 'updated';
    const isBlocked = entry?.status === 'blocked_ui_or_business_value' || !isResolvedCustomValue(liveResolvedValue);
    const status: AssetStatus = isLive && !isBlocked ? 'active' : isBlocked ? 'blocked_ui_or_business_value' : value.deprecationState;
    return {
      ...value,
      ghlId: entry?.id ?? value.ghlId,
      value: isResolvedCustomValue(liveResolvedValue) ? liveResolvedValue : '',
      deprecationState: status,
      lastVerifiedDate: isLive ? today : value.lastVerifiedDate,
      lastTestedDate: isLive ? today : value.lastTestedDate,
      ...(entry?.blocker ? { blocker: entry.blocker } : {}),
      ...(entry?.valueFingerprint ? { liveValueFingerprint: entry.valueFingerprint } : {}),
    };
  });
  const business = businessWorkflows.map((workflow) => workflowWithLiveId(workflow, reportWorkflowIds));
  const botActions = botActionWorkflows.map((workflow) =>
    workflowWithLiveId(workflow, reportWorkflowIds),
  );
  const deprecated = deprecatedWorkflows.map((workflow) =>
    workflowWithLiveId(workflow, reportWorkflowIds),
  );

  return {
    ...current,
    generated_at: generatedAt,
    location_id: registryMetadata.locationId,
    counts: registryCounts(contactFieldRecords, tagRecords, customValueRecords),
    standard_contact_fields: standardContactFields,
    contact_fields: contactFieldRecords,
    tags: tagRecords,
    custom_values: customValueRecords,
    business_workflows: business,
    bot_action_workflows: botActions,
    deprecated_workflows: deprecated,
    deprecations: lowercaseTagDeprecations,
    protected_import_paths: protectedImportPaths,
    safety: {
      ...current.safety,
      messages_sent: 0,
      workflows_published: 0,
      production_workflow_enrollments: 0,
      stripe_mutations: 0,
      student_contacts_allowed_in_highlevel: false,
      voice_ai_launch_active: false,
      human_handoff_workflow_active: false,
      human_task_creation_active: false,
    },
  };
}

async function writeReports(report: ReconciliationReport) {
  await mkdir(path.dirname(args.privateReportFile), { recursive: true });
  await writeFile(args.privateReportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await mkdir(path.dirname(path.join(repoRoot, args.publicReportFile)), { recursive: true });
  await writeFile(
    path.join(repoRoot, args.publicReportFile),
    `${JSON.stringify(publicReport(report), null, 2)}\n`,
    'utf8',
  );
}

async function writeRegistryFiles(current: CurrentRegistry, report: ReconciliationReport) {
  await writeRepoFile('integrations/highlevel/registry/current.json', `${JSON.stringify(current, null, 2)}\n`);
  await writeRepoFile('integrations/highlevel/registry/custom-fields.yaml', yaml(current.contact_fields));
  await writeRepoFile('integrations/highlevel/registry/custom-values.yaml', yaml(current.custom_values));
  await writeRepoFile('integrations/highlevel/registry/tag-taxonomy.yaml', yaml(current.tags));
  await writeRepoFile(
    'integrations/highlevel/registry/workflow-registry.yaml',
    yaml({
      business_workflows: current.business_workflows,
      bot_action_workflows: current.bot_action_workflows,
      deprecated_workflows: current.deprecated_workflows,
      publishing_authorized: false,
      production_enrollment_authorized: false,
      duplicate_workflows_disabled_in_this_run: 0,
      human_task_workflows_active: 0,
      read_only_workflow_api_status: report.workflows.status,
      workflow_ui_missing: report.workflows.missing,
    }),
  );
  await writeRepoFile(
    'integrations/highlevel/registry/bot-action-registry.yaml',
    yaml(botActionContracts(current.bot_action_workflows)),
  );
  await writeRepoFile('integrations/highlevel/registry/prompt-registry.yaml', yaml(current.prompts));
  await writeRepoFile(
    'integrations/highlevel/registry/knowledge-base-registry.yaml',
    yaml(current.knowledge_bases),
  );
  await writeRepoFile('integrations/highlevel/workflows.yaml', buildWorkflowsYaml(current, report));
  await writeRepoFile(
    'integrations/highlevel/registry/AGENT-HANDOFF.md',
    buildAgentHandoff(current, report),
  );
}

function publicReport(report: ReconciliationReport) {
  return {
    generatedAt: report.generatedAt,
    mode: report.mode,
    location: {
      status: report.location.status,
      locationId: report.location.id,
      safeRef: report.location.safeRef,
      timezone: report.location.timezone,
      country: report.location.country,
      ...(report.location.blocker ? { blocker: report.location.blocker } : {}),
    },
    credentials: report.credentials,
    customFields: summarizeEntries(report.customFields),
    tags: summarizeEntries(report.tags),
    customValues: summarizeEntries(report.customValues),
    pipeline: report.pipeline,
    contacts: report.contacts,
    workflows: {
      status: report.workflows.status,
      present: report.workflows.present.length,
      missing: report.workflows.missing.length,
      deprecatedPresent: report.workflows.deprecated_present.length,
      ...(report.workflows.blocker ? { blocker: report.workflows.blocker } : {}),
    },
    testContact: report.testContact,
    externalEffects: report.externalEffects,
    blockers: report.blockers,
    protectedOutputs: {
      privateReport: args.privateReportFile,
      importDirectory: protectedImportPaths.directory,
      manifest: protectedImportPaths.manifest,
      contactMap: protectedImportPaths.contactMap,
      errors: protectedImportPaths.errors,
      reconciliation: protectedImportPaths.reconciliation,
    },
    safety: {
      pitPrinted: false,
      messagesSent: 0,
      workflowEnrollments: 0,
      workflowsPublished: 0,
      stripeMutations: 0,
      studentContactsCreated: 0,
    },
  };
}

function hardBlockers(report: ReconciliationReport) {
  return report.blockers.filter(
    (blocker) =>
      blocker !== 'workflow_ui_setup_required' &&
      !blocker.startsWith('blocked_ui_or_business_value:'),
  );
}

function workflowWithLiveId(workflow: RegistryWorkflow, ids: Map<string, string>): RegistryWorkflow {
  const id = ids.get(workflow.canonicalName) ?? workflow.ghlId;
  const live = Boolean(id);
  const deprecationState: AssetStatus =
    workflow.deprecationState === 'deprecated_existing'
      ? 'deprecated_existing'
      : live
        ? 'active'
        : workflow.deprecationState;
  return {
    ...workflow,
    ghlId: id,
    deprecationState,
    lastVerifiedDate: live ? today : workflow.lastVerifiedDate,
    lastTestedDate: live ? today : workflow.lastTestedDate,
  };
}

function registryCounts(
  fields: RegistryField[],
  tags: RegistryTag[],
  values: RegistryCustomValueRecord[],
) {
  return {
    standard_contact_fields: standardContactFields.length,
    contact_custom_fields: fields.length,
    active_contact_custom_fields: fields.filter((field) => field.deprecationState === 'active')
      .length,
    pending_contact_custom_fields: fields.filter(
      (field) => field.deprecationState === 'pending_creation',
    ).length,
    deprecated_contact_custom_fields: fields.filter(
      (field) => field.deprecationState === 'deprecated_existing',
    ).length,
    tags: tags.length,
    active_tags: tags.filter((tag) => tag.deprecationState === 'active').length,
    pending_tags: tags.filter((tag) => tag.deprecationState === 'pending_creation').length,
    deprecated_tags: tags.filter((tag) => tag.deprecationState === 'deprecated_existing').length,
    custom_values: values.length,
    active_custom_values: values.filter((value) => value.deprecationState === 'active').length,
    blocked_custom_values: values.filter(
      (value) => value.deprecationState === 'blocked_ui_or_business_value',
    ).length,
    business_workflows: businessWorkflows.length,
    bot_action_workflows: botActionWorkflows.length,
    deprecated_workflows: deprecatedWorkflows.length,
  };
}

function buildWorkflowsYaml(current: CurrentRegistry, report: ReconciliationReport) {
  return yaml({
    version: 5,
    schema_id: registryMetadata.schemaId,
    schema_version: registryMetadata.schemaVersion,
    status:
      report.workflows.status === 'verified'
        ? 'api_reconciled_workflows_verified'
        : 'api_reconciled_ui_required',
    location_id: registryMetadata.locationId,
    last_reconciled_at: generatedAt,
    messages_sent_authorized: false,
    workflow_publish_authorized: false,
    production_workflow_enrollment_authorized: false,
    workflow_folders: unique(
      [...current.business_workflows, ...current.bot_action_workflows].map(
        (workflow) => workflow.folder,
      ),
    ).map((name) => ({ name })),
    custom_fields: current.contact_fields,
    tags: current.tags,
    custom_values: current.custom_values,
    pipeline: {
      name: oneTimePipeline.name,
      id: report.pipeline.id ?? '',
      stages: report.pipeline.stages,
      reconciliation_status: report.pipeline.status,
    },
    canonical_bot: {
      id: 'OT-A1',
      name: 'OT-A1 One Time Enrollment Assistant',
      prompt_file: 'integrations/highlevel/prompts/active/OT-A1-v1.0.0.md',
      knowledge_base_file:
        'integrations/highlevel/knowledge-bases/active/one-time-public-kb-v1.0.0.md',
      channels: ['Website Live Chat', 'WhatsApp'],
      voice_ai: 'deferred',
      human_handoff_action: false,
      task_creation_action: false,
    },
    workflows: [...current.business_workflows, ...current.bot_action_workflows],
    deprecated_workflows: current.deprecated_workflows,
    contact_import: protectedImportPaths,
  });
}

function buildAgentHandoff(current: CurrentRegistry, report: ReconciliationReport) {
  return [
    'Before creating or changing a One Time HighLevel field, tag, custom value, workflow, form mapping, bot prompt, knowledge base or contact import, read the canonical registry under `integrations/highlevel/registry/`. Do not create an unregistered asset.',
    '',
    '# One Time HighLevel Agent Handoff',
    '',
    `Canonical schema: ${registryMetadata.schemaId}@${registryMetadata.schemaVersion}`,
    `Canonical location ID: ${registryMetadata.locationId}`,
    `Last API reconciliation: ${report.generatedAt}`,
    '',
    'Required starting files:',
    '- `integrations/highlevel/registry/current.json`',
    '- `integrations/highlevel/registry/custom-fields.yaml`',
    '- `integrations/highlevel/registry/tag-taxonomy.yaml`',
    '- `integrations/highlevel/registry/custom-values.yaml`',
    '- `integrations/highlevel/registry/workflow-registry.yaml`',
    '- `integrations/highlevel/agent-mode/GHL-AGENT-MODE-QUEUE.json`',
    '',
    'Canonical bot:',
    '- OT-A1 One Time Enrollment Assistant.',
    '- Channels: Website Live Chat and WhatsApp.',
    '- Voice AI deferred.',
    '- No Human Handover action.',
    '- No task-creation action.',
    '- No separate WhatsApp lead-qualification bot or workflow.',
    '',
    'Workflow boundary:',
    '- Business workflows: OT-01, OT-02A, OT-02B, OT-03, OT-04, OT-05, OT-06, OT-07, OT-08, OT-09, OT-10, OT-13.',
    '- Bot-action workflows: OT-B01, OT-B02, OT-B03, OT-B04, OT-B05.',
    '- Deprecated: OT-11, OT-12 when it creates tasks, OT - Human Handoff and duplicate lead-capture workflows.',
    '',
    'Prompt boundary:',
    '- Do not overwrite an active prompt with another agent prompt.',
    '- Store incoming prompts under `integrations/highlevel/prompts/incoming/`, diff them against the active prompt, then promote explicitly.',
    '- Store knowledge-base changes under `integrations/highlevel/knowledge-bases/incoming/` until approved.',
    '',
    'Current safe counts:',
    `- Contact custom fields: ${current.counts.contact_custom_fields} total, ${current.counts.active_contact_custom_fields} active, ${current.counts.pending_contact_custom_fields} pending.`,
    `- Tags: ${current.counts.tags} total, ${current.counts.active_tags} active, ${current.counts.pending_tags} pending.`,
    `- Custom values: ${current.counts.custom_values} total, ${current.counts.active_custom_values ?? 0} active, ${current.counts.blocked_custom_values ?? 0} blocked pending UI/business value.`,
    `- Agent Mode jobs: 14 expected under integrations/highlevel/agent-mode/jobs/.`,
    '',
    'Safety:',
    '- Do not create Student contacts, Student fields or Student tags in HighLevel.',
    '- Do not send messages, publish workflows, enroll production contacts, mutate Stripe or expose private One Time links unless a later task explicitly authorizes the exact action.',
    '- Reconcile protected import manifest and contact map before any contact import write.',
    '',
  ].join('\n');
}

function botActionContracts(workflows: RegistryWorkflow[]) {
  return {
    bot_id: 'OT-A1',
    bot_name: 'OT-A1 One Time Enrollment Assistant',
    actions: workflows.map((workflow) => ({
      key: workflow.key,
      name: workflow.canonicalName.replace(`${workflow.key} `, ''),
      workflow_id: workflow.ghlId,
      adapter_required: true,
      student_data_allowed: false,
      messages_authorized_in_this_lane: false,
    })),
  };
}

function fieldEntry(status: ReconcileAssetStatus, name: string, field: GhlCustomField): FieldEntry {
  return {
    name,
    status,
    id: field.id ?? null,
    fieldKey: field.fieldKey ?? null,
    dataType: field.dataType ?? null,
  };
}

function tagEntry(status: ReconcileAssetStatus, name: string, tag: GhlTag): TagEntry {
  return { name, status, id: tag.id ?? null };
}

function pipelineEntry(status: PipelineEntry['status'], pipeline: GhlPipeline): PipelineEntry {
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

function findCustomField(items: GhlCustomField[], field: RegistryField) {
  return items.find((item) =>
    [item.name, item.fieldKey?.replace(/^contact\./, '')].some((candidate) =>
      candidateMatches(candidate, [field.canonicalName, ...field.aliases]),
    ),
  );
}

function findTag(items: GhlTag[], tag: RegistryTag) {
  return items.find((item) => candidateMatches(item.name, [tag.canonicalName, ...tag.aliases]));
}

function findCustomValue(items: GhlCustomValue[], value: RegistryCustomValue) {
  return items.find((item) =>
    candidateMatches(item.name, [value.canonicalName, value.ghlKey, ...value.aliases]),
  );
}

function findWorkflow(items: GhlWorkflow[], workflow: RegistryWorkflow) {
  return items.find((item) =>
    candidateMatches(item.name, [workflow.canonicalName, workflow.ghlKey, ...workflow.aliases]),
  );
}

function findByCanonicalName<T extends { name?: string }>(items: T[], name: string) {
  return items.find((item) => normalizeAssetName(item.name ?? '') === normalizeAssetName(name));
}

function candidateMatches(candidate: string | undefined, canonicalNames: string[]) {
  if (!candidate) return false;
  const normalizedCandidate = normalizeAssetName(candidate.replace(/^contact\./, ''));
  return canonicalNames.some((name) => normalizeAssetName(name) === normalizedCandidate);
}

function replaceCustomValue(values: GhlCustomValue[], updated: GhlCustomValue) {
  return values.map((value) => (value.id && value.id === updated.id ? updated : value));
}

function mergePipelineStages(existing: GhlPipelineStage[]) {
  const stages = [...existing];
  for (const required of oneTimePipeline.stages) {
    if (!findByCanonicalName(stages, required.name)) stages.push(required);
  }
  return stages.map((stage, index) => ({
    ...(stage.id ? { id: stage.id } : {}),
    name: stage.name ?? `Stage ${index + 1}`,
    position: stage.position ?? index,
  }));
}

function workflowIdMap(workflows: WorkflowReport) {
  const map = new Map<string, string>();
  for (const workflow of [...workflows.present, ...workflows.deprecated_present]) {
    if (workflow.id) map.set(workflow.name, workflow.id);
  }
  return map;
}

function byName<T extends { name: string }>(entries: T[]) {
  return new Map(entries.map((entry) => [entry.name, entry]));
}

function hasBlocker<T extends { blocker?: string }>(entry: T): entry is T & { blocker: string } {
  return Boolean(entry.blocker);
}

function summarizeEntries(entries: Array<{ status: string; id?: string | null }>) {
  return {
    total: entries.length,
    verified: entries.filter((entry) => entry.status === 'verified').length,
    created: entries.filter((entry) => entry.status === 'created').length,
    updated: entries.filter((entry) => entry.status === 'updated').length,
    missing: entries.filter((entry) => entry.status === 'missing').length,
    blocked: entries.filter(
      (entry) => entry.status === 'blocked' || entry.status === 'blocked_ui_or_business_value',
    ).length,
    deprecatedExisting: entries.filter((entry) => entry.status === 'deprecated_existing').length,
    idsRecorded: entries.filter((entry) => Boolean(entry.id)).length,
  };
}

function isResolvedCustomValue(value: string) {
  const normalized = value.trim().toUpperCase();
  return Boolean(value.trim()) &&
    !normalized.startsWith('PENDING_') &&
    normalized !== 'TODO' &&
    normalized !== 'CHANGEME';
}

function customValueBlocker(name: string, liveValue: string) {
  if (isResolvedCustomValue(liveValue)) return 'blocked_ui_or_business_value:canonical_review_required';
  if (/url/i.test(name)) return 'blocked_ui_or_business_value:verified_url_missing';
  if (/price|promotion|schedule/i.test(name)) {
    return 'blocked_ui_or_business_value:approved_business_copy_missing';
  }
  return 'blocked_ui_or_business_value:approved_value_missing';
}

function fingerprintMaybe(value: string) {
  return value ? sha256(value).slice(0, 16) : null;
}

async function readCurrentRegistry(): Promise<CurrentRegistry> {
  return JSON.parse(
    await readFile(path.join(repoRoot, 'integrations/highlevel/registry/current.json'), 'utf8'),
  ) as CurrentRegistry;
}

async function readCredentials(privateDir: string): Promise<Credentials> {
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

function numericProperty(value: unknown, names: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const object = value as Record<string, unknown>;
  for (const name of names) {
    const candidate = object[name];
    if (typeof candidate === 'number') return candidate;
  }
  return null;
}

function providerErrorCode(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'provider_error';
  const object = value as Record<string, unknown>;
  const candidate = object.code ?? object.error ?? object.message;
  return typeof candidate === 'string' ? redactProviderMessage(candidate) : 'provider_error';
}

function providerErrorMessage(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'provider_error';
  const object = value as Record<string, unknown>;
  const candidate = object.message ?? object.error ?? object.code;
  return typeof candidate === 'string' ? redactProviderMessage(candidate) : 'provider_error';
}

function redactProviderMessage(value: string) {
  return value
    .replace(/pit-[a-z0-9-]+/gi, '[REDACTED:PIT]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, '[REDACTED_PHONE]')
    .slice(0, 180);
}

function retryDelayMs(attempt: number, retryAfter: string | null) {
  const retryAfterSeconds = retryAfter ? Number(retryAfter) : Number.NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(12_000, retryAfterSeconds * 1000);
  }
  return Math.min(12_000, 750 * 2 ** attempt);
}

function parseArgs(argv: string[]): Args {
  const parsed: Args = {
    apply: false,
    createPipeline: false,
    updatePipelineStages: false,
    privateDir: 'C:/Users/User/.onetime-highlevel-private',
    privateReportFile: 'C:/Users/User/.onetime-highlevel-private/activation-api-finalize-report.json',
    publicReportFile: 'integrations/highlevel/registry/api-reconciliation-report.json',
    skipRegistryWrite: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value) continue;
    if (value === '--apply') parsed.apply = true;
    else if (value === '--create-pipeline') parsed.createPipeline = true;
    else if (value === '--update-pipeline-stages') parsed.updatePipelineStages = true;
    else if (value === '--skip-registry-write') parsed.skipRegistryWrite = true;
    else if (value === '--private-dir') parsed.privateDir = argv[(index += 1)] ?? parsed.privateDir;
    else if (value === '--private-report') {
      parsed.privateReportFile = argv[(index += 1)] ?? parsed.privateReportFile;
    } else if (value === '--public-report') {
      parsed.publicReportFile = argv[(index += 1)] ?? parsed.publicReportFile;
    } else if (value.startsWith('--private-dir=')) {
      parsed.privateDir = value.slice('--private-dir='.length);
    } else if (value.startsWith('--private-report=')) {
      parsed.privateReportFile = value.slice('--private-report='.length);
    } else if (value.startsWith('--public-report=')) {
      parsed.publicReportFile = value.slice('--public-report='.length);
    }
  }
  return parsed;
}

async function writeRepoFile(filePath: string, body: string) {
  const absolute = path.join(repoRoot, filePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, body, 'utf8');
}

function yaml(value: unknown) {
  return `${yamlNode(value, 0)}\n`;
}

function yamlNode(value: unknown, indent: number): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return `${spaces(indent)}[]`;
    return value
      .map((entry) => {
        if (isScalar(entry)) return `${spaces(indent)}- ${yamlScalar(entry)}`;
        return `${spaces(indent)}-\n${yamlNode(entry, indent + 2)}`;
      })
      .join('\n');
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return `${spaces(indent)}{}`;
    return entries
      .map(([key, entry]) => {
        if (isScalar(entry)) return `${spaces(indent)}${key}: ${yamlScalar(entry)}`;
        return `${spaces(indent)}${key}:\n${yamlNode(entry, indent + 2)}`;
      })
      .join('\n');
  }
  return `${spaces(indent)}${yamlScalar(value)}`;
}

function yamlScalar(value: unknown) {
  if (value === null || value === undefined) return "''";
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function isScalar(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function spaces(count: number) {
  return ' '.repeat(count);
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort();
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function writeStdoutJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
