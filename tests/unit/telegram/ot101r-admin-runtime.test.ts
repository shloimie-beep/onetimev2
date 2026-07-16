import { describe, expect, it } from 'vitest';
import {
  asBotKey,
  asCanonicalUserKey,
  asChatRef,
  asProviderUserRef,
  botCapabilities,
  type CanonicalOneTimeActor,
  type NormalizedBotUpdate,
} from '../../../packages/contracts/src/telegram/types.ts';
import { TelegramCommandEngine } from '../../../packages/domain/src/telegram/commands.ts';
import { DeterministicTestPayloadCodec } from '../../../packages/domain/src/telegram/crypto.ts';
import { TelegramIdentityResolver } from '../../../packages/domain/src/telegram/identity.ts';
import {
  FixtureOneTimeBotApplicationAdapter,
  MemoryAuditSink,
  MemoryConfirmationRepository,
  MemoryIdentityMappingRepository,
} from '../../../packages/domain/src/telegram/memory.ts';

const botKey = asBotKey('one_time_internal_ops');
const providerUserRef = asProviderUserRef('telegram_user_fixture');
const chatRef = asChatRef('telegram_chat_fixture');

describe('OT-101R Telegram admin runtime command surface', () => {
  it('serves status and social approval links without provider mutation', async () => {
    const context = await buildContext(actorFixture());
    await context.mappings.upsertProtectedMapping(mappingFixture());

    const status = await context.engine.handle(updateFixture({ text: '/status' }));
    const social = await context.engine.handle(updateFixture({ updateId: '2', text: '/social' }));
    const approval = await context.engine.handle(
      updateFixture({ updateId: '3', text: '/social-approval draft_fixture_1' }),
    );

    expect(status[0]?.text).toContain('Writes require preview');
    expect(social[0]?.text).toContain('Social drafts:');
    expect(approval[0]?.text).toContain('Approval link');
    expect(context.adapter.writes.size).toBe(0);
  });

  it('blocks high-impact publishing and confirms question resolution', async () => {
    const context = await buildContext(actorFixture());
    await context.mappings.upsertProtectedMapping(mappingFixture());

    const blocked = await context.engine.handle(
      updateFixture({ text: 'publish this Buffer post now' }),
    );
    expect(blocked[0]?.text).toContain('not available through the One Time Telegram gateway');

    const preview = await context.engine.handle(
      updateFixture({ updateId: '10', text: '/question-resolve q_1 answered' }),
    );
    expect(preview[0]?.text).toContain('Action: class.question.resolve');
    expect(preview[0]?.text).toContain('Payload hash:');

    const confirmed = await context.engine.handle(
      updateFixture({
        updateId: '11',
        kind: 'callback_query',
        callbackData: requireString(preview[0]?.buttons?.[0]?.callbackData),
      }),
    );
    expect(confirmed[0]?.text).toContain('Completed class.question.resolve');
    expect(context.adapter.writes.size).toBe(1);
  });
});

async function buildContext(testActor: CanonicalOneTimeActor) {
  const mappings = new MemoryIdentityMappingRepository();
  const confirmations = new MemoryConfirmationRepository();
  const audit = new MemoryAuditSink();
  const codec = new DeterministicTestPayloadCodec();
  const adapter = new FixtureOneTimeBotApplicationAdapter(testActor);
  const resolver = new TelegramIdentityResolver(mappings, adapter);
  const engine = new TelegramCommandEngine(resolver, adapter, confirmations, codec, audit);
  return { mappings, confirmations, audit, codec, adapter, engine };
}

function actorFixture() {
  return {
    userKey: asCanonicalUserKey('user_one_time_owner'),
    displayLabel: 'One Time Owner',
    accountKey: 'one_time',
    productKey: 'one_time_mishnah_class',
    membershipKey: 'membership_owner',
    membershipStatus: 'active',
    userStatus: 'active',
    role: 'owner',
    securityVersion: 1,
    capabilities: [...botCapabilities],
  } satisfies CanonicalOneTimeActor;
}

function mappingFixture() {
  return {
    mappingKey: 'mapping_fixture',
    botKey,
    environment: 'local' as const,
    providerUserRef,
    chatRef,
    canonicalUserKey: asCanonicalUserKey('user_one_time_owner'),
    accountKey: 'one_time',
    productKey: 'one_time_mishnah_class',
    membershipKey: 'membership_owner',
    mappingVersion: 1,
    securityVersion: 1,
    status: 'active' as const,
  };
}

function updateFixture(overrides: Partial<NormalizedBotUpdate>): NormalizedBotUpdate {
  const update: NormalizedBotUpdate = {
    updateId: overrides.updateId ?? '1',
    kind: overrides.kind ?? 'message',
    botKey,
    environment: 'local',
    providerUserRef,
    chatRef,
    chatContext: overrides.chatContext ?? 'private',
    isForwarded: overrides.isForwarded ?? false,
    isEdited: overrides.isEdited ?? false,
    isAnonymousAdmin: overrides.isAnonymousAdmin ?? false,
    receivedAt: '2026-07-16T10:00:00Z',
  };
  if (overrides.text !== undefined) update.text = overrides.text;
  if (overrides.callbackData !== undefined) update.callbackData = overrides.callbackData;
  return update;
}

function requireString(value: string | undefined): string {
  if (!value) throw new Error('expected callback data');
  return value;
}
