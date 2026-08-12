import React, { useEffect, useState, type ChangeEvent, type DragEvent } from 'react';
import { Button, Select } from '@onetime/brand-system/react';
import {
  CONTENT_INGEST_MAX_BYTES,
  CONTENT_INGEST_MAX_CONCURRENT_PARTS,
  CONTENT_INGEST_MIME_TYPES,
  CONTENT_INGEST_PART_BYTES,
  type ContentIngestOccurrenceOption,
  type ContentSourceRecord,
  type ExistingReviewedRecordingIntent,
  type MultipartUploadPlan,
  type UploadSessionRecord,
} from '../../../../../../../../packages/contracts/src/content/ingest/index.ts';

type UploadRow = {
  name: string;
  state: 'starting' | 'uploading' | 'confirming' | 'confirmed' | 'matching' | 'matched' | 'failed';
  completedParts: number;
  totalParts: number;
  sourceId?: string;
  sourceVersion?: number;
  occurrenceId?: string | undefined;
  safeError?: string | undefined;
};

export function ContentIngestWorkspace(props: {
  beginUpload: (
    file: File,
    existingRecordingIntent?: ExistingReviewedRecordingIntent,
  ) => Promise<{
    session: UploadSessionRecord;
    plan: MultipartUploadPlan;
  }>;
  uploadPart: (input: {
    session: UploadSessionRecord;
    partNumber: number;
    body: Blob;
  }) => Promise<void>;
  confirmUpload: (session: UploadSessionRecord) => Promise<ContentSourceRecord>;
  listOccurrences: () => Promise<readonly ContentIngestOccurrenceOption[]>;
  matchSource: (input: {
    sourceId: string;
    sourceVersion: number;
    occurrenceId: string;
  }) => Promise<ContentSourceRecord>;
}) {
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [occurrences, setOccurrences] = useState<readonly ContentIngestOccurrenceOption[]>([]);
  const [occurrenceError, setOccurrenceError] = useState('');
  const [existingReviewed, setExistingReviewed] = useState(false);
  const [childDataDisposition, setChildDataDisposition] =
    useState<ExistingReviewedRecordingIntent['childDataDisposition']>('none_present');

  useEffect(() => {
    let active = true;
    void props
      .listOccurrences()
      .then((options) => {
        if (active) setOccurrences(options);
      })
      .catch(() => {
        if (active) setOccurrenceError('Class dates are temporarily unavailable.');
      });
    return () => {
      active = false;
    };
  }, [props.listOccurrences]);

  async function accept(files: FileList | readonly File[]) {
    for (const file of Array.from(files)) {
      const row: UploadRow = {
        name: file.name,
        state: 'starting',
        completedParts: 0,
        totalParts: Math.ceil(file.size / CONTENT_INGEST_PART_BYTES),
      };
      setUploads((current) => [...current, row]);
      try {
        assertClientFile(file);
        const started = await props.beginUpload(
          file,
          existingReviewed
            ? {
                origin: 'recordings_collection',
                rightsToProcessAndPrivatelyPublish: true,
                humanReviewCompleted: true,
                childDataDisposition,
                noUnreviewedChildData: true,
              }
            : undefined,
        );
        update(file.name, { state: 'uploading', totalParts: started.plan.totalParts });
        await uploadFileInBoundedParts(file, started.session, props.uploadPart, (completed) =>
          update(file.name, { completedParts: completed }),
        );
        update(file.name, { state: 'confirming' });
        const source = await props.confirmUpload(started.session);
        update(file.name, {
          state: 'confirmed',
          sourceId: source.id,
          sourceVersion: source.version,
          occurrenceId: undefined,
        });
      } catch (error) {
        update(file.name, {
          state: 'failed',
          safeError: error instanceof Error ? error.message : 'Upload could not be completed.',
        });
      }
    }
  }

  async function match(upload: UploadRow) {
    if (!upload.sourceId || !upload.sourceVersion || !upload.occurrenceId) return;
    update(upload.name, { state: 'matching', safeError: undefined });
    try {
      const source = await props.matchSource({
        sourceId: upload.sourceId,
        sourceVersion: upload.sourceVersion,
        occurrenceId: upload.occurrenceId,
      });
      update(upload.name, { state: 'matched', sourceVersion: source.version });
    } catch (error) {
      update(upload.name, {
        state: 'confirmed',
        safeError:
          error instanceof Error ? error.message : 'Class matching could not be completed.',
      });
    }
  }

  function update(name: string, patch: Partial<UploadRow>) {
    setUploads((current) =>
      current.map((upload) => (upload.name === name ? { ...upload, ...patch } : upload)),
    );
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    void accept(event.dataTransfer.files);
  }

  function onSelect(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) void accept(event.target.files);
    event.target.value = '';
  }

  return (
    <section aria-labelledby="content-ingest-heading">
      <header>
        <p>Content</p>
        <h1 id="content-ingest-heading">Recording intake</h1>
        <p>
          Upload an original recording. MP4, MOV, and MKV files up to 5 GiB are transferred in
          resumable 64 MiB parts.
        </p>
      </header>
      <label>
        <input
          type="checkbox"
          checked={existingReviewed}
          onChange={(event) => setExistingReviewed(event.target.checked)}
        />
        <span>
          This is an existing One Time/Rabbi-owned recording. I have the rights to process and
          privately publish it, have completed a human review, and confirm no unreviewed child data
          remains.
        </span>
      </label>
      {existingReviewed ? (
        <label>
          <span>Child-data review result</span>
          <Select
            value={childDataDisposition}
            onChange={(event) =>
              setChildDataDisposition(
                event.target.value as ExistingReviewedRecordingIntent['childDataDisposition'],
              )
            }
          >
            <option value="none_present">No child data present</option>
            <option value="redactions_complete">Required redactions are complete</option>
          </Select>
        </label>
      ) : null}
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        data-drag-active={dragActive}
      >
        <label>
          <span>Drag and drop a recording here, or choose a file</span>
          <input type="file" accept={CONTENT_INGEST_MIME_TYPES.join(',')} onChange={onSelect} />
        </label>
      </div>
      <div role="status" aria-live="polite" aria-atomic="false">
        {occurrenceError ? <p>{occurrenceError}</p> : null}
        {uploads.map((upload) => (
          <article key={upload.name}>
            <h2>{upload.name}</h2>
            <p>
              {upload.state === 'uploading'
                ? `${upload.completedParts} of ${upload.totalParts} parts uploaded`
                : label(upload.state)}
            </p>
            {upload.safeError ? <p>{upload.safeError}</p> : null}
            {upload.sourceId && upload.state !== 'matched' ? (
              <div>
                <label>
                  <span>Class date</span>
                  <Select
                    value={upload.occurrenceId ?? ''}
                    onChange={(event) =>
                      update(upload.name, {
                        occurrenceId: event.target.value,
                        safeError: undefined,
                      })
                    }
                  >
                    <option value="">Choose a class date</option>
                    {occurrences.map((occurrence) => (
                      <option key={occurrence.id} value={occurrence.id}>
                        {occurrenceLabel(occurrence)}
                      </option>
                    ))}
                  </Select>
                </label>
                <Button
                  type="button"
                  variant="primary"
                  disabled={!upload.occurrenceId || upload.state === 'matching'}
                  onClick={() => void match(upload)}
                >
                  {upload.state === 'matching' ? 'Matching…' : 'Match recording'}
                </Button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export async function uploadFileInBoundedParts(
  file: File,
  session: UploadSessionRecord,
  uploadPart: (input: {
    session: UploadSessionRecord;
    partNumber: number;
    body: Blob;
  }) => Promise<void>,
  onProgress: (completedParts: number) => void,
) {
  const parts = Array.from(
    { length: Math.ceil(file.size / CONTENT_INGEST_PART_BYTES) },
    (_, index) => ({
      partNumber: index + 1,
      start: index * CONTENT_INGEST_PART_BYTES,
      end: Math.min((index + 1) * CONTENT_INGEST_PART_BYTES, file.size),
    }),
  );
  let completed = 0;
  for (let offset = 0; offset < parts.length; offset += CONTENT_INGEST_MAX_CONCURRENT_PARTS) {
    const batch = parts.slice(offset, offset + CONTENT_INGEST_MAX_CONCURRENT_PARTS);
    await Promise.all(
      batch.map((part) =>
        uploadPart({
          session,
          partNumber: part.partNumber,
          body: file.slice(part.start, part.end),
        }).then(() => {
          completed += 1;
          onProgress(completed);
        }),
      ),
    );
  }
}

function assertClientFile(file: File) {
  if (
    file.size < 1 ||
    file.size > CONTENT_INGEST_MAX_BYTES ||
    !CONTENT_INGEST_MIME_TYPES.includes(file.type as (typeof CONTENT_INGEST_MIME_TYPES)[number])
  ) {
    throw new Error('Choose an MP4, MOV, or MKV recording no larger than 5 GiB.');
  }
}

function label(state: UploadRow['state']) {
  if (state === 'starting') return 'Preparing secure upload…';
  if (state === 'confirming') return 'Verifying the preserved original…';
  if (state === 'confirmed') return 'Upload confirmed and ready for matching.';
  if (state === 'matching') return 'Matching recording to class…';
  if (state === 'matched') return 'Recording matched and ready for processing.';
  return 'Upload needs attention.';
}

function occurrenceLabel(occurrence: ContentIngestOccurrenceOption) {
  return `${occurrence.localClassDate} · ${new Date(occurrence.startsAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}
