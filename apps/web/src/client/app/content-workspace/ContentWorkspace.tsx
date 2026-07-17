import React, { useEffect, useMemo, useState } from 'react';
import type {
  ContentAdminActivityEvent,
  ContentAdminActivityResponse,
  ContentAdminArtifactKind,
  ContentAdminCreateGenerationResponse,
  ContentAdminCreateWorkspaceResponse,
  ContentAdminKnowledgeResponse,
  ContentAdminOverviewResponse,
  ContentAdminProcessingResponse,
  ContentAdminPromptListResponse,
  ContentAdminPromptPreviewResponse,
  ContentAdminPromptTemplate,
  ContentAdminPromptVersion,
  ContentAdminProviderPortStatus,
  ContentAdminSocialWorkspaceResponse,
  ContentAdminSourceDetail,
  ContentAdminSourceDetailResponse,
  ContentAdminSourceSummary,
} from '@onetime/contracts';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterStrip,
  Input,
  LoadingState,
  Select,
  Table,
} from '@onetime/brand-system/react';
import './content-workspace.css';

type RouteKind =
  'overview' | 'processing' | 'create' | 'social' | 'knowledge' | 'prompts' | 'activity' | 'detail';

type RouteState = {
  kind: RouteKind;
  sourceKey?: string;
};

type ContentWorkspaceProps = {
  csrfToken: string;
  path: string;
  onNavigate: (href: string) => void;
  onProtectedStateCleared: () => void;
};

type FilterState = {
  search: string;
  lifecycle_stage: string;
  item_type: string;
  sort: string;
};

const navItems: Array<{ href: string; label: string; kind: RouteKind }> = [
  { href: '/app/content', label: 'Overview', kind: 'overview' },
  { href: '/app/content/processing', label: 'Processing', kind: 'processing' },
  { href: '/app/content/create', label: 'Create', kind: 'create' },
  { href: '/app/content/social', label: 'Social', kind: 'social' },
  { href: '/app/content/knowledge', label: 'Knowledge', kind: 'knowledge' },
  { href: '/app/content/prompts', label: 'Prompts', kind: 'prompts' },
  { href: '/app/content/activity', label: 'Activity', kind: 'activity' },
];

const artifactKinds: ContentAdminArtifactKind[] = [
  'lesson_summary',
  'review_sheet',
  'worksheet',
  'newsletter_email',
  'social_caption',
  'short_clip_plan',
  'helper_knowledge',
  'classroom_resource',
];

const defaultFilters: FilterState = {
  search: '',
  lifecycle_stage: '',
  item_type: '',
  sort: 'updated_desc',
};

