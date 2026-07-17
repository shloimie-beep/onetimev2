import { readFile } from 'node:fs/promises';
import {
  communicationHistorySourceTruthMatrix,
  dryRunCommunicationHistoryBackfill,
  unavailableProviderHistoryReport,
  type CommunicationHistoryDryRunInput,
} from '../packages/domain/src/communications/history-ingestion.ts';

const args = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  const next = process.argv[index + 1];
  if (arg?.startsWith('--') && next && !next.startsWith('--')) {
    args.set(arg.slice(2), next);
    index += 1;
  }
}

const fixturePath = args.get('fixture');
const provider = args.get('provider');
const accountKey = args.get('account-key') ?? 'one_time';
const productKey = args.get('product-key') ?? 'one_time_mishnah_class';

if (fixturePath) {
  const parsed = JSON.parse(await readFile(fixturePath, 'utf8')) as CommunicationHistoryDryRunInput;
  writeJson(dryRunCommunicationHistoryBackfill(parsed));
} else if (provider === 'resend' || provider === 'whatsapp') {
  writeJson(
    unavailableProviderHistoryReport({
      account_key: accountKey,
      product_key: productKey,
      provider,
      reason: `${provider} historical export/provider readback was not supplied to W12-02.`,
    }),
  );
} else {
  writeJson({
    mode: 'dry_run',
    message:
      'Pass --fixture path/to/redacted-fixture.json or --provider resend|whatsapp. No live provider reads, sends, or imports are performed.',
    source_truth_matrix: communicationHistorySourceTruthMatrix,
  });
}

function writeJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
