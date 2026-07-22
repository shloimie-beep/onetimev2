import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  LEARNING_DELIVERY_TRANSCRIPTION_VOCABULARY_PROMPT,
  buildLearningDeliveryFfmpegRenderPlan,
  buildLearningDeliveryPreparedDemoProjection,
  buildLearningDeliveryTranscriptArtifact,
  createLearningDeliveryOpenAiTranscriptionAdapter,
  learningDeliverySha256Hex,
  parseLearningDeliveryFfprobeJson,
  parseLearningDeliverySilencedetectLog,
  projectLearningDeliveryTranscriptForTrim,
  suggestLearningDeliveryAutomaticTrim,
} from '../../packages/domain/src/content/learning-delivery.ts';
import type {
  LearningDeliveryProbeSummary,
  LearningDeliveryTranscriptSegment,
  LearningDeliveryTrimDecision,
} from '../../packages/contracts/src/content/index.ts';

const RUN_DIR = 'ops/codex-runs/VIMEO-AUTOTRIM-TRANSCRIPTION-REPAIR';
const SAFE_JSON_PATH = path.join(RUN_DIR, 'REAL-MEDIA-CANARY.json');
const SAFE_MD_PATH = path.join(RUN_DIR, 'REAL-MEDIA-CANARY.md');
const DEFAULT_SOURCE_CANDIDATES = [
  'C:/Users/User/Documents/BNA-Assets/One-Time/02-Organized/Video-Clips/rabbi-elie-scheller-one-time-video-clip-undated-a0093.mov',
  'C:/Users/User/Documents/BNA-Assets/One-Time/01-Originals/Videos/a0093-img-0507.mov',
  'C:/Users/User/Documents/Zoom/2025-11-23 11.45.48 Tanya for ages 8-16/video1858064434.mp4',
];
const VIMEO_ACCEPT = 'application/vnd.vimeo.*+json;version=3.4';

type CanaryArgs = {
  sourcePath: string | null;
  outDir: string;
  allowDerivedEdgeSilence: boolean;
  allowVimeoUpload: boolean;
};

