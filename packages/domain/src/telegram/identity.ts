import type {
  AuthorizationDecision,
  BotCapability,
  BotRateLimiter,
  IdentityMappingRepository,
  NormalizedBotUpdate,
  OneTimeBotApplicationAdapter,
} from '../../../contracts/src/telegram/types.ts';
import { sha256 } from './crypto.ts';

const allowedRoles = new Set(['owner', 'admin']);

export class TelegramIdentityResolver {
  constructor(
    private readonly mappings: IdentityMappingRepository,
    private readonly adapter: OneTimeBotApplicationAdapter,
    private readonly rateLimiter?: BotRateLimiter,
  ) {}

  async authorize(
    update: NormalizedBotUpdate,
    capability?: BotCapability,
    now = new Date(),
  ): Promise<AuthorizationDecision> {
    if (update.chatContext !== 'private') return { allowed: false, reason: 'unsupported_context' };
    if (update.isAnonymousAdmin) return { allowed: false, reason: 'anonymous_admin' };
    if (update.isForwarded || update.isEdited)
      return { allowed: false, reason: 'forwarded_or_edited' };
    if (!update.providerUserRef || !update.chatRef) {
      return { allowed: false, reason: 'missing_provider_identity' };
    }

    const mapping = await this.mappings.findActiveMapping({
      botKey: update.botKey,
      environment: update.environment,
      providerUserRef: update.providerUserRef,
    });
    if (!mapping) return { allowed: false, reason: 'unmapped_identity' };
    if (mapping.status !== 'active') return { allowed: false, reason: 'mapping_revoked' };
    if (!mapping.chatRef || !opaqueRefMatches(mapping.chatRef, update.chatRef)) {
      return { allowed: false, reason: 'unapproved_private_chat' };
    }

    const actor = await this.adapter.resolveActor({
      mapping,
      botKey: update.botKey,
      environment: update.environment,
    });
    if (!actor) return { allowed: false, reason: 'unmapped_identity' };
    if (actor.userStatus !== 'active') return { allowed: false, reason: 'inactive_user' };
    if (actor.membershipStatus !== 'active') {
      return { allowed: false, reason: 'inactive_membership' };
    }
    if (actor.accountKey !== mapping.accountKey || actor.productKey !== mapping.productKey) {
      return { allowed: false, reason: 'wrong_account_or_product' };
    }
    if (actor.membershipKey !== mapping.membershipKey) {
      return { allowed: false, reason: 'wrong_account_or_product' };
    }
    if (!allowedRoles.has(actor.role)) return { allowed: false, reason: 'unsupported_role' };
    if (actor.securityVersion !== mapping.securityVersion) {
      return { allowed: false, reason: 'security_version_mismatch' };
    }
    if (capability) {
      if (capability === 'telegram.audit.read_recent' && actor.role !== 'owner') {
        return { allowed: false, reason: 'unsupported_role' };
      }
      const supported = this.adapter.supportedCapabilities();
      if (!supported.includes(capability) || !actor.capabilities.includes(capability)) {
        return { allowed: false, reason: 'capability_not_advertised' };
      }
    }
    if (this.rateLimiter) {
      const limitInput = {
        botKey: update.botKey,
        environment: update.environment,
        actorUserKey: actor.userKey,
        chatRef: update.chatRef,
        now,
      };
      const limited = await this.rateLimiter.check(
        capability ? { ...limitInput, capability } : limitInput,
      );
      if (!limited.allowed) return { allowed: false, reason: 'rate_limited' };
    }
    return { allowed: true, actor, mapping };
  }
}

function opaqueRefMatches(stored: string, actual: string) {
  return stored === actual || stored === `hashed:${sha256(actual)}`;
}
