import type { AppConfig } from '../../../config/src/index.ts';
import type { Ot86RetrievalResponse } from '../../../contracts/src/content/index.ts';
import {
  hasPortalCapability,
  helperAnswerSchema,
  type HelperAnswer,
  type HelperCitation,
  type LearnerProfile,
  type PortalActorContext,
} from '../../../contracts/src/portals/index.ts';
import type { DbPool } from '../../../db/src/index.ts';
import { householdHasLearningAccess } from '../billing/portal-access.ts';
import { retrieveOt86ApprovedContent, stableOt86Key } from '../content/pipeline.ts';
import { PortalServiceError, fingerprint, type ScopedPortalHelperAdapter } from './services.ts';

export const STUDENT_CLASS_HELPER_POLICY = 'ot107-student-class-helper-v1' as const;
export const STUDENT_CLASS_HELPER_NO_SOURCE =
  "I couldn't find that in Rabbi Scheller's approved class material. Try asking about this lesson, or send a private question.";
export const STUDENT_CLASS_HELPER_OUTSIDE_SCOPE =
  "I can only help with Rabbi Scheller's approved class material.";

export type StudentClassHelperProviderInput = {
  question: string;
  retrieval: Ot86RetrievalResponse;
  policy: typeof STUDENT_CLASS_HELPER_POLICY;
};

export type StudentClassHelperProviderOutput = {
  answer: string;
  citations: HelperCitation[];
  safe_reason_code: string;
};

export type StudentClassHelperProviderPort = {
  answer(input: StudentClassHelperProviderInput): Promise<StudentClassHelperProviderOutput>;
};

export type StudentClassHelperRateLimitStore = {
  assertAllowed(input: {
    accountKey: string;
    productKey: string;
    learnerKey: string;
    now: Date;
  }): Promise<void> | void;
};

export type StudentClassHelperAdapterDeps = {
  pool: DbPool;
  config: Pick<AppConfig, 'accountKey' | 'productKey'>;
  provider?: StudentClassHelperProviderPort | undefined;
  rateLimitStore?: StudentClassHelperRateLimitStore | undefined;
  clock?: (() => Date) | undefined;
};

type RateLimitWindow = {
  windowStartedAt: number;
  windowCount: number;
  dayStartedAt: number;
  dayCount: number;
};

