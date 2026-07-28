import React, { useState, type ChangeEvent, type DragEvent } from 'react';
import {
  CONTENT_INGEST_MAX_BYTES,
  CONTENT_INGEST_MAX_CONCURRENT_PARTS,
  CONTENT_INGEST_MIME_TYPES,
  CONTENT_INGEST_PART_BYTES,
  type MultipartUploadPlan,
  type UploadSessionRecord,
} from '../../../../../../../../packages/contracts/src/content/ingest/index.ts';

type UploadRow = {
  name: string;
  state: 'starting' | 'uploading' | 'confirming' | 'confirmed' | 'failed';
  completedParts: number;
  totalParts: number;
  safeError?: string;
};

export function ContentIngestWorkspace(props: {
  beginUpload: (file: File) => Promise<{
    session: UploadSessionRecord;
    plan: MultipartUploadPlan;
  }>;
  uploadPart: (input: {
    session: UploadSessionRecord;
    partNumber: number;
    body: Blob;
  }) => Promise<void>;
  confirmUpload: (session: UploadSessionRecord) => Promise<void>;
}) {
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [dragActive, setDragActive] = useState(false);

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
        const started = await props.beginUpload(file);
        update(file.name, { state: 'uploading', totalParts: started.plan.totalParts });
        await uploadFileInBoundedParts(file, started.session, props.uploadPart, (completed) =>
          update(file.name, { completedParts: completed }),
        );
        update(file.name, { state: 'confirming' });
        await props.confirmUpload(started.session);
        update(file.name, { state: 'confirmed' });
      } catch (error) {
        update(file.name, {
          state: 'failed',
          safeError: error instanceof Error ? error.message : 'Upload could not be completed.',
        });
      }
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
          Upload the original OBS recording. MP4, MOV, and MKV files up to 5 GiB are transferred in
          resumable 64 MiB parts.
        </p>
      </header>
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
        {uploads.map((upload) => (
          <article key={upload.name}>
            <h2>{upload.name}</h2>
            <p>
              {upload.state === 'uploading'
                ? `${upload.completedParts} of ${upload.totalParts} parts uploaded`
                : label(upload.state)}
            </p>
            {upload.safeError ? <p>{upload.safeError}</p> : null}
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
  return 'Upload needs attention.';
}
