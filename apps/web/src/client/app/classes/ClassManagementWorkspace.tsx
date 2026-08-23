import React, { useEffect, useMemo, useState } from 'react';
import type {
  ClassEnrollment,
  ClassEnrollmentCandidate,
  ClassOccurrenceSummary,
  ClassRecording,
  ClassRecordingAccess,
  ClassSeries,
  ContentLibraryItemSummary,
  ManagedClassOccurrence,
} from '@onetime/contracts';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Link,
  LoadingState,
  Select,
  StatusChip,
} from '@onetime/brand-system/react';
import type { ClassroomSectionId } from '../admin-ia.js';
import {
  attachClassRecording,
  createIdempotencyKey,
  createManagedClassOccurrence,
  createManagedClassSeries,
  deleteSyntheticClassZoom,
  enrollLearnerInClass,
  getClassZoomStatus,
  getContentLibrary,
  getManagedClassOccurrence,
  listClassEnrollmentCandidates,
  listClassEnrollments,
  listClassRecordingAccess,
  listClassRecordings,
  listManagedClassSeries,
  provisionClassZoom,
  revokeClassEnrollment,
  setClassRecordingAccess,
  updateManagedClassOccurrence,
  updateManagedClassSeries,
  type ClassZoomStatus,
} from '../crm-api.js';

type Props = {
  csrfToken: string;
  section: ClassroomSectionId;
  selectedSeriesKey: string | null;
  occurrences: ClassOccurrenceSummary[];
  selectedOccurrenceKey: string | null;
  occurrencesLoading: boolean;
  occurrencesError: string;
  onSelectOccurrence: (occurrenceKey: string) => void;
  onRefreshOccurrences: (preferredOccurrenceKey?: string | null) => Promise<void> | void;
  onNavigate: (href: string) => void;
  dailyFlow?: boolean;
};

type SeriesFormState = {
  title: string;
  description: string;
  teacherName: string;
  timezone: string;
  localStartTime: string;
  reminderLocalTime: string;
};

type OccurrenceFormState = {
  seriesKey: string;
  startsAt: string;
  endsAt: string;
  status: ManagedClassOccurrence['status'];
};

const emptySeriesForm: SeriesFormState = {
  title: '',
  description: '',
  teacherName: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem',
  localStartTime: '19:00',
  reminderLocalTime: '17:00',
};

function initialOccurrenceForm(): OccurrenceFormState {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 60 * 60_000);
  return {
    seriesKey: '',
    startsAt: localDateTimeInput(start),
    endsAt: localDateTimeInput(end),
    status: 'scheduled',
  };
}