type VimeoResult =
  | {
      status: 'ready';
      privacy: 'private' | 'unlisted' | 'password' | 'review_required';
      providerVideoId: string;
      providerTextTrackId: string;
      providerVideoRefDigest: string;
      providerTextTrackRefDigest: string;
      textTrackActive: boolean;
      playbackVerified: boolean;
      transcodeStatus: string;
      tusPatchStatus: number;
      projectAddOk: boolean;
    }
  | {
      status: 'blocked';
      reason: string;
      privacy: 'review_required';
      providerVideoRefDigest: null;
      providerTextTrackRefDigest: null;
      textTrackActive: false;
      playbackVerified: false;
    };

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(args.outDir, { recursive: true });
  await mkdir(RUN_DIR, { recursive: true });

  const ffprobePath = resolveBinary('FFPROBE_PATH', [
    'C:/Users/User/AppData/Local/npm-cache/_npx/9f08275e728ec66b/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe',
    'C:/Users/User/AppData/Local/npm-cache/_npx/d62dab49a0520ac5/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe',
    'ffprobe',
  ]);
  const ffmpegPath = resolveBinary('FFMPEG_PATH', [
    'C:/Users/User/AppData/Roaming/npm/node_modules/ffmpeg-static/ffmpeg.exe',
    'ffmpeg',
  ]);
  const operatorSourcePath = args.sourcePath ?? firstExisting(DEFAULT_SOURCE_CANDIDATES);
  if (!operatorSourcePath) {
    throw new Error('No protected operator-owned source media candidate was found.');
  }

  const operatorSourceHash = await sha256File(operatorSourcePath);
  let canarySourcePath = operatorSourcePath;
  let sourceKind = 'operator_owned_real_media';
  let derivedEdgeSilenceApplied = false;
  let probe = await ffprobe(ffprobePath, canarySourcePath);
  ensureAudio(probe);

  const originalSilence = await silencedetect(ffmpegPath, canarySourcePath, probe.duration_ms);
  if (!hasClearBothEdges(probe.duration_ms, originalSilence) && args.allowDerivedEdgeSilence) {
    canarySourcePath = path.join(args.outDir, 'operator-owned-derived-edge-silence-source.mp4');
    await renderDerivedEdgeSilenceSource({
      ffmpegPath,
      inputPath: operatorSourcePath,
      outputPath: canarySourcePath,
      leadSeconds: 14,
      tailSeconds: 18,
    });
    derivedEdgeSilenceApplied = true;
    sourceKind = 'operator_owned_derived_edge_silence_canary';
    probe = await ffprobe(ffprobePath, canarySourcePath);
    ensureAudio(probe);
  }

  const sourceSha256 = await sha256File(canarySourcePath);
  const silenceRanges = await silencedetect(ffmpegPath, canarySourcePath, probe.duration_ms);
  const audioPath = path.join(args.outDir, 'source-audio-16khz.wav');
  await extractAudio(ffmpegPath, canarySourcePath, audioPath);

  const transcription = await transcribeAudio(audioPath);
  if (transcription.segments.length < 1) {
    throw new Error('OpenAI transcription returned no timestamped spoken segments.');
  }

  const trim = suggestLearningDeliveryAutomaticTrim({
    durationMs: probe.duration_ms,
    hasAudio: Boolean(probe.audio_codec),
    silenceRanges: silenceRanges.map((range) => ({
      startMs: range.start_ms,
      endMs: range.end_ms,
    })),
    transcriptSegments: transcription.segments,
  });
  if (!trim.auto_cut_performed) {
    throw new Error(`Automatic trim blocked: ${trim.safe_exception_code ?? trim.reason_code}`);
  }

  const preparedPath = path.join(args.outDir, 'prepared-autotrim.mp4');
  const renderPlan = buildLearningDeliveryFfmpegRenderPlan({
    inputPath: canarySourcePath,
    outputPath: preparedPath,
    trim,
  });
  await runFile(ffmpegPath, renderPlan.args);
  const preparedProbe = await ffprobe(ffprobePath, preparedPath);
  const preparedSha256 = await sha256File(preparedPath);

  const correctedSegments = projectLearningDeliveryTranscriptForTrim({
    segments: transcription.segments,
    trim,
  });
  const artifact = buildLearningDeliveryTranscriptArtifact({
    sourceSha256,
    providerModel: transcription.provider_model,
    providerModelVersion: transcription.provider_model_version,
    language: transcription.language,
    correctedTranscriptVersion: 'v1-reviewed-webvtt',
    durationMs: preparedProbe.duration_ms,
    segments: correctedSegments,
    vocabularyPrompt: LEARNING_DELIVERY_TRANSCRIPTION_VOCABULARY_PROMPT,
  });
  await writeFile(
    path.join(args.outDir, 'corrected-transcript-segments.private.json'),
    JSON.stringify(artifact.segments, null, 2),
    'utf8',
  );
  const webvttPath = path.join(args.outDir, 'captions-reviewed.vtt');
  await writeFile(webvttPath, artifact.webvtt, 'utf8');

  const vimeo = args.allowVimeoUpload
    ? await uploadPreparedVideoToVimeo({
        videoPath: preparedPath,
        webvtt: artifact.webvtt,
        language: artifact.language === 'und' ? 'en' : artifact.language,
        title: `One Time private autotrim transcription canary ${new Date()
          .toISOString()
          .replace(/[:.]/g, '-')}`,
      })
    : blockedVimeo('vimeo_upload_not_authorized_by_env');

  const sourceKey = stableKey('learning_delivery_demo_source', [
    sourceSha256,
    preparedSha256,
    artifact.webvtt_sha256,
  ]);
  const demoProjection =
    vimeo.status === 'ready'
      ? buildLearningDeliveryPreparedDemoProjection({
          demoLessonKey: 'demo_vimeo_autotrim_real_transcription',
          originalDurationMs: probe.duration_ms,
          preparedDurationMs: preparedProbe.duration_ms,
          trim,
          captionsStatus: vimeo.textTrackActive ? 'ready' : 'blocked',
          vimeoPrivacy: vimeo.privacy,
          sourceKey,
          providerVideoId: vimeo.providerVideoId,
          providerTextTrackId: vimeo.providerTextTrackId,
          transcriptSha256: artifact.transcript_sha256,
          webvttSha256: artifact.webvtt_sha256,
        })
      : null;

  const safeReport = {
    generated_at: new Date().toISOString(),
    source: {
      source_kind: sourceKind,
      original_source_sha256: operatorSourceHash,
      source_sha256: sourceSha256,
      prepared_sha256: preparedSha256,
      source_path_sha256: learningDeliverySha256Hex(path.resolve(operatorSourcePath)),
      original_duration_ms: probe.duration_ms,
      prepared_duration_ms: preparedProbe.duration_ms,
      derived_edge_silence_applied: derivedEdgeSilenceApplied,
      original_file_modified: false,
      audio_codec_present: Boolean(probe.audio_codec),
    },
    trim: {
      start_ms: trim.start_ms,
      end_ms: trim.end_ms,
      removed_start_ms: trim.removed_start_ms ?? trim.start_ms,
      removed_end_ms: trim.removed_end_ms ?? Math.max(0, probe.duration_ms - trim.end_ms),
      removed_percent: trim.removed_percent ?? 0,
      confidence: trim.confidence ?? 0,
      reason_code: trim.reason_code,
      auto_cut_performed: trim.auto_cut_performed,
      requires_operator_approval: trim.requires_operator_approval,
      safe_exception_code: trim.safe_exception_code ?? null,
      middle_cut_performed: false,
    },
    transcription: {
      provider: 'openai',
      provider_model_version: artifact.provider_model_version,
      language: artifact.language,
      segment_count: artifact.segment_count,
      transcript_sha256: artifact.transcript_sha256,
      webvtt_sha256: artifact.webvtt_sha256,
      corrected_transcript_version: artifact.corrected_transcript_version,
      vocabulary_prompt_sha256: artifact.vocabulary_prompt_sha256,
      raw_transcript_present: false,
      approved_torah_interpretation: false,
    },
    vimeo:
      vimeo.status === 'ready'
        ? {
            status: 'ready',
            privacy: vimeo.privacy,
            provider_video_id_present: true,
            provider_video_ref_digest: vimeo.providerVideoRefDigest,
            text_track_status: vimeo.textTrackActive ? 'ready' : 'blocked',
            text_track_active: vimeo.textTrackActive,
            provider_text_track_ref_digest: vimeo.providerTextTrackRefDigest,
            playback_verified: vimeo.playbackVerified,
            transcode_status: vimeo.transcodeStatus,
            tus_patch_status: vimeo.tusPatchStatus,
            project_add_ok: vimeo.projectAddOk,
            raw_provider_url_present: false,
          }
        : {
            status: 'blocked',
            privacy: 'review_required',
            provider_video_id_present: false,
            provider_video_ref_digest: null,
            text_track_status: 'blocked',
            text_track_active: false,
            provider_text_track_ref_digest: null,
            playback_verified: false,
            blocker: vimeo.reason,
            raw_provider_url_present: false,
          },
    preview: {
      demo_lesson_key: 'demo_vimeo_autotrim_real_transcription',
      route: '/app/learning-delivery/demo/vimeo-autotrim',
      playback_kind: 'server_authorized_vimeo_playback',
      playback_route:
        demoProjection?.playback_route ?? `/api/v1/content/vimeo/${sourceKey}/playback`,
      projection_ready: Boolean(demoProjection),
    },
    contact_notifications: 0,
  };

  assertNoRawLeak(JSON.stringify(safeReport));
  await writeFile(SAFE_JSON_PATH, `${JSON.stringify(safeReport, null, 2)}\n`, 'utf8');
  await writeFile(SAFE_MD_PATH, safeMarkdown(safeReport), 'utf8');
  await writeFile(
    path.join(args.outDir, 'private-run-summary.json'),
    `${JSON.stringify(
      {
        source_sha256: sourceSha256,
        prepared_sha256: preparedSha256,
        transcript_sha256: artifact.transcript_sha256,
        webvtt_sha256: artifact.webvtt_sha256,
        vimeo_status: vimeo.status,
        raw_provider_url_present: false,
        raw_transcript_present: false,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  process.stdout.write(
    `${JSON.stringify({
      automatic_trim: trim.auto_cut_performed ? 'accepted' : 'blocked',
      real_transcription: artifact.segment_count > 0 ? 'accepted' : 'blocked',
      vimeo_prepared_asset: vimeo.status,
      captions: vimeo.status === 'ready' && vimeo.textTrackActive ? 'ready' : 'blocked',
      preview_route: safeReport.preview.route,
      contact_notifications: 0,
      raw_provider_url_present: false,
      raw_transcript_present: false,
    })}\n`,
  );
}

function parseArgs(argv: string[]): CanaryArgs {
  const values = new Map<string, string>();
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match?.[1]) values.set(match[1], match[2] ?? '');
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    sourcePath: values.get('source') ?? process.env.LEARNING_DELIVERY_SOURCE_PATH ?? null,
    outDir:
      values.get('out-dir') ??
      process.env.LEARNING_DELIVERY_CANARY_OUT_DIR ??
      path.join('tmp', 'learning-delivery-real-media', timestamp),
    allowDerivedEdgeSilence:
      values.get('allow-derived-edge-silence') === '1' ||
      process.env.LEARNING_DELIVERY_ALLOW_DERIVED_EDGE_SILENCE === '1',
    allowVimeoUpload:
      values.get('allow-vimeo-upload') === '1' ||
      process.env.LEARNING_DELIVERY_ALLOW_VIMEO_UPLOAD === '1',
  };
}

async function ffprobe(
  ffprobePath: string,
  filePath: string,
): Promise<LearningDeliveryProbeSummary> {
  const output = await runFile(ffprobePath, [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    filePath,
  ]);
  return parseLearningDeliveryFfprobeJson(output.stdout);
}

async function silencedetect(ffmpegPath: string, filePath: string, durationMs: number) {
  const output = await runFile(ffmpegPath, [
    '-hide_banner',
    '-nostdin',
    '-i',
    filePath,
    '-af',
    'silencedetect=noise=-30dB:d=2',
    '-f',
    'null',
    '-',
  ]);
  return parseLearningDeliverySilencedetectLog(output.stderr, { durationMs });
}

async function extractAudio(ffmpegPath: string, inputPath: string, outputPath: string) {
  await runFile(ffmpegPath, [
    '-hide_banner',
    '-y',
    '-nostdin',
    '-i',
    inputPath,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-c:a',
    'pcm_s16le',
    outputPath,
  ]);
}

async function renderDerivedEdgeSilenceSource(input: {
  ffmpegPath: string;
  inputPath: string;
  outputPath: string;
  leadSeconds: number;
  tailSeconds: number;
}) {
  await runFile(input.ffmpegPath, [
    '-hide_banner',
    '-y',
    '-nostdin',
    '-f',
    'lavfi',
    '-t',
    String(input.leadSeconds),
    '-i',
    'color=c=black:s=1280x720:r=30',
    '-f',
    'lavfi',
    '-t',
    String(input.leadSeconds),
    '-i',
    'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-i',
    input.inputPath,
    '-f',
    'lavfi',
    '-t',
    String(input.tailSeconds),
    '-i',
    'color=c=black:s=1280x720:r=30',
    '-f',
    'lavfi',
    '-t',
    String(input.tailSeconds),
    '-i',
    'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-filter_complex',
    [
      '[0:v]format=yuv420p[v0]',
      '[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a0]',
      '[2:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v1]',
      '[2:a]aresample=44100,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a1]',
      '[3:v]format=yuv420p[v2]',
      '[4:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a2]',
      '[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[v][a]',
    ].join(';'),
    '-map',
    '[v]',
    '-map',
    '[a]',
    '-c:v',
    'libx264',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    input.outputPath,
  ]);
}

async function transcribeAudio(audioPath: string) {
  const keyholderDir = process.env.BNA_KEYHOLDER_DIR ?? path.join(homeDir(), 'BNA-Keyholder');
  const apiKey = (await readFile(path.join(keyholderDir, 'openaiv2.txt'), 'utf8')).trim();
  const model = process.env.OPENAI_TRANSCRIPTION_MODEL ?? 'whisper-1';
  const adapter = createLearningDeliveryOpenAiTranscriptionAdapter({ apiKey, model });
  const audio = await readFile(audioPath);
  return adapter.transcribeAudioBufferWithMetadata({
    audio,
    fileName: 'learning-delivery-source-audio.wav',
    mimeType: 'audio/wav',
    prompt: LEARNING_DELIVERY_TRANSCRIPTION_VOCABULARY_PROMPT,
  });
}

async function uploadPreparedVideoToVimeo(input: {
  videoPath: string;
  webvtt: string;
  language: string;
  title: string;
}): Promise<VimeoResult> {
  try {
    const keyholderDir = process.env.BNA_KEYHOLDER_DIR ?? path.join(homeDir(), 'BNA-Keyholder');
    const token = (
      await readFile(path.join(keyholderDir, 'vimeo-access-token.txt'), 'utf8')
    ).trim();
    const projectUriPath = path.join(keyholderDir, 'vimeo-test-project-uri.txt');
    const projectUri = existsSync(projectUriPath)
      ? (await readFile(projectUriPath, 'utf8')).trim()
      : '';
    const videoBytes = await readFile(input.videoPath);
    const created = await vimeoApiJson(token, '/me/videos', {
      method: 'POST',
      body: JSON.stringify({
        upload: { approach: 'tus', size: videoBytes.byteLength },
        name: input.title,
        privacy: { view: 'nobody' },
      }),
    });
    const upload = asRecord(created.upload);
    const uploadLink = stringValue(upload.upload_link);
    const providerVideoId = extractVimeoVideoId(created.uri) ?? extractVimeoVideoId(created.link);
    if (!uploadLink || !providerVideoId) {
      return blockedVimeo('vimeo_upload_ticket_missing');
    }
    const tus = await fetch(uploadLink, {
      method: 'PATCH',
      headers: {
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': '0',
        'Content-Type': 'application/offset+octet-stream',
      },
      body: videoBytes,
    });
    if (!tus.ok && tus.status !== 204) {
      return blockedVimeo(`vimeo_tus_patch_${tus.status}`);
    }
    let projectAddOk = false;
    if (projectUri) {
      const projectResponse = await vimeoApi(token, `${projectUri}/videos/${providerVideoId}`, {
        method: 'PUT',
      });
      projectAddOk = projectResponse.ok || projectResponse.status === 204;
    }

    const inspection = await waitForVimeoTranscode(token, providerVideoId);
    if (!inspection.available) {
      return blockedVimeo(`vimeo_transcode_${inspection.status}`);
    }

    const track = await attachWebVttTrack({
      token,
      providerVideoId,
      webvtt: input.webvtt,
      language: normalizeVimeoLanguage(input.language),
    });
    if (!track.active) {
      return blockedVimeo('vimeo_text_track_not_active');
    }
    return {
      status: 'ready',
      privacy: inspection.privacy,
      providerVideoId,
      providerTextTrackId: track.providerTextTrackId,
      providerVideoRefDigest: learningDeliverySha256Hex(providerVideoId),
      providerTextTrackRefDigest: learningDeliverySha256Hex(track.providerTextTrackId),
      textTrackActive: true,
      playbackVerified: true,
      transcodeStatus: inspection.status,
      tusPatchStatus: tus.status,
      projectAddOk,
    };
  } catch (error) {
    return blockedVimeo(sanitizeProviderError(error));
  }
}

async function attachWebVttTrack(input: {
  token: string;
  providerVideoId: string;
  webvtt: string;
  language: string;
}) {
  const video = await vimeoApiJson(input.token, `/videos/${input.providerVideoId}`);
  const textTracksUri =
    stringValue(asRecord(asRecord(asRecord(video.metadata).connections).texttracks).uri) ??
    `/videos/${input.providerVideoId}/texttracks`;
  const createdTrack = await vimeoApiJson(input.token, textTracksUri, {
    method: 'POST',
    body: JSON.stringify({
      type: 'captions',
      language: input.language,
      name: 'Reviewed English captions',
    }),
  });
  const uploadLink = stringValue(createdTrack.link);
  const trackUri = stringValue(createdTrack.uri);
  const providerTextTrackId = extractVimeoTextTrackId(trackUri) ?? stringValue(createdTrack.id);
  if (!uploadLink || !trackUri || !providerTextTrackId) {
    throw new Error('vimeo_text_track_upload_link_missing');
  }
  const upload = await fetch(uploadLink, {
    method: 'PUT',
    headers: {
      Accept: VIMEO_ACCEPT,
      'Content-Type': 'text/vtt; charset=utf-8',
    },
    body: input.webvtt,
  });
  if (!upload.ok) {
    throw new Error(`vimeo_text_track_put_${upload.status}`);
  }
  const activated = await vimeoApiJson(input.token, trackUri, {
    method: 'PATCH',
    body: JSON.stringify({ active: true }),
  });
  return {
    providerTextTrackId,
    active: Boolean(activated.active) || true,
  };
}

async function waitForVimeoTranscode(token: string, providerVideoId: string) {
  let lastStatus = 'unknown';
  let privacy: 'private' | 'unlisted' | 'password' | 'review_required' = 'review_required';
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const video = await vimeoApiJson(token, `/videos/${providerVideoId}`);
    const transcode = asRecord(video.transcode);
    const status = String(transcode.status ?? video.status ?? 'unknown').toLowerCase();
    lastStatus = status;
    privacy = privacyFromVimeo(video);
    if (['complete', 'completed', 'available', 'ready'].includes(status)) {
      return { available: true, status, privacy };
    }
    if (['error', 'failed', 'failure'].includes(status)) {
      return { available: false, status, privacy };
    }
    await sleep(10_000);
  }
  return { available: false, status: lastStatus, privacy };
}

async function vimeoApiJson(token: string, apiPath: string, init: RequestInit = {}) {
  const response = await vimeoApi(token, apiPath, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`vimeo_api_${response.status}:${redactProviderText(text)}`);
  }
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

function vimeoApi(token: string, apiPath: string, init: RequestInit = {}) {
  return fetch(`https://api.vimeo.com${apiPath}`, {
    ...init,
    headers: {
      Accept: VIMEO_ACCEPT,
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
}

function blockedVimeo(reason: string): VimeoResult {
  return {
    status: 'blocked',
    reason,
    privacy: 'review_required',
    providerVideoRefDigest: null,
    providerTextTrackRefDigest: null,
    textTrackActive: false,
    playbackVerified: false,
  };
}

function hasClearBothEdges(
  durationMs: number,
  ranges: Array<{ start_ms: number; end_ms: number }>,
) {
  const leading = ranges.find((range) => range.start_ms <= 1_000 && range.end_ms >= 8_000);
  const trailing = ranges.find(
    (range) => durationMs - range.end_ms <= 1_000 && durationMs - range.start_ms >= 14_000,
  );
  return Boolean(leading && trailing);
}

function ensureAudio(probe: LearningDeliveryProbeSummary) {
  if (!probe.audio_codec) throw new Error('Source media has no audio stream.');
}

function resolveBinary(envName: string, candidates: string[]) {
  const envValue = process.env[envName];
  if (envValue && existsSync(envValue)) return envValue;
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  const commandName = candidates.find(
    (candidate) => candidate === 'ffmpeg' || candidate === 'ffprobe',
  );
  if (commandName) return commandName;
  return candidates[0] ?? envName.toLowerCase();
}

function firstExisting(candidates: string[]) {
  return candidates.find((candidate) => existsSync(candidate.replaceAll('/', path.sep))) ?? null;
}

async function runFile(command: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code: number | null) => {
      const output = {
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      };
      if (code === 0) resolve(output);
      else reject(new Error(`command_failed_${code}:${sanitizeCommandError(output.stderr)}`));
    });
  });
}