export function ContentWorkspace({
  csrfToken,
  path,
  onNavigate,
  onProtectedStateCleared,
}: ContentWorkspaceProps) {
  const route = routeFromPath(path);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(defaultFilters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [overview, setOverview] = useState<ContentAdminOverviewResponse | null>(null);
  const [processing, setProcessing] = useState<ContentAdminProcessingResponse | null>(null);
  const [createData, setCreateData] = useState<ContentAdminCreateWorkspaceResponse | null>(null);
  const [social, setSocial] = useState<ContentAdminSocialWorkspaceResponse | null>(null);
  const [knowledge, setKnowledge] = useState<ContentAdminKnowledgeResponse | null>(null);
  const [prompts, setPrompts] = useState<ContentAdminPromptListResponse | null>(null);
  const [activity, setActivity] = useState<ContentAdminActivityResponse | null>(null);
  const [detail, setDetail] = useState<ContentAdminSourceDetail | null>(null);

  const filterKey = useMemo(() => JSON.stringify(appliedFilters), [appliedFilters]);

  useEffect(() => {
    void loadRoute();
  }, [path, filterKey]);

  async function loadRoute() {
    setLoading(true);
    setError('');
    try {
      if (route.kind === 'overview') {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(appliedFilters)) {
          if (value) query.set(key, value);
        }
        setOverview(
          await apiGet<ContentAdminOverviewResponse>(
            `/api/v1/admin/content/workspace?${query.toString()}`,
            onProtectedStateCleared,
          ),
        );
      } else if (route.kind === 'processing') {
        setProcessing(
          await apiGet<ContentAdminProcessingResponse>(
            '/api/v1/admin/content/processing',
            onProtectedStateCleared,
          ),
        );
      } else if (route.kind === 'create') {
        setCreateData(
          await apiGet<ContentAdminCreateWorkspaceResponse>(
            '/api/v1/admin/content/create',
            onProtectedStateCleared,
          ),
        );
      } else if (route.kind === 'social') {
        setSocial(
          await apiGet<ContentAdminSocialWorkspaceResponse>(
            '/api/v1/admin/content/social',
            onProtectedStateCleared,
          ),
        );
      } else if (route.kind === 'knowledge') {
        setKnowledge(
          await apiGet<ContentAdminKnowledgeResponse>(
            '/api/v1/admin/content/knowledge',
            onProtectedStateCleared,
          ),
        );
      } else if (route.kind === 'prompts') {
        setPrompts(
          await apiGet<ContentAdminPromptListResponse>(
            '/api/v1/admin/content/prompts',
            onProtectedStateCleared,
          ),
        );
      } else if (route.kind === 'activity') {
        setActivity(
          await apiGet<ContentAdminActivityResponse>(
            '/api/v1/admin/content/activity',
            onProtectedStateCleared,
          ),
        );
      } else if (route.sourceKey) {
        const response = await apiGet<ContentAdminSourceDetailResponse>(
          `/api/v1/admin/content/sources/${encodeURIComponent(route.sourceKey)}`,
          onProtectedStateCleared,
        );
        setDetail(response.source);
      }
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  async function postSourceAction(sourceKey: string, action: string, reason: string) {
    setNotice('');
    await apiPost(
      `/api/v1/admin/content/sources/${encodeURIComponent(sourceKey)}/${action}`,
      { reason },
      csrfToken,
      onProtectedStateCleared,
    );
    setNotice('Action recorded.');
    await loadRoute();
  }

  return (
    <section className="content-workspace" data-usable="content-workspace">
      <nav className="content-tabs" aria-label="Content workspace">
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            aria-current={route.kind === item.kind ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(item.href);
            }}
          >
            {item.label}
          </a>
        ))}
      </nav>
      {notice && (
        <p className="notice-banner success" role="status">
          {notice}
        </p>
      )}
      {loading && <LoadingState label="Loading content workspace" />}
      {!loading && error && (
        <ErrorState
          title="Content workspace unavailable"
          body={error}
          action={
            <Button type="button" variant="primary" onClick={() => void loadRoute()}>
              Retry
            </Button>
          }
        />
      )}
      {!loading && !error && route.kind === 'overview' && overview && (
        <OverviewView
          data={overview}
          filters={filters}
          onFiltersChange={setFilters}
          onApplyFilters={() => setAppliedFilters(filters)}
          onOpen={(sourceKey) => onNavigate(`/app/content/${encodeURIComponent(sourceKey)}`)}
        />
      )}
      {!loading && !error && route.kind === 'processing' && processing && (
        <ProcessingView
          data={processing}
          onRetry={(sourceKey) => postSourceAction(sourceKey, 'retry', 'Retry from admin queue')}
        />
      )}
      {!loading && !error && route.kind === 'create' && createData && (
        <CreateView
          data={createData}
          csrfToken={csrfToken}
          onProtectedStateCleared={onProtectedStateCleared}
          onCreated={async () => {
            setNotice('Draft generated for review.');
            await loadRoute();
          }}
        />
      )}
      {!loading && !error && route.kind === 'social' && social && <SocialView data={social} />}
      {!loading && !error && route.kind === 'knowledge' && knowledge && (
        <KnowledgeView data={knowledge} />
      )}
      {!loading && !error && route.kind === 'prompts' && prompts && (
        <PromptRegistryView
          data={prompts}
          csrfToken={csrfToken}
          onProtectedStateCleared={onProtectedStateCleared}
          onChanged={async () => {
            setNotice('Prompt registry updated.');
            await loadRoute();
          }}
        />
      )}
      {!loading && !error && route.kind === 'activity' && activity && (
        <ActivityView events={activity.events} />
      )}
      {!loading && !error && route.kind === 'detail' && detail && (
        <SourceDetailView
          source={detail}
          onBack={() => onNavigate('/app/content')}
          onAction={(action, reason) => postSourceAction(detail.source_key, action, reason)}
        />
      )}
    </section>
  );
}