export function createStudentClassHelperAdapter(
  deps: StudentClassHelperAdapterDeps,
): ScopedPortalHelperAdapter {
  const provider = deps.provider ?? deterministicStudentClassHelperProvider();
  const rateLimitStore =
    deps.rateLimitStore ??
    createInMemoryStudentClassHelperRateLimitStore({
      windowMs: 5 * 60_000,
      windowMax: 10,
      dayMs: 24 * 60 * 60_000,
      dayMax: 60,
    });
  const clock = deps.clock ?? (() => new Date());

  return {
    availability: async ({ actor, learner }) => {
      if (!learner || actor.actor_role !== 'student') {
        return {
          available: false,
          reason: 'Class Helper is available in the student portal.',
          scope_label: 'Class Helper',
        };
      }
      if (!hasPortalCapability(actor, 'helper:query')) {
        return {
          available: false,
          reason: 'Class Helper is unavailable for this session.',
          scope_label: 'Class Helper',
        };
      }
      if (
        !(await householdHasLearningAccess({
          pool: deps.pool,
          accountKey: actor.account_key,
          productKey: actor.product_key,
          householdKey: learner.household_key,
        }))
      ) {
        return {
          available: false,
          reason: 'Class Helper becomes available with active class access.',
          scope_label: 'Class Helper',
        };
      }
      const contentIds = await listEntitledApprovedContentIds(deps.pool, actor, learner);
      return {
        available: contentIds.length > 0,
        reason:
          contentIds.length > 0 ? null : "Rabbi Scheller's approved class material is not ready.",
        scope_label: 'Class Helper',
      };
    },

    query: async ({ actor, learner, payload }) => {
      const started = Date.now();
      if (!learner || actor.actor_role !== 'student' || !actor.student_learner) {
        throw new PortalServiceError(
          'ADAPTER_UNAVAILABLE',
          'Class Helper is only available in the student portal.',
        );
      }
      if (actor.student_learner.learner_key !== learner.learner_key) {
        throw new PortalServiceError('NOT_FOUND', 'The requested portal record was not found.');
      }

      const now = clock();
      await rateLimitStore.assertAllowed({
        accountKey: actor.account_key,
        productKey: actor.product_key,
        learnerKey: learner.learner_key,
        now,
      });

      const tenantId = tenantIdFor(deps.config);
      const principalId = learner.learner_key;
      const correlationId = stableOt86Key('class_helper_corr', [
        actor.account_key,
        actor.product_key,
        learner.learner_key,
        payload.idempotency_key,
      ]);

      if (
        !(await householdHasLearningAccess({
          pool: deps.pool,
          accountKey: actor.account_key,
          productKey: actor.product_key,
          householdKey: learner.household_key,
        }))
      ) {
        await recordHelperAudit(deps.pool, {
          tenantId,
          principalId,
          correlationId,
          authorizationDecisionId: authorizationDecisionIdFor(tenantId, principalId, correlationId),
          entitlementScope: 'billing_denied',
          outcome: 'denied',
          safeReasonCode: 'not_entitled',
          selectedCitationCount: 0,
          latencyMs: Date.now() - started,
          now,
        });
        throw new PortalServiceError(
          'ENTITLEMENT_REQUIRED',
          'Class Helper requires active class access.',
        );
      }

      const entitlementContentIds = await listEntitledApprovedContentIds(deps.pool, actor, learner);
      if (isOutsideClassScope(payload.question)) {
        await recordHelperAudit(deps.pool, {
          tenantId,
          principalId,
          correlationId,
          authorizationDecisionId: authorizationDecisionIdFor(tenantId, principalId, correlationId),
          entitlementScope: entitlementContentIds.length > 0 ? 'content_list' : 'none',
          outcome: 'abstained',
          safeReasonCode: 'outside_class_scope',
          selectedCitationCount: 0,
          latencyMs: Date.now() - started,
          now,
        });
        return helperAnswer({
          answer: STUDENT_CLASS_HELPER_OUTSIDE_SCOPE,
          citations: [],
          abstained: true,
          safeReasonCode: 'outside_class_scope',
        });
      }

      const retrieval = await retrieveOt86ApprovedContent({
        pool: deps.pool,
        tenantId,
        principalId,
        entitlementContentIds,
        question: payload.question,
        correlationId,
        minScore: 2,
        now,
      });
      if (retrieval.abstained) {
        return helperAnswer({
          answer: STUDENT_CLASS_HELPER_NO_SOURCE,
          citations: [],
          abstained: true,
          safeReasonCode: retrieval.safe_reason_code,
        });
      }

      const providerResult = await provider.answer({
        question: payload.question,
        retrieval,
        policy: STUDENT_CLASS_HELPER_POLICY,
      });
      if (!citationsAreFromRetrieval(providerResult.citations, retrieval.citations)) {
        await recordHelperAudit(deps.pool, {
          tenantId,
          principalId,
          correlationId,
          authorizationDecisionId: authorizationDecisionIdFor(tenantId, principalId, correlationId),
          entitlementScope: 'content_list',
          outcome: 'denied',
          safeReasonCode: 'invalid_citation',
          selectedCitationCount: 0,
          latencyMs: Date.now() - started,
          now,
        });
        return helperAnswer({
          answer: STUDENT_CLASS_HELPER_NO_SOURCE,
          citations: [],
          abstained: true,
          safeReasonCode: 'invalid_citation',
        });
      }

      return helperAnswer({
        answer: providerResult.answer,
        citations: providerResult.citations,
        abstained: false,
        safeReasonCode: providerResult.safe_reason_code,
      });
    },
  };
}

export function createInMemoryStudentClassHelperRateLimitStore(input: {
  windowMs: number;
  windowMax: number;
  dayMs: number;
  dayMax: number;
}): StudentClassHelperRateLimitStore {
  const buckets = new Map<string, RateLimitWindow>();
  return {
    assertAllowed: ({ accountKey, productKey, learnerKey, now }) => {
      const key = `${accountKey}:${productKey}:${learnerKey}`;
      const nowMs = now.getTime();
      const bucket =
        buckets.get(key) ??
        ({
          windowStartedAt: nowMs,
          windowCount: 0,
          dayStartedAt: nowMs,
          dayCount: 0,
        } satisfies RateLimitWindow);
      if (nowMs - bucket.windowStartedAt >= input.windowMs) {
        bucket.windowStartedAt = nowMs;
        bucket.windowCount = 0;
      }
      if (nowMs - bucket.dayStartedAt >= input.dayMs) {
        bucket.dayStartedAt = nowMs;
        bucket.dayCount = 0;
      }
      if (bucket.windowCount >= input.windowMax || bucket.dayCount >= input.dayMax) {
        throw new PortalServiceError(
          'RATE_LIMITED',
          'Class Helper is taking a short break. Try again soon.',
        );
      }
      bucket.windowCount += 1;
      bucket.dayCount += 1;
      buckets.set(key, bucket);
    },
  };
}

function deterministicStudentClassHelperProvider(): StudentClassHelperProviderPort {
  return {
    answer: async ({ retrieval }) => ({
      answer: retrieval.answer,
      citations: retrieval.citations,
      safe_reason_code: retrieval.safe_reason_code,
    }),
  };
}

