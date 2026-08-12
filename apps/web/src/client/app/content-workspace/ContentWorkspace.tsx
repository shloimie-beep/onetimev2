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
  ContentAdminStructuredPromptSection,
  ContentAdminPromptTemplate,
  ContentAdminPromptVersion,
  ContentAdminProviderPortStatus,
  ContentAdminSourceDetail,
  ContentAdminSourceDetailResponse,
  ContentAdminSourceSummary,
  ContentFactoryEditPayload,
  ContentFactorySafeItem,
  ContentFactoryWorkspaceResponse,
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
import { CONTENT_SECTIONS, contentSectionFromPath } from '../admin-ia.js';
import { PublicationWorkspace } from '../admin/content/publication/index.js';
import { ContentIngestWorkspace } from '../admin/content/ingest/ContentIngestWorkspace.js';
import { createContentIngestApi } from '../admin/content/ingest/api.js';
import { WorkspaceTabs } from '../shell/WorkspaceTabs.js';
import './content-workspace.css';

type RouteKind =
  | 'overview'
  | 'publication'
  | 'ingest'
  | 'processing'
  | 'factory'
  | 'create'
  | 'knowledge'
  | 'prompts'
  | 'activity'
  | 'review'
  | 'detail';

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

const studioViews = [{ id: 'create', label: 'Create', href: '/app/content/studio' }] as const;

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

const structuredPromptSectionOptions: Array<{
  value: ContentAdminStructuredPromptSection;
  label: string;
}> = [
  { value: 'objective', label: 'Objective' },
  { value: 'audience', label: 'Audience' },
  { value: 'tone_and_voice', label: 'Tone and voice' },
  { value: 'channel_and_output_format', label: 'Channel and output format' },
  { value: 'visual_camera_composition', label: 'Visual, camera, and composition' },
  { value: 'required_elements', label: 'Required elements' },
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
  const ingestApi = useMemo(
    () => createContentIngestApi({ csrfToken, onProtectedStateCleared }),
    [csrfToken, onProtectedStateCleared],
  );
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(defaultFilters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [overview, setOverview] = useState<ContentAdminOverviewResponse | null>(null);
  const [processing, setProcessing] = useState<ContentAdminProcessingResponse | null>(null);
  const [factory, setFactory] = useState<ContentFactoryWorkspaceResponse | null>(null);
  const [createData, setCreateData] = useState<ContentAdminCreateWorkspaceResponse | null>(null);
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
      } else if (route.kind === 'factory') {
        setFactory(
          await apiGet<ContentFactoryWorkspaceResponse>(
            '/api/v1/admin/content/factory',
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
      <WorkspaceTabs
        tabs={CONTENT_SECTIONS}
        currentId={contentSectionFromPath(path)}
        label="Content area"
        onNavigate={onNavigate}
      />
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
        <>
          <LibraryViewSelector currentId="all" onNavigate={onNavigate} />
          <OverviewView
            data={overview}
            filters={filters}
            onFiltersChange={setFilters}
            onApplyFilters={() => setAppliedFilters(filters)}
            onOpen={(sourceKey) => onNavigate(`/app/content/${encodeURIComponent(sourceKey)}`)}
          />
        </>
      )}
      {!loading && !error && route.kind === 'publication' && (
        <PublicationWorkspace
          csrfToken={csrfToken}
          onProtectedStateCleared={onProtectedStateCleared}
        />
      )}
      {!loading && !error && route.kind === 'ingest' && <ContentIngestWorkspace {...ingestApi} />}
      {!loading && !error && route.kind === 'processing' && processing && (
        <>
          <LibraryViewSelector currentId="processing" onNavigate={onNavigate} />
          <ProcessingView
            data={processing}
            onRetry={(sourceKey) => postSourceAction(sourceKey, 'retry', 'Retry from admin queue')}
          />
        </>
      )}
      {!loading && !error && route.kind === 'factory' && factory && (
        <FactoryView
          data={factory}
          csrfToken={csrfToken}
          onProtectedStateCleared={onProtectedStateCleared}
          onChanged={async (message) => {
            setNotice(message);
            await loadRoute();
          }}
        />
      )}
      {!loading && !error && route.kind === 'create' && createData && (
        <>
          <WorkspaceTabs
            tabs={studioViews}
            currentId="create"
            label="Studio view"
            onNavigate={onNavigate}
          />
          <CreateView
            data={createData}
            csrfToken={csrfToken}
            onProtectedStateCleared={onProtectedStateCleared}
            onCreated={async () => {
              setNotice('Draft generated for review.');
              await loadRoute();
            }}
          />
        </>
      )}
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
        <EmptyState
          title="Activity moved to item history"
          body="Open a Library item to review its scoped history. The legacy Activity bookmark remains safe."
          action={
            <Button type="button" variant="primary" onClick={() => onNavigate('/app/content')}>
              Return to Library
            </Button>
          }
        />
      )}
      {!loading && !error && (route.kind === 'detail' || route.kind === 'review') && detail && (
        <SourceDetailView
          source={detail}
          reviewMode={route.kind === 'review'}
          onBack={() =>
            onNavigate(
              route.kind === 'review'
                ? `/app/content/${encodeURIComponent(detail.source_key)}`
                : '/app/content',
            )
          }
          onReview={() =>
            onNavigate(`/app/content/${encodeURIComponent(detail.source_key)}/review`)
          }
          onAction={(action, reason) => postSourceAction(detail.source_key, action, reason)}
        />
      )}
    </section>
  );
}