function OverviewView({
  data,
  filters,
  onFiltersChange,
  onApplyFilters,
  onOpen,
}: {
  data: ContentAdminOverviewResponse;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onApplyFilters: () => void;
  onOpen: (sourceKey: string) => void;
}) {
  return (
    <>
      <ProviderPorts ports={data.provider_ports} />
      <section className="content-counts" aria-label="Content counts">
        {Object.entries(data.counts).map(([key, value]) => (
          <Card key={key} className="content-stat-card">
            <span>{readable(key)}</span>
            <strong>{value}</strong>
          </Card>
        ))}
      </section>
      <form
        className="content-filter-form"
        onSubmit={(event) => {
          event.preventDefault();
          onApplyFilters();
        }}
      >
        <FilterStrip>
          <label>
            <span>Search</span>
            <Input
              value={filters.search}
              onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            />
          </label>
          <label>
            <span>Status</span>
            <Select
              value={filters.lifecycle_stage}
              onChange={(event) =>
                onFiltersChange({ ...filters, lifecycle_stage: event.target.value })
              }
            >
              <option value="">All</option>
              <option value="transcript_review">Transcript review</option>
              <option value="artifact_review">Artifact review</option>
              <option value="published">Published</option>
              <option value="failed">Failed</option>
            </Select>
          </label>
          <label>
            <span>Type</span>
            <Select
              value={filters.item_type}
              onChange={(event) => onFiltersChange({ ...filters, item_type: event.target.value })}
            >
              <option value="">All</option>
              <option value="video">Video</option>
              <option value="sheet">Sheet</option>
              <option value="source">Source</option>
              <option value="review">Review</option>
            </Select>
          </label>
          <label>
            <span>Sort</span>
            <Select
              value={filters.sort}
              onChange={(event) => onFiltersChange({ ...filters, sort: event.target.value })}
            >
              <option value="updated_desc">Updated newest</option>
              <option value="updated_asc">Updated oldest</option>
              <option value="title_asc">Title</option>
            </Select>
          </label>
          <Button type="submit" variant="primary">
            Apply
          </Button>
        </FilterStrip>
      </form>
      <SourceList sources={data.sources} onOpen={onOpen} />
    </>
  );
}

function ProcessingView({
  data,
  onRetry,
}: {
  data: ContentAdminProcessingResponse;
  onRetry: (sourceKey: string) => Promise<void>;
}) {
  return (
    <>
      <ProviderPorts ports={data.provider_ports} />
      {data.items.length === 0 ? (
        <EmptyState
          title="Processing queue is clear"
          body="No source is waiting on local intake."
        />
      ) : (
        <section className="content-stack">
          {data.items.map((item) => (
            <Card key={item.source_key} className="content-row-card">
              <div>
                <h2>{item.title}</h2>
                <p>{readable(item.lifecycle_stage)}</p>
              </div>
              <Badge>{item.provider_state}</Badge>
              <Button
                type="button"
                variant="secondary"
                disabled={!item.retry_eligible}
                onClick={() => void onRetry(item.source_key)}
              >
                Retry
              </Button>
            </Card>
          ))}
        </section>
      )}
    </>
  );
}

