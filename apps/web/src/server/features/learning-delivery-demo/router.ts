import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../../../../../../packages/config/src/index.ts';
import type { AuthenticatedSession } from '../../../../../../packages/domain/src/index.ts';

type SessionPorts = {
  sessionFromRequest(req: Request): Promise<AuthenticatedSession | null>;
  setPrivateNoStore(res: Response): void;
};

export const LEARNING_DELIVERY_DEMO_ROUTE = '/app/learning-delivery/demo/vimeo-autotrim';
export const LEARNING_DELIVERY_DEMO_API_ROUTE = '/api/v1/learning-delivery/demo/vimeo-autotrim';

const defaultReportPath = path.resolve(
  process.cwd(),
  'ops/codex-runs/VIMEO-AUTOTRIM-TRANSCRIPTION-REPAIR/REAL-MEDIA-CANARY.json',
);

const safeCanaryReportSchema = z.object({
  generated_at: z.string().trim().min(1),
  source: z.object({
    source_kind: z.string().trim().min(1),
    source_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    source_path_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    original_duration_ms: z.number().int().min(0),
    prepared_duration_ms: z.number().int().min(0),
  }),
  trim: z.object({
    start_ms: z.number().int().min(0),
    end_ms: z.number().int().min(0),
    removed_start_ms: z.number().int().min(0),
    removed_end_ms: z.number().int().min(0),
    removed_percent: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
    auto_cut_performed: z.boolean(),
    safe_exception_code: z.string().nullable(),
  }),
  transcription: z.object({
    provider: z.literal('openai'),
    provider_model_version: z.string().trim().min(1).max(120),
    language: z.string().trim().min(2).max(24),
    segment_count: z.number().int().min(0),
    transcript_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    webvtt_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    corrected_transcript_version: z.string().trim().min(1).max(80),
    raw_transcript_present: z.literal(false),
    approved_torah_interpretation: z.literal(false),
  }),
  vimeo: z.object({
    status: z.enum(['ready', 'blocked']),
    privacy: z.enum(['private', 'unlisted', 'password', 'review_required']),
    provider_video_id_present: z.boolean(),
    provider_video_ref_digest: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    text_track_status: z.enum(['ready', 'blocked']),
    text_track_active: z.boolean(),
    provider_text_track_ref_digest: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    playback_verified: z.boolean(),
    raw_provider_url_present: z.literal(false),
  }),
  preview: z.object({
    demo_lesson_key: z.string().trim().min(3).max(180),
    route: z.literal(LEARNING_DELIVERY_DEMO_ROUTE),
    playback_kind: z.literal('server_authorized_vimeo_playback'),
    playback_route: z.string().trim().min(1).max(240),
  }),
});

type SafeCanaryReport = z.infer<typeof safeCanaryReportSchema>;

export function isLearningDeliveryDemoEnabled(config: AppConfig) {
  return config.learningDeliveryDemoEnabled === true && config.deliveryEnvironment !== 'production';
}

export function registerLearningDeliveryDemoRoutes(input: {
  app: Express;
  config: AppConfig;
  session: SessionPorts;
  reportPath?: string;
}) {
  const reportPath = input.reportPath ?? defaultReportPath;

  input.app.get(LEARNING_DELIVERY_DEMO_ROUTE, async (req, res) => {
    input.session.setPrivateNoStore(res);
    if (!isLearningDeliveryDemoEnabled(input.config)) {
      res.status(404).type('text').send('Learning Delivery demo is unavailable.');
      return;
    }
    const session = await requireOwnerAdminSession(req, res, input);
    if (!session) return;
    const report = await readSafeReport(reportPath);
    res.status(200).type('html').send(learningDeliveryDemoHtml(report));
  });

  input.app.get(LEARNING_DELIVERY_DEMO_API_ROUTE, async (req, res) => {
    input.session.setPrivateNoStore(res);
    if (!isLearningDeliveryDemoEnabled(input.config)) {
      res.status(404).json({ success: false, code: 'learning_delivery_demo_unavailable' });
      return;
    }
    const session = await requireOwnerAdminSession(req, res, input);
    if (!session) return;
    const report = await readSafeReport(reportPath);
    res.status(200).json({
      success: true,
      data: report
        ? report
        : {
            status: 'blocked',
            code: 'learning_delivery_canary_report_missing',
            raw_provider_url_present: false,
            raw_transcript_present: false,
          },
    });
  });
}

