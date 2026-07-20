import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../../packages/config/src/index.ts';
import {
  buildResendBacklogInventory,
  type ResendBacklogMessageRef,
} from '../../packages/domain/src/highlevel/resend-backlog.ts';

type ReceivedEmailListResponse = {
  object?: string;
  has_more?: boolean;
  data?: Array<{
    id?: string;
    from?: string;
    created_at?: string;
    subject?: string;
    message_id?: string;
    attachments?: unknown[];
  }>;
};

const args = parseArgs(process.argv.slice(2));

if (!args.fixtureFile && !args.live) {
  console.error(
    'Usage: tsx scripts/highlevel/resend-backlog-inventory.ts --fixture received.json OR --live --private-refs outside-git.json',
  );
  process.exitCode = 1;
} else {
  const config = loadConfig(process.env);
  if (args.live && !args.privateRefsFile) {
    throw new Error('Live Resend inventory requires --private-refs outside a Git-tracked path.');
  }
  if (args.privateRefsFile && isInsideGitWorktree(args.privateRefsFile)) {
    throw new Error('--private-refs must point outside the Git worktree.');
  }
  const source = args.live
    ? await fetchReceivedMessages({ apiKey: requiredResendKey(config.resendApiKey) })
    : {
        receivingEnabled: true,
        messages: await readJson<ResendBacklogMessageRef[]>(String(args.fixtureFile)),
      };
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const recentMessages = source.messages.filter(
    (message) => Date.parse(message.receivedAt) >= twoWeeksAgo,
  );
  const inventory = buildResendBacklogInventory({
    receivingEnabled: source.receivingEnabled,
    messages: recentMessages,
  });

  writeStdoutJson({
    receivingEnabled: inventory.receivingEnabled,
    windowDays: inventory.windowDays,
    publicOutputContainsBodies: false,
    attachmentDownloads: inventory.attachmentDownloads,
    privateReferencesRequired: inventory.privateReferencesRequired,
    countsByClass: inventory.countsByClass,
    rows: inventory.rows.map((row) => ({
      messageIdHash: row.messageIdHash,
      senderDomain: row.senderDomain,
      date: row.date,
      classification: row.classification,
      hasAttachments: row.hasAttachments,
    })),
  });

  if (args.privateRefsFile) {
    await mkdir(path.dirname(path.resolve(args.privateRefsFile)), { recursive: true });
    await writeFile(
      args.privateRefsFile,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          source: args.live ? 'resend.receiving.list' : 'fixture',
          publicRows: inventory.rows,
          privateRefs: recentMessages.map((message) => ({
            messageId: message.messageId,
            from: message.from,
            subject: message.subject,
            receivedAt: message.receivedAt,
            hasAttachments: message.hasAttachments,
          })),
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  }
}

async function fetchReceivedMessages(input: {
  apiKey: string;
}): Promise<{ receivingEnabled: boolean; messages: ResendBacklogMessageRef[] }> {
  const response = await fetch('https://api.resend.com/emails/receiving', {
    method: 'GET',
    headers: { authorization: `Bearer ${input.apiKey}`, accept: 'application/json' },
  });
  if (response.status === 404) return { receivingEnabled: false, messages: [] };
  if (!response.ok) throw new Error(`resend_receiving_inventory_failed:${response.status}`);
  const body = (await response.json()) as ReceivedEmailListResponse;
  return {
    receivingEnabled: true,
    messages: (body.data ?? []).map((email) => ({
      messageId: String(email.message_id ?? email.id ?? ''),
      from: String(email.from ?? ''),
      subject: String(email.subject ?? ''),
      receivedAt: String(email.created_at ?? ''),
      hasAttachments: Boolean(email.attachments?.length),
    })),
  };
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T;
}

function requiredResendKey(value: string | undefined) {
  if (!value) throw new Error('RESEND_API_KEY is required for --live inventory.');
  return value;
}

function isInsideGitWorktree(file: string) {
  const target = path.resolve(file).toLowerCase();
  const root = process.cwd().toLowerCase();
  return target === root || target.startsWith(`${root}${path.sep}`);
}

function parseArgs(argv: string[]) {
  const args: {
    fixtureFile?: string | undefined;
    privateRefsFile?: string | undefined;
    live: boolean;
  } = { live: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--live') {
      args.live = true;
    } else if (value === '--fixture') {
      args.fixtureFile = argv[(index += 1)];
    } else if (value === '--private-refs') {
      args.privateRefsFile = argv[(index += 1)];
    }
  }
  return args;
}

function writeStdoutJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
