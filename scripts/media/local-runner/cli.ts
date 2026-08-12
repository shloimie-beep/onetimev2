import {
  readLocalMediaStatus,
  retryLocalMediaJob,
  runLocalMediaRunner,
  selectLocalMediaOccurrence,
} from './runtime.ts';

const [command = 'start', ...args] = process.argv.slice(2);
const settingsPath = valueFor(args, '--settings');

try {
  if (command === 'start') {
    const controller = new AbortController();
    process.once('SIGINT', () => controller.abort());
    process.once('SIGTERM', () => controller.abort());
    await runLocalMediaRunner({
      ...(settingsPath ? { settingsPath } : {}),
      once: args.includes('--once'),
      signal: controller.signal,
    });
  } else if (command === 'status') {
    const status = await readLocalMediaStatus(settingsPath);
    process.stdout.write(`${JSON.stringify({ success: true, jobs: status }, null, 2)}\n`);
  } else if (command === 'retry') {
    const jobId = requiredValue(args, '--job');
    const job = await retryLocalMediaJob({
      ...(settingsPath ? { settingsPath } : {}),
      jobId,
    });
    process.stdout.write(
      `${JSON.stringify({ success: true, job_id: job.jobId, state: job.state })}\n`,
    );
  } else if (command === 'select-occurrence') {
    const jobId = requiredValue(args, '--job');
    const occurrenceKey = requiredValue(args, '--occurrence');
    const job = await selectLocalMediaOccurrence({
      ...(settingsPath ? { settingsPath } : {}),
      jobId,
      occurrenceKey,
    });
    process.stdout.write(
      `${JSON.stringify({ success: true, job_id: job.jobId, state: job.state, occurrence_key: job.occurrenceKey })}\n`,
    );
  } else {
    throw new Error('local_media_command_invalid');
  }
} catch (error) {
  const code = safeCliError(error);
  process.stderr.write(`${JSON.stringify({ success: false, safe_error_code: code })}\n`);
  process.exitCode = 1;
}

function requiredValue(args: string[], name: string) {
  const value = valueFor(args, name);
  if (!value) throw new Error(`local_media_argument_${name.replace(/^--/u, '')}_required`);
  return value;
}

function valueFor(args: string[], name: string) {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  return value && !value.startsWith('--') ? value : undefined;
}

function safeCliError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/[^a-z0-9_.:-]+/giu, '_').slice(0, 160) || 'local_media_unexpected';
}