async function listEntitledApprovedContentIds(
  pool: DbPool,
  actor: PortalActorContext,
  learner: LearnerProfile,
) {
  const result = await pool.query(
    `SELECT DISTINCT items.content_item_key
       FROM onetime.content_items AS items
       JOIN onetime.content_item_entitlements AS entitlements
         ON entitlements.account_key = items.account_key
        AND entitlements.product_key = items.product_key
        AND entitlements.content_item_key = items.content_item_key
       JOIN onetime.ot86_published_content_versions AS versions
         ON versions.tenant_id = $5
        AND versions.content_id = items.content_item_key
        AND versions.active_state = 'active'
      WHERE items.account_key = $1
        AND items.product_key = $2
        AND items.retention_state = 'active'
        AND items.published_revision_key IS NOT NULL
        AND entitlements.entitlement_state = 'active'
        AND (
          entitlements.audience = 'all_active_learners'
          OR entitlements.learner_key = $3
          OR entitlements.household_key = $4
        )
      ORDER BY items.content_item_key ASC
      LIMIT 50`,
    [
      actor.account_key,
      actor.product_key,
      learner.learner_key,
      learner.household_key,
      tenantIdFor(actor),
    ],
  );
  return result.rows.map((row) => String(row.content_item_key));
}

async function recordHelperAudit(
  pool: DbPool,
  input: {
    tenantId: string;
    principalId: string;
    correlationId: string;
    authorizationDecisionId: string;
    entitlementScope: string;
    outcome: 'answered' | 'abstained' | 'denied';
    safeReasonCode: string;
    selectedCitationCount: number;
    latencyMs: number;
    now: Date;
  },
) {
  await pool.query(
    `INSERT INTO onetime.ot86_retrieval_audit_events
       (audit_id, tenant_id, principal_id, entitlement_scope, authorization_decision_id,
        outcome, safe_reason_code, selected_citation_count, latency_ms, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (audit_id) DO NOTHING`,
    [
      stableOt86Key('class_helper_audit', [
        input.tenantId,
        input.principalId,
        input.correlationId,
        input.safeReasonCode,
      ]),
      input.tenantId,
      input.principalId,
      input.entitlementScope,
      input.authorizationDecisionId,
      input.outcome,
      input.safeReasonCode,
      input.selectedCitationCount,
      Math.max(0, input.latencyMs),
      input.now,
    ],
  );
}

function helperAnswer(input: {
  answer: string;
  citations: HelperCitation[];
  abstained: boolean;
  safeReasonCode: string;
}): HelperAnswer {
  const citations = input.citations.slice(0, 10);
  return helperAnswerSchema.parse({
    answer: normalizeAnswer(input.answer),
    source_refs: citations.map(sourceRefForCitation).filter(Boolean).slice(0, 20),
    citations,
    abstained: input.abstained,
    safe_reason_code: input.safeReasonCode,
    private_question_available: true,
    policy: STUDENT_CLASS_HELPER_POLICY,
  });
}

function normalizeAnswer(value: string) {
  const withoutExternalUrls = value.replaceAll(/https?:\/\/\S+/gi, '[link removed]');
  const words = withoutExternalUrls.replaceAll(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const limited = words.slice(0, 450).join(' ');
  return limited.slice(0, 2400) || STUDENT_CLASS_HELPER_NO_SOURCE;
}

function sourceRefForCitation(citation: HelperCitation) {
  const ref = `${citation.section_title} (${citation.deep_link})`;
  return ref.length <= 180 ? ref : `${citation.section_title} (${citation.section_id})`;
}

function citationsAreFromRetrieval(
  providerCitations: HelperCitation[],
  retrievalCitations: Ot86RetrievalResponse['citations'],
) {
  if (providerCitations.length < 1) return false;
  const allowed = new Set(
    retrievalCitations.map((citation) =>
      citationKey({
        content_id: citation.content_id,
        version_id: citation.version_id,
        section_id: citation.section_id,
        section_sha256: citation.section_sha256,
      }),
    ),
  );
  return providerCitations.every((citation) => allowed.has(citationKey(citation)));
}

function citationKey(
  citation: Pick<HelperCitation, 'content_id' | 'version_id' | 'section_id' | 'section_sha256'>,
) {
  return `${citation.content_id}:${citation.version_id}:${citation.section_id}:${citation.section_sha256}`;
}

function isOutsideClassScope(question: string) {
  const normalized = ` ${question.toLowerCase().replaceAll(/[^a-z0-9\s]/g, ' ')} `;
  return [
    ' internet ',
    ' google ',
    ' browsing ',
    ' news ',
    ' weather ',
    ' stock ',
    ' bitcoin ',
    ' password ',
    ' secret ',
    ' token ',
    ' api key ',
    ' sibling ',
    ' household ',
    ' parent account ',
    ' billing ',
    ' payment ',
  ].some((pattern) => normalized.includes(pattern));
}

function authorizationDecisionIdFor(tenantId: string, principalId: string, correlationId: string) {
  return stableOt86Key('class_helper_authz', [tenantId, principalId, correlationId]);
}

function tenantIdFor(input: Pick<AppConfig, 'accountKey'> | PortalActorContext) {
  const raw = 'accountKey' in input ? input.accountKey : input.account_key;
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(raw)
    ? raw
    : `acct_${fingerprint(raw).slice(0, 32)}`;
}