function LibraryViewSelector({
  currentId,
  onNavigate,
}: {
  currentId: 'all' | 'processing';
  onNavigate: (href: string) => void;
}) {
  return (
    <label className="content-library-view">
      <span>Library view</span>
      <Select
        value={currentId}
        onChange={(event) =>
          onNavigate(
            event.target.value === 'processing' ? '/app/content/processing' : '/app/content',
          )
        }
      >
        <option value="all">All items</option>
        <option value="processing">Processing queue</option>
      </Select>
    </label>
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
  const launchProviderPorts = data.provider_ports.filter((port) => port.port !== 'buffer');
  const launchCounts = Object.entries(data.counts).filter(
    ([key]) => key !== 'social_pending' && key !== 'buffer_pending',
  );
  return (
    <>
      <ProviderPorts ports={launchProviderPorts} />
      <section className="content-counts" aria-label="Content counts">
        {launchCounts.map(([key, value]) => (
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

function FactoryView({
  data,
  csrfToken,
  onProtectedStateCleared,
  onChanged,
}: {
  data: ContentFactoryWorkspaceResponse;
  csrfToken: string;
  onProtectedStateCleared: () => void;
  onChanged: (message: string) => Promise<void>;
}) {
  const visibleItems = useMemo(() => data.items.filter((item) => !item.is_demo), [data.items]);
  const [selectedKey, setSelectedKey] = useState(visibleItems[0]?.source_key ?? '');
  const [showIntake, setShowIntake] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadOccurrence, setUploadOccurrence] = useState(
    data.occurrences[0]?.occurrence_key ?? '',
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const selected =
    visibleItems.find((item) => item.source_key === selectedKey) ?? visibleItems[0] ?? null;

  useEffect(() => {
    if (selectedKey && visibleItems.some((item) => item.source_key === selectedKey)) return;
    setSelectedKey(visibleItems[0]?.source_key ?? '');
  }, [selectedKey, visibleItems]);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!uploadFile || !uploadOccurrence) return;
    setUploading(true);
    setUploadError('');
    try {
      await apiUpload(
        '/api/v1/admin/content/factory/intake',
        uploadFile,
        { occurrenceKey: uploadOccurrence, idempotencyKey: crypto.randomUUID() },
        csrfToken,
        onProtectedStateCleared,
      );
      setUploadFile(null);
      setShowIntake(false);
      await onChanged('Video received securely. No external provider was contacted.');
    } catch (error) {
      setUploadError(errorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <Card className="content-factory-hero">
        <div>
          <p className="content-factory-kicker">Class video workflow</p>
          <h1>Content Factory</h1>
          <p>
            Add a class video, review its transcript and lesson drafts, then publish approved
            material to students.
          </p>
        </div>
        <Button type="button" variant="primary" onClick={() => setShowIntake(!showIntake)}>
          {showIntake ? 'Cancel' : 'Add class video'}
        </Button>
      </Card>
      {showIntake && (
        <Card className="content-panel content-factory-intake-panel">
          <h2>Add class video</h2>
          <p>
            The original is streamed to durable private storage and bound to one existing class
            occurrence. Provider-off processing does not contact OpenAI or Vimeo.
          </p>
          {uploadError && (
            <p className="notice-banner" role="alert">
              {uploadError}
            </p>
          )}
          <form className="content-editor-form" onSubmit={(event) => void upload(event)}>
            <label>
              <span>Video file</span>
              <input
                required
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,video/x-matroska,.m4v"
                disabled={uploading}
                onChange={(event) => setUploadFile(event.currentTarget.files?.[0] ?? null)}
              />
            </label>
            <div className="content-factory-fields">
              <label>
                <span>Class occurrence</span>
                <Select
                  required
                  disabled={uploading}
                  value={uploadOccurrence}
                  onChange={(event) => setUploadOccurrence(event.currentTarget.value)}
                >
                  <option value="">Select a class occurrence</option>
                  {data.occurrences.map((occurrence) => (
                    <option key={occurrence.occurrence_key} value={occurrence.occurrence_key}>
                      {occurrence.class_title} · {occurrence.class_date} ·{' '}
                      {occurrence.learner_count} learners
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={!uploadFile || !uploadOccurrence || uploading}
            >
              {uploading ? 'Copying privately…' : 'Add to private storage'}
            </Button>
          </form>
        </Card>
      )}
      <section className="provider-ports" aria-label="Private intake status">
        <Card className="provider-port-card">
          <strong>Private intake</strong>
          <Badge>{data.input_adapter === 'DRIVE' ? 'Drive ready' : 'Local drop ready'}</Badge>
          <span>
            {data.input_adapter === 'DRIVE'
              ? 'Incoming Drive files remain protected.'
              : 'Uploads are streamed into durable private storage.'}
          </span>
        </Card>
      </section>
      {data.intakes.length > 0 && (
        <section className="content-stack" aria-labelledby="received-videos-title">
          <h2 id="received-videos-title">Received videos</h2>
          {data.intakes.map((intake) => (
            <Card className="content-row-card content-factory-intake" key={intake.intake_key}>
              <div>
                <strong>{intake.display_name}</strong>
                <span>
                  {intake.occurrence
                    ? `${intake.occurrence.class_title} · ${intake.occurrence.class_date}`
                    : 'Class occurrence required'}
                </span>
              </div>
              <Badge>{readable(intake.state)}</Badge>
              <span>{formatBytes(intake.byte_length)}</span>
              {intake.retry_eligible && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    void apiPost(
                      `/api/v1/admin/content/factory/intakes/${encodeURIComponent(intake.intake_key)}/retry`,
                      {},
                      csrfToken,
                      onProtectedStateCleared,
                    ).then(() => onChanged('Failed processing step queued for retry.'))
                  }
                >
                  Retry failed step
                </Button>
              )}
            </Card>
          ))}
        </section>
      )}
      {visibleItems.length === 0 && data.intakes.length === 0 ? (
        <EmptyState
          title="No incoming videos"
          body="Use Add class video to place a private source in the content factory."
        />
      ) : visibleItems.length > 0 ? (
        <div className="content-factory-layout">
          <section className="content-stack" aria-label="Content factory queue">
            {visibleItems.map((item) => (
              <button
                type="button"
                className="content-factory-item"
                aria-pressed={selected?.source_key === item.source_key}
                key={item.source_key}
                onClick={() => setSelectedKey(item.source_key)}
              >
                <span>
                  <strong>{item.draft.title}</strong>
                  <small>{item.display_name}</small>
                </span>
                <Badge>{readable(item.state)}</Badge>
              </button>
            ))}
          </section>
          {selected && (
            <FactoryEditor
              key={`${selected.source_key}:${selected.updated_at}`}
              item={selected}
              occurrences={data.occurrences}
              csrfToken={csrfToken}
              onProtectedStateCleared={onProtectedStateCleared}
              onChanged={onChanged}
            />
          )}
        </div>
      ) : null}
    </>
  );
}

const factoryTimeline = [
  'received',
  'inspecting',
  'trimming',
  'transcribing',
  'drafting',
  'uploading',
  'review',
  'approved',
  'published',
] as const;

function FactoryTimeline({ state }: { state: (typeof factoryTimeline)[number] | 'failed' }) {
  const currentIndex = state === 'failed' ? -1 : factoryTimeline.indexOf(state);
  return (
    <section className="content-factory-timeline" aria-label="Video processing status">
      <ol>
        {factoryTimeline.map((step, index) => (
          <li
            key={step}
            data-state={
              state === 'failed'
                ? 'stopped'
                : index < currentIndex
                  ? 'complete'
                  : index === currentIndex
                    ? 'current'
                    : 'upcoming'
            }
            aria-current={step === state ? 'step' : undefined}
          >
            <span aria-hidden="true">{index + 1}</span>
            <strong>{readable(step)}</strong>
          </li>
        ))}
        {state === 'failed' && (
          <li data-state="failed" aria-current="step">
            <span aria-hidden="true">!</span>
            <strong>Failed</strong>
          </li>
        )}
      </ol>
    </section>
  );
}

function factoryTimelineState(state: ContentFactorySafeItem['state']) {
  if (state === 'incoming') return 'received' as const;
  if (state === 'processing') return 'inspecting' as const;
  if (state === 'transcribed') return 'drafting' as const;
  if (state === 'rendered') return 'uploading' as const;
  if (state === 'uploaded' || state === 'needs_review') return 'review' as const;
  return state;
}

function FactoryEditor({
  item,
  occurrences,
  csrfToken,
  onProtectedStateCleared,
  onChanged,
}: {
  item: ContentFactorySafeItem;
  occurrences: ContentFactoryWorkspaceResponse['occurrences'];
  csrfToken: string;
  onProtectedStateCleared: () => void;
  onChanged: (message: string) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: item.draft.title,
    short_description: item.draft.short_description,
    class_label: item.draft.class_label ?? '',
    class_date: item.draft.class_date ?? '',
    topics: item.draft.topics.join(', '),
    mishnah_terms: item.draft.mishnah_terms.join(', '),
    normalized_transcript: item.normalized_transcript,
    review_questions: item.draft.review_questions.join('\n'),
    key_takeaways: item.draft.key_takeaways.join('\n'),
    occurrence_key: item.occurrence?.occurrence_key ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const canEdit = item.state !== 'published';

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setLocalError('');
    const payload: ContentFactoryEditPayload = {
      title: form.title,
      short_description: form.short_description,
      class_label: form.class_label || null,
      class_date: form.class_date || null,
      topics: splitCommaList(form.topics),
      mishnah_terms: splitCommaList(form.mishnah_terms),
      normalized_transcript: form.normalized_transcript,
      review_questions: splitLineList(form.review_questions),
      key_takeaways: splitLineList(form.key_takeaways),
      occurrence_key: form.occurrence_key,
    };
    try {
      await apiPatch(
        `/api/v1/admin/content/factory/${encodeURIComponent(item.source_key)}`,
        payload,
        csrfToken,
        onProtectedStateCleared,
      );
      await onChanged('Factory draft saved; approval is required before publication.');
    } catch (saveError) {
      setLocalError(errorMessage(saveError));
    } finally {
      setBusy(false);
    }
  }

  async function act(action: 'approve' | 'publish' | 'unpublish' | 'retry') {
    setBusy(true);
    setLocalError('');
    try {
      await apiPost(
        `/api/v1/admin/content/factory/${encodeURIComponent(item.source_key)}/${action}`,
        {},
        csrfToken,
        onProtectedStateCleared,
      );
      await onChanged(`${readable(action)} completed.`);
    } catch (actionError) {
      setLocalError(errorMessage(actionError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="content-panel content-factory-editor">
      <header className="content-panel-heading">
        <div>
          <h2>{item.draft.title}</h2>
          <p>
            {item.is_demo
              ? 'Demo — approved synthetic lesson data; no external provider media was used.'
              : 'AI-assisted drafts are never authoritative Torah interpretation.'}
          </p>
        </div>
        <Badge>{readable(item.state)}</Badge>
      </header>
      <FactoryTimeline state={factoryTimelineState(item.state)} />
      <dl className="content-factory-metadata">
        <div>
          <dt>Occurrence</dt>
          <dd>{item.occurrence?.class_date ?? 'Assignment required'}</dd>
        </div>
        <div>
          <dt>Prepared duration</dt>
          <dd>{formatDuration(item.trim.prepared_duration_ms)}</dd>
        </div>
        <div>
          <dt>Trim confidence</dt>
          <dd>{Math.round(item.trim.confidence * 100)}%</dd>
        </div>
        <div>
          <dt>Captions</dt>
          <dd>{item.vimeo.captions_active ? 'Active' : 'Needs attention'}</dd>
        </div>
        <div>
          <dt>Transcript</dt>
          <dd>{readable(item.transcript_review_state)}</dd>
        </div>
      </dl>
      {localError && (
        <p className="notice-banner" role="alert">
          {localError}
        </p>
      )}
      <form className="content-editor-form" onSubmit={(event) => void save(event)}>
        <label>
          <span>Title</span>
          <Input
            required
            maxLength={180}
            disabled={!canEdit || busy}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.currentTarget.value })}
          />
        </label>
        <label>
          <span>Short description</span>
          <textarea
            required
            rows={4}
            maxLength={1200}
            disabled={!canEdit || busy}
            value={form.short_description}
            onChange={(event) => setForm({ ...form, short_description: event.currentTarget.value })}
          />
        </label>
        <div className="content-factory-fields">
          <label>
            <span>Class occurrence</span>
            <Select
              required
              disabled={!canEdit || busy}
              value={form.occurrence_key}
              onChange={(event) => setForm({ ...form, occurrence_key: event.currentTarget.value })}
            >
              <option value="">Select a class occurrence</option>
              {occurrences.map((occurrence) => (
                <option key={occurrence.occurrence_key} value={occurrence.occurrence_key}>
                  {occurrence.class_title} · {occurrence.class_date} · {occurrence.learner_count}{' '}
                  learners
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span>Class date</span>
            <Input
              required
              type="date"
              disabled
              value={form.class_date}
              onChange={(event) => setForm({ ...form, class_date: event.currentTarget.value })}
            />
          </label>
        </div>
        <label>
          <span>Topics (comma separated)</span>
          <Input
            disabled={!canEdit || busy}
            value={form.topics}
            onChange={(event) => setForm({ ...form, topics: event.currentTarget.value })}
          />
        </label>
        <label>
          <span>Mishnah / masechta terms (comma separated)</span>
          <Input
            disabled={!canEdit || busy}
            value={form.mishnah_terms}
            onChange={(event) => setForm({ ...form, mishnah_terms: event.currentTarget.value })}
          />
        </label>
        <label>
          <span>Transcript</span>
          <textarea
            required
            rows={12}
            disabled={!canEdit || busy}
            value={form.normalized_transcript}
            onChange={(event) =>
              setForm({ ...form, normalized_transcript: event.currentTarget.value })
            }
          />
        </label>
        <label>
          <span>Review questions (5–10, one per line)</span>
          <textarea
            required
            rows={10}
            disabled={!canEdit || busy}
            value={form.review_questions}
            onChange={(event) => setForm({ ...form, review_questions: event.currentTarget.value })}
          />
        </label>
        <label>
          <span>Key takeaways (3–5, one per line)</span>
          <textarea
            required
            rows={6}
            disabled={!canEdit || busy}
            value={form.key_takeaways}
            onChange={(event) => setForm({ ...form, key_takeaways: event.currentTarget.value })}
          />
        </label>
        <div className="content-action-row">
          {canEdit && (
            <Button type="submit" variant="secondary" disabled={busy}>
              Save draft
            </Button>
          )}
          {item.state === 'needs_review' && (
            <Button
              type="button"
              variant="primary"
              disabled={busy}
              onClick={() => void act('approve')}
            >
              Approve transcript and drafts
            </Button>
          )}
          {item.state === 'approved' && (
            <Button
              type="button"
              variant="primary"
              disabled={busy}
              onClick={() => void act('publish')}
            >
              Publish
            </Button>
          )}
          {item.state === 'published' && (
            <>
              <a
                className="content-preview-link"
                href={item.playback_route}
                target="_blank"
                rel="noreferrer"
              >
                Preview approved playback
              </a>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void act('unpublish')}
              >
                Unpublish
              </Button>
            </>
          )}
          {item.retry_eligible && (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void act('retry')}
            >
              Retry failed step
            </Button>
          )}
        </div>
      </form>
    </Card>
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
  const [section, setSection] = useState<ContentAdminStructuredPromptSection>('required_elements');
  const [feedback, setFeedback] = useState('Use exact source timestamps for every major point.');
  const [reason, setReason] = useState('Improve source-citation specificity.');
  const [preview, setPreview] = useState<ContentAdminPromptPreviewResponse['preview'] | null>(null);

  useEffect(() => {
    const nextActive = activeVersion(template);
    setParentVersionKey(nextActive?.version_key ?? template?.versions[0]?.version_key ?? '');
    setPreview(null);
  }, [active?.version_key, templateKey]);

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
    const parent = template?.versions.find((version) => version.version_key === parentVersionKey);
    if (!parent || !feedback.trim()) return;
    const operation = {
      operation: 'append_item' as const,
      section,
      expected_section_checksum: await sha256(JSON.stringify(parent.structured_document[section])),
      item: feedback.trim(),
    };
    const result = await postPrompt('preview', {
      parent_version_key: parentVersionKey,
      expected_latest_version_number: Math.max(
        ...(template?.versions.map((version) => version.version_number) ?? [1]),
      ),
      operations: [operation],
      reason,
    });
    setPreview((result as ContentAdminPromptPreviewResponse).preview);
  }

  async function savePatch() {
    if (!preview) return;
    await postPrompt('patch', {
      parent_version_key: parentVersionKey,
      expected_latest_version_number: Math.max(
        ...(template?.versions.map((version) => version.version_number) ?? [1]),
      ),
      operations: preview.proposed_operations,
      reason,
    });
    setPreview(null);
    await onChanged();
  }

  async function activate(version: ContentAdminPromptVersion) {
    if (!active) return;
    await postPrompt('activate', {
      version_key: version.version_key,
      expected_active_version_key: active.version_key,
      reason,
    });
    await onChanged();
  }

  async function rollback(version: ContentAdminPromptVersion) {
    if (!active) return;
    await postPrompt('rollback', {
      target_version_key: version.version_key,
      expected_active_version_key: active.version_key,
      reason,
    });
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
          <span>Active parent version</span>
          <Input value={active ? `v${active.version_number}` : 'Unavailable'} disabled />
        </label>
        <label>
          <span>Prompt section</span>
          <Select
            value={section}
            onChange={(event) => {
              setSection(event.target.value as ContentAdminStructuredPromptSection);
              setPreview(null);
            }}
          >
            {structuredPromptSectionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="wide-field">
          <span>Natural-language instruction</span>
          <Input
            value={feedback}
            onChange={(event) => {
              setFeedback(event.target.value);
              setPreview(null);
            }}
          />
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
            disabled={!canManage || !preview}
            onClick={() => void savePatch()}
          >
            Save draft
          </Button>
        </div>
      </form>
      {preview && (
        <Card className="content-preview-card">
          <h2>Preview</h2>
          <p>
            Review the complete candidate and exact changed instructions before saving this draft.
          </p>
          <h3>Complete candidate prompt</h3>
          <pre>{preview.rendered_prompt}</pre>
          {preview.diff.map((change, index) => (
            <div key={`${change.section}:${index}`} data-prompt-diff={change.section}>
              <h3>{readable(change.section)} exact change</h3>
              <h4>Before</h4>
              {change.before.length === 0 ? (
                <p>No instructions.</p>
              ) : (
                <ol>
                  {change.before.map((item, itemIndex) => (
                    <li key={`before:${itemIndex}`}>{item}</li>
                  ))}
                </ol>
              )}
              <h4>After</h4>
              <ol>
                {change.after.map((item, itemIndex) => (
                  <li key={`after:${itemIndex}`}>{item}</li>
                ))}
              </ol>
            </div>
          ))}
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
  reviewMode,
  onBack,
  onReview,
  onAction,
}: {
  source: ContentAdminSourceDetail;
  reviewMode: boolean;
  onBack: () => void;
  onReview: () => void;
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
          {reviewMode && <p className="content-factory-kicker">Content review</p>}
          <h2>{source.title}</h2>
          <p>{source.source_key}</p>
        </div>
        <Badge>{readable(source.lifecycle_stage)}</Badge>
        {!reviewMode && (
          <Button type="button" variant="primary" onClick={onReview}>
            Open content review
          </Button>
        )}
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

export function contentWorkspaceRouteFromPath(path: string): RouteState {
  const cleanPath = path.split('?')[0] ?? '/app/content';
  if (cleanPath === '/app/content') return { kind: 'overview' };
  const segments = cleanPath
    .replace(/^\/app\/content\/?/, '')
    .split('/')
    .filter(Boolean);
  const segment = segments[0] ?? '';
  if (segment === 'publication') return { kind: 'publication' };
  if (segment === 'upload') return { kind: 'ingest' };
  if (segment === 'processing') return { kind: 'processing' };
  if (segment === 'factory') return { kind: 'factory' };
  if (segment === 'studio') return { kind: 'create' };
  if (segment === 'create') return { kind: 'create' };
  if (segment === 'social') return { kind: 'overview' };
  if (segment === 'knowledge') return { kind: 'knowledge' };
  if (segment === 'prompts') return { kind: 'prompts' };
  if (segment === 'activity') return { kind: 'activity' };
  if (segments[1] === 'review') {
    return { kind: 'review', sourceKey: decodeURIComponent(segment) };
  }
  return { kind: 'detail', sourceKey: decodeURIComponent(segment) };
}

const routeFromPath = contentWorkspaceRouteFromPath;

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

async function apiPatch<T = unknown>(
  path: string,
  body: Record<string, unknown>,
  csrfToken: string,
  onProtectedStateCleared: () => void,
): Promise<T> {
  return apiRequest<T>(
    path,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify(body),
    },
    onProtectedStateCleared,
  );
}

async function apiUpload<T = unknown>(
  path: string,
  file: File,
  metadata: { occurrenceKey: string; idempotencyKey: string },
  csrfToken: string,
  onProtectedStateCleared: () => void,
): Promise<T> {
  return apiRequest<T>(
    path,
    {
      method: 'POST',
      headers: {
        'content-type': file.type || 'application/octet-stream',
        'x-csrf-token': csrfToken,
        'x-file-name': encodeURIComponent(file.name),
        'x-occurrence-key': encodeURIComponent(metadata.occurrenceKey),
        'x-idempotency-key': encodeURIComponent(metadata.idempotencyKey),
      },
      body: file,
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

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(value >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

function readable(value: string) {
  return value
    .replaceAll('_', ' ')
    .replaceAll('.', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function splitLineList(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function splitCommaList(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatDuration(durationMs: number) {
  const seconds = Math.round(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
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