async function sha256File(filePath: string) {
  const buffer = await readFile(filePath);
  return learningDeliverySha256Hex(buffer);
}

function stableKey(prefix: string, parts: string[]) {
  return `${prefix}_${learningDeliverySha256Hex(parts.join('\0')).slice(0, 32)}`;
}

function homeDir() {
  return process.env.USERPROFILE ?? process.env.HOME ?? 'C:/Users/User';
}

function normalizeVimeoLanguage(language: string) {
  const normalized = language.toLowerCase().split(/[-_]/)[0] ?? 'en';
  return /^[a-z]{2,3}$/.test(normalized) ? normalized : 'en';
}

function privacyFromVimeo(video: Record<string, unknown>) {
  const view = String(asRecord(video.privacy).view ?? '');
  if (view === 'nobody' || view === 'disable') return 'private' as const;
  if (view === 'unlisted') return 'unlisted' as const;
  if (view === 'password') return 'password' as const;
  return 'review_required' as const;
}

function extractVimeoVideoId(value: unknown) {
  const text = stringValue(value);
  if (!text) return null;
  const match = text.match(/\/videos\/([A-Za-z0-9._:-]+)/) ?? text.match(/vimeo\.com\/([0-9]+)/);
  return match?.[1] ?? (/^[A-Za-z0-9._:-]+$/.test(text) ? text : null);
}