export function ClassManagementWorkspace({
  csrfToken,
  section,
  selectedSeriesKey,
  occurrences,
  selectedOccurrenceKey,
  occurrencesLoading,
  occurrencesError,
  onSelectOccurrence,
  onRefreshOccurrences,
  onNavigate,
  dailyFlow = false,
}: Props) {
  const [series, setSeries] = useState<ClassSeries[]>([]);
  const [managedOccurrence, setManagedOccurrence] = useState<ManagedClassOccurrence | null>(null);
  const [enrollments, setEnrollments] = useState<ClassEnrollment[]>([]);
  const [candidates, setCandidates] = useState<ClassEnrollmentCandidate[]>([]);
  const [recordings, setRecordings] = useState<ClassRecording[]>([]);
  const [recordingAccess, setRecordingAccess] = useState<ClassRecordingAccess[]>([]);
  const [publishedVideos, setPublishedVideos] = useState<ContentLibraryItemSummary[]>([]);
  const [zoomStatus, setZoomStatus] = useState<ClassZoomStatus | null>(null);
  const [selectedRecordingKey, setSelectedRecordingKey] = useState('');
  const [selectedCandidateKey, setSelectedCandidateKey] = useState('');
  const [selectedVideoKey, setSelectedVideoKey] = useState('');
  const [seriesForm, setSeriesForm] = useState<SeriesFormState>(emptySeriesForm);
  const [occurrenceForm, setOccurrenceForm] = useState<OccurrenceFormState>(initialOccurrenceForm);
  const [editingSeriesKey, setEditingSeriesKey] = useState<string | null>(null);
  const [showSeriesForm, setShowSeriesForm] = useState(false);
  const [showOccurrenceForm, setShowOccurrenceForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [zoomError, setZoomError] = useState('');
  const [notice, setNotice] = useState('');

  const activeSeries = useMemo(() => series.filter((item) => item.status !== 'archived'), [series]);
  const attachableVideos = useMemo(
    () =>
      publishedVideos.filter(
        (item) =>
          item.item_type === 'video' &&
          item.lifecycle_state === 'published' &&
          (!item.occurrence_key || item.occurrence_key === selectedOccurrenceKey),
      ),
    [publishedVideos, selectedOccurrenceKey],
  );

  useEffect(() => {
    void refreshSeries();
  }, []);

  useEffect(() => {
    if (!selectedOccurrenceKey) {
      setManagedOccurrence(null);
      setEnrollments([]);
      setCandidates([]);
      setRecordings([]);
      setRecordingAccess([]);
      setZoomStatus(null);
      setLoading(false);
      return;
    }
    void refreshOccurrenceData(selectedOccurrenceKey);
  }, [selectedOccurrenceKey]);

  useEffect(() => {
    if (!selectedOccurrenceKey || !selectedRecordingKey) {
      setRecordingAccess([]);
      return;
    }
    void refreshRecordingAccess(selectedOccurrenceKey, selectedRecordingKey);
  }, [selectedOccurrenceKey, selectedRecordingKey]);

  async function refreshSeries() {
    try {
      const result = await listManagedClassSeries();
      setSeries(result.series);
      setOccurrenceForm((current) => ({
        ...current,
        seriesKey:
          current.seriesKey ||
          result.series.find((item) => item.status !== 'archived')?.class_series_key ||
          '',
      }));
    } catch (caught) {
      setError(messageFrom(caught, 'Classes could not load.'));
    }
  }

  async function refreshOccurrenceData(occurrenceKey: string) {
    setLoading(true);
    setError('');
    const [managed, roster, candidateList, recordingList, videos, zoom] = await Promise.allSettled([
      getManagedClassOccurrence(occurrenceKey),
      listClassEnrollments(occurrenceKey),
      listClassEnrollmentCandidates(occurrenceKey),
      listClassRecordings(occurrenceKey),
      getContentLibrary('lifecycle_state=published&item_type=video'),
      getClassZoomStatus(occurrenceKey),
    ]);

    if (managed.status === 'rejected') {
      setManagedOccurrence(null);
      setError(messageFrom(managed.reason, 'Class occurrence could not load.'));
      setLoading(false);
      return;
    }
    setManagedOccurrence(managed.value.occurrence);
    setOccurrenceForm({
      seriesKey: managed.value.occurrence.class_series_key,
      startsAt: localDateTimeInput(new Date(managed.value.occurrence.starts_at)),
      endsAt: localDateTimeInput(new Date(managed.value.occurrence.ends_at)),
      status: managed.value.occurrence.status,
    });

    if (roster.status === 'fulfilled') setEnrollments(roster.value.enrollments);
    else setError(messageFrom(roster.reason, 'Enrollments could not load.'));
    if (candidateList.status === 'fulfilled') {
      setCandidates(candidateList.value.candidates);
      setSelectedCandidateKey((current) => {
        if (candidateList.value.candidates.some((item) => item.learner_key === current)) {
          return current;
        }
        return (
          candidateList.value.candidates.find((item) => item.enrollment_state !== 'active')
            ?.learner_key ?? ''
        );
      });
    }
    if (recordingList.status === 'fulfilled') {
      setRecordings(recordingList.value.recordings);
      setSelectedRecordingKey((current) => {
        if (recordingList.value.recordings.some((item) => item.content_item_key === current)) {
          return current;
        }
        return recordingList.value.recordings[0]?.content_item_key ?? '';
      });
    }
    if (videos.status === 'fulfilled') {
      setPublishedVideos(videos.value.items);
      setSelectedVideoKey((current) => {
        if (videos.value.items.some((item) => item.item_key === current)) return current;
        return (
          videos.value.items.find(
            (item) => !item.occurrence_key || item.occurrence_key === occurrenceKey,
          )?.item_key ?? ''
        );
      });
    }
    if (zoom.status === 'fulfilled') {
      setZoomStatus(zoom.value.data);
      setZoomError('');
    } else {
      setZoomStatus(null);
      setZoomError(messageFrom(zoom.reason, 'Zoom status could not load.'));
    }
    setLoading(false);
  }

  async function refreshRecordingAccess(occurrenceKey: string, itemKey: string) {
    try {
      const result = await listClassRecordingAccess(occurrenceKey, itemKey);
      setRecordingAccess(result.access);
    } catch (caught) {
      setRecordingAccess([]);
      setError(messageFrom(caught, 'Recording access could not load.'));
    }
  }

  async function runMutation(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (caught) {
      setError(messageFrom(caught, 'The change could not be saved.'));
    } finally {
      setBusy(false);
    }
  }

  async function saveSeries(event: React.FormEvent) {
    event.preventDefault();
    await runMutation(async () => {
      if (editingSeriesKey) {
        const current = series.find((item) => item.class_series_key === editingSeriesKey);
        if (!current) throw new Error('Reload the class before editing it.');
        await updateManagedClassSeries(csrfToken, editingSeriesKey, {
          title: seriesForm.title,
          description: seriesForm.description || null,
          teacher_name: seriesForm.teacherName || null,
          timezone: seriesForm.timezone,
          local_start_time: seriesForm.localStartTime,
          reminder_local_time: seriesForm.reminderLocalTime,
          status: current.status,
          version: current.version,
        });
        setNotice('Class changes saved.');
      } else {
        await createManagedClassSeries(csrfToken, {
          title: seriesForm.title,
          description: seriesForm.description || null,
          teacher_name: seriesForm.teacherName || null,
          timezone: seriesForm.timezone,
          local_start_time: seriesForm.localStartTime,
          reminder_local_time: seriesForm.reminderLocalTime,
          idempotency_key: createIdempotencyKey(),
        });
        setNotice('Class created.');
      }
      setEditingSeriesKey(null);
      setShowSeriesForm(false);
      setSeriesForm(emptySeriesForm);
      await refreshSeries();
    });
  }

  async function archiveSeries(item: ClassSeries) {
    await runMutation(async () => {
      await updateManagedClassSeries(csrfToken, item.class_series_key, {
        title: item.title,
        description: item.description,
        teacher_name: item.teacher_name,
        timezone: item.timezone,
        local_start_time: item.local_start_time,
        reminder_local_time: item.reminder_local_time,
        status: 'archived',
        version: item.version,
      });
      setNotice(`${item.title} archived.`);
      await refreshSeries();
    });
  }

  async function saveOccurrence(event: React.FormEvent) {
    event.preventDefault();
    await runMutation(async () => {
      const startsAt = new Date(occurrenceForm.startsAt);
      const endsAt = new Date(occurrenceForm.endsAt);
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        throw new Error('Choose valid start and end times.');
      }
      if (managedOccurrence && !showOccurrenceForm) {
        const result = await updateManagedClassOccurrence(
          csrfToken,
          managedOccurrence.occurrence_key,
          {
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            status: occurrenceForm.status,
            version: managedOccurrence.version,
          },
        );
        setManagedOccurrence(result.occurrence);
        setNotice('Occurrence changes saved.');
        await onRefreshOccurrences(result.occurrence.occurrence_key);
        await refreshOccurrenceData(result.occurrence.occurrence_key);
        return;
      }
      const result = await createManagedClassOccurrence(csrfToken, {
        class_series_key: occurrenceForm.seriesKey,
        local_class_date: localDateForInput(startsAt),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        is_operator_test: false,
        idempotency_key: createIdempotencyKey(),
      });
      setShowOccurrenceForm(false);
      setNotice('Occurrence created.');
      await onRefreshOccurrences(result.occurrence.occurrence_key);
    });
  }

  async function changeEnrollment(learnerKey: string, access: 'active' | 'revoked') {
    if (!selectedOccurrenceKey) return;
    await runMutation(async () => {
      if (access === 'active') {
        await enrollLearnerInClass(csrfToken, selectedOccurrenceKey, {
          learner_key: learnerKey,
          idempotency_key: createIdempotencyKey(),
        });
        setNotice('Learner enrolled.');
      } else {
        await revokeClassEnrollment(
          csrfToken,
          selectedOccurrenceKey,
          learnerKey,
          createIdempotencyKey(),
        );
        setNotice('Enrollment revoked. Schedule and recording access were removed.');
      }
      await refreshOccurrenceData(selectedOccurrenceKey);
      await onRefreshOccurrences(selectedOccurrenceKey);
    });
  }

  async function attachRecording(itemKey: string, availability: 'available' | 'unavailable') {
    if (!selectedOccurrenceKey) return;
    await runMutation(async () => {
      await attachClassRecording(csrfToken, selectedOccurrenceKey, {
        content_item_key: itemKey,
        availability,
        idempotency_key: createIdempotencyKey(),
      });
      setNotice(
        availability === 'available'
          ? 'Recording attached and granted to the active roster.'
          : 'Recording made unavailable.',
      );
      await refreshOccurrenceData(selectedOccurrenceKey);
      await onRefreshOccurrences(selectedOccurrenceKey);
    });
  }

  async function changeRecordingAccess(
    itemKey: string,
    learnerKey: string,
    access: 'active' | 'revoked',
  ) {
    if (!selectedOccurrenceKey) return;
    await runMutation(async () => {
      await setClassRecordingAccess(csrfToken, selectedOccurrenceKey, itemKey, {
        learner_key: learnerKey,
        access,
        idempotency_key: createIdempotencyKey(),
      });
      setNotice(access === 'active' ? 'Recording access granted.' : 'Recording access revoked.');
      await refreshOccurrenceData(selectedOccurrenceKey);
      await refreshRecordingAccess(selectedOccurrenceKey, itemKey);
    });
  }

  async function provisionZoom() {
    if (!managedOccurrence) return;
    await runMutation(async () => {
      const result = await provisionClassZoom(csrfToken, managedOccurrence.occurrence_key, {
        purpose: managedOccurrence.is_operator_test ? 'synthetic_acceptance' : 'normal_class',
        idempotency_key: createIdempotencyKey(),
      });
      setZoomStatus(result.data);
      setZoomError('');
      setNotice(
        result.data.meeting_state === 'active'
          ? 'Zoom meeting is provisioned.'
          : 'Zoom provisioning request recorded.',
      );
    });
  }

  async function deleteSyntheticZoom() {
    if (
      !managedOccurrence?.is_operator_test ||
      !window.confirm(
        'Delete this isolated app-created Zoom acceptance meeting? This cannot be undone.',
      )
    ) {
      return;
    }
    await runMutation(async () => {
      await deleteSyntheticClassZoom(csrfToken, managedOccurrence.occurrence_key);
      setNotice('Synthetic Zoom meeting deleted.');
      const result = await getClassZoomStatus(managedOccurrence.occurrence_key);
      setZoomStatus(result.data);
      setZoomError('');
    });
  }

  const selector =
    section === 'classes' ? null : (
      <OccurrenceSelector
        occurrences={occurrences}
        selectedOccurrenceKey={selectedOccurrenceKey}
        onSelectOccurrence={onSelectOccurrence}
      />
    );

  if (occurrencesLoading && occurrences.length === 0 && section !== 'classes') {
    return <LoadingState label="Loading classroom occurrences" />;
  }
  if (occurrencesError && section !== 'classes') {
    return (
      <ErrorState
        title="Classroom could not load"
        body={occurrencesError}
        action={
          <Button type="button" onClick={() => void onRefreshOccurrences()}>
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <div className="class-management">
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      {selector}
      {section === 'classes' && (
        <ClassesSection
          dailyFlow={dailyFlow}
          series={series}
          selectedSeriesKey={selectedSeriesKey}
          form={seriesForm}
          editingSeriesKey={editingSeriesKey}
          showForm={showSeriesForm}
          busy={busy}
          onFormChange={setSeriesForm}
          onShowCreate={() => {
            setEditingSeriesKey(null);
            setSeriesForm(emptySeriesForm);
            setShowSeriesForm(true);
          }}
          onEdit={(item) => {
            setEditingSeriesKey(item.class_series_key);
            setSeriesForm({
              title: item.title,
              description: item.description ?? '',
              teacherName: item.teacher_name ?? '',
              timezone: item.timezone,
              localStartTime: item.local_start_time,
              reminderLocalTime: item.reminder_local_time,
            });
            setShowSeriesForm(true);
          }}
          onCancel={() => {
            setEditingSeriesKey(null);
            setShowSeriesForm(false);
          }}
          onSubmit={saveSeries}
          onArchive={(item) => void archiveSeries(item)}
          onOpen={(item) =>
            onNavigate(`/app/classroom/classes/${encodeURIComponent(item.class_series_key)}`)
          }
          onBack={() => onNavigate('/app/classroom/classes')}
        />
      )}
      {section === 'occurrences' &&
        (loading ? (
          <LoadingState label="Loading occurrence details" />
        ) : (
          <OccurrencesSection
            dailyFlow={dailyFlow}
            series={activeSeries}
            occurrence={managedOccurrence}
            form={occurrenceForm}
            showCreate={showOccurrenceForm}
            busy={busy}
            zoomStatus={zoomStatus}
            zoomError={zoomError}
            onFormChange={setOccurrenceForm}
            onShowCreate={() => {
              setManagedOccurrence(managedOccurrence);
              setOccurrenceForm({
                ...initialOccurrenceForm(),
                seriesKey: activeSeries[0]?.class_series_key ?? '',
              });
              setShowOccurrenceForm(true);
            }}
            onCancelCreate={() => {
              setShowOccurrenceForm(false);
              if (selectedOccurrenceKey) void refreshOccurrenceData(selectedOccurrenceKey);
            }}
            onSubmit={saveOccurrence}
            onProvisionZoom={() => void provisionZoom()}
            onDeleteSyntheticZoom={() => void deleteSyntheticZoom()}
            onRefreshZoom={() =>
              selectedOccurrenceKey && void refreshOccurrenceData(selectedOccurrenceKey)
            }
            onGoToClasses={() => onNavigate('/app/classes')}
          />
        ))}
      {section === 'enrollments' &&
        renderSelectedOccurrenceState(
          loading,
          managedOccurrence,
          <EnrollmentsSection
            enrollments={enrollments}
            candidates={candidates}
            selectedCandidateKey={selectedCandidateKey}
            busy={busy}
            onCandidateChange={setSelectedCandidateKey}
            onEnroll={() => void changeEnrollment(selectedCandidateKey, 'active')}
            onChangeEnrollment={(learnerKey, access) => void changeEnrollment(learnerKey, access)}
          />,
          () => onNavigate('/app/classes/occurrences'),
        )}
      {section === 'recordings' &&
        renderSelectedOccurrenceState(
          loading,
          managedOccurrence,
          <RecordingsSection
            recordings={recordings}
            videos={attachableVideos}
            selectedVideoKey={selectedVideoKey}
            busy={busy}
            onVideoChange={setSelectedVideoKey}
            onAttach={() => void attachRecording(selectedVideoKey, 'available')}
            onAvailabilityChange={(itemKey, availability) =>
              void attachRecording(itemKey, availability)
            }
            onGoToContent={() => window.location.assign('/app/content')}
          />,
          () => onNavigate('/app/classes/occurrences'),
        )}
      {section === 'access' &&
        renderSelectedOccurrenceState(
          loading,
          managedOccurrence,
          <RecordingAccessSection
            recordings={recordings}
            selectedRecordingKey={selectedRecordingKey}
            access={recordingAccess}
            busy={busy}
            onRecordingChange={setSelectedRecordingKey}
            onChange={(itemKey, learnerKey, nextAccess) =>
              void changeRecordingAccess(itemKey, learnerKey, nextAccess)
            }
          />,
          () => onNavigate('/app/classes/recordings'),
        )}
    </div>
  );
}

function ClassesSection({
  dailyFlow,
  series,
  selectedSeriesKey,
  form,
  editingSeriesKey,
  showForm,
  busy,
  onFormChange,
  onShowCreate,
  onEdit,
  onCancel,
  onSubmit,
  onArchive,
  onOpen,
  onBack,
}: {
  dailyFlow: boolean;
  series: ClassSeries[];
  selectedSeriesKey: string | null;
  form: SeriesFormState;
  editingSeriesKey: string | null;
  showForm: boolean;
  busy: boolean;
  onFormChange: (form: SeriesFormState) => void;
  onShowCreate: () => void;
  onEdit: (item: ClassSeries) => void;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onArchive: (item: ClassSeries) => void;
  onOpen: (item: ClassSeries) => void;
  onBack: () => void;
}) {
  const selectedSeries = selectedSeriesKey
    ? (series.find((item) => item.class_series_key === selectedSeriesKey) ?? null)
    : null;
  return (
    <section className="class-management__section">
      <header className="class-management__heading">
        <div>
          <h2>{selectedSeriesKey ? 'Class series detail' : 'Classes'}</h2>
          <p>
            {selectedSeriesKey
              ? 'Review and govern this reusable class series.'
              : 'Create the reusable class before scheduling individual occurrences.'}
          </p>
        </div>
        {selectedSeriesKey ? (
          <Button type="button" onClick={onBack}>
            Back to Classes
          </Button>
        ) : !showForm && !dailyFlow ? (
          <Button type="button" variant="primary" onClick={onShowCreate}>
            Create class
          </Button>
        ) : null}
      </header>
      {showForm && (
        <form className="class-management__form" onSubmit={onSubmit}>
          <label>
            <span>Class name</span>
            <Input
              required
              value={form.title}
              onChange={(event) => onFormChange({ ...form, title: event.currentTarget.value })}
            />
          </label>
          <label>
            <span>Teacher</span>
            <Input
              value={form.teacherName}
              onChange={(event) =>
                onFormChange({ ...form, teacherName: event.currentTarget.value })
              }
            />
          </label>
          <label>
            <span>Timezone</span>
            <Input
              required
              value={form.timezone}
              onChange={(event) => onFormChange({ ...form, timezone: event.currentTarget.value })}
            />
          </label>
          <label>
            <span>Usual start time</span>
            <Input
              required
              type="time"
              value={form.localStartTime}
              onChange={(event) =>
                onFormChange({ ...form, localStartTime: event.currentTarget.value })
              }
            />
          </label>
          <label>
            <span>Reminder time</span>
            <Input
              required
              type="time"
              value={form.reminderLocalTime}
              onChange={(event) =>
                onFormChange({ ...form, reminderLocalTime: event.currentTarget.value })
              }
            />
          </label>
          <label className="class-management__wide-field">
            <span>Description</span>
            <Input
              value={form.description}
              onChange={(event) =>
                onFormChange({ ...form, description: event.currentTarget.value })
              }
            />
          </label>
          <div className="class-management__actions">
            <Button type="submit" variant="primary" disabled={busy}>
              {editingSeriesKey ? 'Save class' : 'Create class'}
            </Button>
            <Button type="button" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      {selectedSeriesKey && !selectedSeries && series.length > 0 ? (
        <ErrorState
          title="Class series not found"
          body="The requested class series is outside this One Time account or no longer exists."
          action={
            <Button type="button" onClick={onBack}>
              Back to Classes
            </Button>
          }
        />
      ) : selectedSeries ? (
        <Card className="class-management__card" data-usable="class-series-detail">
          <header>
            <div>
              <h3>{selectedSeries.title}</h3>
              <p>{selectedSeries.class_series_key}</p>
            </div>
            <StatusChip tone={selectedSeries.status === 'active' ? 'success' : 'neutral'}>
              {readable(selectedSeries.status)}
            </StatusChip>
          </header>
          {selectedSeries.description && <p>{selectedSeries.description}</p>}
          <dl>
            <div>
              <dt>Teacher</dt>
              <dd>{selectedSeries.teacher_name || 'No teacher set'}</dd>
            </div>
            <div>
              <dt>Timezone</dt>
              <dd>{selectedSeries.timezone}</dd>
            </div>
            <div>
              <dt>Usual start</dt>
              <dd>{selectedSeries.local_start_time}</dd>
            </div>
            <div>
              <dt>Reminder</dt>
              <dd>{selectedSeries.reminder_local_time}</dd>
            </div>
          </dl>
          <div className="class-management__actions">
            <Button type="button" onClick={() => onEdit(selectedSeries)} disabled={busy}>
              Edit class
            </Button>
            {selectedSeries.status !== 'archived' && (
              <Button
                type="button"
                variant="danger"
                onClick={() => onArchive(selectedSeries)}
                disabled={busy}
              >
                Archive class
              </Button>
            )}
          </div>
        </Card>
      ) : series.length === 0 && !showForm ? (
        <EmptyState
          title="No classes yet"
          body="Create the first class, then add its scheduled occurrence."
          action={
            <Button type="button" variant="primary" onClick={onShowCreate}>
              Create first class
            </Button>
          }
        />
      ) : (
        <div className="class-management__cards">
          {series.map((item) => (
            <Card key={item.class_series_key} className="class-management__card">
              <header>
                <div>
                  <h3>{item.title}</h3>
                  <p>
                    {item.teacher_name || 'No teacher set'} · {item.local_start_time} ·{' '}
                    {item.timezone}
                  </p>
                </div>
                <StatusChip tone={item.status === 'active' ? 'success' : 'neutral'}>
                  {readable(item.status)}
                </StatusChip>
              </header>
              {item.description && <p>{item.description}</p>}
              <div className="class-management__actions">
                <Button type="button" onClick={() => onOpen(item)} disabled={busy}>
                  Open class details
                </Button>
                <Button type="button" onClick={() => onEdit(item)} disabled={busy}>
                  Edit
                </Button>
                {item.status !== 'archived' && (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => onArchive(item)}
                    disabled={busy}
                  >
                    Archive
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function OccurrencesSection({
  dailyFlow,
  series,
  occurrence,
  form,
  showCreate,
  busy,
  zoomStatus,
  zoomError,
  onFormChange,
  onShowCreate,
  onCancelCreate,
  onSubmit,
  onProvisionZoom,
  onDeleteSyntheticZoom,
  onRefreshZoom,
  onGoToClasses,
}: {
  dailyFlow: boolean;
  series: ClassSeries[];
  occurrence: ManagedClassOccurrence | null;
  form: OccurrenceFormState;
  showCreate: boolean;
  busy: boolean;
  zoomStatus: ClassZoomStatus | null;
  zoomError: string;
  onFormChange: (form: OccurrenceFormState) => void;
  onShowCreate: () => void;
  onCancelCreate: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onProvisionZoom: () => void;
  onDeleteSyntheticZoom: () => void;
  onRefreshZoom: () => void;
  onGoToClasses: () => void;
}) {
  if (series.length === 0) {
    return (
      <EmptyState
        title="Create a class first"
        body="Occurrences need an active class for their title, teacher, and timezone."
        action={
          <Button type="button" variant="primary" onClick={onGoToClasses}>
            Go to Classes
          </Button>
        }
      />
    );
  }
  return (
    <section className="class-management__section">
      <header className="class-management__heading">
        <div>
          <h2>Occurrences</h2>
          <p>Schedule, reschedule, complete, or cancel one exact class meeting.</p>
        </div>
        {!showCreate && !dailyFlow && (
          <Button type="button" variant="primary" onClick={onShowCreate}>
            Create occurrence
          </Button>
        )}
      </header>
      {(showCreate || occurrence) && (
        <form className="class-management__form" onSubmit={onSubmit}>
          {showCreate && (
            <label>
              <span>Class</span>
              <Select
                required
                value={form.seriesKey}
                onChange={(event) =>
                  onFormChange({ ...form, seriesKey: event.currentTarget.value })
                }
              >
                {series.map((item) => (
                  <option key={item.class_series_key} value={item.class_series_key}>
                    {item.title}
                  </option>
                ))}
              </Select>
            </label>
          )}
          <label>
            <span>Starts (your browser timezone)</span>
            <Input
              required
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) => onFormChange({ ...form, startsAt: event.currentTarget.value })}
            />
          </label>
          <label>
            <span>Ends (your browser timezone)</span>
            <Input
              required
              type="datetime-local"
              value={form.endsAt}
              onChange={(event) => onFormChange({ ...form, endsAt: event.currentTarget.value })}
            />
          </label>
          {!showCreate && (
            <label>
              <span>Status</span>
              <Select
                value={form.status}
                onChange={(event) =>
                  onFormChange({
                    ...form,
                    status: event.currentTarget.value as OccurrenceFormState['status'],
                  })
                }
              >
                <option value="scheduled">Scheduled</option>
                <option value="live">Live</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </label>
          )}
          <div className="class-management__actions">
            <Button type="submit" variant="primary" disabled={busy}>
              {showCreate ? 'Create occurrence' : 'Save occurrence'}
            </Button>
            {showCreate && (
              <Button type="button" onClick={onCancelCreate} disabled={busy}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}
      {!showCreate && !occurrence && (
        <EmptyState
          title="No occurrence selected"
          body="Create the first occurrence or select an existing one."
          action={
            <Button type="button" variant="primary" onClick={onShowCreate}>
              Create first occurrence
            </Button>
          }
        />
      )}
      {occurrence && !showCreate && (
        <ZoomProvisionCard
          occurrence={occurrence}
          status={zoomStatus}
          error={zoomError}
          busy={busy}
          onProvision={onProvisionZoom}
          onDeleteSynthetic={onDeleteSyntheticZoom}
          onRefresh={onRefreshZoom}
        />
      )}
    </section>
  );
}

function ZoomProvisionCard({
  occurrence,
  status,
  error,
  busy,
  onProvision,
  onDeleteSynthetic,
  onRefresh,
}: {
  occurrence: ManagedClassOccurrence;
  status: ClassZoomStatus | null;
  error: string;
  busy: boolean;
  onProvision: () => void;
  onDeleteSynthetic: () => void;
  onRefresh: () => void;
}) {
  const provisioningLocked =
    !status?.provider_ready ||
    ['active', 'provisioning', 'deleting'].includes(status.meeting_state) ||
    busy;
  return (
    <Card className="class-management__card class-management__zoom">
      <header>
        <div>
          <h3>Zoom</h3>
          <p>Persisted meeting status for this exact occurrence.</p>
        </div>
        <StatusChip
          tone={
            status?.meeting_state === 'active'
              ? 'success'
              : status?.meeting_state.includes('failed') ||
                  status?.meeting_state.includes('unknown')
                ? 'danger'
                : 'neutral'
          }
        >
          {status ? readable(status.meeting_state) : 'Status unavailable'}
        </StatusChip>
      </header>
      {error ? (
        <Alert tone="error">{error}</Alert>
      ) : status ? (
        <dl className="class-management__facts">
          <div>
            <dt>Provider</dt>
            <dd>{status.provider_ready ? 'Ready' : 'Not ready'}</dd>
          </div>
          <div>
            <dt>Purpose</dt>
            <dd>{status.purpose ? readable(status.purpose) : 'Not provisioned'}</dd>
          </div>
          <div>
            <dt>Enrolled</dt>
            <dd>{status.enrolled_student_count}</dd>
          </div>
          <div>
            <dt>Registered with Zoom</dt>
            <dd>{status.registered_student_count}</dd>
          </div>
        </dl>
      ) : null}
      {status?.last_error && <Alert tone="error">{status.last_error}</Alert>}
      <div className="class-management__actions">
        <Button type="button" variant="primary" disabled={provisioningLocked} onClick={onProvision}>
          Provision Zoom
        </Button>
        <Button type="button" disabled={busy} onClick={onRefresh}>
          Refresh Zoom status
        </Button>
        {occurrence.is_operator_test &&
          status?.purpose === 'synthetic_acceptance' &&
          status.meeting_state === 'active' && (
            <Button type="button" variant="danger" disabled={busy} onClick={onDeleteSynthetic}>
              Delete synthetic Zoom
            </Button>
          )}
        {status?.meeting_state === 'active' && (
          <Link
            href={`/app/live-console?section=zoom&occurrence_key=${encodeURIComponent(
              occurrence.occurrence_key,
            )}`}
          >
            Open in Live Console
          </Link>
        )}
      </div>
      {!status?.provider_ready && status && (
        <p className="class-management__help">
          Zoom provisioning remains disabled until the provider connection is ready.
        </p>
      )}
    </Card>
  );
}

function EnrollmentsSection({
  enrollments,
  candidates,
  selectedCandidateKey,
  busy,
  onCandidateChange,
  onEnroll,
  onChangeEnrollment,
}: {
  enrollments: ClassEnrollment[];
  candidates: ClassEnrollmentCandidate[];
  selectedCandidateKey: string;
  busy: boolean;
  onCandidateChange: (learnerKey: string) => void;
  onEnroll: () => void;
  onChangeEnrollment: (learnerKey: string, access: 'active' | 'revoked') => void;
}) {
  const availableCandidates = candidates.filter((item) => item.enrollment_state !== 'active');
  return (
    <section className="class-management__section">
      <header className="class-management__heading">
        <div>
          <h2>Enrollments</h2>
          <p>Schedule and recording access follow this exact occurrence roster.</p>
        </div>
      </header>
      {availableCandidates.length > 0 ? (
        <div className="class-management__inline-form">
          <label>
            <span>Active learner</span>
            <Select
              value={selectedCandidateKey}
              onChange={(event) => onCandidateChange(event.currentTarget.value)}
            >
              {availableCandidates.map((item) => (
                <option key={item.learner_key} value={item.learner_key}>
                  {item.learner_name} · {item.household_key}
                </option>
              ))}
            </Select>
          </label>
          <Button
            type="button"
            variant="primary"
            disabled={busy || !selectedCandidateKey}
            onClick={onEnroll}
          >
            Enroll learner
          </Button>
        </div>
      ) : candidates.length === 0 ? (
        <EmptyState
          title="No active learners"
          body="Create a learner in Contacts before adding this class enrollment."
          action={<Link href="/app/crm/students">Go to Students</Link>}
        />
      ) : null}
      {enrollments.length === 0 ? (
        <EmptyState
          title="No one is enrolled"
          body="Choose an active learner above to add the first enrollment."
        />
      ) : (
        <div className="class-management__cards">
          {enrollments.map((item) => (
            <Card key={item.learner_key} className="class-management__card">
              <header>
                <div>
                  <h3>{item.learner_name}</h3>
                  <p>{item.household_key}</p>
                </div>
                <StatusChip tone={item.enrollment_state === 'active' ? 'success' : 'danger'}>
                  {readable(item.enrollment_state)}
                </StatusChip>
              </header>
              <Button
                type="button"
                variant={item.enrollment_state === 'active' ? 'danger' : 'primary'}
                disabled={busy}
                onClick={() =>
                  onChangeEnrollment(
                    item.learner_key,
                    item.enrollment_state === 'active' ? 'revoked' : 'active',
                  )
                }
              >
                {item.enrollment_state === 'active' ? 'Revoke enrollment' : 'Re-enroll'}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function RecordingsSection({
  recordings,
  videos,
  selectedVideoKey,
  busy,
  onVideoChange,
  onAttach,
  onAvailabilityChange,
  onGoToContent,
}: {
  recordings: ClassRecording[];
  videos: ContentLibraryItemSummary[];
  selectedVideoKey: string;
  busy: boolean;
  onVideoChange: (itemKey: string) => void;
  onAttach: () => void;
  onAvailabilityChange: (itemKey: string, state: 'available' | 'unavailable') => void;
  onGoToContent: () => void;
}) {
  const unattached = videos.filter(
    (item) => !recordings.some((recording) => recording.content_item_key === item.item_key),
  );
  return (
    <section className="class-management__section">
      <header className="class-management__heading">
        <div>
          <h2>Recordings</h2>
          <p>Attach only published protected video content to this occurrence.</p>
        </div>
      </header>
      {unattached.length > 0 ? (
        <div className="class-management__inline-form">
          <label>
            <span>Published recording</span>
            <Select
              value={selectedVideoKey}
              onChange={(event) => onVideoChange(event.currentTarget.value)}
            >
              {unattached.map((item) => (
                <option key={item.item_key} value={item.item_key}>
                  {item.title}
                </option>
              ))}
            </Select>
          </label>
          <Button
            type="button"
            variant="primary"
            disabled={busy || !selectedVideoKey}
            onClick={onAttach}
          >
            Attach recording
          </Button>
        </div>
      ) : recordings.length === 0 ? (
        <EmptyState
          title="No published recording is ready"
          body="Publish the protected Vimeo-backed video in Content, then return to attach it."
          action={
            <Button type="button" variant="primary" onClick={onGoToContent}>
              Go to Content
            </Button>
          }
        />
      ) : null}
      {recordings.length === 0 ? (
        <EmptyState
          title="No recording attached"
          body="Attach a published protected recording to make it available to enrolled learners."
        />
      ) : (
        <div className="class-management__cards">
          {recordings.map((item) => (
            <Card key={item.content_item_key} className="class-management__card">
              <header>
                <div>
                  <h3>{item.title}</h3>
                  <p>
                    {item.entitled_learner_count} active · {item.revoked_learner_count} revoked
                  </p>
                </div>
                <StatusChip tone={item.availability === 'available' ? 'success' : 'danger'}>
                  {readable(item.availability)}
                </StatusChip>
              </header>
              <Button
                type="button"
                variant={item.availability === 'available' ? 'danger' : 'primary'}
                disabled={busy}
                onClick={() =>
                  onAvailabilityChange(
                    item.content_item_key,
                    item.availability === 'available' ? 'unavailable' : 'available',
                  )
                }
              >
                {item.availability === 'available' ? 'Make unavailable' : 'Make available'}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function RecordingAccessSection({
  recordings,
  selectedRecordingKey,
  access,
  busy,
  onRecordingChange,
  onChange,
}: {
  recordings: ClassRecording[];
  selectedRecordingKey: string;
  access: ClassRecordingAccess[];
  busy: boolean;
  onRecordingChange: (itemKey: string) => void;
  onChange: (itemKey: string, learnerKey: string, access: 'active' | 'revoked') => void;
}) {
  if (recordings.length === 0) {
    return (
      <EmptyState
        title="Attach a recording first"
        body="Per-learner access is available after a protected recording is attached."
      />
    );
  }
  return (
    <section className="class-management__section">
      <header className="class-management__heading">
        <div>
          <h2>Recording access</h2>
          <p>Grant or revoke playback for an actively enrolled learner.</p>
        </div>
      </header>
      <label className="class-management__selector">
        <span>Recording</span>
        <Select
          value={selectedRecordingKey}
          onChange={(event) => onRecordingChange(event.currentTarget.value)}
        >
          {recordings.map((item) => (
            <option key={item.content_item_key} value={item.content_item_key}>
              {item.title}
            </option>
          ))}
        </Select>
      </label>
      {access.length === 0 ? (
        <EmptyState
          title="No enrolled learners"
          body="Enroll a learner in this occurrence before granting recording access."
        />
      ) : (
        <div className="class-management__cards">
          {access.map((item) => (
            <Card key={item.learner_key} className="class-management__card">
              <header>
                <div>
                  <h3>{item.learner_name}</h3>
                  <p>
                    Enrollment: {readable(item.enrollment_state)} · Household: {item.household_key}
                  </p>
                </div>
                <StatusChip tone={item.access === 'active' ? 'success' : 'danger'}>
                  {readable(item.access)}
                </StatusChip>
              </header>
              <Button
                type="button"
                variant={item.access === 'active' ? 'danger' : 'primary'}
                disabled={busy || item.enrollment_state !== 'active'}
                onClick={() =>
                  onChange(
                    selectedRecordingKey,
                    item.learner_key,
                    item.access === 'active' ? 'revoked' : 'active',
                  )
                }
              >
                {item.access === 'active' ? 'Revoke access' : 'Grant access'}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function OccurrenceSelector({
  occurrences,
  selectedOccurrenceKey,
  onSelectOccurrence,
}: {
  occurrences: ClassOccurrenceSummary[];
  selectedOccurrenceKey: string | null;
  onSelectOccurrence: (occurrenceKey: string) => void;
}) {
  if (occurrences.length === 0) return null;
  return (
    <label className="classroom-occurrence-selector">
      <span>Class occurrence</span>
      <Select
        value={selectedOccurrenceKey ?? ''}
        onChange={(event) => onSelectOccurrence(event.currentTarget.value)}
      >
        {!selectedOccurrenceKey && (
          <option value="" disabled>
            Choose an occurrence
          </option>
        )}
        {occurrences.map((item) => (
          <option key={item.occurrence_key} value={item.occurrence_key}>
            {item.title} · {formatDate(item.starts_at)}
          </option>
        ))}
      </Select>
    </label>
  );
}

function renderSelectedOccurrenceState(
  loading: boolean,
  occurrence: ManagedClassOccurrence | null,
  content: React.ReactNode,
  onAction: () => void,
) {
  if (loading) return <LoadingState label="Loading occurrence data" />;
  if (occurrence) return content;
  return (
    <EmptyState
      title="Create an occurrence first"
      body="This section applies to one exact scheduled occurrence."
      action={
        <Button type="button" variant="primary" onClick={onAction}>
          Go to Occurrences
        </Button>
      }
    />
  );
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function readable(value: string) {
  return value.replaceAll('_', ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

function localDateTimeInput(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function localDateForInput(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
