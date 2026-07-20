import { readFile } from 'node:fs/promises';
import { loadConfig } from '../../packages/config/src/index.ts';
import { inspectHighLevelReadiness } from '../../packages/domain/src/highlevel/config.ts';
import {
  buildResendBacklogInventory,
  planResendBackfill,
  type ResendBacklogMessageRef,
} from '../../packages/domain/src/highlevel/resend-backlog.ts';

const args = parseArgs(process.argv.slice(2));

if (!args.privateRefsFile) {
  console.error(
    'Usage: tsx scripts/highlevel/resend-backfill-plan.ts --private-refs outside-git.json',
  );
  process.exitCode = 1;
} else {
  const config = loadConfig(process.env);
  const readiness = inspectHighLevelReadiness(config);
  const privateRefs = await readJson<{ privateRefs?: ResendBacklogMessageRef[] }>(
    args.privateRefsFile,
  );
  const inventory = buildResendBacklogInventory({
    receivingEnabled: true,
    messages: privateRefs.privateRefs ?? [],
  });
  const plan = planResendBackfill({
    inventory,
    ghlCredentialsReady: config.highLevelMode === 'provider' && readiness.ready,
  });
  writeStdoutJson({
    ...plan,
    mode: 'plan_only',
    externalMutations: 0,
    privateBodiesRead: false,
    attachmentDownloads: 0,
    countsByClass: inventory.countsByClass,
  });
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T;
}

function parseArgs(argv: string[]) {
  const args: { privateRefsFile?: string | undefined } = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--private-refs') args.privateRefsFile = argv[(index += 1)];
  }
  return args;
}

function writeStdoutJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