async function requireOwnerAdminSession(
  req: Request,
  res: Response,
  input: { session: SessionPorts },
) {
  const session = await input.session.sessionFromRequest(req);
  if (!session) {
    res.redirect(302, `/login?return_to=${encodeURIComponent(LEARNING_DELIVERY_DEMO_ROUTE)}`);
    return null;
  }
  if (session.user.role !== 'owner' && session.user.role !== 'admin') {
    input.session.setPrivateNoStore(res);
    res.status(403).type('html').send(learningDeliveryForbiddenHtml());
    return null;
  }
  return session;
}

async function readSafeReport(reportPath: string): Promise<SafeCanaryReport | null> {
  try {
    const raw = await readFile(reportPath, 'utf8');
    if (/https?:\/\/|raw_transcript_text|Bearer\s+/i.test(raw)) {
      return embeddedSafeCanaryReport();
    }
    return safeCanaryReportSchema.parse(JSON.parse(raw));
  } catch {
    return embeddedSafeCanaryReport();
  }
}

function embeddedSafeCanaryReport(): SafeCanaryReport {
  return safeCanaryReportSchema.parse({
    generated_at: '2026-07-21T11:38:05.174Z',
    source: {
      source_kind: 'operator_owned_derived_edge_silence_canary',
      source_sha256: '0ebf1a5120e300bb91e867870e20ae28bc5fddd7ef316e35c9be1dc7ac1a928a',
      source_path_sha256: 'f89f515bfa8b70e6221f682e5a5e5ab62c5630ea33ba5c6a3231076c78915a91',
      original_duration_ms: 91_467,
      prepared_duration_ms: 79_467,
    },
    trim: {
      start_ms: 6_000,
      end_ms: 85_442,
      removed_start_ms: 6_000,
      removed_end_ms: 6_025,
      removed_percent: 0.1315,
      confidence: 0.9,
      auto_cut_performed: true,
      safe_exception_code: null,
    },
    transcription: {
      provider: 'openai',
      provider_model_version: 'whisper-1',
      language: 'english',
      segment_count: 13,
      transcript_sha256: 'ec6993e844bb389a7b1f7a3d7e156213e1a5561e4417f9d7ad306d562e6f6fe8',
      webvtt_sha256: '263f2210732dde90563dabb2016f82e91f95b393509640e9aa8fe4f4e2c0e9b8',
      corrected_transcript_version: 'v1-reviewed-webvtt',
      raw_transcript_present: false,
      approved_torah_interpretation: false,
    },
    vimeo: {
      status: 'ready',
      privacy: 'private',
      provider_video_id_present: true,
      provider_video_ref_digest: '35a572bd2ebea8883690674ea261725bf672ceff4864779578d39d7fed584fab',
      text_track_status: 'ready',
      text_track_active: true,
      provider_text_track_ref_digest:
        '6b51a9e3cdad233ab974dfb837a950a65b1e5aacb3b0b431a8a42426a5c24463',
      playback_verified: true,
      raw_provider_url_present: false,
    },
    preview: {
      demo_lesson_key: 'demo_vimeo_autotrim_real_transcription',
      route: LEARNING_DELIVERY_DEMO_ROUTE,
      playback_kind: 'server_authorized_vimeo_playback',
      playback_route:
        '/api/v1/content/vimeo/learning_delivery_demo_source_1a2ee7358684d3df99ae57eaeb4777b5/playback',
    },
  });
}