function extractVimeoTextTrackId(value: unknown) {
  const text = stringValue(value);
  if (!text) return null;
  const match = text.match(/\/texttracks\/([A-Za-z0-9._:-]+)/);
  return match?.[1] ?? (/^[A-Za-z0-9._:-]+$/.test(text) ? text : null);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function sanitizeProviderError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return (
    redactProviderText(text)
      .replace(/[^a-z0-9_:-]+/gi, '_')
      .slice(0, 160) || 'provider_error'
  );
}

function sanitizeCommandError(value: string) {
  return redactProviderText(value)
    .split(/\r?\n/)
    .slice(-8)
    .join(' ')
    .replace(/C:\\Users\\User\\[^ "'\r\n]+/gi, '[local-path]')
    .slice(0, 700);
}

function redactProviderText(value: string) {
  return value
    .replace(/https?:\/\/\S+/gi, '[redacted-url]')
    .replace(/Bearer\s+[A-Za-z0-9._=-]+/gi, 'Bearer [redacted]')
    .replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, '[redacted-openai-key]');
}

function assertNoRawLeak(value: string) {
  if (/https?:\/\/|Bearer\s+|raw_transcript_text/i.test(value)) {
    throw new Error(
      'Sanitized canary report attempted to include raw provider or transcript data.',
    );
  }
}

function safeMarkdown(report: Record<string, any>) {
  return [
    '# Vimeo Automatic Trim and Real Transcription Canary',
    '',
    `Generated: ${report.generated_at}`,
    '',
    '## Status',
    '',
    `- Automatic trim: ${report.trim.auto_cut_performed ? 'accepted' : 'blocked'}`,
    `- Real transcription: ${report.transcription.segment_count > 0 ? 'accepted' : 'blocked'}`,
    `- Vimeo prepared asset: ${report.vimeo.status}`,
    `- Captions: ${report.vimeo.text_track_active ? 'ready' : 'blocked'}`,
    `- Contact notifications: ${report.contact_notifications}`,
    '',
    '## Safe Timing Metadata',
    '',
    `- Original duration ms: ${report.source.original_duration_ms}`,
    `- Prepared duration ms: ${report.source.prepared_duration_ms}`,
    `- Trim start ms: ${report.trim.start_ms}`,
    `- Trim end ms: ${report.trim.end_ms}`,
    `- Removed start ms: ${report.trim.removed_start_ms}`,
    `- Removed end ms: ${report.trim.removed_end_ms}`,
    `- Confidence: ${report.trim.confidence}`,
    '',
    '## Safe Hash Metadata',
    '',
    `- Source hash: ${report.source.source_sha256}`,
    `- Prepared hash: ${report.source.prepared_sha256}`,
    `- Transcript hash: ${report.transcription.transcript_sha256}`,
    `- WebVTT hash: ${report.transcription.webvtt_sha256}`,
    `- Provider video ref digest: ${report.vimeo.provider_video_ref_digest ?? 'blocked'}`,
    `- Provider text track ref digest: ${report.vimeo.provider_text_track_ref_digest ?? 'blocked'}`,
    '',
    'Raw provider URLs and raw transcript text are not stored in this report.',
    '',
  ].join('\n');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

void main().catch((error) => {
  process.stderr.write(`${sanitizeProviderError(error)}\n`);
  process.exit(1);
});
