import type {
  FamilySignupCommand,
  FamilySignupOutboxIntent,
  FamilySignupResult,
  FamilySignupScope,
} from '../../../../../../../packages/contracts/src/signup/family/index.ts';
import {
  planFamilySignup,
  type ExistingFamilyIdentity,
  type FamilySignupGhlEvidence,
  type FamilySignupRecoveryRecord,
} from '../../../../../../../packages/domain/src/signup/family/index.ts';

export interface FamilySignupTransaction {
  findRequest(idempotencyKey: string): Promise<FamilySignupRecoveryRecord | null>;
  findIdentity(normalizedEmail: string): Promise<ExistingFamilyIdentity | null>;
  readGhlEvidence(normalizedEmailHash: string): Promise<FamilySignupGhlEvidence>;
  commit(input: {
    scope: FamilySignupScope;
    command: Omit<FamilySignupCommand, 'password'>;
    password_hash: string | null;
    result: FamilySignupResult;
    outbox_intents: readonly FamilySignupOutboxIntent[];
    ghl_identity_state: 'unlinked' | 'linked' | 'identity_review';
    ghl_contact_ref_hash: string | null;
  }): Promise<void>;
}

export interface FamilySignupRepository {
  transaction<T>(run: (tx: FamilySignupTransaction) => Promise<T>): Promise<T>;
}

export interface FamilySignupServiceDependencies {
  repository: FamilySignupRepository;
  hashPassword(password: string): Promise<string>;
  normalizeEmail(email: string): string;
  allocateIds(): {
    adult_id: string;
    human_account_id: string;
    household_id: string;
  };
}

export function createFamilySignupService(dependencies: FamilySignupServiceDependencies) {
  return {
    async submit(input: {
      scope: FamilySignupScope;
      command: FamilySignupCommand;
      now: Date;
    }): Promise<FamilySignupResult> {
      const normalizedEmail = dependencies.normalizeEmail(input.command.email);
      const normalizedEmailHash = await sha256(normalizedEmail);
      const ids = dependencies.allocateIds();
      return dependencies.repository.transaction(async (tx) => {
        const [existingRequest, existingIdentity, ghlEvidence] = await Promise.all([
          tx.findRequest(input.command.idempotency_key),
          tx.findIdentity(normalizedEmail),
          tx.readGhlEvidence(normalizedEmailHash),
        ]);
        const plan = planFamilySignup({
          command: input.command,
          now: input.now,
          proposed_adult_id: ids.adult_id,
          proposed_human_account_id: ids.human_account_id,
          proposed_household_id: ids.household_id,
          existing_identity: existingIdentity,
          existing_request: existingRequest,
          ghl_evidence: ghlEvidence,
        });
        if (!plan.local_write_required) return plan.result;
        const passwordHash = plan.credential_write_required
          ? await dependencies.hashPassword(input.command.password)
          : null;
        const { password: _password, ...safeCommand } = input.command;
        void _password;
        await tx.commit({
          scope: input.scope,
          command: safeCommand,
          password_hash: passwordHash,
          result: plan.result,
          outbox_intents: plan.outbox_intents,
          ghl_identity_state: plan.ghl_identity_state,
          ghl_contact_ref_hash: plan.ghl_contact_ref_hash,
        });
        return plan.result;
      });
    },
  };
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