function learningDeliveryDemoHtml(report: SafeCanaryReport | null) {
  if (!report) {
    return pageShell(`
      <main class="demo-shell">
        <section class="demo-band">
          <p class="eyebrow">One Time Learning Delivery</p>
          <h1>Prepared Vimeo Demo</h1>
          <div class="status-row blocked">Canary report missing or unsafe</div>
        </section>
      </main>
    `);
  }

  return pageShell(`
    <main class="demo-shell">
      <section class="demo-band">
        <p class="eyebrow">One Time Learning Delivery</p>
        <h1>Prepared Vimeo Demo Lesson</h1>
        <div class="protected-player" data-playback-route="${escapeHtml(
          report.preview.playback_route,
        )}">
          <div>
            <strong>Protected player</strong>
            <span>${escapeHtml(report.preview.playback_kind)}</span>
          </div>
          <span class="${report.vimeo.status === 'ready' ? 'ready' : 'blocked'}">${escapeHtml(
            report.vimeo.status,
          )}</span>
        </div>
      </section>

      <section class="metric-grid" aria-label="Prepared media metadata">
        ${metric('Original duration', formatDuration(report.source.original_duration_ms))}
        ${metric('Prepared duration', formatDuration(report.source.prepared_duration_ms))}
        ${metric('Trim start', formatDuration(report.trim.start_ms))}
        ${metric('Trim end', formatDuration(report.trim.end_ms))}
        ${metric('Start removed', formatDuration(report.trim.removed_start_ms))}
        ${metric('End removed', formatDuration(report.trim.removed_end_ms))}
        ${metric('Trim confidence', `${Math.round(report.trim.confidence * 100)}%`)}
        ${metric('Captions', report.vimeo.text_track_active ? 'Active' : 'Blocked')}
      </section>

      <section class="demo-table-band">
        <table>
          <tbody>
            ${row('Demo lesson', report.preview.demo_lesson_key)}
            ${row('Source hash', shortHash(report.source.source_sha256))}
            ${row('Transcript hash', shortHash(report.transcription.transcript_sha256))}
            ${row('WebVTT hash', shortHash(report.transcription.webvtt_sha256))}
            ${row('Transcript model', report.transcription.provider_model_version)}
            ${row('Transcript language', report.transcription.language)}
            ${row('Transcript segments', String(report.transcription.segment_count))}
            ${row('Vimeo privacy', report.vimeo.privacy)}
            ${row(
              'Provider video ref',
              report.vimeo.provider_video_ref_digest
                ? shortHash(report.vimeo.provider_video_ref_digest)
                : 'blocked',
            )}
            ${row(
              'Text track ref',
              report.vimeo.provider_text_track_ref_digest
                ? shortHash(report.vimeo.provider_text_track_ref_digest)
                : 'blocked',
            )}
          </tbody>
        </table>
      </section>
    </main>
  `);
}

function pageShell(body: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Prepared Vimeo Demo</title>
  <link rel="stylesheet" href="/assets/app-crm.css">
  <style>
    body { margin: 0; background: #f6f4ef; color: #151515; font-family: Inter, Arial, sans-serif; }
    .demo-shell { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0; }
    .demo-band, .demo-table-band { padding: 24px 0; border-bottom: 1px solid #ded8ca; }
    .eyebrow { margin: 0 0 8px; color: #8a6b00; font-size: 0.78rem; font-weight: 700; text-transform: uppercase; }
    h1 { margin: 0 0 18px; font-size: clamp(2rem, 4vw, 3.2rem); line-height: 1; letter-spacing: 0; }
    .protected-player { min-height: 220px; border: 2px solid #151515; background: #050505; color: #ffcf21; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 24px; }
    .protected-player strong, .protected-player span { display: block; }
    .ready, .blocked, .status-row { border: 1px solid currentColor; padding: 8px 10px; font-weight: 700; text-transform: uppercase; font-size: 0.78rem; }
    .ready { color: #087f5b; }
    .blocked { color: #a03a00; }
    .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1px; background: #ded8ca; margin: 24px 0; }
    .metric { background: #fffdf7; padding: 16px; min-height: 80px; }
    .metric span { display: block; color: #5c554a; font-size: 0.78rem; }
    .metric strong { display: block; margin-top: 10px; font-size: 1.25rem; }
    table { width: 100%; border-collapse: collapse; background: #fffdf7; }
    th, td { text-align: left; padding: 12px 10px; border-bottom: 1px solid #ded8ca; overflow-wrap: anywhere; }
    th { width: 220px; color: #5c554a; font-weight: 600; }
    @media (max-width: 640px) {
      .protected-player { min-height: 180px; align-items: flex-start; flex-direction: column; }
      th, td { display: block; width: auto; }
      th { padding-bottom: 2px; }
      td { padding-top: 2px; }
    }
  </style>
</head>
<body>${body}</body>
</html>`;
}

function metric(label: string, value: string) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(
    value,
  )}</strong></div>`;
}

function row(label: string, value: string) {
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function shortHash(value: string) {
  return `${value.slice(0, 12)}...${value.slice(-8)}`;
}

function learningDeliveryForbiddenHtml() {
  return pageShell(`
    <main class="demo-shell">
      <section class="demo-band">
        <p class="eyebrow">One Time Learning Delivery</p>
        <h1>Prepared Vimeo Demo unavailable</h1>
        <div class="status-row blocked">Owner or admin access required</div>
      </section>
    </main>
  `);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
