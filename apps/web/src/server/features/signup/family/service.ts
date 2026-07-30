import {
  FAMILY_SIGNUP_OPERATION,
  type FamilySignupCommand,
  type FamilySignupOutboxIntent,
  type FamilySignupReceipt,
  type FamilySignupRequestBinding,
  type FamilySignupResult,
  type FamilySignupScope,
} from '../../../../../../../packages/contracts/src/signup/family/index.ts';
import {
  assertFamilySignupPassword,
  assertFamilySignupEnvelope,
  canonicalizeFamilySignupRequest,
  planFamilySignup,
  type CanonicalFamilySignupRequest,
  type ExistingFamilyLocalState,
  type FamilySignupCommercialBillingPlan,
  type FamilySignupGhlEvidence,
  type FamilySignupRecoveryRecord,
} from '../../../../../../../packages/domain/src/signup/family/index.ts';

export interface FamilySignupTransaction {
  /**
   * Locks the globally unique key and returns any prior receipt, including a
   * receipt from another scope so the service can reject cross-scope replay.
   */
  findRequest(input: {
    scope: FamilySignupScope;
    operation: typeof FAMILY_SIGNUP_OPERATION;
    idempotency_key: string;
  }): Promise<FamilySignupRecoveryRecord | null>;
  readLocalState(input: {
    scope: FamilySignupScope;
    operation: typeof FAMILY_SIGNUP_OPERATION;
    normalized_email: string;
  }): Promise<ExistingFamilyLocalState>;
  readGhlEvidence(input: {
    scope: FamilySignupScope;
    operation: typeof FAMILY_SIGNUP_OPERATION;
    normalized_email_hash: string;
  }): Promise<FamilySignupGhlEvidence>;
  commit(input: {
    request_binding: FamilySignupRequestBinding;
    request: CanonicalFamilySignupRequest;
    password_hash: string;
    receipt: FamilySignupReceipt;
    outbox_intents: readonly FamilySignupOutboxIntent[];
    commercial_billing: FamilySignupCommercialBillingPlan;
    session_creation_required: boolean;
    ghl_identity_state: 'unlinked' | 'linked' | 'readback_required' | 'identity_review';
    ghl_contact_ref_hash: string | null;
    ghl_evidence_status: FamilySignupGhlEvidence['status'];
    committed_at: string;
  }): Promise<void>;
}

export interface FamilySignupRepository {
  transaction<T>(run: (tx: FamilySignupTransaction) => Promise<T>): Promise<T>;
}

export interface FamilySignupServiceDependencies {
  repository: FamilySignupRepository;
  hashPassword(password: string): Promise<string>;
  /**
   * Returns a keyed, server-only deterministic SHA-256 fingerprint. It is used
   * only in the semantic request digest and is never authentication material.
   */
  fingerprintPasswordForIdempotency(password: string): Promise<string>;
  allocateIds(): {
    adult_id: string;
    human_account_id: string;
    household_id: string;
  };
}

const EMPTY_LOCAL_STATE: ExistingFamilyLocalState = {
  identity: null,
  household: null,
};

export function createFamilySignupService(dependencies: FamilySignupServiceDependencies) {
  return {
    async submit(input: {
      scope: FamilySignupScope;
      command: FamilySignupCommand;
      now: Date;
    }): Promise<FamilySignupResult> {
      assertFamilySignupEnvelope(input.scope, input.command);
      assertFamilySignupPassword(input.command);
      const passwordFingerprint = await dependencies.fingerprintPasswordForIdempotency(
        input.command.password,
      );
      const canonical = canonicalizeFamilySignupRequest(
        input.scope,
        input.command,
        passwordFingerprint,
      );

      return dependencies.repository.transaction(async (tx) => {
        const existingRequest = await tx.findRequest({
          scope: input.scope,
          operation: FAMILY_SIGNUP_OPERATION,
          idempotency_key: input.command.idempotency_key,
        });
        if (existingRequest) {
          return planFamilySignup({
            scope: input.scope,
            request_binding: canonical.request_binding,
            command: input.command,
            normalized_email: canonical.request.normalized_email,
            now: input.now,
            proposed_adult_id: '',
            proposed_human_account_id: '',
            proposed_household_id: '',
            existing_local_state: EMPTY_LOCAL_STATE,
            existing_request: existingRequest,
            ghl_evidence: null,
          }).result;
        }

        const existingLocalState = await tx.readLocalState({
          scope: input.scope,
          operation: FAMILY_SIGNUP_OPERATION,
          normalized_email: canonical.request.normalized_email,
        });
        if (existingLocalState.identity !== null || existingLocalState.household !== null) {
          return planFamilySignup({
            scope: input.scope,
            request_binding: canonical.request_binding,
            command: input.command,
            normalized_email: canonical.request.normalized_email,
            now: input.now,
            proposed_adult_id: '',
            proposed_human_account_id: '',
            proposed_household_id: '',
            existing_local_state: existingLocalState,
            existing_request: null,
            ghl_evidence: null,
          }).result;
        }

        const normalizedEmailHash = await sha256(canonical.request.normalized_email);
        const ghlEvidence = await tx.readGhlEvidence({
          scope: input.scope,
          operation: FAMILY_SIGNUP_OPERATION,
          normalized_email_hash: normalizedEmailHash,
        });
        const ids = dependencies.allocateIds();
        const plan = planFamilySignup({
          scope: input.scope,
          request_binding: canonical.request_binding,
          command: input.command,
          normalized_email: canonical.request.normalized_email,
          now: input.now,
          proposed_adult_id: ids.adult_id,
          proposed_human_account_id: ids.human_account_id,
          proposed_household_id: ids.household_id,
          existing_local_state: existingLocalState,
          existing_request: null,
          ghl_evidence: ghlEvidence,
        });
        const passwordHash = await dependencies.hashPassword(input.command.password);
        const receipt: FamilySignupReceipt = {
          request_binding: canonical.request_binding,
          result: plan.result,
          outbox_intents: plan.outbox_intents,
        };
        if (!plan.commercial_billing) {
          throw new Error('family_signup_commercial_plan_missing');
        }
        await tx.commit({
          request_binding: canonical.request_binding,
          request: canonical.request,
          password_hash: passwordHash,
          receipt,
          outbox_intents: plan.outbox_intents,
          commercial_billing: plan.commercial_billing,
          session_creation_required: plan.session_write_required,
          ghl_identity_state: plan.ghl_identity_state,
          ghl_contact_ref_hash: plan.ghl_contact_ref_hash,
          ghl_evidence_status: plan.ghl_evidence_status,
          committed_at: input.now.toISOString(),
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
