import type { AppConfig } from '../../../config/src/index.ts';
import type { Ot86RetrievalResponse } from '../../../contracts/src/content/index.ts';
import {
  hasPortalCapability,
  helperAnswerSchema,
  helperCitationSchema,
  type HelperAnswer,
  type HelperCitation,
  type LearnerProfile,
  type PortalActorContext,
} from '../../../contracts/src/portals/index.ts';
import type { DbPool } from '../../../db/src/index.ts';
import { householdHasLearningAccess } from '../billing/portal-access.ts';
import { retrieveOt86ApprovedContent, stableOt86Key } from '../content/pipeline.ts';
import {
  SCOPED_KNOWLEDGE_UNSAFE_SOURCE_REASON,
  sanitizeScopedKnowledgeProjection,
} from '../content/scoped-knowledge-redaction.ts';
import { consumeRateLimitBudgets } from '../security/rate-limit.ts';
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
  mode: 'provider_off' | 'ready';
  answer(input: StudentClassHelperProviderInput): Promise<StudentClassHelperProviderOutput>;
};

export type StudentClassHelperRateLimitStore = {
  assertAllowed(input: {
    accountKey: string;
    productKey: string;
    principalKey: string;
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

export function createScopedKnowledgeHelperAdapter(
  deps: StudentClassHelperAdapterDeps,
): ScopedPortalHelperAdapter {
  const provider = deps.provider ?? deterministicProviderOffKnowledgeHelper();
  const rateLimitStore =
    deps.rateLimitStore ?? createDbStudentClassHelperRateLimitStore(deps.pool, deps.config);
  const clock = deps.clock ?? (() => new Date());

  return {
    availability: async ({ actor, learner }) => {
      if (!learner || !isAuthorizedForLearner(actor, learner)) {
        return {
          available: false,
          reason: 'Select an authorized learner to use Class Helper.',
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
      if (!(await currentPrincipalCanAccessLearner(deps.pool, actor, learner))) {
        return {
          available: false,
          reason: 'Select an authorized learner to use Class Helper.',
          scope_label: 'Class Helper',
        };
      }
      if (!(await hasActiveAccess(deps.pool, actor, learner, clock()))) {
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
      if (!learner || !isAuthorizedForLearner(actor, learner)) {
        throw new PortalServiceError('NOT_FOUND', 'The requested portal record was not found.');
      }
      if (!hasPortalCapability(actor, 'helper:query')) {
        throw new PortalServiceError('FORBIDDEN', 'Class Helper is unavailable for this session.');
      }
      if (!(await currentPrincipalCanAccessLearner(deps.pool, actor, learner))) {
        throw new PortalServiceError('NOT_FOUND', 'The requested portal record was not found.');
      }

      const now = clock();
      const principalId = scopedPrincipalId(actor, learner);
      await rateLimitStore.assertAllowed({
        accountKey: actor.account_key,
        productKey: actor.product_key,
        principalKey: principalId,
        learnerKey: learner.learner_key,
        now,
      });

      const tenantId = tenantIdFor(deps.config);
      const correlationId = stableOt86Key('class_helper_corr', [
        actor.account_key,
        actor.product_key,
        principalId,
        learner.learner_key,
        payload.idempotency_key,
      ]);
      const authorizationDecisionId = authorizationDecisionIdFor(
        tenantId,
        principalId,
        correlationId,
      );

      if (!(await hasActiveAccess(deps.pool, actor, learner, now))) {
        await recordHelperAudit(deps.pool, {
          tenantId,
          principalId,
          correlationId,
          authorizationDecisionId,
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
      const unsafeQuestionReason = questionSafetyReason(payload.question);
      if (unsafeQuestionReason) {
        await recordHelperAudit(deps.pool, {
          tenantId,
          principalId,
          correlationId,
          authorizationDecisionId,
          entitlementScope: entitlementContentIds.length > 0 ? 'content_list' : 'none',
          outcome: 'abstained',
          safeReasonCode: unsafeQuestionReason,
          selectedCitationCount: 0,
          latencyMs: Date.now() - started,
          now,
        });
        return helperAnswer({
          answer: STUDENT_CLASS_HELPER_OUTSIDE_SCOPE,
          citations: [],
          abstained: true,
          safeReasonCode: unsafeQuestionReason,
          providerMode: provider.mode,
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
          providerMode: provider.mode,
        });
      }

      const providerResult = await provider.answer({
        question: payload.question,
        retrieval,
        policy: STUDENT_CLASS_HELPER_POLICY,
      });

      if (
        !(await currentPrincipalCanAccessLearner(deps.pool, actor, learner)) ||
        !(await hasActiveAccess(deps.pool, actor, learner, clock()))
      ) {
        await recordHelperAudit(deps.pool, {
          tenantId,
          principalId,
          correlationId,
          authorizationDecisionId,
          entitlementScope: 'revoked_during_request',
          outcome: 'denied',
          safeReasonCode: 'authorization_changed',
          selectedCitationCount: 0,
          latencyMs: Date.now() - started,
          now,
        });
        throw new PortalServiceError(
          'ENTITLEMENT_REQUIRED',
          'Class Helper access changed. Refresh before trying again.',
        );
      }
      const canonicalProviderCitations = canonicalizeProviderCitations(
        providerResult.citations,
        retrieval.citations,
      );
      const currentCitations = canonicalProviderCitations
        ? await listCurrentEntitledApprovedCitations(
            deps.pool,
            actor,
            learner,
            canonicalProviderCitations,
          )
        : [];
      const invalidCitation = canonicalProviderCitations === null;
      const revokedCitation =
        canonicalProviderCitations !== null &&
        currentCitations.length !== canonicalProviderCitations.length;
      const ungroundedAnswer = !providerAnswerIsGrounded(providerResult.answer, retrieval.answer);
      if (invalidCitation || revokedCitation || ungroundedAnswer) {
        const safeReasonCode = invalidCitation
          ? 'invalid_citation'
          : revokedCitation
            ? 'authorization_changed'
            : 'ungrounded_provider_answer';
        await recordHelperAudit(deps.pool, {
          tenantId,
          principalId,
          correlationId,
          authorizationDecisionId,
          entitlementScope: 'content_list',
          outcome: ungroundedAnswer ? 'abstained' : 'denied',
          safeReasonCode,
          selectedCitationCount: 0,
          latencyMs: Date.now() - started,
          now,
        });
        return helperAnswer({
          answer: STUDENT_CLASS_HELPER_NO_SOURCE,
          citations: [],
          abstained: true,
          safeReasonCode,
          providerMode: provider.mode,
        });
      }

      const safeProjection = sanitizeScopedKnowledgeProjection({
        answer: providerResult.answer,
        citations: currentCitations,
      });
      if (!safeProjection.safe) {
        await recordHelperAudit(deps.pool, {
          tenantId,
          principalId,
          correlationId,
          authorizationDecisionId,
          entitlementScope: 'content_list',
          outcome: 'abstained',
          safeReasonCode: SCOPED_KNOWLEDGE_UNSAFE_SOURCE_REASON,
          selectedCitationCount: 0,
          latencyMs: Date.now() - started,
          now,
        });
        return helperAnswer({
          answer: STUDENT_CLASS_HELPER_NO_SOURCE,
          citations: [],
          abstained: true,
          safeReasonCode: SCOPED_KNOWLEDGE_UNSAFE_SOURCE_REASON,
          providerMode: provider.mode,
        });
      }

      const safeReasonCode = safeProviderReasonCode(providerResult.safe_reason_code);
      await recordHelperAudit(deps.pool, {
        tenantId,
        principalId,
        correlationId,
        authorizationDecisionId,
        entitlementScope: 'content_list',
        outcome: 'answered',
        safeReasonCode,
        selectedCitationCount: currentCitations.length,
        latencyMs: Date.now() - started,
        now,
      });
      return helperAnswer({
        answer: safeProjection.answer,
        citations: safeProjection.citations,
        abstained: false,
        safeReasonCode,
        providerMode: provider.mode,
      });
    },
  };
}

/** @deprecated Use createScopedKnowledgeHelperAdapter. */
export const createStudentClassHelperAdapter = createScopedKnowledgeHelperAdapter;

export function createDbStudentClassHelperRateLimitStore(
  pool: DbPool,
  config: Pick<AppConfig, 'accountKey' | 'productKey'>,
): StudentClassHelperRateLimitStore {
  return {
    assertAllowed: async ({ principalKey, learnerKey, now }) => {
      const result = await consumeRateLimitBudgets({
        pool,
        config,
        budgets: [
          {
            scope: 'scoped_knowledge_helper_5m',
            subject: `${principalKey}:${learnerKey}`,
            limit: 10,
            windowMs: 5 * 60_000,
          },
          {
            scope: 'scoped_knowledge_helper_24h',
            subject: `${principalKey}:${learnerKey}`,
            limit: 60,
            windowMs: 24 * 60 * 60_000,
          },
        ],
        now,
      });
      if (!result.allowed) {
        throw new PortalServiceError(
          'RATE_LIMITED',
          'Class Helper is taking a short break. Try again soon.',
        );
      }
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
    assertAllowed: ({ accountKey, productKey, principalKey, learnerKey, now }) => {
      const key = `${accountKey}:${productKey}:${principalKey}:${learnerKey}`;
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

function deterministicProviderOffKnowledgeHelper(): StudentClassHelperProviderPort {
  return {
    mode: 'provider_off',
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
        AND versions.privacy_json->>'source_scope' = 'approved_rabbi_content'
        AND versions.privacy_json->>'approved_for_student_kb' = 'true'
        AND versions.privacy_json->>'contains_learner_name' = 'false'
        AND versions.privacy_json->>'contains_learner_voice' = 'false'
        AND versions.privacy_json->>'contains_learner_face' = 'false'
        AND versions.privacy_json->>'contains_learner_question' = 'false'
        AND versions.privacy_json->>'contains_private_data' = 'false'
        AND (
          entitlements.audience = 'all_active_learners'
          OR (
            entitlements.audience = 'learner'
            AND entitlements.learner_key = $3
          )
          OR (
            entitlements.audience = 'household'
            AND entitlements.household_key = $4
          )
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

async function hasActiveAccess(
  pool: DbPool,
  actor: PortalActorContext,
  learner: LearnerProfile,
  now: Date,
) {
  return householdHasLearningAccess({
    pool,
    accountKey: actor.account_key,
    productKey: actor.product_key,
    householdKey: learner.household_key,
    now,
  });
}

async function currentPrincipalCanAccessLearner(
  pool: DbPool,
  actor: PortalActorContext,
  learner: LearnerProfile,
) {
  if (actor.actor_role === 'student') {
    const result = await pool.query(
      `SELECT 1
         FROM onetime.portal_learners AS learners
         JOIN onetime.portal_student_access_state AS access
           ON access.account_key = learners.account_key
          AND access.product_key = learners.product_key
          AND access.household_key = learners.household_key
          AND access.learner_key = learners.learner_key
        WHERE learners.account_key = $1
          AND learners.product_key = $2
          AND learners.household_key = $3
          AND learners.learner_key = $4
          AND learners.learner_status = 'active'
          AND access.student_user_ref = $5
          AND access.status = 'active'
        LIMIT 1`,
      [
        actor.account_key,
        actor.product_key,
        learner.household_key,
        learner.learner_key,
        actor.actor_user_ref,
      ],
    );
    return Boolean(result.rowCount);
  }
  if (actor.actor_role === 'parent') {
    const result = await pool.query(
      `SELECT 1
         FROM onetime.portal_learners AS learners
         JOIN onetime.portal_guardian_relationships AS guardians
           ON guardians.account_key = learners.account_key
          AND guardians.product_key = learners.product_key
          AND guardians.household_key = learners.household_key
        WHERE learners.account_key = $1
          AND learners.product_key = $2
          AND learners.household_key = $3
          AND learners.learner_key = $4
          AND learners.learner_status = 'active'
          AND guardians.guardian_user_ref = $5
          AND guardians.status = 'active'
          AND guardians.authority <> 'support_only'
        LIMIT 1`,
      [
        actor.account_key,
        actor.product_key,
        learner.household_key,
        learner.learner_key,
        actor.actor_user_ref,
      ],
    );
    return Boolean(result.rowCount);
  }
  return false;
}

function isAuthorizedForLearner(actor: PortalActorContext, learner: LearnerProfile) {
  if (learner.learner_status !== 'active') return false;
  if (actor.actor_role === 'student') {
    return (
      actor.student_learner?.learner_key === learner.learner_key &&
      actor.student_learner.household_key === learner.household_key
    );
  }
  if (actor.actor_role === 'parent') {
    return actor.authorized_households.some(
      (subject) =>
        subject.household_key === learner.household_key && subject.authority !== 'support_only',
    );
  }
  return false;
}

function scopedPrincipalId(actor: PortalActorContext, learner: LearnerProfile) {
  return stableOt86Key('scoped_helper_principal', [
    actor.actor_role,
    actor.actor_user_ref,
    learner.household_key,
    learner.learner_key,
  ]);
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
  providerMode: StudentClassHelperProviderPort['mode'];
}): HelperAnswer {
  const safeProjection = sanitizeScopedKnowledgeProjection({
    answer: input.answer,
    citations: input.citations.slice(0, 10),
  });
  if (!safeProjection.safe) {
    return helperAnswerSchema.parse({
      answer: STUDENT_CLASS_HELPER_NO_SOURCE,
      source_refs: [],
      citations: [],
      abstained: true,
      safe_reason_code: SCOPED_KNOWLEDGE_UNSAFE_SOURCE_REASON,
      private_question_available: true,
      policy: STUDENT_CLASS_HELPER_POLICY,
      provider_mode: input.providerMode,
      grounding_mode: 'approved_entitled_sections',
    });
  }
  return helperAnswerSchema.parse({
    answer: normalizeAnswer(safeProjection.answer),
    source_refs: safeProjection.sourceRefs.slice(0, 20),
    citations: safeProjection.citations,
    abstained: input.abstained,
    safe_reason_code: input.safeReasonCode,
    private_question_available: true,
    policy: STUDENT_CLASS_HELPER_POLICY,
    provider_mode: input.providerMode,
    grounding_mode: 'approved_entitled_sections',
  });
}

function normalizeAnswer(value: string) {
  const words = value.replaceAll(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const limited = words.slice(0, 450).join(' ');
  return limited.slice(0, 2400) || STUDENT_CLASS_HELPER_NO_SOURCE;
}

function canonicalizeProviderCitations(
  providerCitations: HelperCitation[],
  retrievalCitations: Ot86RetrievalResponse['citations'],
) {
  if (providerCitations.length < 1) return null;
  const allowed = new Map(
    retrievalCitations.map((citation) => [
      citationKey(citation),
      helperCitationSchema.parse(citation),
    ]),
  );
  const seen = new Set<string>();
  const canonical: HelperCitation[] = [];
  for (const citation of providerCitations) {
    const key = citationKey(citation);
    const matched = allowed.get(key);
    if (!matched || seen.has(key)) return null;
    seen.add(key);
    canonical.push(matched);
  }
  return canonical;
}

async function listCurrentEntitledApprovedCitations(
  pool: DbPool,
  actor: PortalActorContext,
  learner: LearnerProfile,
  requested: HelperCitation[],
) {
  const contentIds = [...new Set(requested.map((citation) => citation.content_id))];
  const currentlyEntitledContentIds = new Set(
    await listEntitledApprovedContentIds(pool, actor, learner),
  );
  if (contentIds.some((contentId) => !currentlyEntitledContentIds.has(contentId))) {
    return [];
  }
  const result = await pool.query(
    `SELECT sections.content_id, sections.version_id, sections.section_id,
            sections.title AS section_title, sections.deep_link,
            sections.text_sha256 AS section_sha256
       FROM onetime.ot86_published_content_versions AS versions
       JOIN onetime.ot86_published_sections AS sections
         ON sections.tenant_id = versions.tenant_id
        AND sections.content_id = versions.content_id
        AND sections.version_id = versions.version_id
      WHERE versions.tenant_id = $1
        AND versions.active_state = 'active'
        AND sections.active = true
        AND versions.privacy_json->>'source_scope' = 'approved_rabbi_content'
        AND versions.privacy_json->>'approved_for_student_kb' = 'true'
        AND versions.privacy_json->>'contains_learner_name' = 'false'
        AND versions.privacy_json->>'contains_learner_voice' = 'false'
        AND versions.privacy_json->>'contains_learner_face' = 'false'
        AND versions.privacy_json->>'contains_learner_question' = 'false'
        AND versions.privacy_json->>'contains_private_data' = 'false'
        AND versions.content_id = ANY($2::text[])
      ORDER BY sections.content_id ASC, sections.version_id ASC, sections.section_id ASC
      LIMIT 50`,
    [tenantIdFor(actor), contentIds],
  );
  const current = new Map<string, HelperCitation>();
  for (const row of result.rows) {
    const parsed = helperCitationSchema.safeParse(row);
    if (parsed.success) current.set(citationKey(parsed.data), parsed.data);
  }
  return requested.flatMap((citation) => {
    const currentCitation = current.get(citationKey(citation));
    return currentCitation ? [currentCitation] : [];
  });
}

function citationKey(
  citation: Pick<HelperCitation, 'content_id' | 'version_id' | 'section_id' | 'section_sha256'>,
) {
  return `${citation.content_id}:${citation.version_id}:${citation.section_id}:${citation.section_sha256}`;
}

function questionSafetyReason(question: string) {
  const normalized = ` ${question.toLowerCase().replaceAll(/[^a-z0-9\s]/g, ' ')} `;
  const exactInjectionPatterns = [
    ' ignore previous ',
    ' ignore all ',
    ' system prompt ',
    ' developer message ',
    ' reveal instructions ',
    ' jailbreak ',
    ' act as ',
    ' override policy ',
    ' hidden prompt ',
  ];
  const attemptsInstructionOverride =
    /\b(ignore|disregard|forget|override|bypass|supersede|violate|break|skip)\b/.test(normalized) &&
    /\b(previous|prior|earlier|above|system|developer|instruction|direction|rule|policy|guardrail|prompt)\b/.test(
      normalized,
    );
  const attemptsRoleSwitch =
    /\b(act|pretend|roleplay|behave)\b/.test(normalized) && /\bas\b/.test(normalized);
  if (
    exactInjectionPatterns.some((pattern) => normalized.includes(pattern)) ||
    attemptsInstructionOverride ||
    attemptsRoleSwitch
  ) {
    return 'prompt_injection';
  }
  if (
    [
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
    ].some((pattern) => normalized.includes(pattern))
  ) {
    return 'outside_class_scope';
  }
  return null;
}

function safeProviderReasonCode(value: string) {
  return new Set([
    'supported_by_approved_section',
    'provider_answer_grounded',
    'provider_off_approved_source_fallback',
  ]).has(value)
    ? value
    : 'provider_reason_redacted';
}

function providerAnswerIsGrounded(providerAnswer: string, retrievalAnswer: string) {
  const normalizedProvider = providerAnswer.replaceAll(/\s+/g, ' ').trim();
  const normalizedRetrieval = retrievalAnswer.replaceAll(/\s+/g, ' ').trim();
  return (
    normalizedProvider.length > 0 &&
    (normalizedProvider === normalizedRetrieval || normalizedRetrieval.includes(normalizedProvider))
  );
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