function CreateView({
  data,
  csrfToken,
  onProtectedStateCleared,
  onCreated,
}: {
  data: ContentAdminCreateWorkspaceResponse;
  csrfToken: string;
  onProtectedStateCleared: () => void;
  onCreated: () => Promise<void>;
}) {
  const firstTemplate = data.prompt_templates[0];
  const [sourceKey, setSourceKey] = useState(data.eligible_sources[0]?.source_key ?? '');
  const [artifactKind, setArtifactKind] = useState<ContentAdminArtifactKind>(
    firstTemplate?.artifact_kind ?? 'lesson_summary',
  );
  const [promptVersionKey, setPromptVersionKey] = useState(firstTemplate?.active_version_key ?? '');
  const [reason, setReason] = useState('Admin generated draft for review.');
  const [saving, setSaving] = useState(false);

  const compatibleTemplates = data.prompt_templates.filter(
    (template) => template.artifact_kind === artifactKind,
  );

  useEffect(() => {
    const next = compatibleTemplates[0]?.active_version_key ?? '';
    if (
      next &&
      !compatibleTemplates.some((template) => template.active_version_key === promptVersionKey)
    ) {
      setPromptVersionKey(next);
    }
  }, [artifactKind, data.prompt_templates.length]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiPost<ContentAdminCreateGenerationResponse>(
        '/api/v1/admin/content/create',
        {
          source_key: sourceKey,
          artifact_kind: artifactKind,
          prompt_version_key: promptVersionKey,
          reason,
        },
        csrfToken,
        onProtectedStateCleared,
      );
      await onCreated();
    } finally {
      setSaving(false);
    }
  }

  if (data.eligible_sources.length === 0) {
    return <EmptyState title="No approved source" body="No transcript is ready for generation." />;
  }

  return (
    <>
      <ProviderPorts ports={data.provider_ports} />
      <form className="content-editor-form" onSubmit={(event) => void submit(event)}>
        <label>
          <span>Source</span>
          <Select value={sourceKey} onChange={(event) => setSourceKey(event.target.value)}>
            {data.eligible_sources.map((source) => (
              <option key={source.source_key} value={source.source_key}>
                {source.title}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span>Artifact</span>
          <Select
            value={artifactKind}
            onChange={(event) => setArtifactKind(event.target.value as ContentAdminArtifactKind)}
          >
            {artifactKinds.map((kind) => (
              <option key={kind} value={kind}>
                {readable(kind)}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span>Prompt version</span>
          <Select
            value={promptVersionKey}
            onChange={(event) => setPromptVersionKey(event.target.value)}
          >
            {compatibleTemplates.flatMap((template) =>
              template.versions.map((version) => (
                <option key={version.version_key} value={version.version_key}>
                  {template.label} v{version.version_number} - {version.status}
                </option>
              )),
            )}
          </Select>
        </label>
        <label className="wide-field">
          <span>Reason</span>
          <Input value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <Button type="submit" variant="primary" disabled={saving || !promptVersionKey}>
          {saving ? 'Generating...' : 'Generate Draft'}
        </Button>
      </form>
    </>
  );
}

function SocialView({ data }: { data: ContentAdminSocialWorkspaceResponse }) {
  return (
    <>
      <ProviderPorts ports={data.provider_ports} />
      {data.drafts.length === 0 ? (
        <EmptyState title="No social drafts" body="No exact-revision social draft is pending." />
      ) : (
        <section className="content-stack">
          {data.drafts.map((draft) => (
            <Card key={draft.draft_id} className="content-row-card">
              <div>
                <h2>{draft.platform.toUpperCase()}</h2>
                <p>{draft.source_key}</p>
              </div>
              <Badge>{draft.workflow_state}</Badge>
              <span>{draft.buffer_command_state ?? 'buffer provider off'}</span>
            </Card>
          ))}
        </section>
      )}
    </>
  );
}

function KnowledgeView({ data }: { data: ContentAdminKnowledgeResponse }) {
  return (
    <>
      <ProviderPorts ports={data.provider_ports} />
      {data.sections.length === 0 ? (
        <EmptyState
          title="No indexed knowledge"
          body="No approved knowledge section is projected."
        />
      ) : (
        <section className="content-stack">
          {data.sections.map((section) => (
            <Card key={`${section.content_id}:${section.section_id}`} className="content-row-card">
              <div>
                <h2>{section.title}</h2>
                <p>{section.content_id}</p>
              </div>
              <Badge>{section.readiness_state}</Badge>
              <span>{section.entitlement_projection}</span>
            </Card>
          ))}
        </section>
      )}
    </>
  );
}

function PromptRegistryView({
  data,
  csrfToken,
  onProtectedStateCleared,
  onChanged,
}: {
  data: ContentAdminPromptListResponse;
  csrfToken: string;
  onProtectedStateCleared: () => void;
  onChanged: () => Promise<void>;
}) {
  const canManage = data.capabilities.includes('prompt.manage');
  const [templateKey, setTemplateKey] = useState(data.templates[0]?.template_key ?? '');
  const template = data.templates.find((entry) => entry.template_key === templateKey);
  const active = activeVersion(template);
  const [parentVersionKey, setParentVersionKey] = useState(active?.version_key ?? '');
  const [findText, setFindText] = useState('approved transcript');
  const [replaceText, setReplaceText] = useState('approved transcript with timestamp citations');
  const [reason, setReason] = useState('Improve source-citation specificity.');
  const [preview, setPreview] = useState<ContentAdminPromptPreviewResponse['preview'] | null>(null);

  useEffect(() => {
    const nextActive = activeVersion(template);
    setParentVersionKey(nextActive?.version_key ?? template?.versions[0]?.version_key ?? '');
  }, [templateKey]);

  async function postPrompt(pathSuffix: string, body: Record<string, unknown>) {
    if (!template) return;
    return apiPost(
      `/api/v1/admin/content/prompts/${encodeURIComponent(template.template_key)}/${pathSuffix}`,
      body,
      csrfToken,
      onProtectedStateCleared,
    );
  }

  async function previewPatch() {
    const result = await postPrompt('preview', {
      parent_version_key: parentVersionKey,
      patch: { find: findText, replace: replaceText },
      reason,
    });
    setPreview((result as ContentAdminPromptPreviewResponse).preview);
  }

  async function savePatch() {
    await postPrompt('patch', {
      parent_version_key: parentVersionKey,
      patch: { find: findText, replace: replaceText },
      reason,
    });
    await onChanged();
  }

  async function activate(version: ContentAdminPromptVersion) {
    await postPrompt('activate', { version_key: version.version_key, reason });
    await onChanged();
  }

  async function rollback(version: ContentAdminPromptVersion) {
    await postPrompt('rollback', { target_version_key: version.version_key, reason });
    await onChanged();
  }

  if (data.templates.length === 0) {
    return <EmptyState title="No prompt templates" body="The registry did not return templates." />;
  }

  return (
    <section className="prompt-registry">
      <form className="content-editor-form" onSubmit={(event) => event.preventDefault()}>
        <label>
          <span>Template</span>
          <Select value={templateKey} onChange={(event) => setTemplateKey(event.target.value)}>
            {data.templates.map((entry) => (
              <option key={entry.template_key} value={entry.template_key}>
                {entry.label}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span>Parent version</span>
          <Select
            value={parentVersionKey}
            onChange={(event) => setParentVersionKey(event.target.value)}
          >
            {template?.versions.map((version) => (
              <option key={version.version_key} value={version.version_key}>
                v{version.version_number} - {version.status}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span>Find</span>
          <Input value={findText} onChange={(event) => setFindText(event.target.value)} />
        </label>
        <label>
          <span>Replace</span>
          <Input value={replaceText} onChange={(event) => setReplaceText(event.target.value)} />
        </label>
        <label className="wide-field">
          <span>Reason</span>
          <Input value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <div className="content-action-row">
          <Button
            type="button"
            variant="secondary"
            disabled={!canManage}
            onClick={() => void previewPatch()}
          >
            Preview/test
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!canManage}
            onClick={() => void savePatch()}
          >
            Save draft
          </Button>
        </div>
      </form>
      {preview && (
        <Card className="content-preview-card">
          <h2>Preview</h2>
          <pre>{preview.rendered_excerpt}</pre>
          <Badge>cannot publish</Badge>
        </Card>
      )}
      <section className="content-stack">
        {template?.versions.map((version) => (
          <Card key={version.version_key} className="content-row-card">
            <div>
              <h2>Version {version.version_number}</h2>
              <p>{version.checksum.slice(0, 16)}</p>
            </div>
            <Badge>{version.status}</Badge>
            <div className="content-action-row">
              <Button
                type="button"
                variant="secondary"
                disabled={!canManage || version.status === 'active'}
                onClick={() => void activate(version)}
              >
                Activate
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!canManage || version.status === 'active'}
                onClick={() => void rollback(version)}
              >
                Rollback/reactivate
              </Button>
            </div>
          </Card>
        ))}
      </section>
    </section>
  );
}

function ActivityView({ events }: { events: ContentAdminActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <EmptyState title="No activity" body="No audited Content workspace event is recorded." />
    );
  }
  return (
    <section className="content-stack">
      {events.map((event) => (
        <Card key={event.activity_key} className="content-row-card">
          <div>
            <h2>{readable(event.action_type)}</h2>
            <p>{event.scope_key ?? 'workspace'}</p>
          </div>
          <Badge>{event.capability ?? 'audit'}</Badge>
          <span>{formatDate(event.created_at)}</span>
        </Card>
      ))}
    </section>
  );
}

function SourceDetailView({
  source,
  onBack,
  onAction,
}: {
  source: ContentAdminSourceDetail;
  onBack: () => void;
  onAction: (action: string, reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('Reviewed in OT-110A workspace.');
  return (
    <section className="source-detail">
      <div className="content-detail-header">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
        <div>
          <h2>{source.title}</h2>
          <p>{source.source_key}</p>
        </div>
        <Badge>{readable(source.lifecycle_stage)}</Badge>
      </div>
      <ProviderPorts ports={source.provider_ports} />
      <VerticalSlicePanel slice={source.vertical_slice} />
      <section className="detail-grid">
        <Card className="content-panel">
          <h3>Protected Player</h3>
          <p>{source.provider_state}</p>
          <Badge>no provider URL exposed</Badge>
        </Card>
        <Card className="content-panel">
          <h3>Transcript</h3>
          {source.transcript_revisions.length === 0 ? (
            <p>No transcript revision yet.</p>
          ) : (
            source.transcript_revisions.map((revision) => (
              <p key={revision.revision_key}>
                v{revision.revision_number}: {revision.state} -{' '}
                {revision.transcript_hash.slice(0, 12)}
              </p>
            ))
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => void onAction('transcript/approve', reason)}
          >
            Approve Transcript
          </Button>
        </Card>
        <Card className="content-panel">
          <h3>Artifacts</h3>
          {source.artifact_revisions.length === 0 ? (
            <p>No artifact revision yet.</p>
          ) : (
            source.artifact_revisions.map((artifact) => (
              <p key={artifact.artifact_revision_key}>
                {readable(artifact.artifact_kind)} v{artifact.revision_number}:{' '}
                {artifact.review_state}
              </p>
            ))
          )}
          <div className="content-action-row">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void onAction('artifacts/approve', reason)}
            >
              Approve Artifact
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void onAction('artifacts/publish', reason)}
            >
              Publish Artifact
            </Button>
          </div>
        </Card>
        <Card className="content-panel">
          <h3>Social And Buffer</h3>
          {source.social_drafts.length === 0 ? (
            <p>No social draft is pending.</p>
          ) : (
            source.social_drafts.map((draft) => (
              <p key={draft.draft_id}>
                {draft.platform}: {draft.workflow_state}
              </p>
            ))
          )}
          <div className="content-action-row">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void onAction('social/approve', reason)}
            >
              Approve Social
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void onAction('social/schedule', reason)}
            >
              Schedule
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => void onAction('social/retract', reason)}
            >
              Retract
            </Button>
          </div>
        </Card>
      </section>
      <label className="source-action-reason">
        <span>Reason</span>
        <Input value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      <ActivityView events={source.activity} />
    </section>
  );
}

function VerticalSlicePanel({ slice }: { slice: ContentAdminSourceDetail['vertical_slice'] }) {
  const activeSteps = slice.flow_steps.filter((step) =>
    ['ready', 'done'].includes(step.state),
  ).length;
  return (
    <section className="content-vertical-slice" aria-label="Content classroom pipeline">
      <Card className="content-panel content-flow-panel">
        <div className="content-panel-heading">
          <h3>Content Flow</h3>
          <Badge>
            {activeSteps}/{slice.flow_steps.length} active
          </Badge>
        </div>
        <ol className="content-flow-list">
          {slice.flow_steps.map((step) => (
            <li key={step.key} data-state={step.state}>
              <span>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </span>
              <span>
                <Badge>{readable(step.state)}</Badge>
                <small>{formatOptionalDate(step.updated_at)}</small>
              </span>
            </li>
          ))}
        </ol>
      </Card>
      <Card className="content-panel content-slice-card">
        <h3>Classroom</h3>
        <dl>
          <div>
            <dt>Class</dt>
            <dd>{slice.classroom.class_key ?? 'Needs association'}</dd>
          </div>
          <div>
            <dt>Title</dt>
            <dd>{slice.classroom.title}</dd>
          </div>
          <div>
            <dt>Starts</dt>
            <dd>{formatOptionalDate(slice.classroom.starts_at)}</dd>
          </div>
          <div>
            <dt>Recording</dt>
            <dd>{readable(slice.classroom.recording_state)}</dd>
          </div>
          <div>
            <dt>Portal</dt>
            <dd>{readable(slice.classroom.portal_eligibility)}</dd>
          </div>
          <div>
            <dt>Helper</dt>
            <dd>{readable(slice.classroom.helper_eligibility)}</dd>
          </div>
        </dl>
      </Card>
      <Card className="content-panel content-slice-card">
        <h3>Provider Setup</h3>
        <dl>
          <div>
            <dt>State</dt>
            <dd>{readable(slice.provider_setup.state)}</dd>
          </div>
          <div>
            <dt>Missing</dt>
            <dd>{slice.provider_setup.missing_provider_count}</dd>
          </div>
          <div>
            <dt>Provider-Off</dt>
            <dd>{slice.provider_setup.can_continue_provider_off ? 'Available' : 'Blocked'}</dd>
          </div>
        </dl>
        <p>{slice.provider_setup.owner_action}</p>
      </Card>
      <Card className="content-panel content-slice-card">
        <h3>Social Handoff</h3>
        <dl>
          <div>
            <dt>State</dt>
            <dd>{readable(slice.social_handoff.state)}</dd>
          </div>
          <div>
            <dt>Drafts</dt>
            <dd>{slice.social_handoff.draft_count}</dd>
          </div>
          <div>
            <dt>Live Publish</dt>
            <dd>{slice.social_handoff.buffer_live_publish_allowed ? 'Allowed' : 'Disabled'}</dd>
          </div>
          <div>
            <dt>Revision Lock</dt>
            <dd>{slice.social_handoff.exact_revision_required ? 'Exact' : 'Open'}</dd>
          </div>
        </dl>
      </Card>
    </section>
  );
}

function SourceList({
  sources,
  onOpen,
}: {
  sources: ContentAdminSourceSummary[];
  onOpen: (sourceKey: string) => void;
}) {
  if (sources.length === 0) {
    return <EmptyState title="No content sources" body="No source matched the current filters." />;
  }
  return (
    <section className="source-list">
      <div className="source-table-wrap">
        <Table className="content-table">
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">Stage</th>
              <th scope="col">Artifacts</th>
              <th scope="col">Social</th>
              <th scope="col">Updated</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr
                key={source.source_key}
                tabIndex={0}
                role="button"
                onClick={() => onOpen(source.source_key)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpen(source.source_key);
                  }
                }}
              >
                <td>
                  <strong>{source.title}</strong>
                  <small>{source.source_key}</small>
                </td>
                <td>{readable(source.lifecycle_stage)}</td>
                <td>
                  {source.artifact_counts.published} published /{' '}
                  {source.artifact_counts.review_needed} review
                </td>
                <td>{source.social_state}</td>
                <td>{formatDate(source.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <div className="source-cards">
        {sources.map((source) => (
          <button
            type="button"
            key={source.source_key}
            className="source-card"
            onClick={() => onOpen(source.source_key)}
          >
            <span>
              <strong>{source.title}</strong>
              <small>{formatDate(source.updated_at)}</small>
            </span>
            <Badge>{readable(source.lifecycle_stage)}</Badge>
          </button>
        ))}
      </div>
    </section>
  );
}

function ProviderPorts({ ports }: { ports: ContentAdminProviderPortStatus[] }) {
  return (
    <section className="provider-ports" aria-label="Provider status">
      {ports.map((port) => (
        <Card key={port.port} className="provider-port-card">
          <strong>{readable(port.port)}</strong>
          <Badge>{port.mode}</Badge>
          <span>{port.state}</span>
        </Card>
      ))}
    </section>
  );
}

function routeFromPath(path: string): RouteState {
  const cleanPath = path.split('?')[0] ?? '/app/content';
  if (cleanPath === '/app/content') return { kind: 'overview' };
  const segment = cleanPath.replace(/^\/app\/content\/?/, '').split('/')[0] ?? '';
  if (segment === 'processing') return { kind: 'processing' };
  if (segment === 'create') return { kind: 'create' };
  if (segment === 'social') return { kind: 'social' };
  if (segment === 'knowledge') return { kind: 'knowledge' };
  if (segment === 'prompts') return { kind: 'prompts' };
  if (segment === 'activity') return { kind: 'activity' };
  return { kind: 'detail', sourceKey: decodeURIComponent(segment) };
}

async function apiGet<T>(path: string, onProtectedStateCleared: () => void): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' }, onProtectedStateCleared);
}

async function apiPost<T = unknown>(
  path: string,
  body: Record<string, unknown>,
  csrfToken: string,
  onProtectedStateCleared: () => void,
): Promise<T> {
  return apiRequest<T>(
    path,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify(body),
    },
    onProtectedStateCleared,
  );
}

async function apiRequest<T>(
  path: string,
  init: RequestInit,
  onProtectedStateCleared: () => void,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: privateHeaders(init.headers),
  });
  const json = await response.json().catch(() => ({}));
  if (response.status === 401) {
    onProtectedStateCleared();
    throw new Error('Session expired.');
  }
  if (!response.ok || json.success === false) {
    throw new Error(typeof json.message === 'string' ? json.message : 'Request failed.');
  }
  return json as T;
}

function privateHeaders(headers?: HeadersInit) {
  const merged = new Headers(headers);
  if (!merged.has('accept')) merged.set('accept', 'application/json');
  merged.set('cache-control', 'no-store');
  merged.set('pragma', 'no-cache');
  return merged;
}

function activeVersion(template: ContentAdminPromptTemplate | undefined) {
  if (!template) return null;
  return (
    template.versions.find((version) => version.version_key === template.active_version_key) ??
    template.versions[0] ??
    null
  );
}

function readable(value: string) {
  return value
    .replaceAll('_', ' ')
    .replaceAll('.', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function formatOptionalDate(value: string | null) {
  return value ? formatDate(value) : 'Not set';
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Content workspace request failed.';
}
