import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../../packages/config/src/index.ts';
import { createPgPool, inTransaction } from '../../packages/db/src/index.ts';
import { upsertHighLevelParentLink } from '../../packages/db/src/highlevel/repository.ts';
import type { HighLevelContact } from '../../packages/domain/src/highlevel/client.ts';
import {
  planManualUploadMapping,
  type LocalParentCandidate,
} from '../../packages/domain/src/highlevel/mapping.ts';

type Args = {
  localFile?: string | undefined;
  highLevelFile?: string | undefined;
  privateReportFile?: string | undefined;
  apply: boolean;
};

const args = parseArgs(process.argv.slice(2));

if (!args.localFile || !args.highLevelFile) {
  console.error(
    'Usage: tsx scripts/highlevel/manual-contact-mapping.ts --local local-parents.json --highlevel ghl-contacts.json [--private-report path] [--apply]',
  );
  process.exitCode = 1;
} else {
  const config = loadConfig(process.env);
  const localParents = await readJson<LocalParentCandidate[]>(args.localFile);
  const highLevelContacts = await readJson<HighLevelContact[]>(args.highLevelFile);
  const plan = planManualUploadMapping({ localParents, highLevelContacts });

  const publicReport = {
    mode: args.apply ? 'apply_local_links_only' : 'dry_run',
    countsOnly: true,
    createsHighLevelContacts: false,
    updatesHighLevelRecords: false,
    counts: plan.counts,
  };
  writeStdoutJson(publicReport);

  if (args.privateReportFile) {
    await mkdir(path.dirname(path.resolve(args.privateReportFile)), { recursive: true });
    await writeFile(args.privateReportFile, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  }

  if (args.apply) {
    const links = plan.decisions.filter(
      (decision): decision is Extract<(typeof plan.decisions)[number], { disposition: 'link' }> =>
        decision.disposition === 'link',
    );
    const pool = createPgPool(config);
    try {
      await inTransaction(pool, async (client) => {
        for (const link of links) {
          await upsertHighLevelParentLink(client, {
            accountKey: config.accountKey,
            productKey: config.productKey,
            parentUserKey: link.parentUserKey,
            householdKey: link.householdKey,
            ghlContactId: link.ghlContactId,
            syncStatus: 'synced',
            lastSuccessfulSyncAt: new Date().toISOString(),
          });
        }
      });
    } finally {
      await pool.end();
    }
  }
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { apply: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--apply') {
      args.apply = true;
    } else if (value === '--local') {
      args.localFile = argv[(index += 1)];
    } else if (value === '--highlevel') {
      args.highLevelFile = argv[(index += 1)];
    } else if (value === '--private-report') {
      args.privateReportFile = argv[(index += 1)];
    }
  }
  return args;
}

function writeStdoutJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
