import { loadConfig } from '../../packages/config/src/index.ts';
import { createPgPool } from '../../packages/db/src/index.ts';
import {
  HttpHighLevelClient,
  MockHighLevelClient,
  type HighLevelClient,
} from '../../packages/domain/src/highlevel/client.ts';
import { inspectHighLevelReadiness } from '../../packages/domain/src/highlevel/config.ts';

const args = parseArgs(process.argv.slice(2));

if (!args.householdKey) {
  console.error(
    'Usage: tsx scripts/highlevel/reconcile-household.ts --household household_key [--use-provider]',
  );
  process.exitCode = 1;
} else {
  const config = loadConfig(process.env);
  const readiness = inspectHighLevelReadiness(config);
  if (args.useProvider && config.highLevelMode !== 'provider') {
    throw new Error(`HighLevel provider diagnostics require HIGHLEVEL_MODE=provider.`);
  }
  if (args.useProvider && !readiness.ready) {
    throw new Error(`HighLevel provider diagnostics blocked: ${readiness.blockers.join(',')}`);
  }

  const pool = createPgPool(config);
  try {
    const link = await pool.query(
      `SELECT ghl_contact_id, ghl_opportunity_id, sync_status, last_successful_sync_at, last_error_code
         FROM onetime.highlevel_parent_links
        WHERE account_key = $1 AND product_key = $2 AND household_key = $3
        LIMIT 1`,
      [config.accountKey, config.productKey, args.householdKey],
    );
    const row = link.rows[0];
    if (!row) {
      writeStdoutJson({
        household: args.householdKey,
        foundLocalLink: false,
        externalMutations: 0,
      });
    } else {
      const client = makeClient(config, args.useProvider);
      const contactId = String(row.ghl_contact_id);
      const [contact, subscriptions, transactions, conversations] = await Promise.all([
        client.getContact(contactId),
        client.listSubscriptions({ contactId }),
        client.listTransactions(),
        client.getConversations(contactId),
      ]);
      writeStdoutJson({
        household: args.householdKey,
        foundLocalLink: true,
        mode: args.useProvider ? 'provider' : 'mock',
        contactFound: Boolean(contact),
        subscriptions: subscriptions.length,
        transactions: transactions.length,
        conversations: conversations.length,
        syncStatus: row.sync_status,
        lastSuccessfulSyncAt: row.last_successful_sync_at,
        lastErrorCode: row.last_error_code,
        externalMutations: 0,
      });
    }
  } finally {
    await pool.end();
  }
}

function makeClient(
  config: Parameters<typeof inspectHighLevelReadiness>[0],
  useProvider: boolean,
): HighLevelClient {
  if (useProvider) return new HttpHighLevelClient(config);
  return new MockHighLevelClient();
}

function parseArgs(argv: string[]) {
  const args: { householdKey?: string | undefined; useProvider: boolean } = { useProvider: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--household') {
      args.householdKey = argv[(index += 1)];
    } else if (value === '--use-provider') {
      args.useProvider = true;
    }
  }
  return args;
}

function writeStdoutJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
